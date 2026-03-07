## Tests

### Unit tests

```bash
pnpm test
```

Run a specific file:

```bash
pnpm test:file -- apps/playground/src/telegram.menu.live.spec.ts
```

Run a specific `it`/`test` by name:

```bash
pnpm test:case -- "navigates menu and handles inline button clicks"
```

### Live Telegram integration test (real Bot API)

This test starts a real Nest bot and verifies `/help` in a real chat via Telegram Bot API.

```bash
pnpm test:live
```

Run a specific live file:

```bash
pnpm test:live:file -- apps/playground/src/telegram.menu.live.spec.ts
```

Run a specific live test by name:

```bash
pnpm test:live:case -- "navigates menu and handles inline button clicks"
```

Required environment variables:

- `TELEGRAM_KEY` — target bot token
- `TG_TEST_CHAT_ID` — test chat id (usually a group, e.g. `-100...`)
- `TG_USER_API_ID`
- `TG_USER_API_HASH`
- `TG_USER_SESSION` (StringSession)
- `TG_FORM_TIMEOUT_MS` (optional) — form timeout in ms, default `60000`.

You can generate `TG_USER_SESSION` programmatically:

```bash
pnpm tg:gen-session
```

By default the script starts QR login (prints QR in terminal). If you need the legacy code mode:

```bash
pnpm tg:gen-session -- --sms
```

After authorization, the script prints a line for `.env`.

Recommended setup:

- the user account from `TG_USER_SESSION` should be a member of the test chat;
- run tests only in a dedicated test chat.

If env variables are not set, the live suite is skipped automatically.

### Form e2e corner cases

Live e2e covers `/order` form scenarios:

- Happy path: all fields are completed successfully and final `✅ Order accepted` is returned.
- Validation retry: invalid `quantity` and `deliveryDate` return `Error:` and repeat current prompt.
- Timeout path: with a short `TG_FORM_TIMEOUT_MS`, bot sends timeout message.

Recommended for e2e: `TG_FORM_TIMEOUT_MS=10000` to avoid waiting 60 seconds.

### List e2e

Live e2e includes `/list` scenario:

- bot shows inline button list;
- test presses real `kek2` button;
- final reply `Selected option: key2` is verified.

## Telegram debug logs

- `TG_DEBUG_UPDATES=1` — enable logging of all incoming bot updates to console.
- `TG_DEBUG_UPDATES_FILE=1` — additionally write these logs to file.
- `TG_DEBUG_UPDATES_LOG_PATH` (optional) — log file path (default `logs/telegram-updates.log`).

## Send helper command

- `pnpm tg:send-help` — send `/help` to `TG_TEST_CHAT_ID`.
- Custom text: `pnpm tg:send-help -- "<text>"`.
- Sending uses user MTProto session (`TG_USER_SESSION`).
