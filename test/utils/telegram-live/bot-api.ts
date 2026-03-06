import { BotApiResponse, TgUpdate } from './types';

export async function callBotApi<T>(
  token: string,
  method: string,
  payload?: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload ?? {}),
  });

  if (!res.ok) {
    throw new Error(`Bot API HTTP ${res.status} on ${method}`);
  }

  const data = (await res.json()) as BotApiResponse<T>;
  if (!data.ok) {
    throw new Error(`Bot API not ok for ${method}`);
  }

  return data.result;
}

export async function purgeUpdates(token: string) {
  let offset: number | undefined;

  for (;;) {
    const updates = await callBotApi<TgUpdate[]>(token, 'getUpdates', {
      timeout: 0,
      allowed_updates: ['message'],
      offset,
    });

    if (!updates.length) return;
    offset = updates[updates.length - 1].update_id + 1;
  }
}

export async function waitForIncomingToTarget(
  targetToken: string,
  chatId: number,
  expectedTextPart: string,
  timeoutMs: number,
) {
  const started = Date.now();
  let offset: number | undefined;

  while (Date.now() - started < timeoutMs) {
    const updates = await callBotApi<TgUpdate[]>(targetToken, 'getUpdates', {
      timeout: 8,
      allowed_updates: ['message'],
      offset,
    });

    if (updates.length) {
      offset = updates[updates.length - 1].update_id + 1;
    }

    for (const update of updates) {
      const msg = update.message;
      if (!msg?.chat || msg.chat.id !== chatId) continue;
      if (!msg.text?.includes(expectedTextPart)) continue;
      return;
    }
  }

  throw new Error(
    'Target bot does not receive command updates from this chat. Check TG_TEST_CHAT_ID and chat permissions.',
  );
}
