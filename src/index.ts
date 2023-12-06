import { Context, Markup, Telegraf } from 'telegraf';
import { CronJob } from 'cron';
import { CallbackQuery, Message, Update } from 'telegraf/typings/core/types/typegram';
import { Database } from './db';
import { appConfig, directLinkKeys, messageVideoUrl } from './config';
import { convertArrayToTable, formateDateTime, truncate } from './utils';
import { WebAppDataSubscribe } from './types';
import { getDaoReportMessages } from './messages';
import * as api from './api';
import { subscribe } from './commands';
import sanitizeHtml from 'sanitize-html';

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

    const buttons = subscriptions.map((item) =>
      Markup.button.url(
        item.daoName,

        appConfig.getGroupLaunchWebAppUrl(
          ctx.botInfo.username,
          `${directLinkKeys.dao}${item.daoAddress}`,
        ),
      ),
    );

    const buttonsTable = convertArrayToTable(buttons, 2);

    await ctx.reply(`This group is subscribed to the following DAOs:`, {
      reply_markup: Markup.inlineKeyboard(buttonsTable).reply_markup,
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

    const buttonsTable = convertArrayToTable(buttons, 2);

    await ctx.reply(
      'Select the DAO you want to unsubscribe from:',
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

    const messages = await getDaoReportMessages(subscriptions, bot.botInfo?.username || '');

    if (!messages.length) {
      await ctx.reply('There are no active or pending proposals for your subscriptions.');
      return;
    }

    let messageToSend = '';
    messages.forEach(({ message }) => {
      messageToSend += message;
    });

    await ctx.sendVideo(messageVideoUrl, {
      caption: messageToSend,
      parse_mode: 'Markdown',
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

    ctx.reply(`You have subscribed to *${data.name}* ✅`, { parse_mode: 'MarkdownV2' });
  } catch (err) {
    console.log('An error occured when subscribing', err);
  }
});

bot.on('my_chat_member', async (ctx) => {
  if (ctx.update.my_chat_member.new_chat_member.user.id !== bot.botInfo?.id) {
    return;
  }

  if (
    ctx.update.my_chat_member.new_chat_member.status === 'kicked' ||
    ctx.update.my_chat_member.new_chat_member.status === 'left'
  ) {
    try {
      await db.clearProposals();
      console.log('Cleared proposals!');
      await db.clearSubscriptions();
      console.log('Cleared subscriptions!');
    } catch (err) {
      console.log('An error occured when clearing db', err);
    }
    return;
  }

  if (ctx.update.my_chat_member.new_chat_member.status !== 'member') {
    return;
  }

  subscribe(ctx.chat, ctx, ctx.update.my_chat_member.from.id);
});

const dailyReportScheduler = new CronJob('0 0 12 * * *', async () => {
  // Your post_info_proposals_daily logic here
  console.log('Running dailyReportScheduler...');

  const subscriptions = await db.getAll();

  const messages = await getDaoReportMessages(subscriptions, bot.botInfo?.username || '');

  messages.forEach(async ({ groupId, message }) => {
    try {
      await bot.telegram.sendVideo(groupId, messageVideoUrl, {
        caption: message,
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
          try {
            await bot.telegram.sendVideo(subscription.groupId, messageVideoUrl, {
              caption: `🎉 *NEW PROPOSAL*\n\nDAO: *${dao.name}*\n\n*${p.title}*\n${truncate(
                sanitizeHtml(p.description),
                30,
              )}\n\nStarts on: ${formateDateTime(new Date(startTime))}\nEnds on: ${formateDateTime(
                new Date(endTime),
              )}`,

              reply_markup: Markup.inlineKeyboard([
                Markup.button.url(
                  'View proposal',
                  appConfig.getGroupLaunchWebAppUrl(
                    bot.botInfo?.username || '',
                    `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
                  ),
                ),
              ]).reply_markup,
              parse_mode: 'Markdown',
            });
          } catch (err) {
            console.log('An error occured when sending new proposal message', err);
          }

          // set cron job for proposal start
          new CronJob(
            new Date(startTime),
            async () => {
              try {
                await bot.telegram.sendVideo(subscription.groupId, messageVideoUrl, {
                  caption: `⏳ *VOTING STARTED*\n\nDAO: *${dao.name}*\n\n*${p.title}*\n${truncate(
                    sanitizeHtml(p.description),
                    30,
                  )}`,

                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      'Vote now',
                      appConfig.getGroupLaunchWebAppUrl(
                        bot.botInfo?.username || '',
                        `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
                      ),
                    ),
                  ]).reply_markup,
                  parse_mode: 'Markdown',
                });
              } catch (err) {
                console.log('An error occured when sending proposal start message', err);
              }
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
              try {
                await bot.telegram.sendVideo(subscription.groupId, messageVideoUrl, {
                  caption: `🏁 *VOTING ENDED*\n\nDAO: *${dao.name}*\n\n*${p.title}*\n${truncate(
                    sanitizeHtml(p.description),
                    30,
                  )}\n\n*Results*\n✅ Yes: *${p.yes || 0}*\n❌ No: *${p.no || 0}*\n🤐 Abstain: *${
                    p.abstain || 0
                  }*`,
                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      'View proposal',
                      appConfig.getGroupLaunchWebAppUrl(
                        bot.botInfo?.username || '',
                        `${directLinkKeys.dao}${daoAddress}${directLinkKeys.separator}${directLinkKeys.proposal}${p.address}`,
                      ),
                    ),
                  ]).reply_markup,
                  parse_mode: 'Markdown',
                });
              } catch (err) {
                console.log('An error occured when sending proposal start message', err);
              }
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

async function clearDb() {
  try {
    if (process.env.CLEAR_PROPOSALS || process.env.CLEAR_SUBS) {
      await db.clearProposals();
      console.log('Cleared proposals!');
    }

    if (process.env.CLEAR_SUBS) {
      await db.clearSubscriptions();
      console.log('Cleared subscriptions!');
    }
  } catch (err) {
    console.log('An error occured when clearing db', err);
  }
}

clearDb();
