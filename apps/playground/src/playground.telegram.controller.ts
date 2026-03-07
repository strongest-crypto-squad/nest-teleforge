import { Injectable, Logger } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand } from "libs/my-lib/src/features/command/command.decorator";
import { OrderDto } from "libs/my-lib/src/features/form/dto/order.dto";
import { ListAnswerService } from "libs/my-lib/src/features/list-answer/list-answer.service";
import {
  MenuAction,
  MenuActionResult,
} from "libs/my-lib/src/features/menu/menu.decorator";
import { TelegramService } from "libs/my-lib/src/telegram.service";

@Injectable()
export class PlaygroundTelegramController {
  private readonly logger = new Logger(PlaygroundTelegramController.name);

  constructor(
    private readonly telegramService: TelegramService,
    private readonly listAnswerService: ListAnswerService,
  ) {}

  @TgCommand("start")
  onStart(ctx: Context) {
    ctx.reply("Привет! Это кастомный /start от NestJS-бота");
  }

  @TgCommand("help")
  onHelp(ctx: Context) {
    ctx.reply("Вот список команд: /start, /help, /order, /cancel");
  }

  @TgCommand("order")
  async onOrder(ctx: Context) {
    await ctx.reply(
      "Запускаю форму заказа. Можно отменить в любой момент командой /cancel.",
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
          "✅ Заказ принят:",
          `• Товар: ${dto.product}`,
          `• Кол-во: ${dto.quantity}`,
          `• Размер: ${dto.size}`,
          `• Дата: ${dto.deliveryDate.toISOString().slice(0, 10)}`,
        ].join("\n"),
      );
    } catch (e: any) {
      this.logger.warn(`Форма прервана: ${e?.message ?? e}`);
    }
  }

  @MenuAction("main.home.profile.view")
  async onProfileView(ctx: Context): Promise<MenuActionResult> {
    await ctx.answerCbQuery();
    await ctx.editMessageText("👤 Профиль — кастомный экран");
    return "handled";
  }

  @TgCommand("list")
  async onList(ctx: Context): Promise<MenuActionResult> {
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
        ? `Выбран вариант: ${res.item.key}`
        : res.type === "timeout"
          ? "Время выбора истекло."
          : "Выбор отменён.",
    );

    return "handled";
  }
}
