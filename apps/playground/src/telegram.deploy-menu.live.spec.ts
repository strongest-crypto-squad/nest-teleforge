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
} from "../../../test/utils/telegram-live";
import { PlaygroundModule } from "./playground.module";

describe("Telegram menu custom root menu integration", () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env: LiveEnv;
  let targetBotUsername = "";

  beforeAll(async () => {
    env = getRequiredLiveEnv();
    process.env.TELEGRAM_KEY = env.targetToken;

    const me = await callBotApi<TgUser>(env.targetToken, "getMe");
    if (!me.username) throw new Error("Target bot must have username");
    targetBotUsername = me.username;

    harness = await createLiveBotHarness(PlaygroundModule, env.targetToken);
  });

  beforeEach(async () => {
    const testName = expect.getState().currentTestName ?? "Unnamed test";
    await callBotApi(env.targetToken, "sendMessage", {
      chat_id: env.chatId,
      text: `🧪 ${testName}`,
    });
  });

  afterAll(async () => {
    await disposeLiveBotHarness(harness);
  });

  it("handles isolated service-initiated root menu", async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/startdeploy" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Deploy requested from Service",
      sinceMs: startMs,
    });

    // 1st level: click Deploy
    await clickInlineButtonByText({ env, buttonText: "Deploy" });

    // 2nd level: click Confirm
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Needs confirmation",
    });

    await clickInlineButtonByText({ env, buttonText: "Confirm ✅" });

    // Check confirmation text
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Target deployed",
    });
  });
});
