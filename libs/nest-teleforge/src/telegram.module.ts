import { Module, DynamicModule, Provider } from "@nestjs/common";
import { DiscoveryModule } from "@nestjs/core";

import { TelegramExplorer } from "./features/command/command.explorer";
import { ListAnswerService } from "./features/list-answer/list-answer.service";
import {
  MENU_SESSION_STORE,
  InMemoryMenuSessionStore,
  IMenuSessionStore,
} from "./features/menu/menu-session.store";
import { MenuContextBuilder } from "./features/menu/menu.context.builder";
import { MenuExplorer } from "./features/menu/menu.explorer";
import { MenuService } from "./features/menu/menu.service";
import { TelegramService } from "./telegram.service";
import { WaitManager } from "./wait-manager";
import { TELEGRAM_KEY } from "./telegram.constant";

const TELEGRAM_MODULE_OPTIONS = Symbol("TELEGRAM_MODULE_OPTIONS");

function normalizeModuleOptions(
  options: TelegramModuleFactoryResult,
): TelegramModuleOptions {
  return typeof options === "string" ? { telegramKey: options } : options;
}

function createMenuSessionStore(
  options?: TelegramMenuSessionOptions,
): IMenuSessionStore {
  if (options?.store) {
    return options.store;
  }

  return new InMemoryMenuSessionStore(options?.inMemory);
}

function createTelegramProviders(moduleOptionsProvider: Provider): Provider[] {
  const telegramKeyProvider: Provider = {
    provide: TELEGRAM_KEY,
    inject: [TELEGRAM_MODULE_OPTIONS],
    useFactory: (options: TelegramModuleOptions) => options.telegramKey,
  };

  const menuSessionStoreProvider: Provider = {
    provide: MENU_SESSION_STORE,
    inject: [TELEGRAM_MODULE_OPTIONS],
    useFactory: (options: TelegramModuleOptions) =>
      createMenuSessionStore(options.menuSession),
  };

  return [
    moduleOptionsProvider,
    telegramKeyProvider,

    WaitManager,
    TelegramService,
    TelegramExplorer,

    menuSessionStoreProvider,
    MenuContextBuilder,
    MenuService,
    MenuExplorer,
    ListAnswerService,
  ];
}

@Module({})
export class TelegramModule {
  static forRoot(
    telegramKeyOrOptions: string | TelegramModuleOptions,
  ): DynamicModule {
    return this.forRootAsync({
      useFactory: () => normalizeModuleOptions(telegramKeyOrOptions),
    });
  }

  static forRootAsync(options: TelegramModuleAsyncOptions): DynamicModule {
    const moduleOptionsProvider: Provider = {
      provide: TELEGRAM_MODULE_OPTIONS,
      useFactory: async (...args: any[]) => {
        const result = await options.useFactory(...args);
        return normalizeModuleOptions(result);
      },
      inject: options.inject ?? [],
    };

    return {
      module: TelegramModule,
      imports: [DiscoveryModule, ...(options.imports ?? [])],
      providers: createTelegramProviders(moduleOptionsProvider),
      exports: [TelegramService, WaitManager, ListAnswerService, MenuService],
    };
  }
}

export interface TelegramInMemorySessionOptions {
  defaultTtlMs?: number;
  maxEntries?: number;
}

export interface TelegramMenuSessionOptions {
  inMemory?: TelegramInMemorySessionOptions;
  store?: IMenuSessionStore;
}

export interface TelegramModuleOptions {
  telegramKey: string;
  menuSession?: TelegramMenuSessionOptions;
}

type TelegramModuleFactoryResult = string | TelegramModuleOptions;

export interface TelegramModuleAsyncOptions {
  imports?: any[];
  inject?: any[];
  useFactory: (
    ...args: any[]
  ) => Promise<TelegramModuleFactoryResult> | TelegramModuleFactoryResult;
}
