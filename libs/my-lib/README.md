# nest-teleforge

NestJS toolkit for Telegram bots built on Telegraf:

- `@TgCommand()` command handlers
- typed `telegramService.form()` form flow
- `@MenuAction()` + `menuService.start()` menu flow with nested menus
- list-answer helper service

## Install

```bash
pnpm add nest-teleforge telegraf reflect-metadata class-validator
pnpm add @nestjs/common @nestjs/core
```

## Quick start

```ts
import { Module } from "@nestjs/common";
import { TelegramModule } from "nest-teleforge";

@Module({
  imports: [TelegramModule.forRoot(process.env.TELEGRAM_KEY!)],
})
export class AppModule {}
```

## Menu example

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand, MenuAction, MenuService } from "nest-teleforge";

@Injectable()
export class BotController {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand("menu")
  async onMenu(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: "main",
      text: "Choose an action",
    });
  }

  @MenuAction("main", "home", { label: "🏠 Home", description: "Home" })
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

- Auto-publish runs on tag `my-lib-vX.Y.Z` (for example `my-lib-v1.2.0`).
- Manual run via `workflow_dispatch` is also available.
- Required GitHub Secret: `NPM_TOKEN` (npm automation token).

Tag release example:

```bash
git tag my-lib-v1.2.0
git push origin my-lib-v1.2.0
```
