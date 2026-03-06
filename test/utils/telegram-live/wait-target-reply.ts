import { Logger, TelegramClient, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';
import { callBotApi } from './bot-api';
import { LiveEnv, TgUpdate } from './types';
import { resolveTargetDialogByPeerId } from './user-client';

export async function waitForTargetReplyInChat(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs: number;
}): Promise<string> {
  const { env } = params;
  return env.senderMode === 'bot'
    ? waitViaTesterBot(params)
    : waitViaUserSession(params);
}

async function waitViaTesterBot(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs: number;
}) {
  const { env, targetBotUsername, expectedTextPart, timeoutMs } = params;
  const started = Date.now();
  let offset: number | undefined;

  while (Date.now() - started < timeoutMs) {
    const updates = await callBotApi<TgUpdate[]>(env.testerToken!, 'getUpdates', {
      timeout: 8,
      allowed_updates: ['message'],
      offset,
    });

    if (updates.length) offset = updates[updates.length - 1].update_id + 1;

    for (const update of updates) {
      const msg = update.message;
      if (!msg?.chat || msg.chat.id !== env.chatId) continue;
      if (!msg.text) continue;
      if (!msg.from?.is_bot || msg.from.username !== targetBotUsername) continue;
      if (msg.text.includes(expectedTextPart)) return msg.text;
    }
  }

  throw new Error(`Did not observe bot reply containing "${expectedTextPart}" in ${timeoutMs}ms`);
}

async function waitViaUserSession(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs: number;
}) {
  const { env, targetBotUsername, expectedTextPart, timeoutMs } = params;
  const client = new TelegramClient(
    new StringSession(env.userSession!),
    env.userApiId!,
    env.userApiHash!,
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
