import { MenuService } from "./menu.service";
import { MenuContextBuilder } from "./menu.context.builder";
import { InMemoryMenuSessionStore } from "./menu-session.store";
import type { DynamicButton, MenuContext } from "./menu.decorator";

/* ─── Helpers ──────────────────────────────────────────────────── */

function makeCtx(chatId = 1, cbData?: string) {
  const sent: any[] = [];
  const edited: any[] = [];
  const answered: string[] = [];

  const ctx: any = {
    chat: { id: chatId },
    from: { id: chatId, username: "test" },
    update: cbData
      ? { callback_query: { data: cbData, message: { message_id: 1 } } }
      : {},
    reply: jest.fn(async (text: string, opts: any) => {
      sent.push({ text, ...opts });
    }),
    editMessageText: jest.fn(async (text: string, opts: any) => {
      edited.push({ text, ...opts });
    }),
    answerCbQuery: jest.fn(async (text?: string) => {
      answered.push(text ?? "");
    }),
  };

  return { ctx, sent, edited, answered };
}

const runWithChat = async <T>(fn: () => Promise<T>) => fn();

/* ─── Tests ────────────────────────────────────────────────────── */

describe("MenuService dynamic buttons (session-based)", () => {
  let svc: MenuService;
  let store: InMemoryMenuSessionStore;

  beforeEach(() => {
    store = new InMemoryMenuSessionStore();
    const builder = new MenuContextBuilder();
    svc = new MenuService(builder, store);
  });

  type ProductPayload = { id: number; name: string };

  const products = [
    { id: 1, name: "Alpha" },
    { id: 2, name: "Beta" },
    { id: 3, name: "Gamma" },
  ];

  function dynamicProvider(
    _ctx: any,
    _mctx: MenuContext,
  ): Promise<DynamicButton<ProductPayload>[]> {
    return Promise.resolve(
      products.map((p) => ({
        label: p.name,
        data: { id: p.id, name: p.name },
      })),
    );
  }

  const onButtonFn = jest.fn(
    async (_ctx: any, _mctx: MenuContext<ProductPayload>) => {
      return "handled" as const;
    },
  );

  function registerDynamicAction() {
    onButtonFn.mockClear();

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "items",
        key: "test.items",
        options: {
          label: "📦 Items",
          description: "Pick an item:",
          dynamicButtons: dynamicProvider,
        },
      },
      methodRef: registerDynamicAction,
      handler: async (_ctx: any, mctx: MenuContext<ProductPayload>) => {
        if (mctx.buttonData) {
          return onButtonFn(_ctx, mctx);
        }
        return "rerender";
      },
      dynamicProvider,
    });
  }

  it("renders dynamic buttons via dynamicProvider", async () => {
    registerDynamicAction();

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Test menu" });

    // Start renders the items button at root
    const sentReply = (ctx.reply as jest.Mock).mock.calls[0];
    const keyboard = sentReply[1].reply_markup.inline_keyboard;
    const itemsBtn = keyboard.flat().find((b: any) => b.text === "📦 Items");
    expect(itemsBtn).toBeDefined();

    // Click "Items" → pushes & renders with dynamic buttons
    const { ctx: cbCtx, edited } = makeCtx(1, itemsBtn.callback_data);
    const handled = await svc.handleCallback(cbCtx, runWithChat);

    expect(handled).toBe(true);
    expect(edited.length).toBe(1);
    const dynKeyboard = edited[0].reply_markup.inline_keyboard;

    // 3 dynamic products + back button
    const flatBtns = dynKeyboard.flat();
    expect(flatBtns.map((b: any) => b.text)).toEqual([
      "Alpha",
      "Beta",
      "Gamma",
      "⬅️ Back",
    ]);
  });

  it("replace mode clears previous session", async () => {
    registerDynamicAction();
    const deleteSpy = jest.spyOn(store, "delete");

    const { ctx: firstCtx } = makeCtx(10);
    await svc.start(firstCtx, { flowId: "test", text: "First menu" });

    const { ctx: secondCtx } = makeCtx(10);
    await svc.start(secondCtx, { flowId: "test", text: "Second menu" });

    expect(deleteSpy).toHaveBeenCalledTimes(1);
  });

  it("calls handler with mctx.buttonData when dynamic button is tapped", async () => {
    registerDynamicAction();

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Test menu" });

    // Click "Items"
    const sentReply = (ctx.reply as jest.Mock).mock.calls[0];
    const itemsBtn = sentReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "📦 Items");

    const { ctx: cbCtx1, edited: edited1 } = makeCtx(1, itemsBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    // Now tap "Beta"
    const dynKeyboard = edited1[0].reply_markup.inline_keyboard;
    const betaBtn = dynKeyboard.flat().find((b: any) => b.text === "Beta");
    expect(betaBtn).toBeDefined();

    const { ctx: cbCtx2 } = makeCtx(1, betaBtn.callback_data);
    const handled = await svc.handleCallback(cbCtx2, runWithChat);

    expect(handled).toBe(true);
    expect(onButtonFn).toHaveBeenCalledTimes(1);

    const [, mctx] = onButtonFn.mock.calls[0];
    expect(mctx.buttonData).toEqual({ id: 2, name: "Beta" });
  });

  it('returns "Session expired" when session has expired', async () => {
    store = new InMemoryMenuSessionStore({ defaultTtlMs: 50 });
    const builder = new MenuContextBuilder();
    svc = new MenuService(builder, store);

    registerDynamicAction();

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Test menu" });

    const sentReply = (ctx.reply as jest.Mock).mock.calls[0];
    const itemsBtn = sentReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "📦 Items");

    const { ctx: cbCtx1, edited: edited1 } = makeCtx(1, itemsBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    const alphaBtn = edited1[0].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Alpha");

    // Wait for TTL to expire
    await new Promise((r) => setTimeout(r, 80));

    const { ctx: cbCtx2, answered } = makeCtx(1, alphaBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);
    expect(answered).toContain("Session expired");
  });

  it("back button from dynamic view clears dynamic state", async () => {
    registerDynamicAction();

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Test menu" });

    // Click "Items"
    const sentReply = (ctx.reply as jest.Mock).mock.calls[0];
    const itemsBtn = sentReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "📦 Items");

    const { ctx: cbCtx1, edited: edited1 } = makeCtx(1, itemsBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    // Press Back
    const backBtn = edited1[0].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "⬅️ Back");

    const { ctx: cbCtx2, edited: edited2 } = makeCtx(1, backBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);

    // Should be back at the root — no dynamic buttons, just "Items"
    const keyboard2 = edited2[0].reply_markup.inline_keyboard;
    const labels = keyboard2.flat().map((b: any) => b.text);
    expect(labels).toContain("📦 Items");
    expect(labels).not.toContain("Alpha");
    expect(labels).not.toContain("Beta");
  });

  it("session data is shared across handler calls", async () => {
    const provider = async () => [{ label: "Add", data: { action: "add" } }];
    let currentCount = 0;

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "counter",
        key: "test.counter",
        options: {
          label: "Counter",
          description: "Session demo",
          dynamicButtons: provider,
        },
      },
      methodRef: provider,
      handler: async (_ctx: any, mctx: MenuContext<{ count: number }>) => {
        if (mctx.buttonData) {
          mctx.session.data.count += 1;
        }
        currentCount = mctx.session.data.count;
        return "rerender";
      },
      dynamicProvider: provider,
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, {
      flowId: "test",
      text: "Counter demo",
      sessionData: { count: 0 },
    });

    // Click "Counter"
    const sentReply = (ctx.reply as jest.Mock).mock.calls[0];
    const counterBtn = sentReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Counter");

    const { ctx: cbCtx1, edited: e1 } = makeCtx(1, counterBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    // Click "Add" dynamic button
    const addBtn = e1[0].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Add");

    const { ctx: cbCtx2 } = makeCtx(1, addBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);
    expect(currentCount).toBe(1);

    const reRendered = (cbCtx2.editMessageText as jest.Mock).mock.calls;
    expect(reRendered.length).toBe(1);
    const newKb = reRendered[0][1].reply_markup.inline_keyboard;
    const newAddBtn = newKb.flat().find((b: any) => b.text === "Add");

    const { ctx: cbCtx4 } = makeCtx(1, newAddBtn.callback_data);
    await svc.handleCallback(cbCtx4, runWithChat);
    expect(currentCount).toBe(2);
  });

  it("applies action disabled predicate for dynamic button taps", async () => {
    const provider = async () => [{ label: "Locked", data: { locked: true } }];
    const onTap = jest.fn(
      async (_ctx: any, _mctx: MenuContext<{ locked?: boolean }>) =>
        "handled" as const,
    );

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "secure",
        key: "test.secure",
        options: {
          label: "Secure",
          description: "Secure menu",
          dynamicButtons: provider,
          disabled: (mctx: MenuContext<{ locked?: boolean }>) =>
            Boolean(mctx.buttonData?.locked),
          disabledText: "Locked by policy",
        },
      },
      methodRef: provider,
      handler: async (ctx: any, mctx: MenuContext<{ locked?: boolean }>) => {
        if (mctx.buttonData) return onTap(ctx, mctx);
        return "rerender";
      },
      dynamicProvider: provider,
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Secure root" });

    const rootReply = (ctx.reply as jest.Mock).mock.calls[0];
    const secureBtn = rootReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Secure");

    const { ctx: cbCtx1, edited: e1 } = makeCtx(1, secureBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    const lockedBtn = e1[0].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Locked");

    const { ctx: cbCtx2, answered } = makeCtx(1, lockedBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);

    expect(answered).toContain("Locked by policy");
    expect(onTap).not.toHaveBeenCalled();
  });

  it("applies action guard predicate for dynamic button taps", async () => {
    const provider = async () => [{ label: "Guarded", data: { ok: false } }];
    const onTap = jest.fn(
      async (_ctx: any, _mctx: MenuContext<{ ok?: boolean }>) =>
        "handled" as const,
    );

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "guarded",
        key: "test.guarded",
        options: {
          label: "Guarded menu",
          description: "Guarded menu",
          dynamicButtons: provider,
          guard: (mctx: MenuContext<{ ok?: boolean }>) =>
            mctx.buttonData ? Boolean(mctx.buttonData.ok) : true,
        },
      },
      methodRef: provider,
      handler: async (ctx: any, mctx: MenuContext<{ ok?: boolean }>) => {
        if (mctx.buttonData) return onTap(ctx, mctx);
        return "rerender";
      },
      dynamicProvider: provider,
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Guard root" });

    const rootReply = (ctx.reply as jest.Mock).mock.calls[0];
    const menuBtn = rootReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Guarded menu");

    const { ctx: cbCtx1, edited: e1 } = makeCtx(1, menuBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    const guardedBtn = e1[0].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Guarded");

    const { ctx: cbCtx2, answered } = makeCtx(1, guardedBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);

    expect(answered).toContain("Unavailable");
    expect(onTap).not.toHaveBeenCalled();
  });

  it("keeps menu responsive when dynamic provider throws", async () => {
    const brokenProvider = async () => {
      throw new Error("provider failed");
    };

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "broken",
        key: "test.broken",
        options: {
          label: "Broken",
          description: "Broken dynamic",
          dynamicButtons: brokenProvider,
        },
      },
      methodRef: brokenProvider,
      handler: async () => "rerender",
      dynamicProvider: brokenProvider,
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Root" });

    const rootReply = (ctx.reply as jest.Mock).mock.calls[0];
    const brokenBtn = rootReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Broken");

    const { ctx: cbCtx, edited } = makeCtx(1, brokenBtn.callback_data);
    await expect(svc.handleCallback(cbCtx, runWithChat)).resolves.toBe(true);

    expect(edited[0].text).toBe("Broken dynamic");
    const labels = edited[0].reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.text);
    expect(labels).toContain("⬅️ Back");
  });

  it("nested push keeps lower session usable when top session expires", async () => {
    let mainHits = 0;

    svc.registerAction({
      metadata: {
        flowId: "main",
        actionId: "open-sub",
        key: "main.open-sub",
        options: { label: "Open sub" },
      },
      methodRef: () => {},
      handler: async (ctx: any) => {
        await svc.start(ctx, {
          flowId: "sub",
          text: "Sub root",
          mode: "push",
          columns: 1,
        });
        return "handled";
      },
    });

    svc.registerAction({
      metadata: {
        flowId: "main",
        actionId: "ping",
        key: "main.ping",
        options: { label: "Main ping" },
      },
      methodRef: () => {},
      handler: async () => {
        mainHits += 1;
        return "handled";
      },
    });

    svc.registerAction({
      metadata: {
        flowId: "sub",
        actionId: "ping",
        key: "sub.ping",
        options: { label: "Sub ping" },
      },
      methodRef: () => {},
      handler: async () => "handled",
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "main", text: "Main root", columns: 1 });

    const rootKb = (ctx.reply as jest.Mock).mock.calls[0][1].reply_markup
      .inline_keyboard;
    const openSubBtn = rootKb.flat().find((b: any) => b.text === "Open sub");
    const mainPingBtn = rootKb.flat().find((b: any) => b.text === "Main ping");

    const { ctx: cbCtx1 } = makeCtx(1, openSubBtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    const subRender =
      (cbCtx1.editMessageText as jest.Mock).mock.calls[0] ??
      (cbCtx1.reply as jest.Mock).mock.calls[0];
    const subPingBtn = subRender[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Sub ping");

    const statesByChat = (svc as any).statesByChat as Map<number, any[]>;
    const subState = statesByChat.get(1)?.[1];
    expect(subState).toBeDefined();

    const originalGet = store.get.bind(store);
    jest.spyOn(store, "get").mockImplementation((id: string) => {
      if (id === subState.sessionId) return undefined as any;
      return originalGet(id);
    });

    const { ctx: cbCtx2, answered: a2 } = makeCtx(1, subPingBtn.callback_data);
    await svc.handleCallback(cbCtx2, runWithChat);
    expect(a2).toContain("Session expired");

    const { ctx: cbCtx3 } = makeCtx(1, mainPingBtn.callback_data);
    await svc.handleCallback(cbCtx3, runWithChat);
    expect(mainHits).toBe(1);
  });

  it("supports parentActionId-based child linking", async () => {
    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "rootA",
        key: "test.rootA",
        options: { label: "Root A" },
      },
      methodRef: function rootA() {},
      handler: async () => "rerender",
    });

    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "childA",
        key: "test.childA",
        options: { label: "Child A", parentActionId: "rootA" },
      },
      methodRef: function childA() {},
      handler: async () => "handled",
    });

    const { ctx } = makeCtx();
    await svc.start(ctx, { flowId: "test", text: "Root menu" });

    const rootReply = (ctx.reply as jest.Mock).mock.calls[0];
    const rootABtn = rootReply[1].reply_markup.inline_keyboard
      .flat()
      .find((b: any) => b.text === "Root A");
    expect(rootABtn).toBeDefined();

    const { ctx: cbCtx1, edited } = makeCtx(1, rootABtn.callback_data);
    await svc.handleCallback(cbCtx1, runWithChat);

    const labels = edited[0].reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.text);
    expect(labels).toContain("Child A");
  });

  it("can start menu with sender without Telegraf Context", async () => {
    svc.registerAction({
      metadata: {
        flowId: "test",
        actionId: "x",
        key: "test.x",
        options: { label: "X" },
      },
      methodRef: function x() {},
      handler: async () => "handled",
    });

    const sent: any[] = [];
    await svc.startWithSender(
      777,
      {
        send: async (text, extra) => {
          sent.push({ text, extra });
          return { message_id: 1 };
        },
      },
      { flowId: "test", text: "Hello menu" },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0].text).toBe("Hello menu");
    const labels = sent[0].extra.reply_markup.inline_keyboard
      .flat()
      .map((b: any) => b.text);
    expect(labels).toContain("X");
  });
});
