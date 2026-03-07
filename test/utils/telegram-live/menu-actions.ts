import { Api } from 'telegram';
import { LiveEnv } from './types';
import { resolveTargetDialogByPeerId, withUserClient } from './user-client';

export async function clickInlineButtonByText(params: {
  env: LiveEnv;
  buttonText: string;
  timeoutMs?: number;
}) {
  const { env, buttonText, timeoutMs = 30_000 } = params;

  return withUserClient(
    {
      apiId: env.userApiId,
      apiHash: env.userApiHash,
      session: env.userSession,
    },
    async (client) => {
      const target = await resolveTargetDialogByPeerId(client, env.chatId);
      const started = Date.now();

      while (Date.now() - started < timeoutMs) {
        const messages = await client.getMessages(target.entity!, { limit: 20 });

        for (const msg of messages) {
          const markup = (msg as any)?.replyMarkup;
          if (!markup?.rows) continue;

          for (const row of markup.rows) {
            for (const button of row.buttons ?? []) {
              if (button?.text !== buttonText) continue;
              if (!button?.data) continue;

              await client.invoke(
                new Api.messages.GetBotCallbackAnswer({
                  peer: target.entity,
                  msgId: (msg as any).id,
                  data: button.data,
                }),
              );
              return;
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new Error(`Inline button "${buttonText}" was not found in ${timeoutMs}ms`);
    },
  );
}
