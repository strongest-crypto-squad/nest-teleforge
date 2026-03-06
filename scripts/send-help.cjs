const { loadDotEnv, requireEnv } = require('./lib/env.cjs');
const {
  createUserClient,
  resolveTargetDialogByPeerId,
} = require('./lib/telegram-user.cjs');

async function callBotApi(token, method, payload = {}) {
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    throw new Error(`Bot API HTTP ${response.status} on ${method}`);
  }

  const json = await response.json();
  if (!json.ok) {
    throw new Error(`Bot API not ok on ${method}: ${JSON.stringify(json)}`);
  }

  return json.result;
}

async function main() {
  loadDotEnv();

  const targetToken = process.env.TELEGRAM_KEY;
  const chatIdRaw = process.env.TG_TEST_CHAT_ID;
  const senderModeRaw = (process.env.TG_LIVE_SENDER || 'bot').trim();
  const senderMode = senderModeRaw === 'user' ? 'user' : 'bot';

  const testerToken = process.env.TG_TESTER_BOT_TOKEN;
  const userApiIdRaw = process.env.TG_USER_API_ID;
  const userApiHash = process.env.TG_USER_API_HASH;
  const userSession = process.env.TG_USER_SESSION;

  const commonEnv = ['TELEGRAM_KEY', 'TG_TEST_CHAT_ID'];
  const botEnv = ['TG_TESTER_BOT_TOKEN'];
  const userEnv = ['TG_USER_API_ID', 'TG_USER_API_HASH', 'TG_USER_SESSION'];
  requireEnv(senderMode === 'bot' ? [...commonEnv, ...botEnv] : [...commonEnv, ...userEnv]);

  const chatId = Number(chatIdRaw);
  if (!Number.isFinite(chatId)) {
    throw new Error('TG_TEST_CHAT_ID must be numeric');
  }

  const userApiId = userApiIdRaw ? Number(userApiIdRaw) : NaN;
  if (senderMode === 'user' && !Number.isFinite(userApiId)) {
    throw new Error('TG_USER_API_ID must be numeric');
  }

  const me = await callBotApi(targetToken, 'getMe');
  const targetUsername = me?.username;

  const rawArgs = process.argv.slice(2);
  const messageArgs = rawArgs[0] === '--' ? rawArgs.slice(1) : rawArgs;
  const cliText = messageArgs.join(' ').trim();
  const defaultText = targetUsername ? `/help@${targetUsername}` : '/help';
  const text = cliText || defaultText;

  let messageId = '(user-mode: no bot message id)';
  let destination = `chat_id=${chatId}`;

  if (senderMode === 'bot') {
    const sent = await callBotApi(testerToken, 'sendMessage', {
      chat_id: chatId,
      text,
    });
    messageId = String(sent.message_id);
    destination = `bot-api chat_id=${chatId}`;
  } else {
    const client = createUserClient({
      apiId: userApiId,
      apiHash: userApiHash,
      session: userSession,
    });
    await client.connect();
    try {
      const target = await resolveTargetDialogByPeerId(client, chatId);

      const sent = await client.sendMessage(target.entity, { message: text });
      messageId = String(sent.id ?? messageId);
      destination = `dialog=${target.name || 'unknown'} peerId=${Number(utils.getPeerId(target.entity))}`;
    } finally {
      await client.disconnect();
    }
  }

  console.log('Sent command:', text);
  console.log('Sender mode:', senderMode);
  console.log('Destination:', destination);
  console.log('Message id:', messageId);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
