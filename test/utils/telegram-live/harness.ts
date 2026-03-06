import { NestFactory } from '@nestjs/core';
import { TelegramService } from 'libs/my-lib/src';
import { LiveBotHarness } from './types';

export async function createLiveBotHarness(
  rootModule: unknown,
  targetToken: string,
): Promise<LiveBotHarness> {
  process.env.TELEGRAM_KEY = targetToken;

  const app = await NestFactory.create(rootModule as any, { logger: false });
  await app.init();

  const telegramService = app.get(TelegramService);
  const sendMessageSpy = jest.spyOn(telegramService.bot.telegram, 'sendMessage');

  await new Promise((resolve) => setTimeout(resolve, 1500));

  return { app, telegramService, sendMessageSpy };
}

export async function disposeLiveBotHarness(harness?: LiveBotHarness) {
  if (!harness) return;
  if (harness.telegramService?.bot) harness.telegramService.bot.stop('live-test-finished');
  if (harness.sendMessageSpy) harness.sendMessageSpy.mockRestore();
  if (harness.app) await harness.app.close();
}
