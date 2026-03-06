import { callBotApi, purgeUpdates, waitForIncomingToTarget } from './bot-api';

export async function preflightHelpCommand(params: {
  targetToken: string;
  testerToken: string;
  chatId: number;
  targetBotUsername: string;
  timeoutMs?: number;
}) {
  const {
    targetToken,
    testerToken,
    chatId,
    targetBotUsername,
    timeoutMs = 20_000,
  } = params;

  await purgeUpdates(targetToken);
  await purgeUpdates(testerToken);

  await callBotApi(testerToken, 'sendMessage', {
    chat_id: chatId,
    text: `/help@${targetBotUsername}`,
  });

  await waitForIncomingToTarget(
    targetToken,
    chatId,
    `/help@${targetBotUsername}`,
    timeoutMs,
  );

  await purgeUpdates(targetToken);
}
