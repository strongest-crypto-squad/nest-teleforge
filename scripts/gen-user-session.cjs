const { TelegramClient } = require('telegram');
const { StringSession } = require('telegram/sessions');
const qr = require('qrcode-terminal');
const { loadDotEnv, requireEnv } = require('./lib/env.cjs');
const { createPrompt } = require('./lib/prompt.cjs');

function toBase64Url(bufferLike) {
  const b64 = Buffer.from(bufferLike).toString('base64');
  return b64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function main() {
  loadDotEnv();
  requireEnv(['TG_USER_API_ID', 'TG_USER_API_HASH']);

  const apiIdRaw = process.env.TG_USER_API_ID;
  const apiHash = process.env.TG_USER_API_HASH;

  const apiId = Number(apiIdRaw);
  if (!Number.isFinite(apiId)) {
    throw new Error('TG_USER_API_ID must be numeric');
  }

  const prompt = createPrompt();
  const client = new TelegramClient(new StringSession(''), apiId, apiHash, {
    connectionRetries: 5,
  });
  const useSmsMode = process.argv.includes('--sms');

  try {
    await client.connect();

    if (useSmsMode) {
      await client.start({
        phoneNumber: async () => (await prompt.ask('Phone number (e.g. +7999...): ')).trim(),
        phoneCode: async () => (await prompt.ask('Telegram code: ')).trim(),
        password: async () => (await prompt.ask('2FA password (if any): ')).trim(),
        onError: (err) => {
          throw err;
        },
      });
    } else {
      console.log('Scan QR in Telegram: Settings -> Devices -> Link Desktop Device');
      let lastToken = '';

      await client.signInUserWithQrCode(
        { apiId, apiHash },
        {
          qrCode: async ({ token, expires }) => {
            const encoded = toBase64Url(token);
            if (encoded === lastToken) return;
            lastToken = encoded;

            const link = `tg://login?token=${encoded}`;
            console.log(`\nQR expires at: ${new Date(expires * 1000).toISOString()}`);
            console.log(`Login link: ${link}\n`);
            qr.generate(link, { small: true });
            console.log('\nWaiting for scan confirmation...');
          },
          password: async () => (await prompt.ask('2FA password (if any): ')).trim(),
          onError: (err) => {
            throw err;
          },
        },
      );
    }

    const session = client.session.save();
    console.log('\nTG_USER_SESSION generated successfully:\n');
    console.log(session);
    console.log('\nAdd this to your .env:');
    console.log(`TG_USER_SESSION=${session}`);
  } finally {
    prompt.close();
    await client.disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
