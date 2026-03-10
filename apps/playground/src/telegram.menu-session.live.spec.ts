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

describe("Telegram menu-session live integration", () => {
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

  it("persists selected items inside one menu session", async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/menusession" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Session cart menu",
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: "🛒 Pick items" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    await clickInlineButtonByText({ env, buttonText: "Apple" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    await clickInlineButtonByText({ env, buttonText: "Banana" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    await clickInlineButtonByText({ env, buttonText: "✅ Apple" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    await clickInlineButtonByText({ env, buttonText: "⬅️ Back" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Session cart menu",
    });

    await clickInlineButtonByText({ env, buttonText: "Show cart" });
    const cartText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Cart:",
    });

    expect(cartText).toContain("Banana");
    expect(cartText).not.toContain("Apple");
  });

  it("starts with empty cart after replace start", async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/menusession" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Session cart menu",
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: "🛒 Pick items" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    await clickInlineButtonByText({ env, buttonText: "Cherry" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Select items to add:",
    });

    const restartMs = Date.now();
    await sendLiveMessage({ env, text: "/menusession" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Session cart menu",
      sinceMs: restartMs,
    });

    await clickInlineButtonByText({ env, buttonText: "Show cart" });
    const cartText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Cart:",
      sinceMs: restartMs,
    });

    expect(cartText).toContain("Cart: (empty)");
  });
});
