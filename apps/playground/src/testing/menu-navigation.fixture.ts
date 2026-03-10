import { MenuService } from "../../../../libs/nest-teleforge/src/features/menu/menu.service";
import type {
  DynamicButton,
  MenuContext,
} from "../../../../libs/nest-teleforge/src/features/menu/menu.decorator";

export function registerPlaygroundHandlers(menuService: MenuService) {
  const onHome = async () => "rerender" as const;

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home",
      key: "main.home",
      options: { label: "🏠 Home", description: "Home screen.", order: 10 },
    },
    methodRef: onHome,
    handler: async () => "rerender",
  });

  const onProfile = async () => "rerender" as const;

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home.profile",
      key: "main.home.profile",
      options: {
        label: "👤 Profile",
        description: "Your profile data and settings.",
        order: 10,
        parentFunction: onHome,
      },
    },
    methodRef: onProfile,
    handler: async () => "rerender",
  });

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home.profile.view",
      key: "main.home.profile.view",
      options: {
        label: "View profile",
        description: "Your profile details appear here.",
        order: 10,
        parentFunction: onProfile,
      },
    },
    methodRef: onProfile,
    handler: async (ctx: any) => {
      await menuService.start(ctx, {
        flowId: "profile",
        text: "Profile: choose an action",
        mode: "push",
        columns: 1,
      });
      return "handled";
    },
  });

  menuService.registerAction({
    metadata: {
      flowId: "profile",
      actionId: "info",
      key: "profile.info",
      options: {
        label: "📄 Info",
        description: "👤 Profile\n(custom content from @MenuAction)",
        order: 10,
      },
    },
    methodRef: () => {},
    handler: async () => "rerender",
  });

  menuService.registerAction({
    metadata: {
      flowId: "profile",
      actionId: "back-to-main",
      key: "profile.back-to-main",
      options: {
        label: "⬅️ Back to main menu",
        description: "Return to main menu",
        order: 20,
      },
    },
    methodRef: () => {},
    handler: async (ctx: any) => {
      await menuService.closeCurrent(ctx, { renderPrevious: true });
      return "handled";
    },
  });

  const onSettings = async () => "rerender" as const;

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home.settings",
      key: "main.home.settings",
      options: {
        label: "⚙️ Settings",
        description: "General account settings.",
        order: 20,
        parentFunction: onHome,
      },
    },
    methodRef: onSettings,
    handler: async () => "rerender",
  });

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home.settings.notifications",
      key: "main.home.settings.notifications",
      options: {
        label: "Notifications",
        description: "Enable or disable notifications.",
        order: 10,
        parentFunction: onSettings,
      },
    },
    methodRef: () => {},
    handler: async () => "rerender",
  });

  const getProductButtons = async (
    _ctx: any,
    _mctx: MenuContext,
  ): Promise<DynamicButton<{ id: number; name: string }>[]> => {
    const products = [
      { id: 1, name: "Widget A", price: 9.99 },
      { id: 2, name: "Widget B", price: 19.99 },
      { id: 3, name: "Gadget X", price: 49.99 },
    ];

    return products.map((p) => ({
      label: `${p.name} — $${p.price}`,
      data: { id: p.id, name: p.name },
    }));
  };

  const onProducts = async (
    ctx: any,
    mctx: MenuContext<{ id: number; name: string }>,
  ) => {
    if (mctx.buttonData) {
      const { id, name } = mctx.buttonData;
      await ctx.answerCbQuery(`You picked: ${name} (id=${id})`);
      return "handled" as const;
    }
    return "rerender" as const;
  };

  menuService.registerAction({
    metadata: {
      flowId: "main",
      actionId: "home.products",
      key: "main.home.products",
      options: {
        label: "🛒 Products",
        description: "Choose a product:",
        order: 30,
        columns: 1,
        parentFunction: onHome,
        dynamicButtons: getProductButtons,
      },
    },
    methodRef: onProducts,
    handler: onProducts,
    dynamicProvider: getProductButtons,
  });
}
