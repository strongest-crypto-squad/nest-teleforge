export function makeMenuCtx(chatId = 1, cbData?: string) {
  const sent: any[] = [];
  const edited: any[] = [];
  const answered: string[] = [];

  const ctx: any = {
    chat: { id: chatId },
    from: { id: chatId, username: "tester" },
    update: cbData
      ? { callback_query: { data: cbData, message: { message_id: 1 } } }
      : {},
    reply: jest.fn(async (text: string, opts?: any) => {
      sent.push({ text, ...opts });
    }),
    editMessageText: jest.fn(async (text: string, opts?: any) => {
      edited.push({ text, ...opts });
    }),
    answerCbQuery: jest.fn(async (text?: string) => {
      answered.push(text ?? "");
    }),
  };

  return { ctx, sent, edited, answered };
}

export const runWithChat = async <T>(fn: () => Promise<T>) => fn();

export function kbLabels(callArgs: any[]): string[] {
  const opts = callArgs[1];
  return opts.reply_markup.inline_keyboard.flat().map((b: any) => b.text);
}

export function findBtn(callArgs: any[], text: string) {
  const opts = callArgs[1];
  return opts.reply_markup.inline_keyboard
    .flat()
    .find((b: any) => b.text === text);
}
