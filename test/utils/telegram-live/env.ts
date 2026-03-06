import { LiveEnv } from './types';

export function getRequiredLiveEnv(): LiveEnv {
  const missing: string[] = [];

  const targetToken = process.env.TELEGRAM_KEY ?? '';
  const chatIdRaw = process.env.TG_TEST_CHAT_ID ?? '';
  const senderModeRaw = (process.env.TG_LIVE_SENDER ?? 'bot').trim();
  const senderMode = senderModeRaw === 'user' ? 'user' : 'bot';

  const testerToken = process.env.TG_TESTER_BOT_TOKEN ?? '';
  const userApiIdRaw = process.env.TG_USER_API_ID ?? '';
  const userApiHash = process.env.TG_USER_API_HASH ?? '';
  const userSession = process.env.TG_USER_SESSION ?? '';

  if (!targetToken) missing.push('TELEGRAM_KEY');
  if (!chatIdRaw) missing.push('TG_TEST_CHAT_ID');
  if (senderMode === 'bot' && !testerToken) missing.push('TG_TESTER_BOT_TOKEN');
  if (senderMode === 'user' && !userApiIdRaw) missing.push('TG_USER_API_ID');
  if (senderMode === 'user' && !userApiHash) missing.push('TG_USER_API_HASH');
  if (senderMode === 'user' && !userSession) missing.push('TG_USER_SESSION');

  if (missing.length) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }

  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId)) {
    throw new Error('TG_TEST_CHAT_ID must be numeric');
  }

  const userApiId = userApiIdRaw ? Number(userApiIdRaw) : undefined;
  if (senderMode === 'user' && !Number.isFinite(userApiId)) {
    throw new Error('TG_USER_API_ID must be numeric');
  }

  return {
    targetToken,
    chatId,
    senderMode,
    testerToken: senderMode === 'bot' ? testerToken : undefined,
    userApiId: senderMode === 'user' ? userApiId : undefined,
    userApiHash: senderMode === 'user' ? userApiHash : undefined,
    userSession: senderMode === 'user' ? userSession : undefined,
  };
}
