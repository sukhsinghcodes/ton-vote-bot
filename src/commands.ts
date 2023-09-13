import { Context } from 'telegraf';
import { Chat } from 'telegraf/typings/core/types/typegram';
import { SubscribeMessages } from './messages';

export async function subscribe(chat: Chat, ctx: Context, fromId: number) {
  try {
    if (chat.type === 'private') {
      ctx.sendMessage(SubscribeMessages.private);
      return;
    }

    const admins = await ctx.getChatAdministrators();
    const isAdmin = admins.some((admin) => admin.user.id === fromId);

    if (isAdmin) {
      ctx.telegram.sendMessage(fromId, SubscribeMessages.success(chat.title), {
        parse_mode: 'Markdown',
        reply_markup: SubscribeMessages.buttonReplyMarkup(chat.id),
      });
    } else {
      ctx.sendMessage(SubscribeMessages.notAdmin);
    }
  } catch (err) {
    console.log(err);
  }
}
