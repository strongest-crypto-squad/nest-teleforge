export async function waitForOutgoingSendMessage(
  sendSpy: { mock: { calls: unknown[][] } },
  chatId: number,
  textPart: string,
  timeoutMs: number,
) {
  const started = Date.now();

  while (Date.now() - started < timeoutMs) {
    for (const args of sendSpy.mock.calls) {
      const [chatIdArg, textArg] = args;
      if (Number(chatIdArg) !== chatId) continue;
      if (typeof textArg !== 'string') continue;
      if (!textArg.includes(textPart)) continue;
      return textArg;
    }

    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  throw new Error(
    `Target bot did not call sendMessage with text containing "${textPart}" in ${timeoutMs}ms`,
  );
}
