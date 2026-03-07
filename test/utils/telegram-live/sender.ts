import { LiveEnv } from './types';
import { resolveTargetDialogByPeerId, withUserClient } from './user-client';

function getEntityLabel(entity: any): string {
  return (
    entity?.title ||
    [entity?.firstName, entity?.lastName].filter(Boolean).join(' ') ||
    entity?.username ||
    'unknown'
  );
}

export async function sendLiveMessage(params: { env: LiveEnv; text: string }) {
  const { env, text } = params;

  const log = (message: string) => console.log(`[live:user] ${message}`);

  await withUserClient(
    {
      apiId: env.userApiId,
      apiHash: env.userApiHash,
      session: env.userSession,
    },
    async (client) => {
      log('connected MTProto client');
      const target = await resolveTargetDialogByPeerId(client, env.chatId);
      log(`sending message to ${getEntityLabel(target.entity)} (${env.chatId})`);
      const sent = await client.sendMessage(target.entity!, { message: text });
      log(`message sent id=${sent.id}`);
    },
  );
}
