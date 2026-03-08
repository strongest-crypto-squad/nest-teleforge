import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';
import { MenuContextBuilder } from './menu.context.builder';
import {
  MenuActionMetadata,
  MenuActionOptions,
  MenuActionResult,
  MenuPredicate,
} from './menu.decorator';

type RegisteredMenuAction = {
  key: string;
  flowId: string;
  actionId: string;
  options: MenuActionOptions;
  methodRef: Function;
  handler: (ctx: Context, mctx: any) => Promise<MenuActionResult | void>;
};

type MenuState = {
  flowId: string;
  stack: string[];
  rootText: string;
  rootColumns: number;
  rootParentFunction?: Function;
  renderSeq: number;
  callbackLookup: Map<string, string>;
};

type CallbackPayload = {
  flowId: string;
  token: string;
};

@Injectable()
export class MenuService {
  private readonly actionsByKey = new Map<string, RegisteredMenuAction>();
  private readonly actionsByFlow = new Map<string, RegisteredMenuAction[]>();
  private readonly statesByChat = new Map<number, MenuState[]>();
  private readonly callbackPrefix = 'm2:';

  constructor(private readonly builder: MenuContextBuilder) {}

  registerAction(params: {
    metadata: MenuActionMetadata;
    methodRef: Function;
    handler: (ctx: Context, mctx: any) => Promise<MenuActionResult | void>;
  }) {
    const { metadata, methodRef, handler } = params;

    const key = this.buildKey(metadata.flowId, metadata.actionId);

    const action: RegisteredMenuAction = {
      key,
      flowId: metadata.flowId,
      actionId: metadata.actionId,
      options: metadata.options ?? {},
      methodRef,
      handler,
    };

    this.actionsByKey.set(key, action);

    const flowActions = this.actionsByFlow.get(metadata.flowId) ?? [];
    const withoutOld = flowActions.filter((x) => x.key !== key);
    withoutOld.push(action);
    this.actionsByFlow.set(metadata.flowId, withoutOld);
  }

  async start(
    ctx: Context,
    opts: {
      flowId: string;
      text: string;
      columns?: number;
      parentFunction?: Function;
      mode?: 'replace' | 'push';
      reuseCurrentMessage?: boolean;
    },
  ) {
    const chatId = ctx.chat?.id;
    if (chatId == null) return;

    const state: MenuState = {
      flowId: opts.flowId,
      stack: [],
      rootText: opts.text,
      rootColumns: Math.max(1, Math.min(5, opts.columns ?? 2)),
      rootParentFunction: opts.parentFunction,
      renderSeq: 0,
      callbackLookup: new Map(),
    };

    const mode = opts.mode ?? 'replace';
    const existing = this.statesByChat.get(chatId) ?? [];
    const nextStates = mode === 'push' ? [...existing, state] : [state];

    this.statesByChat.set(chatId, nextStates);
    const preferEdit = opts.reuseCurrentMessage ?? true;
    const renderMode: 'send' | 'edit' =
      preferEdit && this.canEditCurrentMessage(ctx) ? 'edit' : 'send';

    await this.render(ctx, state, renderMode);
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

    states.pop();

    if (states.length === 0) {
      this.statesByChat.delete(chatId);
      return;
    }

    this.statesByChat.set(chatId, states);

    if (opts?.renderPrevious) {
      const previous = states[states.length - 1];
      const renderMode: 'send' | 'edit' = this.canEditCurrentMessage(ctx)
        ? 'edit'
        : 'send';
      await this.render(ctx, previous, renderMode);
    }
  }

