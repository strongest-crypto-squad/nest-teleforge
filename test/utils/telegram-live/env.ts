import { LiveEnv } from './types';

export function getRequiredLiveEnv(): LiveEnv {
  const missing: string[] = [];

  const targetToken = process.env.TELEGRAM_KEY ?? '';
  const chatIdRaw = process.env.TG_TEST_CHAT_ID ?? '';
  const userApiIdRaw = process.env.TG_USER_API_ID ?? '';
  const userApiHash = process.env.TG_USER_API_HASH ?? '';
  const userSession = process.env.TG_USER_SESSION ?? '';

  if (!targetToken) missing.push('TELEGRAM_KEY');
  if (!chatIdRaw) missing.push('TG_TEST_CHAT_ID');
  if (!userApiIdRaw) missing.push('TG_USER_API_ID');
  if (!userApiHash) missing.push('TG_USER_API_HASH');
  if (!userSession) missing.push('TG_USER_SESSION');

  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId)) {
    throw new Error('TG_TEST_CHAT_ID must be numeric');
  }

  const userApiId = Number(userApiIdRaw);
  if (!Number.isFinite(userApiId)) {
    throw new Error('TG_USER_API_ID must be numeric');
  }

  return {
    targetToken,
    chatId,
    userApiId,
    userApiHash,
    userSession,
  };
}
