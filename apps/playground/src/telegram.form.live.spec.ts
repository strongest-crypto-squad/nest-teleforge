import { PlaygroundModule } from "./playground.module";
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
} from "test/utils/telegram-live";

describe("Telegram form live integration", () => {
  jest.setTimeout(180_000);

  let harness: LiveBotHarness;
  let env!: LiveEnv;
  let targetBotUsername = "";

  const sendAndWait = async (
    text: string,
    expectedTextPart: string,
    timeoutMs = 30_000,
  ) => {
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
    process.env.TG_FORM_TIMEOUT_MS = process.env.TG_FORM_TIMEOUT_MS ?? "15000";

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

    await sendLiveMessage({ env, text: "/cancel" });
    await new Promise((resolve) => setTimeout(resolve, 700));
  });

  afterAll(async () => {
    await disposeLiveBotHarness(harness);
  });

  it("completes /order form with validation retries", async () => {
    process.env.TG_FORM_TIMEOUT_MS = "20000";

    const orderStartMs = Date.now();
    await sendLiveMessage({ env, text: "/order" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Starting the order form.",
      sinceMs: orderStartMs,
    });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "What product would you like to order?",
      sinceMs: orderStartMs,
    });

    await sendAndWait("Laptop", "How many units?");

    const invalidQtyMs = Date.now();
    await sendLiveMessage({ env, text: "0" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Error:",
      sinceMs: invalidQtyMs,
    });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "How many units?",
      sinceMs: invalidQtyMs,
    });

    await sendAndWait("2", "Choose size");
    await sendAndWait("medium", "When should we deliver?");

    const invalidDateMs = Date.now();
    await sendLiveMessage({ env, text: "bad-date" });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Error:",
      sinceMs: invalidDateMs,
    });
    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "When should we deliver?",
      sinceMs: invalidDateMs,
    });

    const summary = await sendAndWait(
      "2026-03-15",
      "✅ Order accepted:",
      30_000,
    );
    expect(summary).toContain("Product: Laptop");
    expect(summary).toContain("Quantity: 2");
    expect(summary).toContain("Size: medium");
  });

  it("times out /order form with short timeout", async () => {
    process.env.TG_FORM_TIMEOUT_MS = "10000";

    const startMs = Date.now();

    await sendLiveMessage({ env, text: "/order" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "What product would you like to order?",
      sinceMs: startMs,
    });

    const timeoutText = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Waiting time expired.",
      sinceMs: startMs,
    });

    expect(timeoutText).toContain("/cancel");
  });

  it("cancels /order form by /cancel command", async () => {
    process.env.TG_FORM_TIMEOUT_MS = "20000";

    const startMs = Date.now();
    await sendLiveMessage({ env, text: "/order" });

    await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "What product would you like to order?",
      sinceMs: startMs,
    });

    const cancelSince = Date.now();
    await sendLiveMessage({ env, text: "/cancel" });

    const cancelReply = await waitForTargetReplyInChat({
      env,
      targetBotUsername,
      expectedTextPart: "Okay, form cancelled.",
      sinceMs: cancelSince,
    });

    expect(cancelReply).toContain("Okay, form cancelled.");
  });
});
