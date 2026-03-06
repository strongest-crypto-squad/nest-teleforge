import { LiveEnv } from './types';
import { resolveTargetDialogByPeerId, withUserClient } from './user-client';

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
      log(`sending message to ${target.name ?? 'unknown'} (${env.chatId})`);
      const sent = await client.sendMessage(target.entity!, { message: text });
      log(`message sent id=${sent.id}`);
    },
  );
}
