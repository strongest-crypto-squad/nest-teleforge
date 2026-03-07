const { Logger, TelegramClient, utils } = require('telegram');
const { StringSession } = require('telegram/sessions');

function createUserClient({ apiId, apiHash, session }) {
  return new TelegramClient(new StringSession(session), apiId, apiHash, {
    connectionRetries: 5,
    receiveUpdates: false,
    baseLogger: new Logger('error'),
  });
}

async function closeUserClient(client) {
  if (!client) return;
  try {
    await client.disconnect();
  } catch {}
  try {
    await client.destroy();
  } catch {}
}

async function resolveTargetDialogByPeerId(client, chatId) {
  const me = await client.getMe();
  const selfPeerId = Number(utils.getPeerId(me));

  if (chatId === selfPeerId) {
    throw new Error(
      `TG_TEST_CHAT_ID points to your own account (${chatId}), it sends to Saved Messages.`,
    );
  }

  const dialogs = await client.getDialogs({ limit: 200 });
  const target = dialogs.find((dialog) => {
    try {
      return Number(utils.getPeerId(dialog.entity)) === chatId;
    } catch {
      return false;
    }
  });

  if (!target || !target.entity) {
    throw new Error(
      `Chat ${chatId} not found in user dialogs. Open this chat in Telegram and retry.`,
    );
  }

  return target;
}

module.exports = {
  createUserClient,
  closeUserClient,
  resolveTargetDialogByPeerId,
};
