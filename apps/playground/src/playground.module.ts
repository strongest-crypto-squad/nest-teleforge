import { Module } from "@nestjs/common";

import { ConfigModule, ConfigService } from "@nestjs/config";
import { PlaygroundController } from "./playground.controller";
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
      useFactory: (config: ConfigService) => config.getOrThrow("TELEGRAM_KEY"),
    }),
  ],
  controllers: [PlaygroundController],
  providers: [
    PlaygroundService,
    PlaygroundTelegramController,
    PlaygroundProfileHandlers,
  ],
})
export class PlaygroundModule {}
