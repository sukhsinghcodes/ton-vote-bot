import { Context, Markup, Telegraf } from 'telegraf';
import { CronJob } from 'cron';
import { CallbackQuery, Message, Update } from 'telegraf/typings/core/types/typegram';
import { Database } from './db';
import { appConfig } from './config';
import { convertArrayTo2dArray } from './utils';
import { WebAppDataSubscribe } from './types';
import { getDaoReportMessages } from './messages';
import * as api from './api';
import { subscribe } from './commands';

const bot = new Telegraf<Context<Update>>(appConfig.apiToken);
const db = new Database();

bot.start(async (ctx) => {
  try {
    const { chat } = ctx.message;

    if (chat.type === 'private') {
      ctx.sendMessage('To get started, add me to a group.');
      return;
    }
  } catch (err) {
    console.log('An error occured when executing the start command', err);
  }
});

bot.command('subscribe', async (ctx) => {
  subscribe(ctx.message.chat, ctx, ctx.message.from.id);
});

bot.action('subscribe', async (ctx) => {
  const chat = ctx.callbackQuery?.message?.chat;

  if (!chat) {
    return;
  }

  subscribe(chat, ctx, ctx.callbackQuery?.from.id);
});

bot.command('list', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'private') {
    return;
  }

  // Handle cmd list
  try {
    const subscriptions = await db.getAllByGroupId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions.');
      return;
    }

    const list = subscriptions
      .map((item) => `- [${item.daoName}](${appConfig.tonVoteUrl}/${item.daoAddress})`)
      .join('\n');

    await ctx.reply(`This group is subscribed to the following DAOs:\n${list}`, {
      reply_markup: Markup.inlineKeyboard([
        Markup.button.url('Open TON Vote', appConfig.getGroupLaunchWebAppUrl(ctx.botInfo.username)),
      ]).reply_markup,
      parse_mode: 'Markdown',
    });
  } catch (err) {
    console.log('An error occured when executing the list command', err);
  }
});

bot.command('unsubscribe', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'private') {
    return;
  }

  // Handle cmd unsubscribe
  try {
    const subscriptions = await db.getAllByGroupId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions. To subscribe, use the /subscribe command.');
      return;
    }

    const buttons = subscriptions.map((item) =>
      Markup.button.callback(item.daoName, `rm:${item.daoAddress}`),
    );

    const buttonsTable = convertArrayTo2dArray(buttons, 2);

    await ctx.reply(
      'Click on the DAO from the list below to unsubscribe:',
      Markup.inlineKeyboard(buttonsTable),
    );
  } catch (err) {
    console.log('An error occured when executing the unsubscribe command', err);
  }
});

bot.action(/^rm:/g, async (ctx) => {
  // Handle button action for removing DAO subscriptions
  try {
    if (!ctx.callbackQuery) {
      throw new Error();
    }

    const chatId = ctx.callbackQuery.message?.chat.id;
    const daoAddress = (ctx.callbackQuery as CallbackQuery.DataQuery).data.split(':')[1];
    const subscriptionId = `${chatId}:${daoAddress}`;

    const { daoName } = await db.get(subscriptionId);
    await db.delete(subscriptionId);

    ctx.answerCbQuery(`You have unsubscribed from ${daoName}`, { show_alert: true });
    ctx.deleteMessage();
  } catch (err) {
    ctx.answerCbQuery(`Could not find DAO with the specified address.`, { show_alert: true });
  }
});

bot.command('report', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'private') {
    return;
  }

  // Handle cmd report
  try {
    const subscriptions = await db.getAllByGroupId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions.');
      return;
    }

    const messages = await getDaoReportMessages(subscriptions);

    if (!messages.length) {
      await ctx.reply('There are no active or pending proposals for your subscriptions.');
      return;
    }

    messages.forEach(({ message }) => {
      ctx.sendMessage(message, {
        parse_mode: 'Markdown',
      });
    });
  } catch (err) {
    console.log('An error occured when executing the report command', err);
  }
});

bot.on('message', async (ctx) => {
  try {
    const { chat } = ctx.message;

    const message = ctx.update.message as Message.WebAppDataMessage;

    console.log('Received web app data', message.web_app_data);

    if (!message.web_app_data) {
      return;
    }

    const data: WebAppDataSubscribe = JSON.parse(message.web_app_data.data);

    await db.insert({
      groupId: data.groupId,
      userId: chat.id,
      daoAddress: data.address,
      daoName: data.name,
    });

    ctx.reply(`You have subscribed to ${data.name} ✅`);
  } catch (err) {
    console.log('An error occured when subscribing', err);
  }
});

