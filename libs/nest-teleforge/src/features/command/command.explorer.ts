import { Injectable, OnModuleInit, Logger } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import { TG_COMMAND_METADATA } from "./command.decorator";
import { TelegramService } from "../../telegram.service";
import { Context } from "telegraf";

@Injectable()
export class TelegramExplorer implements OnModuleInit {
  private readonly logger = new Logger(TelegramExplorer.name);
  constructor(
    private readonly discoveryService: DiscoveryService,
    private readonly metadataScanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly botService: TelegramService,
  ) {}

  onModuleInit() {
    const bot = this.botService.getBot();
    const providers = this.discoveryService.getProviders();
    const controllers = this.discoveryService.getControllers();
    for (const w of [...providers, ...controllers]) {
      const instance = w.instance;
      if (!instance || typeof instance !== "object") continue;
      const proto = Object.getPrototypeOf(instance);
      this.metadataScanner.scanFromPrototype(instance, proto, (methodName) => {
        const method = proto[methodName];
        const command = this.reflector.get<string>(TG_COMMAND_METADATA, method);
        if (command) {
          this.logger.log(
            `Registering @TgCommand('${command}') -> ${instance.constructor.name}.${methodName}`,
          );
          bot.command(command, async (ctx: Context) => {
            const chatId = ctx.chat?.id;
            if (chatId == null) {
              this.logger.warn(`No chat id in ctx for command '${command}'`);
              return;
            }
            this.botService.runWithChat(chatId, async () => {
              await (method as Function).call(instance, ctx);
            });
          });
        }
      });
    }
  }
}
