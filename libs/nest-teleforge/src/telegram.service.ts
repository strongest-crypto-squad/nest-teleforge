import { Injectable, OnModuleInit, Logger, Inject } from "@nestjs/common";
import { Telegraf, Context } from "telegraf";
import { AsyncLocalStorage } from "async_hooks";
import { message } from "telegraf/filters";
import { appendFile, mkdir } from "fs/promises";
import { dirname } from "path";
import { TgFormContext, tgForm } from "./features/form/tgForm";
import { WaitManager } from "./wait-manager";
import { TELEGRAM_KEY } from "./telegram.constant";

@Injectable()
export class TelegramService implements OnModuleInit {
  public bot!: Telegraf<Context>;
  private readonly logger = new Logger(TelegramService.name);
  private readonly chatStorage = new AsyncLocalStorage<number>();
  private readonly debugUpdatesEnabled = process.env.TG_DEBUG_UPDATES === "1";
  private readonly debugUpdatesToFile =
    process.env.TG_DEBUG_UPDATES_FILE === "1";
  private readonly updatesLogFilePath =
    process.env.TG_DEBUG_UPDATES_LOG_PATH ?? "logs/telegram-updates.log";

  constructor(
    @Inject(TELEGRAM_KEY)
    private readonly telegramKey: string,
    private readonly wait: WaitManager,
  ) {}

  async onModuleInit() {
    this.bot = new Telegraf(this.telegramKey, {
      telegram: {
        
      }
    });

    if (this.debugUpdatesEnabled) {
      this.bot.use(async (ctx, next) => {
        const updateType = ctx.updateType;
        const chatId = ctx.chat?.id;
        const fromId = ctx.from?.id;
        const text = (ctx.message as any)?.text;
        const callbackData = (ctx.update as any)?.callback_query?.data;

        const parts = [
          `type=${updateType}`,
          `chatId=${chatId ?? "-"}`,
          `fromId=${fromId ?? "-"}`,
        ];

        if (typeof text === "string") {
          parts.push(`text=${JSON.stringify(text.slice(0, 200))}`);
        }

        if (typeof callbackData === "string") {
          parts.push(`callback=${JSON.stringify(callbackData.slice(0, 200))}`);
        }

        const line = `[tg:update] ${parts.join(" ")}`;
        this.logger.log(line);

        if (this.debugUpdatesToFile) {
          try {
            await mkdir(dirname(this.updatesLogFilePath), { recursive: true });
            await appendFile(this.updatesLogFilePath, `${new Date().toISOString()} ${line}\n`);
          } catch (err) {
            this.logger.warn(`Failed to write Telegram update log file: ${err}`);
          }
        }

        return next();
      });
    }

    this.bot.on(message("text"), async (ctx, next) => {
      const chatId = ctx.chat?.id;
      const text = ctx.message?.text ?? "";
      if (chatId == null) return;

      if (text.startsWith("/cancel")) {
        const canceled = this.wait.cancel(chatId, "User canceled");
        if (canceled) {
          await ctx.reply("Okay, form cancelled.");
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

    try {
      await this.bot.telegram.deleteWebhook({ drop_pending_updates: true });
    } catch (e: any) {
      this.logger.error(`Failed to delete webhook (is the bot token valid?): ${e.message}`, e.stack);
      throw e;
    }
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
        "telegramService.form() must be called inside a Telegram command handler. " +
          "Alternatively, pass context via TelegramExplorer.runWithChat().",
      );
    }

    const timeoutMs = opts?.timeoutMs ?? 60_000;
    const cancelCommand = opts?.cancelCommand ?? "/cancel";
    const promptSuffix =
      opts?.promptSuffix ?? `(Send text or ${cancelCommand})`;

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
              "Waiting time expired. Start again or send /cancel.",
            );
          } catch {}
        });
      },
    };

    return tgForm(dtoClass, formCtx);
  }
}
