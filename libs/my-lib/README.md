# @your-scope/my-lib

NestJS toolkit for Telegram bots built on Telegraf:

- `@TgCommand()` command handlers
- typed `telegramService.form()` form flow
- `@MenuAction()` + `menuService.start()` menu flow with nested menus
- list-answer helper service

## Install

```bash
pnpm add @your-scope/my-lib telegraf reflect-metadata class-validator
pnpm add @nestjs/common @nestjs/core
```

## Quick start

```ts
import { Module } from "@nestjs/common";
import { TelegramModule } from "@your-scope/my-lib";

@Module({
  imports: [TelegramModule.forRoot(process.env.TELEGRAM_KEY!)],
})
export class AppModule {}
```

## Menu example

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand, MenuAction, MenuService } from "@your-scope/my-lib";

@Injectable()
export class BotController {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand("menu")
  async onMenu(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: "main",
      text: "Выберите действие",
    });
  }

  @MenuAction("main", "home", { label: "🏠 Домой", description: "Домой" })
  async onHome() {
    return "rerender" as const;
  }
}
```

## Publish

1. Set real package name in `libs/my-lib/package.json` (`name`).
2. Build package:

```bash
pnpm run lib:build
```

3. Check tarball:

```bash
pnpm run lib:pack
```

4. Publish:

```bash
pnpm run lib:publish
```

## CI/CD publish (GitHub Actions)

Workflow: `.github/workflows/publish-my-lib.yml`

- Автопубликация запускается по тегу `my-lib-vX.Y.Z` (например `my-lib-v1.2.0`).
- Также доступен ручной запуск через `workflow_dispatch`.
- Нужен GitHub Secret: `NPM_TOKEN` (npm automation token).

Пример релиза по тегу:

```bash
git tag my-lib-v1.2.0
git push origin my-lib-v1.2.0
```
