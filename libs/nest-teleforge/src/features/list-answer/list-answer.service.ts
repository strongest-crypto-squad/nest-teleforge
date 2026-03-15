import { Injectable } from "@nestjs/common";
import { Context, Markup } from "telegraf";
import {
  ListAnswerOptions,
  ListAnswerResult,
  PageItem,
} from "./dto/list-answer.types";
import { normalizePredicates, checkPredicate } from "./list-answer.utils";
import { WaitManager } from "../../wait-manager";

const PAGE_SIZE = 5;

@Injectable()
export class ListAnswerService {
  constructor(private readonly waitManager: WaitManager) {}

  private readonly callbackPrefix = "la:";

  async ask<T>(
    ctx: Context,
    list: T[],
    options: ListAnswerOptions<T>,
  ): Promise<ListAnswerResult<T>> {
    const {
      getLabel,
      getKey,
      predicate,
      disabledStrategy = "disable",
      disabledLabelSuffix = " (unavailable)",
      message = "Choose an option:",
      cancel,
      timeoutMs = 60_000,
      onBeforeShow,
      onSelect,
    } = options;

    const chatId = ctx.chat!.id;
    const predicates = normalizePredicates(predicate);

    // 1️⃣ Prepare items
    const items: PageItem<T>[] = [];

    for (const item of list) {
      const enabled = await checkPredicate(item, predicates, ctx);

      if (!enabled && disabledStrategy === "hide") continue;

      items.push({
        key: getKey ? getKey(item) : crypto.randomUUID(),
        item,
        enabled,
        label: enabled ? getLabel(item) : getLabel(item) + disabledLabelSuffix,
      });
    }

    if (onBeforeShow) {
      await onBeforeShow(list, ctx);
    }

    let page = 0;
    const totalPages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
    const nonce = crypto.randomUUID().replace(/-/g, "").slice(0, 10);
    const callbackNamespace = `${this.callbackPrefix}${nonce}:`;
    const pagePrev = `${callbackNamespace}page_prev`;
    const pageNext = `${callbackNamespace}page_next`;
    const cancelValue = `${callbackNamespace}cancel`;
    const disabledValue = `${callbackNamespace}disabled`;

    // 2️⃣ Send message
    const sent = await ctx.reply(
      message,
      this.buildKeyboard(items, page, totalPages, cancel, {
        callbackNamespace,
        pagePrev,
        pageNext,
        cancelValue,
        disabledValue,
      }),
    );

    // 3️⃣ Event loop
    while (true) {
      let text: string;

      try {
        text = await this.waitManager.create(chatId, timeoutMs, undefined, {
          scope: `list-answer:${nonce}`,
          matcher: (input) => input.startsWith(callbackNamespace),
        });
      } catch (err: any) {
        if (err.message === "Timed out") {
          return { type: "timeout" };
        }
        return { type: "cancel" };
      }

      // cancel
      if (cancel && text === cancelValue) {
        return { type: "cancel" };
      }

      // pagination
      if (text === pagePrev) {
        page = Math.max(0, page - 1);
        await ctx.telegram.editMessageReplyMarkup(
          chatId,
          sent.message_id,
          undefined,
          this.buildKeyboard(items, page, totalPages, cancel, {
            callbackNamespace,
            pagePrev,
            pageNext,
            cancelValue,
            disabledValue,
          }).reply_markup,
        );
        continue;
      }

      if (text === pageNext) {
        page = Math.min(totalPages - 1, page + 1);
        await ctx.telegram.editMessageReplyMarkup(
          chatId,
          sent.message_id,
          undefined,
          this.buildKeyboard(items, page, totalPages, cancel, {
            callbackNamespace,
            pagePrev,
            pageNext,
            cancelValue,
            disabledValue,
          }).reply_markup,
        );
        continue;
      }

      // selection
      if (!text.startsWith(callbackNamespace)) {
        continue;
      }

      const selectedKey = text.slice(callbackNamespace.length);
      const selected = items.find((i) => i.key === selectedKey);

      if (!selected || !selected.enabled) {
        // invalid -> ignore
        continue;
      }

      if (onSelect) {
        await onSelect(selected.item, ctx);
      }

      return { type: "selected", item: selected.item };
    }
  }

  // 4️⃣ Keyboard builder
  private buildKeyboard<T>(
    items: PageItem<T>[],
    page: number,
    totalPages: number,
    cancel?: { label?: string; value?: string },
    callbackValues?: {
      callbackNamespace: string;
      pagePrev: string;
      pageNext: string;
      cancelValue: string;
      disabledValue: string;
    },
  ) {
    if (!callbackValues) {
      throw new Error("ListAnswerService callback values are required");
    }

    const start = page * PAGE_SIZE;
    const pageItems = items.slice(start, start + PAGE_SIZE);

    type CallbackBtn = ReturnType<typeof Markup.button.callback>;

    const rows: CallbackBtn[][] = [];

    for (const i of pageItems) {
      rows.push([
        Markup.button.callback(
          i.label,
          i.enabled
            ? `${callbackValues.callbackNamespace}${i.key}`
            : callbackValues.disabledValue,
        ),
      ]);
    }

    const navigation: CallbackBtn[] = [];

    if (page > 0) {
      navigation.push(Markup.button.callback("⬅️", callbackValues.pagePrev));
    }

    if (page < totalPages - 1) {
      navigation.push(Markup.button.callback("➡️", callbackValues.pageNext));
    }

    if (navigation.length) {
      rows.push(navigation);
    }

    if (cancel) {
      rows.push([
        Markup.button.callback(
          cancel.label ?? "Cancel",
          callbackValues.cancelValue,
        ),
      ]);
    }

    return Markup.inlineKeyboard(rows);
  }
}
