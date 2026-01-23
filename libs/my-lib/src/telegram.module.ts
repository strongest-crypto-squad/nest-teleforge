import { Module, DynamicModule, Provider } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { TelegramExplorer } from "./features/command/command.explorer";
import { ListAnswerService } from "./features/list-answer/list-answer.service";
import { CallbackPacker } from "./features/menu/callback.packer";
import { MenuContextBuilder } from "./features/menu/menu.context.builder";
import { MenuExplorer } from "./features/menu/menu.explorer";
import { MenuRenderer } from "./features/menu/menu.renderer";
import { SchemaRegistryService } from "./features/menu/schema.registry";
import { EXAMPLE_SCHEMA } from "./schemas/example";
import { TelegramController } from "./telegram.controller.tg";
import { TelegramService } from "./telegram.service";
import { WaitManager } from "./wait-manager";

function createTelegramProviders(telegramKeyProvider: Provider): Provider[] {
  return [
    telegramKeyProvider,

    WaitManager,
    TelegramService,
    TelegramExplorer,
    TelegramController,

    SchemaRegistryService,
    MenuContextBuilder,
    MenuRenderer,
    CallbackPacker,
    MenuExplorer,
    ListAnswerService,

    {
      provide: "MENU_SCHEMA_REGISTRAR",
      useFactory: (registry: SchemaRegistryService) => {
        registry.registerSchema(EXAMPLE_SCHEMA);
        return true;
      },
      inject: [SchemaRegistryService],
    },
  ];
}

@Module({})
export class TelegramModule {
  static forRootAsync(options: TelegramModuleAsyncOptions): DynamicModule {
    const telegramKeyProvider: Provider = {
      provide: TELEGRAM_KEY,
      useFactory: options.useFactory,
      inject: options.inject ?? [],
    };

    return {
      module: TelegramModule,
      imports: [DiscoveryModule, ...(options.imports ?? [])],
      providers: createTelegramProviders(telegramKeyProvider),
      exports: [TelegramService, WaitManager],
    };
  }

  static forRoot(telegramKey: string): DynamicModule {
    return this.forRootAsync({
      useFactory: () => telegramKey,
    });
  }
}

export const TELEGRAM_KEY = "TELEGRAM_KEY";

export interface TelegramModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (...args: any[]) => Promise<string> | string;
}
