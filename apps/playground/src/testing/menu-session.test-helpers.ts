export function makeMenuCtx(chatId = 1, cbData?: string) {
  const ctx: any = {
    chat: { id: chatId },
    from: { id: chatId, username: "tester" },
    update: cbData
      ? { callback_query: { data: cbData, message: { message_id: 1 } } }
      : {},
    reply: jest.fn(async () => {}),
    editMessageText: jest.fn(async () => {}),
    answerCbQuery: jest.fn(async () => {}),
  };
  return ctx;
}

export const runWithChat = async <T>(fn: () => Promise<T>) => fn();

export function lastEdit(ctx: any) {
  const calls = (ctx.editMessageText as jest.Mock).mock.calls;
  return calls[calls.length - 1];
}

export function lastReply(ctx: any) {
  const calls = (ctx.reply as jest.Mock).mock.calls;
  return calls[calls.length - 1];
}

export function lastKb(ctx: any) {
  const edit = lastEdit(ctx);
  if (edit) return edit[1]?.reply_markup?.inline_keyboard;
  const reply = lastReply(ctx);
  return reply?.[1]?.reply_markup?.inline_keyboard;
}

export function findBtn(kb: any[][], text: string) {
  return kb.flat().find((b: any) => b.text === text);
}