bot.on('my_chat_member', async (ctx) => {
  if (
    ctx.update.my_chat_member.new_chat_member.user.id === bot.botInfo?.id &&
    ctx.update.my_chat_member.new_chat_member.status !== 'member'
  ) {
    return;
  }

  subscribe(ctx.chat, ctx, ctx.update.my_chat_member.from.id);
});

const dailyReportScheduler = new CronJob('0 0 12 * * *', async () => {
  // Your post_info_proposals_daily logic here
  console.log('Running dailyReportScheduler...');

  const subscriptions = await db.getAll();

  const messages = await getDaoReportMessages(subscriptions);

  messages.forEach(({ groupId, message }) => {
    try {
      bot.telegram.sendMessage(groupId, message, {
        parse_mode: 'Markdown',
      });
    } catch (err) {
      console.log('An error occured when sending daily report', err);
    }
  });
});

const proposalScheduler = new CronJob('0 */1 * * * *', async () => {
  // Your post_new_proposal logic here
  console.log('Running proposalScheduler');

  const subscriptions = await db.getAll();

  try {
    for (const subscription of subscriptions) {
      const { daoAddress } = subscription;

      const dao = await api.dao(daoAddress);

      if (!dao) {
        continue;
      }

      const results = await Promise.allSettled(
        dao.daoProposals.map((proposalAddress) => api.proposal(proposalAddress)),
      );

      const proposals = results
        .filter((p) => p.status === 'fulfilled')
        .map((p) => (p as PromiseFulfilledResult<api.ProposalMetadata>).value);

      for (const p of proposals) {
        const nowUnixInSeconds = Date.now();
        const startTime = p.proposalStartTime * 1000;
        const endTime = p.proposalEndTime * 1000;

        // Check if proposal already exists
        const proposal = await db.containsReadProposal(p.address);
        if (proposal) {
          continue;
        }

        if (nowUnixInSeconds < startTime) {
          bot.telegram.sendMessage(
            subscription.groupId,
            `New proposal for *${dao.name}*\n\n*${p.title}*\n${
              p.description
            }\n\nStarts on: ${new Date(startTime).toLocaleString()}\nEnds on: ${new Date(
              endTime,
            ).toLocaleString()}`,
            {
              reply_markup: Markup.inlineKeyboard([
                Markup.button.url(
                  'View propsal',
                  `${appConfig.tonVoteUrl}/${daoAddress}/proposal/${p.address}`,
                ),
              ]).reply_markup,
              parse_mode: 'Markdown',
            },
          );

          // set cron job for proposal start
          new CronJob(
            new Date(startTime),
            async () => {
              bot.telegram.sendMessage(
                subscription.groupId,
                `Proposal for *${dao.name}* has started!\n\n*${p.title}*\n${p.description}`,
                {
                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      'Vote now',
                      `${appConfig.tonVoteUrl}/${daoAddress}/proposal/${p.address}`,
                    ),
                  ]).reply_markup,
                  parse_mode: 'Markdown',
                },
              );
            },
            null,
            true,
          );
        }

        if (nowUnixInSeconds < endTime) {
          // set cron job for proposal end
          new CronJob(
            new Date(endTime),
            async () => {
              bot.telegram.sendMessage(
                subscription.groupId,
                `Proposal for *${dao.name}* has ended!\n\n*${p.title}*\n${
                  p.description
                }\n\n*Results*\nYes: ${p.yes || 0}\nNo: ${p.no || 0}\nAbstain: ${p.abstain || 0}`,
                {
                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      'View results',
                      `${appConfig.tonVoteUrl}/${daoAddress}/proposal/${p.address}`,
                    ),
                  ]).reply_markup,
                  parse_mode: 'Markdown',
                },
              );
            },
            null,
            true,
          );
        }

        await db.insertReadProposal(p.address);
        console.log(`added proposal(${p.address}) to read proposals`);
      }
    }
  } catch (e) {
    console.log(e);
  }
});

// Start the bot and schedulers
bot.launch();
dailyReportScheduler.start();
proposalScheduler.start();

console.log('TON vote Bot started...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

async function clearProposals() {
  if (process.env.CLEAR_PROPOSALS) {
    await db.clearProposals();
    console.log('Cleared proposals!');
  }
}
clearProposals();
