import { Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import { TgCommand } from "libs/nest-teleforge/src/features/command/command.decorator";
import {
  DynamicButton,
  MenuAction,
  MenuActionResult,
  MenuContext,
} from "libs/nest-teleforge/src/features/menu/menu.decorator";
import { MenuService } from "libs/nest-teleforge/src/features/menu/menu.service";

const TELEGRAM_MENU_SESSION_FLOW_ID = "telegram_menu_session";
const sessionMenuRoot = () => {};

type SessionCartData = { items: string[] };

@Injectable()
export class PlaygroundMenuSessionHandlers {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand("menusession")
  async onStart(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: TELEGRAM_MENU_SESSION_FLOW_ID,
      text: "Session cart menu",
      columns: 1,
      mode: "replace",
      reuseCurrentMessage: false,
      parentFunction: sessionMenuRoot,
      sessionData: { items: [] } satisfies SessionCartData,
    });
  }

  async getCartButtons(
    _ctx: Context,
    mctx: MenuContext<SessionCartData>,
  ): Promise<DynamicButton<{ item: string }>[]> {
    const catalog = ["Apple", "Banana", "Cherry"];
    return catalog.map((item) => ({
      label: mctx.session.data.items.includes(item) ? `✅ ${item}` : item,
      data: { item },
    }));
  }

  @MenuAction(TELEGRAM_MENU_SESSION_FLOW_ID, "cart", {
    label: "🛒 Pick items",
    description: "Select items to add:",
    columns: 1,
    parentFunction: sessionMenuRoot,
    dynamicButtons: PlaygroundMenuSessionHandlers.prototype.getCartButtons,
  })
  async onCart(
    ctx: Context,
    mctx: MenuContext<SessionCartData>,
  ): Promise<MenuActionResult> {
    if (mctx.buttonData) {
      const item = (mctx.buttonData as { item: string }).item;
      const idx = mctx.session.data.items.indexOf(item);
      if (idx >= 0) {
        mctx.session.data.items.splice(idx, 1);
      } else {
        mctx.session.data.items.push(item);
      }
      await ctx.answerCbQuery(
        `Cart: ${mctx.session.data.items.join(", ") || "empty"}`,
      );
      return "rerender";
    }
    return "rerender";
  }

  @MenuAction(TELEGRAM_MENU_SESSION_FLOW_ID, "show", {
    label: "Show cart",
    description: "Show current cart",
    parentFunction: sessionMenuRoot,
  })
  async onShowCart(
    ctx: Context,
    mctx: MenuContext<SessionCartData>,
  ): Promise<MenuActionResult> {
    const items = mctx.session.data.items;
    const text = items.length ? `Cart: ${items.join(", ")}` : "Cart: (empty)";
    await ctx.reply(text);
    return "handled";
  }
}