  async handleCallback(
    ctx: Context,
    runWithChat: <T>(fn: () => Promise<T>) => Promise<T>,
  ): Promise<boolean> {
    const data = (ctx.update as any)?.callback_query?.data as string | undefined;
    if (!data || !data.startsWith(this.callbackPrefix)) {
      return false;
    }

    const payload = this.parseCallback(data);
    if (!payload) {
      await this.safeAnswerCbQuery(ctx, 'Invalid menu button');
      return true;
    }

    const chatId = ctx.chat?.id;
    if (chatId == null) {
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    const states = this.statesByChat.get(chatId) ?? [];
    const state = states[states.length - 1];
    if (!state || state.flowId !== payload.flowId) {
      await this.safeAnswerCbQuery(ctx, 'Menu is unavailable');
      return true;
    }

    const actionId = state.callbackLookup.get(payload.token);
    if (!actionId) {
      await this.safeAnswerCbQuery(ctx, 'Button is outdated');
      return true;
    }

    if (actionId === '__back__') {
      if (state.stack.length > 0) state.stack.pop();
      await this.render(ctx, state, 'edit');
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    const key = this.buildKey(payload.flowId, actionId);
    const action = this.actionsByKey.get(key);
    if (!action) {
      await this.safeAnswerCbQuery(ctx, 'Action not found');
      return true;
    }

    const mctx = await this.builder.build(ctx);

    const allowed = await this.evalPred(action.options.guard, mctx);
    if (!allowed) {
      await this.safeAnswerCbQuery(ctx, 'Unavailable');
      return true;
    }

    const enabled = await this.evalEnabled(action.options.disabled, mctx);
    if (!enabled) {
      await this.safeAnswerCbQuery(ctx, action.options.disabledText || 'Unavailable');
      return true;
    }

    const outcome = await runWithChat(() => action.handler(ctx, mctx));

    if (outcome === 'handled') {
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    if (outcome === 'rerender-parent') {
      if (state.stack.length > 0) state.stack.pop();
      await this.render(ctx, state, 'edit');
      await this.safeAnswerCbQuery(ctx);
      return true;
    }

    const currentKey = state.stack[state.stack.length - 1];
    if (currentKey !== action.key) {
      state.stack.push(action.key);
    }

    await this.render(ctx, state, 'edit');
    await this.safeAnswerCbQuery(ctx);
    return true;
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
    parentFunction: Function | undefined,
  ): RegisteredMenuAction[] {
    return (this.actionsByFlow.get(flowId) ?? [])
      .filter((action) => {
        if (action.options.hidden) return false;
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

  private async render(ctx: Context, state: MenuState, mode: 'send' | 'edit') {
    const current = this.getCurrentAction(state);
    const parentFunction = current?.methodRef ?? state.rootParentFunction;
    const mctx = await this.builder.build(ctx);

    const visibleChildren: RegisteredMenuAction[] = [];
    for (const child of this.getChildren(state.flowId, parentFunction)) {
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
        callback_data: this.packCallback({ flowId: state.flowId, token }),
      });

      if (row.length >= columns) {
        rows.push(row);
        row = [];
      }
    }

    if (row.length) rows.push(row);

    const showBack = state.stack.length > 0 && (current?.options.back ?? true);
    if (showBack) {
      const backToken = `${seqToken}.b`;
      callbackLookup.set(backToken, '__back__');

      rows.push([
        {
          text: '⬅️ Back',
          callback_data: this.packCallback({ flowId: state.flowId, token: backToken }),
        },
      ]);
    }

    state.callbackLookup = callbackLookup;

    const text = current?.options.description ?? current?.options.label ?? state.rootText;
    const reply_markup = { inline_keyboard: rows };

    if (mode === 'edit') {
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

  private packCallback(payload: CallbackPayload): string {
    return `${this.callbackPrefix}${payload.flowId}:${payload.token}`;
  }

  private parseCallback(data: string): CallbackPayload | null {
    try {
      const raw = data.slice(this.callbackPrefix.length);
      const [flowId, token] = raw.split(':', 2);

      if (!flowId || !token) {
        return null;
      }

      return { flowId, token };
    } catch {
      return null;
    }
  }

  private canEditCurrentMessage(ctx: Context): boolean {
    const callbackMessageId = (ctx.update as any)?.callback_query?.message?.message_id;
    return typeof callbackMessageId === 'number';
  }
}
