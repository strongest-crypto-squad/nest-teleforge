import { Injectable, Logger } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand } from "libs/nest-teleforge/src/features/command/command.decorator";
import { OrderDto } from "libs/nest-teleforge/src/features/form/dto/order.dto";
import { ListAnswerService } from "libs/nest-teleforge/src/features/list-answer/list-answer.service";
import { MenuService } from "libs/nest-teleforge/src/features/menu/menu.service";
import { TelegramService } from "libs/nest-teleforge/src/telegram.service";

@Injectable()
export class PlaygroundTelegramController {
  private readonly logger = new Logger(PlaygroundTelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly listAnswerService: ListAnswerService,
    private readonly menuService: MenuService,
  ) {}

  @TgCommand("start")
  onStart(ctx: Context) {
    ctx.reply("Hi! This is a custom /start from the NestJS bot");
  }

  @TgCommand("help")
  onHelp(ctx: Context) {
    ctx.reply("Available commands: /start, /help, /menu, /order, /cancel");
  }

  @TgCommand("menu")
  async onMenu(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: "main",
      text: "Choose a section below.",
    });
  }

  @TgCommand("order")
  async onOrder(ctx: Context) {
    await ctx.reply(
      "Starting the order form. You can cancel anytime with /cancel.",
    );
    try {
      const timeoutMsRaw = process.env.TG_FORM_TIMEOUT_MS;
      const parsedTimeout = timeoutMsRaw ? Number(timeoutMsRaw) : NaN;
      const timeoutMs =
        Number.isFinite(parsedTimeout) && parsedTimeout > 0
          ? parsedTimeout
          : 60_000;

      const dto = await this.telegramService.form(OrderDto, { timeoutMs });
      await ctx.reply(
        [
          "✅ Order accepted:",
          `• Product: ${dto.product}`,
          `• Quantity: ${dto.quantity}`,
          `• Size: ${dto.size}`,
          `• Date: ${dto.deliveryDate.toISOString().slice(0, 10)}`,
        ].join("\n"),
      );
    } catch (e: any) {
      this.logger.warn(`Form interrupted: ${e?.message ?? e}`);
    }
  }

  @TgCommand("list")
  async onList(ctx: Context): Promise<void> {
    const list = [
      { key: "key1", label: "kek1" },
      { key: "key2", label: "kek2" },
      { key: "key3", label: "kek3" },
    ];

    const res = await this.listAnswerService.ask(ctx, list, {
      getLabel: ({ label }) => label,
      getKey: ({ key }) => key,
    });

    await ctx.reply(
      res.type === "selected"
        ? `Selected option: ${res.item.key}`
        : res.type === "timeout"
          ? "Selection timed out."
          : "Selection cancelled.",
    );

    return;
  }
}
