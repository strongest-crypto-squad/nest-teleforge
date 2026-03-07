import { PlaygroundModule } from './playground.module';
import {
  callBotApi,
  createLiveBotHarness,
  disposeLiveBotHarness,
  getRequiredLiveEnv,
  LiveBotHarness,
  LiveEnv,
  sendLiveMessage,
  waitForTargetReplyInChat,
  TgUser,
} from 'test/utils/telegram-live';

describe('Telegram form live integration', () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env!: LiveEnv;
  let targetBotUsername = '';

  const sendAndWait = async (text: string, expectedTextPart: string, timeoutMs = 30_000) => {
    const sinceMs = Date.now();
    await sendLiveMessage({ env, text });
    return waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart,
      timeoutMs,
      sinceMs,
    });
  };

  beforeAll(async () => {
    env = getRequiredLiveEnv();
    process.env.TELEGRAM_KEY = env.targetToken;
    process.env.TG_FORM_TIMEOUT_MS = process.env.TG_FORM_TIMEOUT_MS ?? '15000';

    const me = await callBotApi<TgUser>(env.targetToken, 'getMe');
    if (!me.username) throw new Error('Target bot must have username');
    targetBotUsername = me.username;

    harness = await createLiveBotHarness(PlaygroundModule, env.targetToken);
  });

  beforeEach(async () => {
    await sendLiveMessage({ env, text: '/cancel' });
    await new Promise((resolve) => setTimeout(resolve, 700));
  });

  afterAll(async () => {
    await disposeLiveBotHarness(harness);
  });

  it('completes /order form with validation retries', async () => {
    process.env.TG_FORM_TIMEOUT_MS = '20000';

    const orderStartMs = Date.now();
    await sendLiveMessage({ env, text: '/order' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Запускаю форму заказа.',
      sinceMs: orderStartMs,
    });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Какой товар хотите заказать?',
      sinceMs: orderStartMs,
    });

    await sendAndWait('Laptop', 'Сколько штук?');

    const invalidQtyMs = Date.now();
    await sendLiveMessage({ env, text: '0' });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Ошибка:',
      sinceMs: invalidQtyMs,
    });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Сколько штук?',
      sinceMs: invalidQtyMs,
    });

    await sendAndWait('2', 'Выберите размер');
    await sendAndWait('medium', 'Когда доставить?');

    const invalidDateMs = Date.now();
    await sendLiveMessage({ env, text: 'bad-date' });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Ошибка:',
      sinceMs: invalidDateMs,
    });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Когда доставить?',
      sinceMs: invalidDateMs,
    });

    const summary = await sendAndWait('2026-03-15', '✅ Заказ принят:', 30_000);
    expect(summary).toContain('Товар: Laptop');
    expect(summary).toContain('Кол-во: 2');
    expect(summary).toContain('Размер: medium');
  });

  it('times out /order form with short timeout', async () => {
    process.env.TG_FORM_TIMEOUT_MS = '10000';

    const startMs = Date.now();

    await sendLiveMessage({ env, text: '/order' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Какой товар хотите заказать?',
      sinceMs: startMs,
    });

    const timeoutText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Время ожидания истекло.',
      sinceMs: startMs,
    });

    expect(timeoutText).toContain('/cancel');
  });

  it('cancels /order form by /cancel command', async () => {
    process.env.TG_FORM_TIMEOUT_MS = '20000';

    const startMs = Date.now();
    await sendLiveMessage({ env, text: '/order' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Какой товар хотите заказать?',
      sinceMs: startMs,
    });

    const cancelSince = Date.now();
    await sendLiveMessage({ env, text: '/cancel' });

    const cancelReply = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Окей, отменил форму.',
      sinceMs: cancelSince,
    });

    expect(cancelReply).toContain('Окей, отменил форму.');
  });
});
