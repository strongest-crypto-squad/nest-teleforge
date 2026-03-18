import { PlaygroundModule } from "./playground.module";
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
} from "test/utils/telegram-live";

describe("Telegram menu live integration", () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env!: LiveEnv;
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

  it("navigates menu and handles inline button clicks", async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/menu" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Choose a section below.",
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: "🏠 Home" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Home screen.",
    });

    await clickInlineButtonByText({ env, buttonText: "👤 Profile" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Your profile data and settings.",
    });

    await clickInlineButtonByText({ env, buttonText: "View profile" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Profile: choose an action",
    });

    await clickInlineButtonByText({ env, buttonText: "⬅️ Back to main menu" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Your profile data and settings.",
    });

    await clickInlineButtonByText({ env, buttonText: "⬅️ Back" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Home screen.",
    });

    await clickInlineButtonByText({ env, buttonText: "⚙️ Settings" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "General account settings.",
    });

    await clickInlineButtonByText({ env, buttonText: "Notifications" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Enable or disable notifications.",
    });

    await clickInlineButtonByText({ env, buttonText: "⬅️ Back" });
    const backText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "General account settings.",
    });

    expect(backText).toContain("General account settings.");
  });

  it("handles mode:push for 3 concurrent profile submenus and preserves context", async () => {
    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/menu" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Choose a section below.",
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: "🏠 Home" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Home screen.",
      sinceMs: startMs,
    });

    await clickInlineButtonByText({ env, buttonText: "👤 Profile" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Your profile data and settings.",
      sinceMs: startMs,
    });

    for (let i = 0; i < 3; i += 1) {
      const openPushMs = Date.now();
      await clickInlineButtonByText({
        env,
        buttonText: "View profile",
        messageTextPart: "Your profile data and settings.",
        matchIndexFromNewest: 0,
      });

      await waitForTargetReplyInChat({
        env,
        targetBotUsername,
        expectedTextPart: "Profile: choose an action",
        sinceMs: openPushMs,
      });
    }

    for (let i = 0; i < 3; i += 1) {
      await clickInlineButtonByText({
        env,
        buttonText: "⬅️ Back to main menu",
        messageTextPart: "Profile: choose an action",
        matchIndexFromNewest: 0,
      });
    }

    const reopenMs = Date.now();
    await clickInlineButtonByText({
      env,
      buttonText: "View profile",
      messageTextPart: "Your profile data and settings.",
      matchIndexFromNewest: 0,
    });

    const reopenedText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Profile: choose an action",
      sinceMs: reopenMs,
    });
    expect(reopenedText).toContain("Profile: choose an action");
  });
});
