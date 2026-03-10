import { MenuService } from "../../../../libs/nest-teleforge/src/features/menu/menu.service";
import type {
  DynamicButton,
  MenuContext,
} from "../../../../libs/nest-teleforge/src/features/menu/menu.decorator";

type CartSession = { items: string[] };

export function registerCartMenu(
  menuService: MenuService,
  onCartItemsChange?: (items: string[]) => void,
) {
  const getCartButtons = async (
    _ctx: any,
    mctx: MenuContext<CartSession>,
  ): Promise<DynamicButton<{ item: string }>[]> => {
    const catalog = ["Apple", "Banana", "Cherry"];
    return catalog.map((item) => ({
      label: mctx.session.data.items.includes(item) ? `✅ ${item}` : item,
      data: { item },
    }));
  };

  const onCartAction = async (ctx: any, mctx: MenuContext<CartSession>) => {
    if (mctx.buttonData) {
      const { item } = mctx.buttonData as { item: string };
      const idx = mctx.session.data.items.indexOf(item);
      if (idx >= 0) {
        mctx.session.data.items.splice(idx, 1);
      } else {
        mctx.session.data.items.push(item);
      }
      onCartItemsChange?.([...mctx.session.data.items]);
      return "rerender" as const;
    }
    return "rerender" as const;
  };

  menuService.registerAction({
    metadata: {
      flowId: "cart",
      actionId: "pick",
      key: "cart.pick",
      options: {
        label: "🛒 Pick items",
        description: "Select items to add:",
        columns: 1,
        dynamicButtons: getCartButtons,
      },
    },
    methodRef: onCartAction,
    handler: onCartAction,
    dynamicProvider: getCartButtons,
  });
}
