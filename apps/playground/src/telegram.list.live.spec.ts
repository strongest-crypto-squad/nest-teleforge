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

describe('Telegram list live integration', () => {
  jest.setTimeout(120_000);

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

  it('handles list selection via inline button', async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: '/list' });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Choose an option:',
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: 'kek2' });

    const selectedText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: 'Selected option: key2',
      sinceMs: startMs,
    });

    expect(selectedText).toContain('Selected option: key2');
  });
});
