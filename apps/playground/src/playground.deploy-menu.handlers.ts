import { Injectable } from "@nestjs/common";
import type { Context } from "telegraf";
import { TgCommand } from "libs/nest-teleforge/src/features/command/command.decorator";
import {
  MenuAction,
  MenuActionResult,
} from "libs/nest-teleforge/src/features/menu/menu.decorator";
import { MenuService } from "libs/nest-teleforge/src/features/menu/menu.service";

const TELEGRAM_DEPLOY_FLOW_ID = "telegram_deploy";
const deployMenuRoot = () => {};

@Injectable()
export class PlaygroundDeployMenuHandlers {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand("startdeploy")
  async onStartDeploy(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: TELEGRAM_DEPLOY_FLOW_ID,
      text: "Deploy requested from Service",
      columns: 2,
      mode: "replace",
      reuseCurrentMessage: false,
      parentFunction: deployMenuRoot,
    });
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, "deploy", {
    label: "Deploy",
    description: "Needs confirmation",
    columns: 2,
    parentFunction: deployMenuRoot,
  })
  onDeploy(this: void): MenuActionResult {
    return "rerender";
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, "cancel", {
    label: "Cancel",
    parentFunction: deployMenuRoot,
  })
  async onCancel(ctx: Context): Promise<MenuActionResult> {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.answerCbQuery("Deploy canceled!");
    await ctx.reply("Target canceled");
    return "handled";
  }

  @MenuAction(TELEGRAM_DEPLOY_FLOW_ID, "confirm", {
    parentFunction: PlaygroundDeployMenuHandlers.prototype.onDeploy,
    label: "Confirm ✅",
  })
  async onConfirm(ctx: Context): Promise<MenuActionResult> {
    await ctx.editMessageReplyMarkup({ inline_keyboard: [] }).catch(() => {});
    await ctx.answerCbQuery("Deploy confirmed!");
    await ctx.reply("Target deployed");
    return "handled";
  }
}
