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

describe('Telegram live integration', () => {
  jest.setTimeout(120_000);

  describe('real Bot API flow', () => {
    let harness: LiveBotHarness;
    let env!: LiveEnv;
    let targetBotUsername = '';

    beforeAll(async () => {
      env = getRequiredLiveEnv();

      process.env.TELEGRAM_KEY = env.targetToken;

      const me = await callBotApi<TgUser>(env.targetToken, 'getMe');
      if (!me.username) {
        throw new Error('Target bot must have username');
      }
      targetBotUsername = me.username;

      harness = await createLiveBotHarness(PlaygroundModule, env.targetToken);
    });

    afterAll(async () => {
      await disposeLiveBotHarness(harness);
    });

    it('handles /help command in real chat', async () => {
      await sendLiveMessage({
        env,
        text: `/help`,
      });

      const reply = await waitForTargetReplyInChat({
        env,
        targetBotUsername,
        expectedTextPart: 'Вот список команд:',
        timeoutMs: 30_000,
      });

      expect(reply).toContain('/order');
    });
  });
});
