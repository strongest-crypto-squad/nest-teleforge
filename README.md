## Tests

### Unit tests

```bash
pnpm test
```

### Live Telegram integration test (real Bot API)

Тест запускает реальный Nest-бот и проверяет `/help` в реальном чате через Telegram Bot API.

```bash
pnpm test:live
```

Нужны переменные окружения:

- `TELEGRAM_KEY` — токен тестируемого бота (target)
- `TG_TEST_CHAT_ID` — chat id общего тестового чата (обычно группа, например `-100...`)

Режим отправителя (`TG_LIVE_SENDER`):

- `bot` (по умолчанию) — отправка от tester-бота, нужен `TG_TESTER_BOT_TOKEN`.
- `user` — отправка от реального пользователя через MTProto, нужны:
  - `TG_USER_API_ID`
  - `TG_USER_API_HASH`
  - `TG_USER_SESSION` (StringSession)

Сгенерировать `TG_USER_SESSION` можно программно:

```bash
pnpm tg:gen-session
```

По умолчанию скрипт запускает QR-логин (покажет QR в терминале). Если нужен старый режим по коду:

```bash
pnpm tg:gen-session -- --sms
```

После авторизации скрипт выведет строку для `.env`.

Рекомендуемые условия:

- в режиме `bot`: оба бота добавлены в один тестовый чат;
- в режиме `bot`: у tester-бота отключён privacy mode в BotFather (чтобы видеть сообщения в группе);
- запускать только на отдельном тестовом чате.

Если env-переменные не заданы, live suite автоматически пропускается.

## Telegram debug logs

- `TG_DEBUG_UPDATES=1` — включить лог всех входящих апдейтов бота в консоль.
- `TG_DEBUG_UPDATES_FILE=1` — дополнительно писать эти логи в файл.
- `TG_DEBUG_UPDATES_LOG_PATH` (опционально) — путь к файлу логов (по умолчанию `logs/telegram-updates.log`).

## Send helper command

- `pnpm tg:send-help` — отправить `/help` в `TG_TEST_CHAT_ID`.
- Для кастомного текста: `pnpm tg:send-help -- "<text>"`.
- Режим отправителя задаётся через `TG_LIVE_SENDER=bot|user`.
