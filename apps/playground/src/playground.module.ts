import { Module } from "@nestjs/common";

import { ConfigModule, ConfigService } from "@nestjs/config";
import { PlaygroundController } from "./playground.controller";
import { PlaygroundDeployMenuHandlers } from "./playground.deploy-menu.handlers";
import { PlaygroundMenuSessionHandlers } from "./playground.menu-session.handlers";
import { PlaygroundProfileHandlers } from "./playground.profile.handlers";
import { PlaygroundService } from "./playground.service";
import { PlaygroundTelegramController } from "./playground.telegram.controller";
import { TelegramModule } from "libs/nest-teleforge/src";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TelegramModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        telegramKey: config.getOrThrow("TELEGRAM_KEY"),
        menuSession: {
          inMemory: {
            defaultTtlMs: 10 * 60 * 1000,
            maxEntries: 20_000,
          },
        },
      }),
    }),
  ],
  controllers: [PlaygroundController],
  providers: [
    PlaygroundService,
    PlaygroundTelegramController,
    PlaygroundProfileHandlers,
    PlaygroundDeployMenuHandlers,
    PlaygroundMenuSessionHandlers,
  ],
})
export class PlaygroundModule {}
