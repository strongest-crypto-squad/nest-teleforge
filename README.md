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
- `TG_TESTER_BOT_TOKEN` — токен второго бота, который отправляет команду (tester)
- `TG_TEST_CHAT_ID` — chat id общего тестового чата (обычно группа, например `-100...`)

Рекомендуемые условия:

- оба бота добавлены в один тестовый чат;
- у tester-бота отключён privacy mode в BotFather (чтобы видеть сообщения в группе);
- запускать только на отдельном тестовом чате.

Если env-переменные не заданы, live suite автоматически пропускается.
