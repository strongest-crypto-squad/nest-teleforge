import { Injectable } from '@nestjs/common';
import type { TgCtx } from './menu.types';
import type { Context } from 'telegraf';
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
}
