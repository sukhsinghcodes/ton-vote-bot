import { Context, Markup, Telegraf } from 'telegraf';
import { CronJob } from 'cron';
import { CallbackQuery, Message, Update } from 'telegraf/typings/core/types/typegram';
import { Database } from './db';
import { appConfig, directLinkKeys, messageVideoUrl } from './config';
import { WebAppDataSubscribe } from './types';
import {
  getDaoReportMessages,
  getNewProposalMessage,
  getVoteEndedMessage,
  getVoteStartedMessage,
} from './messages';
import * as api from './api';
import { subscribe } from './commands';

const bot = new Telegraf<Context<Update>>(appConfig.apiToken);
const db = new Database();

bot.start(async (ctx) => {
  try {
    const { chat } = ctx.message;

    if (chat.type === 'private') {
      ctx.sendMessage(
        `*Let's get started*\n\nPlease tap below to start voting in your favorite DAOs.\n\nGroup admins - Add this bot to your group to subscribe to notifications about your DAO`,
        {
          parse_mode: 'Markdown',
          reply_markup: Markup.inlineKeyboard([
            Markup.button.webApp('Open TON Vote', appConfig.twaUrl),
          ]).reply_markup,
        },
      );
      return;
    }
  } catch (err) {
    console.log('An error occured when executing the start command', err);
  }
});

bot.action('subscribe', async (ctx) => {
  const chat = ctx.callbackQuery?.message?.chat;

  if (!chat) {
    return;
  }

  await subscribe(chat, ctx, ctx.callbackQuery?.from.id);

  ctx.deleteMessage();
});

bot.command('admin', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'private') {
    return;
  }

  try {
    const admins = await ctx.getChatAdministrators();
    const isAdmin = admins.some((admin) => admin.user.id === ctx.from.id);

    if (!isAdmin) {
      return;
    }

    const subscriptions = await db.getAllByGroupId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('This group has no subscriptions on TON Vote.');
      return;
    }

    const buttons = subscriptions.map((item) => [
      Markup.button.url(
        item.daoName,

        appConfig.getGroupLaunchWebAppUrl(
          ctx.botInfo.username,
          `${directLinkKeys.dao}${item.daoAddress}`,
        ),
      ),
      Markup.button.callback('🗑️', `rm:${item.daoAddress}`),
    ]);

    buttons.push([Markup.button.callback('🪄 Subscribe', 'subscribe')]);
    buttons.push([Markup.button.callback('📊 Report', 'report')]);
    buttons.push([Markup.button.callback('❌ Close', 'close')]);

    await ctx.reply(
      `Manage the TON Vote subscriptions for this group.\n\n- Add/remove subscriptions\n- View a report of your subscriptions`,
      {
        reply_markup: Markup.inlineKeyboard(buttons).reply_markup,
        parse_mode: 'Markdown',
      },
    );
  } catch (err) {
    console.log('An error occured when executing the list command', err);
  }
});

bot.action('close', async (ctx) => {
  ctx.deleteMessage();
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

bot.action('report', async (ctx) => {
  const chat = ctx.callbackQuery?.message?.chat;

  if (!chat) {
    return;
  }

  if (chat.type === 'private') {
    return;
  }

  // Handle cmd report
  try {
    const subscriptions = await db.getAllByGroupId(chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions.');
      return;
    }

    const messages = await getDaoReportMessages(subscriptions, bot.botInfo?.username || '');

    if (!messages.length) {
      await ctx.reply('There are no active or upcoming proposals for your subscriptions.');
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

    ctx.deleteMessage();
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

    const groupChat = await bot.telegram.getChat(data.groupId);

    if (groupChat.type === 'private') {
      return;
    }

    ctx.reply(`Group *${groupChat.title}* is now subscribed to space *${data.name}* ✅`, {
      parse_mode: 'Markdown',
    });
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
      // clear by group id
      await db.clearProposalsByGroupId(ctx.chat.id);
      await db.clearSubscriptionsByGroupId(ctx.chat.id);
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
        const proposal = await db.containsReadProposal(p.address, subscription.groupId);
        if (proposal) {
          continue;
        }

        if (nowUnixInSeconds < startTime) {
          try {
            await bot.telegram.sendVideo(subscription.groupId, messageVideoUrl, {
              caption: getNewProposalMessage({
                daoName: dao.name,
                proposalTitle: p.title,
                proposalDescription: p.description,
                startTime,
                endTime,
              }),

              reply_markup: Markup.inlineKeyboard([
                Markup.button.url(
                  '📬   View proposal',
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
                  caption: getVoteStartedMessage({
                    daoName: dao.name,
                    proposalTitle: p.title,
                    proposalDescription: p.description,
                  }),

                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      '✍🏻 Vote now',
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
                  caption: getVoteEndedMessage({
                    daoName: dao.name,
                    proposalTitle: p.title,
                    proposalDescription: p.description,
                    results: {
                      yes: p.yes || 0,
                      no: p.no || 0,
                      abstain: p.abstain || 0,
                    },
                  }),
                  reply_markup: Markup.inlineKeyboard([
                    Markup.button.url(
                      '📊 View results',
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

        await db.insertReadProposal(p.address, subscription.groupId);
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
