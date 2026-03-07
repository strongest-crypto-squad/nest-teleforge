import { PlaygroundModule } from './playground.module';
import {
  callBotApi,
  clickInlineButtonByText,
  createLiveBotHarness,
  disposeLiveBotHarness,
  getRequiredLiveEnv,
  LiveBotHarness,
  LiveEnv,
  sendLiveMessage,
  TgUser,
  waitForTargetReplyInChat,
} from 'test/utils/telegram-live';

describe('Telegram menu live integration', () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env!: LiveEnv;
  let targetBotUsername = '';

  beforeAll(async () => {
    env = getRequiredLiveEnv();
    process.env.TELEGRAM_KEY = env.targetToken;

    const me = await callBotApi<TgUser>(env.targetToken, 'getMe');
    if (!me.username) throw new Error('Target bot must have username');
    targetBotUsername = me.username;

    harness = await createLiveBotHarness(PlaygroundModule, env.targetToken);
  });

  afterAll(async () => {
    await disposeLiveBotHarness(harness);
  });

  it('navigates menu and handles inline button clicks', async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: '/menu' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Выберите раздел ниже.',
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: '🏠 Домой' });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Домашний экран.',
    });

    await clickInlineButtonByText({ env, buttonText: '⚙️ Настройки' });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Общие параметры аккаунта.',
    });

    await clickInlineButtonByText({ env, buttonText: 'Уведомления' });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Включить/выключить уведомления.',
    });

    await clickInlineButtonByText({ env, buttonText: '⬅️ Назад' });
    const backText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Общие параметры аккаунта.',
    });

    expect(backText).toContain('Общие параметры аккаунта.');
  });
});
