import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import type { Context } from "telegraf";
import { MENU_ACTION_METADATA, MenuActionMetadata } from "./menu.decorator";
import { MenuService } from "./menu.service";
import { TelegramService } from "../../telegram.service";
@Injectable()
export class MenuExplorer implements OnModuleInit {
  private readonly logger = new Logger(MenuExplorer.name);

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly botService: TelegramService,
    private readonly menuService: MenuService,
  ) {}

  onModuleInit() {
    this.scanActionHandlers();
    this.registerCallbackQuery();
  }

  private scanActionHandlers() {
    const providers = this.discovery.getProviders();
    const controllers = this.discovery.getControllers();

    for (const w of [...providers, ...controllers]) {
      const instance = w.instance as any;
      if (!instance || typeof instance !== "object") continue;
      const proto = Object.getPrototypeOf(instance);
      this.scanner.scanFromPrototype(instance, proto, (methodName: string) => {
        const method = proto[methodName];
        const metadata = this.reflector.get<MenuActionMetadata>(
          MENU_ACTION_METADATA,
          method,
        );

        if (metadata) {
          this.logger.log(
            `@MenuAction('${metadata.flowId}', '${metadata.actionId}') -> ${instance.constructor.name}.${methodName}`,
          );

          // Resolve dynamicButtons provider if specified
          let dynamicProvider: any;
          if (metadata.options?.dynamicButtons) {
            const providerFn = metadata.options.dynamicButtons;
            // Find the method on the same instance whose reference matches
            const providerMethodName = Object.getOwnPropertyNames(proto).find(
              (name) => proto[name] === providerFn,
            );
            if (providerMethodName) {
              dynamicProvider = proto[providerMethodName].bind(instance);
            } else {
              this.logger.warn(
                `dynamicButtons provider not found on ${instance.constructor.name} for @MenuAction('${metadata.flowId}', '${metadata.actionId}')`,
              );
            }
          }

          this.menuService.registerAction({
            metadata,
            methodRef: method,
            handler: method.bind(instance),
            dynamicProvider,
          });
        }
      });
    }
  }

  private registerCallbackQuery() {
    const bot = this.botService.getBot();

    bot.on("callback_query", async (ctx: Context) => {
      const chatId = ctx.chat?.id;
      if (chatId == null) return;

      await this.menuService.handleCallback(ctx, (fn) =>
        this.botService.runWithChat(chatId, fn),
      );
    });
  }
}
