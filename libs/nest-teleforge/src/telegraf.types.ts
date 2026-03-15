export type {
  Context,
  MiddlewareFn,
  NarrowedContext,
  Telegram,
} from "telegraf";

import type { Context, NarrowedContext } from "telegraf";

export type CallbackQueryContext = NarrowedContext<
  Context,
  {
    update_id: number;
    callback_query: NonNullable<Context["callbackQuery"]>;
  }
>;
