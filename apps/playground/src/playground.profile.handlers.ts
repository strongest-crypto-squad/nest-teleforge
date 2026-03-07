import { Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import {
  MenuAction,
  MenuActionResult,
} from "libs/my-lib/src/features/menu/menu.decorator";

@Injectable()
export class PlaygroundProfileHandlers {
  @MenuAction("main.home.profile.view")
  async onProfileView(ctx: Context): Promise<MenuActionResult> {
    await ctx.answerCbQuery();
    await ctx.editMessageText("👤 Профиль\n(кастомный контент из @MenuAction)");
    return "handled";
  }

  @MenuAction("main.home.settings.notifications")
  async onToggleNotif(ctx: Context): Promise<MenuActionResult> {
    await ctx.answerCbQuery("Уведомления переключены");
    return "rerender";
  }
}
