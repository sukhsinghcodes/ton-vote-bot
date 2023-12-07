import { Context } from 'telegraf';
import { Chat } from 'telegraf/typings/core/types/typegram';
import { SubscribeMessages } from './messages';

export async function subscribe(chat: Chat, ctx: Context, fromId: number) {
  try {
    if (chat.type === 'private') {
      return;
    }

    const admins = await ctx.getChatAdministrators();
    const isAdmin = admins.some((admin) => admin.user.id === fromId);

    if (isAdmin) {
      await ctx.telegram.sendMessage(fromId, SubscribeMessages.start(chat.title), {
        parse_mode: 'Markdown',
        reply_markup: SubscribeMessages.buttonReplyMarkup(chat.id),
      });
    } else {
      await ctx.telegram.sendMessage(fromId, SubscribeMessages.notAdmin(chat.title));
    }
  } catch (err) {
    console.log(err);
  }
}
