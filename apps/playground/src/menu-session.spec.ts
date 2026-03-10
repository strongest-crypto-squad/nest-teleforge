import { MenuService } from "../../../libs/nest-teleforge/src/features/menu/menu.service";
import { MenuContextBuilder } from "../../../libs/nest-teleforge/src/features/menu/menu.context.builder";
import { InMemoryMenuSessionStore } from "../../../libs/nest-teleforge/src/features/menu/menu-session.store";
import { registerCartMenu } from "./testing/menu-session.fixture";
import {
  findBtn,
  lastKb,
  makeMenuCtx,
  runWithChat,
} from "./testing/menu-session.test-helpers";

/* ─── Tests ────────────────────────────────────────────────────── */

describe("Menu session e2e", () => {
  let svc: MenuService;
  let store: InMemoryMenuSessionStore;

  /** Tracks items added via dynamic button taps. */
  let cartItems: string[];

  beforeEach(() => {
    store = new InMemoryMenuSessionStore();
    svc = new MenuService(new MenuContextBuilder(), store);
    cartItems = [];
    registerCartMenu(svc, (items) => {
      cartItems = items;
    });
  });

  it("session data persists across multiple button taps", async () => {
    const ctx1 = makeMenuCtx();
    await svc.start(ctx1, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    // Click "Pick items"
    const kb1 = lastKb(ctx1);
    const pickBtn = findBtn(kb1, "🛒 Pick items");
    expect(pickBtn).toBeDefined();

    const ctx2 = makeMenuCtx(1, pickBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    // Should see Apple, Banana, Cherry (unchecked)
    let kb = lastKb(ctx2);
    expect(findBtn(kb, "Apple")).toBeDefined();
    expect(findBtn(kb, "Banana")).toBeDefined();
    expect(findBtn(kb, "Cherry")).toBeDefined();

    // Click Apple → toggles on
    const appleBtn = findBtn(kb, "Apple");
    const ctx3 = makeMenuCtx(1, appleBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    expect(cartItems).toEqual(["Apple"]);

    // After re-render, Apple shows as checked
    kb = lastKb(ctx3);
    expect(findBtn(kb, "✅ Apple")).toBeDefined();
    expect(findBtn(kb, "Banana")).toBeDefined();

    // Click Banana → toggles on
    const bananaBtn = findBtn(kb, "Banana");
    const ctx4 = makeMenuCtx(1, bananaBtn.callback_data);
    await svc.handleCallback(ctx4, runWithChat);

    expect(cartItems).toEqual(["Apple", "Banana"]);

    kb = lastKb(ctx4);
    expect(findBtn(kb, "✅ Apple")).toBeDefined();
    expect(findBtn(kb, "✅ Banana")).toBeDefined();
    expect(findBtn(kb, "Cherry")).toBeDefined();

    // Click Apple again → toggles off
    const appleChecked = findBtn(kb, "✅ Apple");
    const ctx5 = makeMenuCtx(1, appleChecked.callback_data);
    await svc.handleCallback(ctx5, runWithChat);

    expect(cartItems).toEqual(["Banana"]);

    kb = lastKb(ctx5);
    expect(findBtn(kb, "Apple")).toBeDefined(); // unchecked again
    expect(findBtn(kb, "✅ Banana")).toBeDefined();
  });

  it("separate chats have independent sessions", async () => {
    // Chat 10 starts menu
    const ctxA1 = makeMenuCtx(10);
    await svc.start(ctxA1, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    // Chat 20 starts menu
    const ctxB1 = makeMenuCtx(20);
    await svc.start(ctxB1, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    // Chat 10: Pick items → Apple
    const pickA = findBtn(lastKb(ctxA1), "🛒 Pick items");
    const ctxA2 = makeMenuCtx(10, pickA.callback_data);
    await svc.handleCallback(ctxA2, runWithChat);

    const appleA = findBtn(lastKb(ctxA2), "Apple");
    const ctxA3 = makeMenuCtx(10, appleA.callback_data);
    await svc.handleCallback(ctxA3, runWithChat);
    expect(cartItems).toEqual(["Apple"]);

    // Chat 20: Pick items → check that Apple is NOT checked
    const pickB = findBtn(lastKb(ctxB1), "🛒 Pick items");
    const ctxB2 = makeMenuCtx(20, pickB.callback_data);
    await svc.handleCallback(ctxB2, runWithChat);

    // Chat 20 should show unchecked items
    const kbB = lastKb(ctxB2);
    expect(findBtn(kbB, "Apple")).toBeDefined(); // not '✅ Apple'
    expect(findBtn(kbB, "✅ Apple")).toBeUndefined();
  });

  it("session expires after TTL", async () => {
    // Use a very short TTL
    store = new InMemoryMenuSessionStore({ defaultTtlMs: 50 });
    svc = new MenuService(new MenuContextBuilder(), store);
    registerCartMenu(svc, (items) => {
      cartItems = items;
    });

    const ctx1 = makeMenuCtx();
    await svc.start(ctx1, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    const pickBtn = findBtn(lastKb(ctx1), "🛒 Pick items");
    const ctx2 = makeMenuCtx(1, pickBtn.callback_data);
    await svc.handleCallback(ctx2, runWithChat);

    const appleBtn = findBtn(lastKb(ctx2), "Apple");

    // Wait for session to expire
    await new Promise((r) => setTimeout(r, 80));

    const ctx3 = makeMenuCtx(1, appleBtn.callback_data);
    await svc.handleCallback(ctx3, runWithChat);

    // Should get "Session expired" because the session data is gone
    expect(ctx3.answerCbQuery).toHaveBeenCalledWith("Session expired");
  });

  it("menu replace mode disposes previous session", async () => {
    const ctx1 = makeMenuCtx();
    await svc.start(ctx1, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    // Get button from first session
    const pickBtn1 = findBtn(lastKb(ctx1), "🛒 Pick items");

    // Start a new menu (replace mode — default)
    const ctx2 = makeMenuCtx();
    await svc.start(ctx2, {
      flowId: "cart",
      text: "Cart demo",
      sessionData: { items: [] },
    });

    // Old button should not work — "Menu is unavailable" because
    // the old session ID doesn't match the new state.
    const ctx3 = makeMenuCtx(1, pickBtn1.callback_data);
    await svc.handleCallback(ctx3, runWithChat);
    expect(ctx3.answerCbQuery).toHaveBeenCalledWith("Menu is unavailable");
  });
});
