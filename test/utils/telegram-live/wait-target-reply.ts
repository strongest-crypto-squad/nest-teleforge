import { LiveEnv } from './types';
import { resolveTargetDialogByPeerId, withUserClient } from './user-client';

export async function waitForTargetReplyInChat(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs?: number;
  sinceMs?: number;
}): Promise<string> {
  return waitViaUserSession(params);
}

async function waitViaUserSession(params: {
  env: LiveEnv;
  targetBotUsername: string;
  expectedTextPart: string;
  timeoutMs?: number;
  sinceMs?: number;
}) {
  const { env, expectedTextPart, timeoutMs = 30_000, sinceMs } = params;
  return withUserClient(
    {
      apiId: env.userApiId,
      apiHash: env.userApiHash,
      session: env.userSession,
    },
    async (client) => {
      const targetDialog = await resolveTargetDialogByPeerId(client, env.chatId);
      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        const messages = await client.getMessages(targetDialog.entity!, { limit: 20 });
        for (const msg of messages) {
          const text = (msg as any)?.message;
          const dateSec = (msg as any)?.date;
          const out = (msg as any)?.out;
          if (typeof text !== 'string') continue;
          if (out === true) continue;
          if (typeof sinceMs === 'number') {
            const messageMs = typeof dateSec === 'number' ? dateSec * 1000 : 0;
            if (messageMs < sinceMs) continue;
          }
          if (text.includes(expectedTextPart)) return text;
        }
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new Error(
        `Did not observe bot reply containing "${expectedTextPart}" in ${timeoutMs}ms`,
      );
    },
  );
}
