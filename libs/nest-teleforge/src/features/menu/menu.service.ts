import { Inject, Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import {
  MENU_SESSION_STORE,
  IMenuSessionStore,
  MenuSession,
} from "./menu-session.store";
import { MenuContextBuilder } from "./menu.context.builder";
import {
  DynamicButton,
  MenuActionMetadata,
  MenuActionOptions,
  MenuActionResult,
  MenuContext,
  MenuPredicate,
} from "./menu.decorator";

// ─── Internal types ─────────────────────────────────────────────

type RegisteredMenuAction = {
  key: string;
  flowId: string;
  actionId: string;
  options: MenuActionOptions;
  methodRef: Function;
  handler: (
    ctx: Context,
    mctx: MenuContext,
  ) => Promise<MenuActionResult | void>;
  /** Bound provider that returns dynamic buttons (set by MenuExplorer). */
  dynamicProvider?: (
    ctx: Context,
    mctx: MenuContext,
  ) => Promise<DynamicButton[]>;
};

/** @internal Dynamic button metadata stored in MenuState per render. */
type DynamicEntry = {
  label: string;
  dataKey: string;
  disabled?: boolean;
  disabledText?: string;
};

type MenuState = {
  flowId: string;
  sessionId: string;
  stack: string[];
  rootText: string;
  rootColumns: number;
  rootParentFunction?: Function;
  renderSeq: number;
  callbackLookup: Map<string, string>;

  // ── dynamic buttons (rebuilt on every render if provider exists) ──
  dynamicEntries?: DynamicEntry[];
  dynamicActionKey?: string;
};

type CallbackPayload = {
  flowId: string;
  sessionId: string;
  token: string;
};

export type MenuStartOptions = {
  flowId: string;
  text: string;
  columns?: number;
  parentFunction?: Function;
  mode?: "replace" | "push";
  reuseCurrentMessage?: boolean;
  sessionData?: any;
};

export type MenuMessageSender = {
  send: (text: string, extra: any) => Promise<any>;
  edit?: (text: string, extra: any) => Promise<any>;
  answerCbQuery?: (text?: string) => Promise<any>;
  from?: {
    id?: number;
    username?: string;
  };
};

@Injectable()
export class MenuService {
  private readonly actionsByKey = new Map<string, RegisteredMenuAction>();
  private readonly actionsByFlow = new Map<string, RegisteredMenuAction[]>();
  private readonly statesByChat = new Map<number, MenuState[]>();
  private readonly dynamicDataBySession = new Map<string, Map<string, any>>();
  private readonly callbackPrefix = "m3:";

  constructor(
    private readonly builder: MenuContextBuilder,
    @Inject(MENU_SESSION_STORE)
    private readonly sessionStore: IMenuSessionStore,
  ) {}

  // ── Registration ─────────────────────────────────────────────

  registerAction(params: {
    metadata: MenuActionMetadata;
    methodRef: Function;
    handler: (
      ctx: Context,
      mctx: MenuContext,
    ) => Promise<MenuActionResult | void>;
    dynamicProvider?: (
      ctx: Context,
      mctx: MenuContext,
    ) => Promise<DynamicButton[]>;
  }) {
    const { metadata, methodRef, handler, dynamicProvider } = params;
    const key = this.buildKey(metadata.flowId, metadata.actionId);

    const action: RegisteredMenuAction = {
      key,
      flowId: metadata.flowId,
      actionId: metadata.actionId,
      options: metadata.options ?? {},
      methodRef,
      handler,
      dynamicProvider,
    };

    this.actionsByKey.set(key, action);

    const flowActions = this.actionsByFlow.get(metadata.flowId) ?? [];
    const withoutOld = flowActions.filter((x) => x.key !== key);
    withoutOld.push(action);
    this.actionsByFlow.set(metadata.flowId, withoutOld);
  }

  // ── Lifecycle ────────────────────────────────────────────────

  async start(ctx: Context, opts: MenuStartOptions) {
    const chatId = ctx.chat?.id;
    if (chatId == null) return;

    const session = this.sessionStore.create(
      opts.flowId,
      opts.sessionData ?? {},
    );

    const state: MenuState = {
      flowId: opts.flowId,
      sessionId: session.id,
      stack: [],
      rootText: opts.text,
      rootColumns: Math.max(1, Math.min(5, opts.columns ?? 2)),
      rootParentFunction: opts.parentFunction,
      renderSeq: 0,
      callbackLookup: new Map(),
    };

    const mode = opts.mode ?? "replace";
    const existing = this.statesByChat.get(chatId) ?? [];
    if (mode === "replace") {
      for (const prev of existing) {
        this.sessionStore.delete(prev.sessionId);
        this.dynamicDataBySession.delete(prev.sessionId);
      }
    }
    const nextStates = mode === "push" ? [...existing, state] : [state];

    this.statesByChat.set(chatId, nextStates);
    const preferEdit = opts.reuseCurrentMessage ?? true;
    const renderMode: "send" | "edit" =
      preferEdit && this.canEditCurrentMessage(ctx) ? "edit" : "send";

    await this.render(ctx, state, renderMode);
  }

  async startWithSender(
    chatId: number,
    sender: MenuMessageSender,
    opts: MenuStartOptions,
  ) {
    const syntheticCtx = this.createSyntheticContext(chatId, sender);
    await this.start(syntheticCtx, opts);
  }

  async startByChat(
    chatId: number,
    opts: MenuStartOptions,
    telegram: {
      sendMessage: (chatId: number, text: string, extra: any) => Promise<any>;
      editMessageText?: (
        chatId: number,
        messageId: number,
        inlineMessageId: string | undefined,
        text: string,
        extra?: any,
      ) => Promise<any>;
    },
    from?: {
      id?: number;
      username?: string;
    },
  ) {
    await this.startWithSender(
      chatId,
      {
        send: (text, extra) => telegram.sendMessage(chatId, text, extra),
        from,
      },
      opts,
    );
  }

  async closeCurrent(
    ctx: Context,
    opts?: {
      renderPrevious?: boolean;
    },
  ) {
    const chatId = ctx.chat?.id;
    if (chatId == null) return;

    const states = this.statesByChat.get(chatId) ?? [];
    if (states.length === 0) return;

    const removed = states.pop()!;
    this.sessionStore.delete(removed.sessionId);
    this.dynamicDataBySession.delete(removed.sessionId);

    if (states.length === 0) {
      this.statesByChat.delete(chatId);
      return;
    }

    this.statesByChat.set(chatId, states);

    if (opts?.renderPrevious) {
      const previous = states[states.length - 1];
      const renderMode: "send" | "edit" = this.canEditCurrentMessage(ctx)
        ? "edit"
        : "send";
      await this.render(ctx, previous, renderMode);
    }
  }

  // ── Callback handling ────────────────────────────────────────

  async handleCallback(
    ctx: Context,
    runWithChat: <T>(fn: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    const data = (ctx.update as any)?.callback_query?.data as
      | string
      | undefined;
    if (!data || !data.startsWith(this.callbackPrefix)) {
      return false;
    }

    const payload = this.parseCallback(data);
    if (!payload) {
      await this.safeAnswerCbQuery(ctx, "Invalid menu button");
      return true;
    }

    const chatId = ctx.chat?.id;
    if (chatId == null) {
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    const states = this.statesByChat.get(chatId) ?? [];
    const state = this.findStateBySession(
      states,
      payload.flowId,
      payload.sessionId,
    );
    if (!state) {
      await this.safeAnswerCbQuery(ctx, "Menu is unavailable");
      return true;
    }

    const lookupValue = state.callbackLookup.get(payload.token);
    if (!lookupValue) {
      await this.safeAnswerCbQuery(ctx, "Button is outdated");
      return true;
    }

    // ── Dynamic button callback (d:<dataKey>) ──
    if (lookupValue.startsWith("d:")) {
      return this.handleDynamicCallback(ctx, state, lookupValue, runWithChat);
    }

    const actionId = lookupValue;

    if (actionId === "__back__") {
      this.clearDynamic(state, this.sessionStore.get(state.sessionId));
      if (state.stack.length > 0) state.stack.pop();
      await this.render(ctx, state, "edit");
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    const key = this.buildKey(payload.flowId, actionId);
    const action = this.actionsByKey.get(key);
    if (!action) {
      await this.safeAnswerCbQuery(ctx, "Action not found");
      return true;
    }

    const session = this.sessionStore.get(state.sessionId);
    if (!session) {
      await this.safeAnswerCbQuery(ctx, "Session expired");
      return true;
    }

    const mctx = this.builder.buildWithSession(ctx, session);

    const allowed = await this.evalPred(action.options.guard, mctx);
    if (!allowed) {
      await this.safeAnswerCbQuery(ctx, "Unavailable");
      return true;
    }

    const enabled = await this.evalEnabled(action.options.disabled, mctx);
    if (!enabled) {
      await this.safeAnswerCbQuery(
        ctx,
        action.options.disabledText || "Unavailable",
      );
      return true;
    }

    const outcome = await runWithChat(() => action.handler(ctx, mctx));

    if (outcome === "handled") {
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    if (outcome === "rerender-parent") {
      this.clearDynamic(state, session);
      if (state.stack.length > 0) state.stack.pop();
      await this.render(ctx, state, "edit");
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    // Default: push & rerender
    this.clearDynamic(state, session);
    const currentKey = state.stack[state.stack.length - 1];
    if (currentKey !== action.key) {
      state.stack.push(action.key);
    }

    await this.render(ctx, state, "edit");
    await this.safeAnswerCbQuery(ctx);
    return true;
  }

  // ── Dynamic‑button helpers ──────────────────────────────────────

  private async handleDynamicCallback(
    ctx: Context,
    state: MenuState,
    lookupValue: string,
    runWithChat: <T>(fn: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    const dataKey = lookupValue.slice(2); // strip 'd:'

    const session = this.sessionStore.get(state.sessionId);
    if (!session) {
      await this.safeAnswerCbQuery(ctx, "Session expired");
      return true;
    }

    const btnStore = this.dynamicDataBySession.get(state.sessionId);
    const buttonData = btnStore?.get(dataKey);
    if (buttonData === undefined) {
      await this.safeAnswerCbQuery(ctx, "Button data expired");
      return true;
    }

    if (!state.dynamicActionKey) {
      await this.safeAnswerCbQuery(ctx, "Action not found");
      return true;
    }

    const action = this.actionsByKey.get(state.dynamicActionKey);
    if (!action) {
      await this.safeAnswerCbQuery(ctx, "Action not found");
      return true;
    }

    // Check disabled
    const entry = state.dynamicEntries?.find((e) => e.dataKey === dataKey);
    if (entry?.disabled) {
      await this.safeAnswerCbQuery(ctx, entry.disabledText || "Unavailable");
      return true;
    }

    const mctx = this.builder.buildWithSession(ctx, session, buttonData);

    const allowed = await this.evalPred(action.options.guard, mctx);
    if (!allowed) {
      await this.safeAnswerCbQuery(ctx, "Unavailable");
      return true;
    }

    const enabled = await this.evalEnabled(action.options.disabled, mctx);
    if (!enabled) {
      await this.safeAnswerCbQuery(
        ctx,
        action.options.disabledText || "Unavailable",
      );
      return true;
    }

    const outcome = await runWithChat(() => action.handler(ctx, mctx));

    if (outcome === "handled") {
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    if (outcome === "rerender-parent") {
      this.clearDynamic(state, session);
      if (state.stack.length > 0) state.stack.pop();
      await this.render(ctx, state, "edit");
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    // 'rerender' or undefined → refresh dynamic buttons from provider
    await this.render(ctx, state, "edit");
    await this.safeAnswerCbQuery(ctx);
    return true;
  }

  /** Wipe dynamic‑button metadata from state. */
  private clearDynamic(state: MenuState, session?: MenuSession) {
    state.dynamicEntries = undefined;
    state.dynamicActionKey = undefined;
    if (session) {
      this.dynamicDataBySession.delete(session.id);
    }
  }

  private buildKey(flowId: string, actionId: string): string {
    return `${flowId}::${actionId}`;
  }

  private getCurrentAction(state: MenuState): RegisteredMenuAction | undefined {
    const currentKey = state.stack[state.stack.length - 1];
    if (!currentKey) return undefined;
    return this.actionsByKey.get(currentKey);
  }

  private getChildren(
    flowId: string,
    parentAction: RegisteredMenuAction | undefined,
    rootParentFunction: Function | undefined,
  ): RegisteredMenuAction[] {
    return (this.actionsByFlow.get(flowId) ?? [])
      .filter((action) => {
        if (action.options.hidden) return false;

        if (action.options.parentActionId) {
          return parentAction?.actionId === action.options.parentActionId;
        }

        const parentFunction = parentAction?.methodRef ?? rootParentFunction;
        return action.options.parentFunction === parentFunction;
      })
      .sort((a, b) => {
        const ao = a.options.order ?? 0;
        const bo = b.options.order ?? 0;
        if (ao !== bo) return ao - bo;
        const al = a.options.label ?? a.actionId;
        const bl = b.options.label ?? b.actionId;
        return al.localeCompare(bl);
      });
  }

  private async render(ctx: Context, state: MenuState, mode: "send" | "edit") {
    const current = this.getCurrentAction(state);

    const session = this.sessionStore.get(state.sessionId);
    const mctx = this.builder.buildWithSession(
      ctx,
      session ?? { id: state.sessionId, flowId: state.flowId, data: {} },
    );

    const visibleChildren: RegisteredMenuAction[] = [];
    for (const child of this.getChildren(
      state.flowId,
      current,
      state.rootParentFunction,
    )) {
      const allowed = await this.evalPred(child.options.guard, mctx);
      if (allowed) visibleChildren.push(child);
    }

    const columns = Math.max(
      1,
      Math.min(5, current?.options.columns ?? state.rootColumns),
    );

    const rows: Array<Array<{ text: string; callback_data: string }>> = [];
    let row: Array<{ text: string; callback_data: string }> = [];
    const callbackLookup = new Map<string, string>();
    state.renderSeq += 1;
    const seqToken = state.renderSeq.toString(36);
    let tokenIndex = 0;

    for (const child of visibleChildren) {
      const token = `${seqToken}.${(tokenIndex++).toString(36)}`;
      callbackLookup.set(token, child.actionId);

      row.push({
        text: child.options.label ?? child.actionId,
        callback_data: this.packCallback({
          flowId: state.flowId,
          sessionId: state.sessionId,
          token,
        }),
      });

      if (row.length >= columns) {
        rows.push(row);
        row = [];
      }
    }

    if (row.length) rows.push(row);

    // ── Dynamic buttons from provider ──
    if (current?.dynamicProvider) {
      try {
        const dynButtons = await current.dynamicProvider(ctx, mctx);
        if (dynButtons?.length) {
          const btnStore = new Map<string, any>();
          const entries: DynamicEntry[] = [];

          for (const btn of dynButtons) {
            if (btn.hidden) continue;
            const dataKey = (tokenIndex++).toString(36);
            btnStore.set(dataKey, btn.data);
            entries.push({
              label: btn.label,
              dataKey,
              disabled: btn.disabled,
              disabledText: btn.disabledText,
            });
          }

          // Sort by order
          const orderMap = new Map(
            dynButtons
              .filter((b) => !b.hidden)
              .map((b) => [b.label, b.order ?? 0]),
          );
          entries.sort(
            (a, b) =>
              (orderMap.get(a.label) ?? 0) - (orderMap.get(b.label) ?? 0),
          );

          if (session) {
            this.dynamicDataBySession.set(session.id, btnStore);
          }

          state.dynamicEntries = entries;
          state.dynamicActionKey = current.key;

          // Render dynamic button rows
          const dynCols = Math.max(
            1,
            Math.min(5, current.options.columns ?? columns),
          );
          let dynRow: Array<{ text: string; callback_data: string }> = [];

          for (const entry of entries) {
            const token = `${seqToken}.${entry.dataKey}`;
            callbackLookup.set(token, `d:${entry.dataKey}`);

            dynRow.push({
              text: entry.label,
              callback_data: this.packCallback({
                flowId: state.flowId,
                sessionId: state.sessionId,
                token,
              }),
            });

            if (dynRow.length >= dynCols) {
              rows.push(dynRow);
              dynRow = [];
            }
          }
          if (dynRow.length) rows.push(dynRow);
        } else {
          this.clearDynamic(state, session);
        }
      } catch {
        this.clearDynamic(state, session);
      }
    } else {
      this.clearDynamic(state, session);
    }

    const showBack = state.stack.length > 0 && (current?.options.back ?? true);
    if (showBack) {
      const backToken = `${seqToken}.b`;
      callbackLookup.set(backToken, "__back__");

      rows.push([
        {
          text: "⬅️ Back",
          callback_data: this.packCallback({
            flowId: state.flowId,
            sessionId: state.sessionId,
            token: backToken,
          }),
        },
      ]);
    }

    state.callbackLookup = callbackLookup;

    const text =
      current?.options.description ?? current?.options.label ?? state.rootText;
    const reply_markup = { inline_keyboard: rows };

    if (mode === "edit") {
      await this.safeEditOrSend(ctx, text, reply_markup);
      return;
    }

    await ctx.reply(text, { reply_markup });
  }

  private async safeEditOrSend(ctx: Context, text: string, reply_markup: any) {
    try {
      await ctx.editMessageText(text, { reply_markup });
    } catch {
      await ctx.reply(text, { reply_markup });
    }
  }

  private async safeAnswerCbQuery(ctx: Context, text?: string) {
    try {
      if (text) {
        await ctx.answerCbQuery(text);
      } else {
        await ctx.answerCbQuery();
      }
    } catch {}
  }

  private async evalPred(
    predicate: MenuPredicate | MenuPredicate[] | undefined,
    mctx: any,
  ): Promise<boolean> {
    if (!predicate) return true;

    const predicates = Array.isArray(predicate) ? predicate : [predicate];
    for (const fn of predicates) {
      const ok = await Promise.resolve(fn(mctx));
      if (!ok) return false;
    }

    return true;
  }

  private async evalEnabled(
    predicate: MenuPredicate | MenuPredicate[] | undefined,
    mctx: any,
  ): Promise<boolean> {
    if (!predicate) return true;

    const predicates = Array.isArray(predicate) ? predicate : [predicate];
    for (const fn of predicates) {
      const disabled = await Promise.resolve(fn(mctx));
      if (disabled) return false;
    }

    return true;
  }

  // ── Callback packing (m3:<flowId>:<sessionShort>:<token>) ───

  private packCallback(payload: CallbackPayload): string {
    const shortSession = payload.sessionId.replace(/-/g, "").slice(0, 8);
    return `${this.callbackPrefix}${payload.flowId}:${shortSession}:${payload.token}`;
  }

  private parseCallback(data: string): CallbackPayload | null {
    try {
      const raw = data.slice(this.callbackPrefix.length);
      const parts = raw.split(":");
      if (parts.length < 3) return null;

      const flowId = parts[0];
      const sessionShort = parts[1];
      const token = parts.slice(2).join(":");

      if (!flowId || !sessionShort || !token) return null;

      return { flowId, sessionId: sessionShort, token };
    } catch {
      return null;
    }
  }

  /** Match a state by short session prefix. */
  private findStateBySession(
    states: MenuState[],
    flowId: string,
    sessionShort: string,
  ): MenuState | undefined {
    return states.find(
      (s) =>
        s.flowId === flowId &&
        s.sessionId.replace(/-/g, "").startsWith(sessionShort),
    );
  }

  private canEditCurrentMessage(ctx: Context): boolean {
    const callbackMessageId = (ctx.update as any)?.callback_query?.message
      ?.message_id;
    return typeof callbackMessageId === "number";
  }

  private createSyntheticContext(
    chatId: number,
    sender: MenuMessageSender,
  ): Context {
    return {
      chat: { id: chatId },
      from: sender.from,
      update: {},
      reply: (text: string, extra: any) => sender.send(text, extra),
      editMessageText: async (text: string, extra: any) => {
        if (sender.edit) {
          return sender.edit(text, extra);
        }

        return sender.send(text, extra);
      },
      answerCbQuery: async (text?: string) => sender.answerCbQuery?.(text),
    } as unknown as Context;
  }
}
