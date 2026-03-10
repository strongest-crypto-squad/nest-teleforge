import { MenuService } from "../../../libs/nest-teleforge/src/features/menu/menu.service";
import { MenuContextBuilder } from "../../../libs/nest-teleforge/src/features/menu/menu.context.builder";
import { InMemoryMenuSessionStore } from "../../../libs/nest-teleforge/src/features/menu/menu-session.store";
import { registerPlaygroundHandlers } from "./testing/menu-navigation.fixture";
import {
  findBtn,
  kbLabels,
  makeMenuCtx,
  runWithChat,
} from "./testing/menu-navigation.test-helpers";

/* ─── Tests ────────────────────────────────────────────────────── */

describe("Playground menu e2e (full navigation flow)", () => {
  let svc: MenuService;
  let store: InMemoryMenuSessionStore;

  beforeEach(() => {
    store = new InMemoryMenuSessionStore();
    const builder = new MenuContextBuilder();
    svc = new MenuService(builder, store);
    registerPlaygroundHandlers(svc);
  });

  // ── Test: full menu navigation ────────────────────────────────

  it("renders root menu with Home button on /menu start", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    const reply = (ctx.reply as jest.Mock).mock.calls[0];
    expect(reply[0]).toBe("Choose a section below.");
    expect(kbLabels(reply)).toEqual(["🏠 Home"]);
  });

  it("navigates Home → Profile → View profile → back to main", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // ── Click Home ──
    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    expect(e2[0].text).toBe("Home screen.");
    const homeLabels = kbLabels([, e2[0]] as any);
    expect(homeLabels).toContain("👤 Profile");
    expect(homeLabels).toContain("⚙️ Settings");
    expect(homeLabels).toContain("🛒 Products");

    // ── Click Profile ──
    const profileBtn = findBtn([, e2[0]] as any, "👤 Profile");
    const { ctx: ctx3, edited: e3 } = makeMenuCtx(1, profileBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    expect(e3[0].text).toBe("Your profile data and settings.");
    expect(kbLabels([, e3[0]] as any)).toContain("View profile");

    // ── Click View profile (pushes "profile" flow) ──
    const viewBtn = findBtn([, e3[0]] as any, "View profile");
    const { ctx: ctx4 } = makeMenuCtx(1, viewBtn.callback_data);
    await svc.handleCallback(ctx4, runWithChat);

    // "View profile" handler calls start() with mode: 'push',
    // which sends a new message (ctx4.reply or editMessageText).
    const pushReply =
      (ctx4.reply as jest.Mock).mock.calls[0] ??
      (ctx4.editMessageText as jest.Mock).mock.calls[0];
    // Check that profile flow root text is shown
    // Resolve from either reply or edit
    const profileFlowText =
      pushReply?.[0] ?? (ctx4.editMessageText as jest.Mock).mock.calls[0]?.[0];
    expect(profileFlowText).toContain("Profile: choose an action");

    // ── Click "Back to main menu" in profile flow ──
    // Find the button from the last edit/reply
    const profileKb =
      pushReply?.[1]?.reply_markup?.inline_keyboard ??
      (ctx4.editMessageText as jest.Mock).mock.calls[0]?.[1]?.reply_markup
        ?.inline_keyboard;
    const backToMainBtn = profileKb
      .flat()
      .find((b: any) => b.text === "⬅️ Back to main menu");
    expect(backToMainBtn).toBeDefined();

    const { ctx: ctx5, edited: e5 } = makeMenuCtx(
      1,
      backToMainBtn.callback_data,
    );
    await svc.handleCallback(ctx5, runWithChat);

    // Should render the previous "main" flow state
    // closeCurrent with renderPrevious calls render on the main state
    const backText =
      e5[0]?.text ?? (ctx5.reply as jest.Mock).mock.calls[0]?.[0];
    expect(backText).toBe("Your profile data and settings.");
  });

  it("navigates Home → Settings → Notifications → Back → Back", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // Home
    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    // Settings
    const settingsBtn = findBtn([, e2[0]] as any, "⚙️ Settings");
    const { ctx: ctx3, edited: e3 } = makeMenuCtx(1, settingsBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    expect(e3[0].text).toBe("General account settings.");
    expect(kbLabels([, e3[0]] as any)).toContain("Notifications");

    // Notifications
    const notifBtn = findBtn([, e3[0]] as any, "Notifications");
    const { ctx: ctx4, edited: e4 } = makeMenuCtx(1, notifBtn.callback_data);
    await svc.handleCallback(ctx4, runWithChat);

    expect(e4[0].text).toBe("Enable or disable notifications.");
    expect(kbLabels([, e4[0]] as any)).toContain("⬅️ Back");

    // Back → Settings
    const backBtn1 = findBtn([, e4[0]] as any, "⬅️ Back");
    const { ctx: ctx5, edited: e5 } = makeMenuCtx(1, backBtn1.callback_data);
    await svc.handleCallback(ctx5, runWithChat);

    expect(e5[0].text).toBe("General account settings.");

    // Back → Home
    const backBtn2 = findBtn([, e5[0]] as any, "⬅️ Back");
    const { ctx: ctx6, edited: e6 } = makeMenuCtx(1, backBtn2.callback_data);
    await svc.handleCallback(ctx6, runWithChat);

    expect(e6[0].text).toBe("Home screen.");
  });

  // ── Test: dynamic products ────────────────────────────────────

  it("renders dynamic product buttons under Products", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // Home
    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    // Products
    const productsBtn = findBtn([, e2[0]] as any, "🛒 Products");
    const { ctx: ctx3, edited: e3 } = makeMenuCtx(1, productsBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    expect(e3[0].text).toBe("Choose a product:");
    const labels = kbLabels([, e3[0]] as any);
    expect(labels).toContain("Widget A — $9.99");
    expect(labels).toContain("Widget B — $19.99");
    expect(labels).toContain("Gadget X — $49.99");
    expect(labels).toContain("⬅️ Back");
  });

  it("handles dynamic product button tap with correct payload", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // Home → Products
    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    const productsBtn = findBtn([, e2[0]] as any, "🛒 Products");
    const { ctx: ctx3, edited: e3 } = makeMenuCtx(1, productsBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    // Click "Widget B — $19.99"
    const widgetBBtn = findBtn([, e3[0]] as any, "Widget B — $19.99");
    expect(widgetBBtn).toBeDefined();

    const { ctx: ctx4, answered: a4 } = makeMenuCtx(
      1,
      widgetBBtn.callback_data,
    );
    await svc.handleCallback(ctx4, runWithChat);

    // Handler calls ctx.answerCbQuery with payload info
    expect(ctx4.answerCbQuery).toHaveBeenCalledWith(
      "You picked: Widget B (id=2)",
    );
  });

  it("returns to Home after pressing Back from Products", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // Home → Products
    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    const productsBtn = findBtn([, e2[0]] as any, "🛒 Products");
    const { ctx: ctx3, edited: e3 } = makeMenuCtx(1, productsBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    // Back
    const backBtn = findBtn([, e3[0]] as any, "⬅️ Back");
    const { ctx: ctx4, edited: e4 } = makeMenuCtx(1, backBtn.callback_data);
    await svc.handleCallback(ctx4, runWithChat);

    expect(e4[0].text).toBe("Home screen.");
    const labels = kbLabels([, e4[0]] as any);
    expect(labels).not.toContain("Widget A — $9.99");
    expect(labels).toContain("🛒 Products");
  });

  // ── Test: session isolation between multiple menus ─────────────

  it("supports independent menu sessions for different chats", async () => {
    const { ctx: ctx1 } = makeMenuCtx(100);
    const { ctx: ctx2 } = makeMenuCtx(200);

    await svc.start(ctx1, {
      flowId: "main",
      text: "Choose a section below.",
    });
    await svc.start(ctx2, {
      flowId: "main",
      text: "Choose a section below.",
    });

    // Chat 100: navigate to Home
    const home1 = findBtn((ctx1.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: cb1, edited: e1 } = makeMenuCtx(100, home1.callback_data);
    await svc.handleCallback(cb1, runWithChat);
    expect(e1[0].text).toBe("Home screen.");

    // Chat 200: navigate to Home → Settings
    const home2 = findBtn((ctx2.reply as jest.Mock).mock.calls[0], "🏠 Home");
    const { ctx: cb2, edited: e2 } = makeMenuCtx(200, home2.callback_data);
    await svc.handleCallback(cb2, runWithChat);

    const settings2 = findBtn([, e2[0]] as any, "⚙️ Settings");
    const { ctx: cb3, edited: e3 } = makeMenuCtx(200, settings2.callback_data);
    await svc.handleCallback(cb3, runWithChat);
    expect(e3[0].text).toBe("General account settings.");

    // Chat 100 should still be at Home — pressing their Settings works fine
    const settings1 = findBtn([, e1[0]] as any, "⚙️ Settings");
    const { ctx: cb4, edited: e4 } = makeMenuCtx(100, settings1.callback_data);
    await svc.handleCallback(cb4, runWithChat);
    expect(e4[0].text).toBe("General account settings.");
  });

  // ── Test: outdated button ─────────────────────────────────────

  it("rejects callback from outdated render cycle", async () => {
    const { ctx } = makeMenuCtx();
    await svc.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });

    const homeBtn = findBtn((ctx.reply as jest.Mock).mock.calls[0], "🏠 Home");

    // Navigate to Home (renders new buttons, old tokens become stale)
    const { ctx: ctx2, edited: e2 } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    // Try clicking the old Home button again — different renderSeq → stale token
    const { ctx: ctx3, answered } = makeMenuCtx(1, homeBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);
    expect(answered).toContain("Button is outdated");
  });
});
