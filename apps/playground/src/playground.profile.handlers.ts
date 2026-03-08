import { Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import {
  MenuAction,
  MenuActionResult,
} from "libs/nest-teleforge/src/features/menu/menu.decorator";
import { MenuService } from "libs/nest-teleforge/src/features/menu/menu.service";

@Injectable()
export class PlaygroundProfileHandlers {
  constructor(private readonly menuService: MenuService) {}

  @MenuAction("main", "home", {
    label: "🏠 Home",
    description: "Home screen.",
    order: 10,
  })
  async onHome(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.profile", {
    label: "👤 Profile",
    description: "Your profile data and settings.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onHome,
  })
  async onProfile(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.profile.view", {
    label: "View profile",
    description: "Your profile details appear here.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onProfile,
  })
  async onProfileView(ctx: Context): Promise<MenuActionResult> {
    await this.menuService.start(ctx, {
      flowId: "profile",
      text: "Profile: choose an action",
      mode: "push",
      columns: 1,
    });
    return "handled";
  }

  @MenuAction("profile", "info", {
    label: "📄 Info",
    description: "👤 Profile\n(custom content from @MenuAction)",
    order: 10,
  })
  async onProfileInfo(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("profile", "back-to-main", {
    label: "⬅️ Back to main menu",
    description: "Return to main menu",
    order: 20,
  })
  async onBackToMain(ctx: Context): Promise<MenuActionResult> {
    await this.menuService.closeCurrent(ctx, { renderPrevious: true });
    return "handled";
  }

  @MenuAction("main", "home.settings", {
    label: "⚙️ Settings",
    description: "General account settings.",
    order: 20,
    parentFunction: PlaygroundProfileHandlers.prototype.onHome,
  })
  async onSettings(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.settings.notifications", {
    label: "Notifications",
    description: "Enable or disable notifications.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onSettings,
  })
  async onToggleNotif(): Promise<MenuActionResult> {
    return "rerender";
  }
}
