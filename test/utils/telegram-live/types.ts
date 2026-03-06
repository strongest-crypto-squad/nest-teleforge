import { INestApplication } from '@nestjs/common';
import { TelegramService } from 'libs/my-lib/src';

export type TgUser = {
  id: number;
  username?: string;
};

export type LiveEnv = {
  targetToken: string;
  chatId: number;
  userApiId: number;
  userApiHash: string;
  userSession: string;
};

export type LiveBotHarness = {
  app: INestApplication;
  telegramService: TelegramService;
  sendMessageSpy: jest.SpyInstance;
};

export type BotApiResponse<T> = {
  ok: boolean;
  result: T;
};

export type TgUpdate = {
  update_id: number;
  message?: {
    chat?: { id: number };
    text?: string;
    from?: { is_bot?: boolean; username?: string };
  };
};
