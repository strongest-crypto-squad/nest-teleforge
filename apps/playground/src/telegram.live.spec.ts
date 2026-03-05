import { NestFactory } from '@nestjs/core';
import { PlaygroundModule } from './playground.module';
import { TelegramService } from 'libs/my-lib/src';

type BotApiResponse<T> = {
  ok: boolean;
  result: T;
};

type TgUser = {
  id: number;
  username?: string;
};

type TgUpdate = {
  update_id: number;
  message?: {
    chat?: { id: number };
    text?: string;
    from?: { is_bot?: boolean; username?: string };
  };
};

async function callBotApi<T>(
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

async function purgeUpdates(testerToken: string) {
  let offset: number | undefined;

  for (;;) {
    const updates = await callBotApi<TgUpdate[]>(testerToken, 'getUpdates', {
      timeout: 0,
      allowed_updates: ['message'],
      offset,
    });

    if (!updates.length) {
      return;
    }

    offset = updates[updates.length - 1].update_id + 1;
  }
}

async function waitForBotReply(
  testerToken: string,
  chatId: number,
  targetBotUsername: string,
  expectedTextPart: string,
  timeoutMs: number,
): Promise<string> {
  const started = Date.now();
  let offset: number | undefined;

  while (Date.now() - started < timeoutMs) {
    const updates = await callBotApi<TgUpdate[]>(testerToken, 'getUpdates', {
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
      if (!msg.text) continue;

      const from = msg.from;
      if (!from?.is_bot || from.username !== targetBotUsername) continue;

      if (msg.text.includes(expectedTextPart)) {
        return msg.text;
      }
    }
  }

  throw new Error(
    `Did not receive bot reply containing "${expectedTextPart}" in ${timeoutMs}ms`,
  );
}

describe('Telegram live integration', () => {
  jest.setTimeout(120_000);

  const targetToken = process.env.TELEGRAM_KEY;
  const testerToken = process.env.TG_TESTER_BOT_TOKEN;
  const chatIdRaw = process.env.TG_TEST_CHAT_ID;

  const runLive = Boolean(targetToken && testerToken && chatIdRaw);
  const live = runLive ? describe : describe.skip;

  live('real Bot API flow', () => {
    let app: Awaited<ReturnType<typeof NestFactory.create>>;
    let telegramService: TelegramService;
    let targetBotUsername = '';
    const chatId = Number(chatIdRaw);

    beforeAll(async () => {
      if (!Number.isFinite(chatId)) {
        throw new Error('TG_TEST_CHAT_ID must be numeric');
      }

      process.env.TELEGRAM_KEY = targetToken!;

      const me = await callBotApi<TgUser>(targetToken!, 'getMe');
      if (!me.username) {
        throw new Error('Target bot must have username');
      }
      targetBotUsername = me.username;

      await purgeUpdates(testerToken!);

      app = await NestFactory.create(PlaygroundModule, { logger: false });
      await app.init();
      telegramService = app.get(TelegramService);

      await new Promise((resolve) => setTimeout(resolve, 1500));
    });

    afterAll(async () => {
      if (telegramService?.bot) {
        telegramService.bot.stop('live-test-finished');
      }
      if (app) {
        await app.close();
      }
    });

    it('handles /help command in real chat', async () => {
      await callBotApi(testerToken!, 'sendMessage', {
        chat_id: chatId,
        text: `/help@${targetBotUsername}`,
      });

      const reply = await waitForBotReply(
        testerToken!,
        chatId,
        targetBotUsername,
        'Вот список команд:',
        30_000,
      );

      expect(reply).toContain('/order');
    });
  });
});
