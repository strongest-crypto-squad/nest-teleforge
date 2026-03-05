import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import { Telegraf, Context } from "telegraf";
import { AsyncLocalStorage } from "async_hooks";
import { message } from "telegraf/filters";
import { TgFormContext, tgForm } from "libs/my-lib/src/features/form/tgForm";
import { WaitManager } from "libs/my-lib/src/wait-manager";
import { TELEGRAM_KEY } from "libs/my-lib/src/telegram.constant";

@Injectable()
export class TelegramService implements OnModuleInit {
  public bot!: Telegraf<Context>;
  private readonly logger = new Logger(TelegramService.name);
  private readonly chatStorage = new AsyncLocalStorage<number>();

  constructor(
    @Inject(TELEGRAM_KEY)
    private readonly telegramKey: string,
    private readonly wait: WaitManager,
  ) {}

  async onModuleInit() {
    this.bot = new Telegraf(this.telegramKey);

    this.bot.on(message("text"), async (ctx, next) => {
      const chatId = ctx.chat?.id;
      const text = ctx.message?.text ?? "";
      if (chatId == null) return;

      if (text.startsWith("/cancel")) {
        const canceled = this.wait.cancel(chatId, "User canceled");
        if (canceled) {
          await ctx.reply("Окей, отменил форму.");
        }
        return;
      }

      if (this.wait.has(chatId)) {
        const consumed = this.wait.consume(chatId, text);
        if (consumed) return;
      }

      return next();
    });

    this.bot.on("callback_query", async (ctx, next) => {
      const chatId = ctx.chat?.id;
      const data = (ctx.update as any)?.callback_query?.data as
        | string
        | undefined;

      if (chatId == null || !data) {
        return next();
      }

      if (!this.wait.has(chatId)) {
        return next();
      }

      const consumed = this.wait.consume(chatId, data);
      if (consumed) {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }

      return next();
    });

    await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
    this.bot.launch();
    this.logger.log("Telegram bot launched");
  }

  getBot(): Telegraf<Context> {
    return this.bot;
  }

  runWithChat<T>(chatId: number, fn: () => Promise<T>): Promise<T> {
    return this.chatStorage.run(chatId, fn);
  }

  getCurrentChatId(): number | undefined {
    return this.chatStorage.getStore();
  }

  async form<T extends object>(
    dtoClass: new () => T,
    opts?: {
      timeoutMs?: number;
      cancelCommand?: string;
      promptSuffix?: string;
    },
  ): Promise<T> {
    const chatId = this.getCurrentChatId();
    if (chatId == null) {
      throw new Error(
        "telegramService.form() должен вызываться внутри обработчика команды Telegram. " +
          "Либо передайте контекст через TelegramExplorer.runWithChat().",
      );
    }

    const timeoutMs = opts?.timeoutMs ?? 60_000;
    const cancelCommand = opts?.cancelCommand ?? "/cancel";
    const promptSuffix =
      opts?.promptSuffix ?? `(Напишите текст или ${cancelCommand})`;

    const formCtx: TgFormContext = {
      reply: async (text: string) => {
        await this.bot.telegram.sendMessage(
          chatId,
          `${text}\n\n${promptSuffix}`,
        );
      },
      waitForMessage: () => {
        return this.wait.create(chatId, timeoutMs, async () => {
          try {
            await this.bot.telegram.sendMessage(
              chatId,
              "Время ожидания истекло. Начни заново или напиши /cancel.",
            );
          } catch {}
        });
      },
    };

    return tgForm(dtoClass, formCtx);
  }
}
