import { Context, Markup, Telegraf } from 'telegraf';
import { CronJob } from 'cron';
import { CallbackQuery, Message, Update } from 'telegraf/typings/core/types/typegram';
import { Database } from './db';
import { appConfig } from './config';
import { convertArrayTo2dArray } from './utils';
import { WebAppDataSubscribe } from './types';
import { getDaoReportMessages } from './messages';

const bot = new Telegraf<Context<Update>>(process.env.BOT_TOKEN as string);
const db = new Database();

bot.start(async (ctx) => {
  const { chat } = ctx.message;

  if (chat.type === 'private') {
    return;
  }

  // Handle start for group chats
  ctx.sendMessage(
    'Thanks for adding me to your group. To view proposals please open TON Vote.',
    Markup.inlineKeyboard([
      Markup.button.url('Open TON Vote', appConfig.getGroupLaunchWebAppUrl(ctx.botInfo.username)),
    ]),
  );

  const admins = await ctx.getChatAdministrators();
  const isAdmin = admins.some((admin) => admin.user.id === ctx.from.id);

  if (isAdmin) {
    console.log('button url', `${appConfig.subscribeUrl}&groupId=${chat.id}`);

    ctx.telegram.sendMessage(
      ctx.from.id,
      `Subscribe your group, *${chat.title}*, to a DAO to receive notifications about proposals:`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.keyboard([
          Markup.button.webApp('Subscribe', `${appConfig.subscribeUrl}&groupId=${chat.id}`),
        ]).reply_markup,
      },
    );
  }
});

bot.command('subscribe', async (ctx) => {
  // subscribe is triggered from a group chat but confirmed in a private chat
  const { chat } = ctx.message;

  if (chat.type === 'private') {
    ctx.sendMessage('Use the subscribe command in the group chat you want to subscribe to.');
    return;
  }

  const admins = await ctx.getChatAdministrators();
  const isAdmin = admins.some((admin) => admin.user.id === ctx.from.id);

  if (isAdmin) {
    console.log('button url', `${appConfig.subscribeUrl}&groupId=${chat.id}`);

    ctx.telegram.sendMessage(
      ctx.from.id,
      `Subscribe your group, *${chat.title}*, to a DAO to receive notifications about proposals:`,
      {
        parse_mode: 'Markdown',
        reply_markup: Markup.keyboard([
          Markup.button.webApp('Subscribe', `${appConfig.subscribeUrl}&groupId=${chat.id}`),
        ]).resize().reply_markup,
      },
    );
  } else {
    ctx.sendMessage('You must be an admin to use this command.');
  }
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

bot.command('report', async (ctx) => {
  const { chat } = ctx.message;
  if (chat.type === 'private') {
    return;
  }

  // Handle cmd report
  try {
    const subscriptions = await db.getAllByGroupId(ctx.chat.id);

    if (!subscriptions.length) {
      await ctx.reply('You have no subscriptions. To subscribe, use the /subscribe command.');
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

    ctx.reply(`You have subscribed to ${data.name}`);
  } catch (err) {
    console.log('An error occured when subscribing', err);
  }
});

const dailyReportScheduler = new CronJob('0 0 12 * * *', async () => {
  // Your post_info_proposals_daily logic here
  console.log('Running dailyReportScheduler...');

  const subscriptions = await db.getAll();

  const messages = await getDaoReportMessages(subscriptions);

  messages.forEach(({ groupId, message }) => {
    bot.telegram.sendMessage(groupId, message, {
      parse_mode: 'Markdown',
    });
  });
});

// const proposalSchedular = new CronJob('0 */1 * * * *', async () => {
//   // Your post_new_proposal logic here
//   console.log('Running proposalSchedular');
// });

bot.telegram.setMyCommands([
  { command: 'start', description: 'Welcome to TON Vote' },
  { command: 'list', description: 'List all DAOs you are subscribed to' },
  { command: 'subscribe', description: 'Subscribe to a DAO' },
  { command: 'unsubscribe', description: 'Unsubscribe from a DAO' },
  { command: 'report', description: "Get a report of the DAOs you're subscribed to" },
]);

// Start the bot and schedulers
bot.launch();
dailyReportScheduler.start();

console.log('TON vote Bot started...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
