import { Api } from "telegram";
import { LiveEnv } from "./types";
import { resolveTargetDialogByPeerId, withUserClient } from "./user-client";

export async function clickInlineButtonByText(params: {
  env: LiveEnv;
  buttonText: string;
  messageTextPart?: string;
  matchIndexFromNewest?: number;
  sinceMs?: number;
  timeoutMs?: number;
}) {
  const {
    env,
    buttonText,
    messageTextPart,
    matchIndexFromNewest = 0,
    sinceMs,
    timeoutMs = 30_000,
  } = params;

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
        const messages = await client.getMessages(target.entity!, {
          limit: 50,
        });
        const candidateMessages: any[] = [];

        for (const msg of messages) {
          const text = (msg as any)?.message;
          const dateSec = (msg as any)?.date;

          if (typeof sinceMs === "number") {
            const messageMs = typeof dateSec === "number" ? dateSec * 1000 : 0;
            if (messageMs < sinceMs) continue;
          }

          if (
            messageTextPart &&
            typeof text === "string" &&
            !text.includes(messageTextPart)
          ) {
            continue;
          }

          const markup = (msg as any)?.replyMarkup;
          if (!markup?.rows) continue;

          const hasTargetButton = markup.rows.some((row: any) =>
            (row?.buttons ?? []).some(
              (button: any) => button?.text === buttonText && button?.data,
            ),
          );

          if (!hasTargetButton) continue;
          candidateMessages.push(msg);
        }

        const targetMessage = candidateMessages[matchIndexFromNewest];
        if (targetMessage) {
          const markup = (targetMessage as any)?.replyMarkup;

          for (const row of markup.rows) {
            for (const button of row.buttons ?? []) {
              if (button?.text !== buttonText) continue;
              if (!button?.data) continue;

              await client.invoke(
                new Api.messages.GetBotCallbackAnswer({
                  peer: target.entity,
                  msgId: (targetMessage as any).id,
                  data: button.data,
                }),
              );
              return;
            }
          }
        }

        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      throw new Error(
        `Inline button "${buttonText}" was not found in ${timeoutMs}ms`,
      );
    },
  );
}
