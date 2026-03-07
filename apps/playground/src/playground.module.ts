import { Module } from "@nestjs/common";

import { ConfigModule, ConfigService } from "@nestjs/config";
import { PlaygroundController } from "./playground.controller";
import { PLAYGROUND_MENU_SCHEMA } from "./playground.menu.schema";
import { PlaygroundProfileHandlers } from "./playground.profile.handlers";
import { PlaygroundService } from "./playground.service";
import { PlaygroundTelegramController } from "./playground.telegram.controller";
import { TelegramModule } from "libs/my-lib/src";
import { SchemaRegistryService } from "libs/my-lib/src/features/menu/schema.registry";

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
    {
      provide: "PLAYGROUND_MENU_SCHEMA_REGISTRAR",
      useFactory: (registry: SchemaRegistryService) => {
        registry.registerSchema(PLAYGROUND_MENU_SCHEMA);
        return true;
      },
      inject: [SchemaRegistryService],
    },
  ],
})
export class PlaygroundModule {}
