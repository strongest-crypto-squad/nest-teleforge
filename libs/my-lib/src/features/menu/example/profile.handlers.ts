import { Injectable } from '@nestjs/common';
import type { Context } from 'telegraf';
import { MenuAction, type MenuActionResult } from '../menu.decorator';
@Injectable()
export class ProfileHandlers {
  @MenuAction('main.home.profile.view') async onProfileView(
    ctx: Context,
  ): Promise<MenuActionResult> {
    await ctx.answerCbQuery();
    await ctx.editMessageText('👤 Профиль\n(кастомный контент из @MenuAction)');
    return 'handled';
  }
  @MenuAction('main.home.settings.notifications') async onToggleNotif(
    ctx: Context,
  ): Promise<MenuActionResult> {
    await ctx.answerCbQuery('Уведомления переключены');
    return 'rerender';
  }
}
