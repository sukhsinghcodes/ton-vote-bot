import { Context, Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import { CallbackQuery, Update } from 'telegraf/typings/core/types/typegram';
import { Database } from './db';
import * as api from './api';
import { tonVoteUrl } from './config';
import { convertArrayTo2dArray } from './utils';

dotenv.config();

const bot = new Telegraf<Context<Update>>(process.env.BOT_TOKEN as string);
const db = new Database();

enum Actions {
  AddDAOAddress = 'add',
  RemoveDAOAddress = 'rm',
}

bot.start(async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type !== 'private') {
    // Handle start for group chats

    // ctx.sendMessage(
    //   'Thanks for adding me to your group. I will now send you alerts for new proposals in the DAOs you have subscribed to.',
    //   Markup.inlineKeyboard([
    //     Markup.button.url(
    //       'Open TON Vote',
    //       'https://t.me/sukhtonvotebot/sukhTONvote?startapp=command',
    //     ),
    //   ]),
    // );

    return;
  }

  // Handle start for private chats
  ctx.sendMessage(
    'Welcome to TON Vote Bot. I will send you alerts for new proposals in the DAOs you have subscribed to.\n\n- To subscribe to a DAO, send /set and follow the instructions.\n- To unsubscribe from a DAO, send /remove and follow the instructions.\n- To view the DAOs you are subscribed to, send /list.\n\nFor more information, send /help.',
    Markup.inlineKeyboard([Markup.button.webApp('Open TON Vote', tonVoteUrl)]),
  );
});

bot.command('list', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return;
  }

  // Handle cmd list
  try {
    const subscriptions = await db.getAllByChatId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions. Add a new DAO using the /set command.');
      return;
    }

    const buttons = subscriptions.map((item) =>
      Markup.button.webApp(item.daoName, `${tonVoteUrl}/${item.daoAddress}`),
    );

    await ctx.reply('You are subscribed to the following DAOs:', Markup.inlineKeyboard(buttons));
  } catch (err) {
    console.log('An error occured when executing the list command', err);
  }
});

bot.command('set', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return;
  }

  // Handle cmd set
  try {
    const daos = await api.daos();

    const buttons = daos.map((item) =>
      Markup.button.callback(
        JSON.parse(item.daoMetadata.metadataArgs.name).en,
        `${Actions.AddDAOAddress}:${item.daoAddress}`,
      ),
    );

    const buttonsTable = convertArrayTo2dArray(buttons, 2);

    await ctx.reply(
      'Select the DAO address you want to subscribe to:',
      Markup.inlineKeyboard(buttonsTable),
    );
  } catch (err) {
    console.log('An error occured when executing the set command', err);
  }
});

bot.action(/^add:/g, async (ctx) => {
  if (!ctx.callbackQuery) {
    ctx.answerCbQuery(`No DAO address`, { show_alert: true });
  }

  const chatId = ctx.callbackQuery.message?.chat.id;
  const daoAddress = (ctx.callbackQuery as CallbackQuery.DataQuery).data.split(':')[1];
  const subscriptionId = `${chatId}:${daoAddress}`;

  try {
    if (!ctx.chat) {
      throw new Error();
    }

    const dao = await api.dao(daoAddress);
    console.log(dao);
    await db.insert({
      chatId: ctx.chat.id,
      daoAddress: dao.address,
      daoName: dao.name,
      id: subscriptionId,
    });

    ctx.answerCbQuery(`You have subscribed to ${dao.name}`, { show_alert: true });
    ctx.deleteMessage();
  } catch (err) {
    ctx.answerCbQuery(`There was an error when subscribing to ${daoAddress}`, { show_alert: true });
  }
});

bot.command('remove', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return;
  }

  // Handle cmd remove
  try {
    const subscriptions = await db.getAllByChatId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('The list is empty. Add a new DAO using the /set command.');
      return;
    }

    const buttons = subscriptions.map((item) =>
      Markup.button.callback(item.daoName, `rm:${item.daoAddress}`),
    );

    const buttonsTable = convertArrayTo2dArray(buttons, 2);

    console.log(buttonsTable);

    await ctx.reply(
      'Click on the DAO from the list below to remove:',
      Markup.inlineKeyboard(buttonsTable),
    );
  } catch (err) {
    console.log('An error occured when executing the remove command', err);
  }
});

bot.action(/^rm:/g, async (ctx: Context) => {
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

const dailyReportScheduler = new CronJob('0 0 0 * * *', async () => {
  // Your post_info_proposals_daily logic here
  console.log('Running dailyReportScheduler');

  const subscriptions = await db.getAll();

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

    const activeProposals: api.ProposalMetadata[] = [];
    const pendingProposals: api.ProposalMetadata[] = [];

    proposals.forEach((proposal) => {
      const nowUnixInSeconds = Math.floor(Date.now() / 1000);

      if (nowUnixInSeconds < proposal.proposalStartTime) {
        pendingProposals.push(proposal);
        return;
      }

      activeProposals.push(proposal);
    });

    bot.telegram.sendMessage(
      subscription.chatId,
      `Daily report for *${dao.name}*\n\nActive proposals:\n${
        pendingProposals.length > 0
          ? activeProposals
              .map(
                (p) =>
                  `- [${p.title}](${tonVoteUrl}/${p.daoAddress}/proposal/${p.address}): ✅ Yes ${
                    p.yes || 0
                  }, ❌ No ${p.no || 0}, 🤐 Abstain ${p.abstain || 0}`,
              )
              .join('\n')
          : '_No active proposals_'
      }\n\nPending proposals:\n${
        pendingProposals.length > 0
          ? pendingProposals
              .map((p) => `- [${p.title}](${tonVoteUrl}/${p.daoAddress}/proposal/${p.address})`)
              .join('\n')
          : '_No pending proposals_'
      }`,
      {
        parse_mode: 'Markdown',
      },
    );
  }
});

// const proposalSchedular = new CronJob('0 */1 * * * *', async () => {
//   // Your post_new_proposal logic here
//   console.log('Running proposalSchedular');
// });

// Start the bot and schedulers
bot.launch();
dailyReportScheduler.start();

console.log('TON vote Bot started...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
