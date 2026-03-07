import { Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import {
  MenuAction,
  MenuActionResult,
} from "libs/my-lib/src/features/menu/menu.decorator";
import { MenuService } from "libs/my-lib/src/features/menu/menu.service";

@Injectable()
export class PlaygroundProfileHandlers {
  constructor(private readonly menuService: MenuService) {}

  @MenuAction("main", "home", {
    label: "🏠 Домой",
    description: "Домашний экран.",
    order: 10,
  })
  async onHome(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.profile", {
    label: "👤 Профиль",
    description: "Ваши данные и настройки профиля.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onHome,
  })
  async onProfile(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.profile.view", {
    label: "Посмотреть профиль",
    description: "Здесь будут ваши данные.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onProfile,
  })
  async onProfileView(ctx: Context): Promise<MenuActionResult> {
    await this.menuService.start(ctx, {
      flowId: "profile",
      text: "Профиль: выберите действие",
      mode: "push",
      columns: 1,
    });
    return "handled";
  }

  @MenuAction("profile", "info", {
    label: "📄 Инфо",
    description: "👤 Профиль\n(кастомный контент из @MenuAction)",
    order: 10,
  })
  async onProfileInfo(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("profile", "back-to-main", {
    label: "⬅️ В главное меню",
    description: "Возврат в основное меню",
    order: 20,
  })
  async onBackToMain(ctx: Context): Promise<MenuActionResult> {
    await this.menuService.closeCurrent(ctx, { renderPrevious: true });
    return "handled";
  }

  @MenuAction("main", "home.settings", {
    label: "⚙️ Настройки",
    description: "Общие параметры аккаунта.",
    order: 20,
    parentFunction: PlaygroundProfileHandlers.prototype.onHome,
  })
  async onSettings(): Promise<MenuActionResult> {
    return "rerender";
  }

  @MenuAction("main", "home.settings.notifications", {
    label: "Уведомления",
    description: "Включить/выключить уведомления.",
    order: 10,
    parentFunction: PlaygroundProfileHandlers.prototype.onSettings,
  })
  async onToggleNotif(): Promise<MenuActionResult> {
    return "rerender";
  }
}
