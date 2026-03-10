import { Injectable } from "@nestjs/common";
import type { TgCtx } from "./menu.types";
import type { Context } from "telegraf";
import type { MenuSession } from "./menu-session.store";
import type { MenuContext } from "./menu.decorator";

@Injectable()
export class MenuContextBuilder {
  async build(ctx: Context): Promise<TgCtx> {
    const user = {
      id: ctx.from?.id,
      username: ctx.from?.username,
      isAdmin: false,
      paid: false,
      notificationsEnabled: false,
    };
    return { user };
  }

  /**
   * Build a `MenuContext` that includes the session (and optional button data).
   */
  buildWithSession(
    ctx: Context,
    session: MenuSession,
    buttonData?: any,
  ): MenuContext {
    const user = {
      id: ctx.from?.id,
      username: ctx.from?.username,
      isAdmin: false,
      paid: false,
      notificationsEnabled: false,
    };
    return { user, session, buttonData };
  }
}
