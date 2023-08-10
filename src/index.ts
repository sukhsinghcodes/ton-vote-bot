import { Context, Markup, Telegraf } from 'telegraf';
import dotenv from 'dotenv';
import { CronJob } from 'cron';
import * as sqlite3 from 'sqlite3';
import * as api from './api';
import { CallbackQuery, Update } from 'telegraf/typings/core/types/typegram';

dotenv.config()



const bot = new Telegraf<Context<Update>> (process.env.BOT_TOKEN as string);
const db = new sqlite3.Database('database.db');

enum Actions {
  AddDAOAddress = 'AddDAOAddress',
  RemoveDAOAddress = 'RemoveDAOAddress'
}

const scheduler = new CronJob('0 */1 * * * *', async () => {
  // Your post_new_proposal logic here
  console.log('Running post_new_proposal');
});

const infoScheduler = new CronJob('0 0 0 * * *', async () => {
  // Your post_info_proposals_daily logic here
  console.log('Running post_info_proposals_daily');
});

bot.start(async (ctx) => {
  const { chat, from } = ctx.message;
  if (chat.type !== 'private') {
    // Handle start for group chats

    ctx.sendMessage('Thanks for adding me to your group. I will now send you alerts for new proposals in the DAOs you have subscribed to.', Markup.inlineKeyboard([
      Markup.button.url('Open TON Vote', 'https://t.me/sukhtonvotebot/sukhTONvote?startapp=command'),
    ]));

    return 
  }

  // Handle start for private chats
  ctx.sendMessage('Welcome to TON Vote Bot. I will send you alerts for new proposals in the DAOs you have subscribed to.\n\n- To subscribe to a DAO, send /set and follow the instructions.\nTo unsubscribe from a DAO, send /remove and follow the instructions.\nTo view the DAOs you are subscribed to, send /list.\n\nFor more information, send /help.', 
    Markup.inlineKeyboard([
      Markup.button.webApp('View DAOs', 'https://frolicking-custard-23f51e.netlify.app/'),
    ])
  );

});

bot.command('set', (ctx) => {
  const { chat, from } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return 
  }

  // Handle cmd set

});

bot.command('list', (ctx) => {
  const { chat, from } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return
  }

  // Handle cmd list
});

bot.command('remove', (ctx) => {
  const { chat, from } = ctx.message;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    return
  }

  // Handle cmd remove
});

bot.action(Actions.AddDAOAddress, async (ctx) => {
  // Handle button action for adding DAO to alerts

});

bot.action(Actions.RemoveDAOAddress, async (ctx: Context & { callbackQuery: CallbackQuery }) => {
  // Handle button action for removing DAO from alerts

  const callbackData = ctx.callbackQuery.message; // The address of the DAO that needs to be deleted is stored

  const nameResult = await new Promise<any[]>((resolve, reject) => {
    db.all(`SELECT name_dao FROM DAOs WHERE dao_address = ?`, [callbackData], (err, rows) => {
      if (err) {
        reject(err);
      } else {
        resolve(rows);
      }
    });
  });

  if (nameResult.length > 0) {
    const name = nameResult[0].name_dao; // The name of the selected DAO for deletion is stored

    db.run(`DELETE FROM DAOs WHERE dao_address = ?`, [callbackData], async (err) => {
      if (err) {
        console.error(err);
      } else {
        // Deleted successfully
        ctx.answerCbQuery(`You have removed the DAO named *${name}*`, {show_alert: true});
        ctx.deleteMessage();

        await ctx.leaveChat();
      }
    });
  } else {
    ctx.answerCbQuery(`Could not find DAO with the specified address.`, {show_alert: true});
  }  

});


bot.on('text', async (ctx) => {
  const { chat, from, message } = ctx;
  if (chat.type === 'group' || chat.type === 'supergroup') {
    if (message.text && message.reply_to_message && message.reply_to_message?.from?.id === ctx.botInfo.id) {
      // Handle handle_message logic
    }
  }
});

// Start the bot and scheduler
bot.launch();
scheduler.start();
infoScheduler.start();
console.log('TON vote Bot started...');

process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
