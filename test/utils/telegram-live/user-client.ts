import { Logger, TelegramClient, utils } from 'telegram';
import { StringSession } from 'telegram/sessions';

type UserClientParams = {
  apiId: number;
  apiHash: string;
  session: string;
};

export async function withUserClient<T>(
  params: UserClientParams,
  run: (client: TelegramClient) => Promise<T>,
): Promise<T> {
  const client = new TelegramClient(
    new StringSession(params.session),
    params.apiId,
    params.apiHash,
    {
      connectionRetries: 3,
      baseLogger: new Logger('error' as any),
    },
  );

  await client.connect();
  try {
    return await run(client);
  } finally {
    await client.disconnect();
  }
}

export async function resolveTargetDialogByPeerId(
  client: TelegramClient,
  chatId: number,
) {
  const me = await client.getMe();
  const selfPeerId = Number(utils.getPeerId(me));

  if (chatId === selfPeerId) {
    throw new Error(
      `TG_TEST_CHAT_ID points to your own account (${chatId}), it sends to Saved Messages.`,
    );
  }

  const dialogs = await client.getDialogs({ limit: 200 });
  const target = dialogs.find((dialog: any) => {
    try {
      return Number(utils.getPeerId(dialog.entity)) === chatId;
    } catch {
      return false;
    }
  });

  if (!target?.entity) {
    throw new Error(
      `Chat ${chatId} not found in user dialogs. Open this chat in Telegram app and retry.`,
    );
  }

  const targetPeerId = Number(utils.getPeerId(target.entity));
  if (targetPeerId === selfPeerId) {
    throw new Error(
      `Resolved chat ${chatId} as Saved Messages. Use target group/channel id (usually -100...).`,
    );
  }

  return target;
}
