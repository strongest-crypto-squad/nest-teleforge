import { Logger, TelegramClient, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { LiveEnv } from './types';
import { resolveTargetDialogByPeerId } from './user-client';

export async function waitForTargetReplyInChat(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs: number;
}): Promise<string> {
  return waitViaUserSession(params);
}

async function waitViaUserSession(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs: number;
}) {
  const { env, targetBotUsername, expectedTextPart, timeoutMs } = params;
  const client = new TelegramClient(
    new StringSession(env.userSession),
    env.userApiId,
    env.userApiHash,
    { connectionRetries: 3, baseLogger: new Logger('error' as any) },
  );

  await client.connect();
  try {
    const targetDialog = await resolveTargetDialogByPeerId(client, env.chatId);
    const started = Date.now();

    while (Date.now() - started < timeoutMs) {
      const messages = await client.getMessages(targetDialog.entity!, { limit: 20 });
      for (const msg of messages) {
        const text = (msg as any)?.message;
        const sender = (msg as any)?.sender;
        if (typeof text !== 'string') continue;
        if (sender?.bot !== true || sender?.username !== targetBotUsername) continue;
        if (text.includes(expectedTextPart)) return text;
      }
      await new Promise((resolve) => setTimeout(resolve, 500));
    }

    throw new Error(`Did not observe bot reply containing "${expectedTextPart}" in ${timeoutMs}ms`);
  } finally {
    await client.disconnect();
  }
}
