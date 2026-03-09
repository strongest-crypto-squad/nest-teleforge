# nest-teleforge

NestJS toolkit for Telegram bots on top of Telegraf.

## Features

- `@TgCommand()` command handlers discovered automatically
- `telegramService.form()` typed conversational forms with validation
- `@MenuAction()` + `menuService.start()` inline keyboard menus with nested navigation
- `listAnswerService.ask()` selectable lists with pagination, predicates, cancel and timeout
- Low-level `WaitManager` for custom waiting flows

## Installation

```bash
pnpm add nest-teleforge @nestjs/common @nestjs/core telegraf reflect-metadata class-validator
```

## Module setup

```ts
import { Module } from "@nestjs/common";
import { TelegramModule } from "nest-teleforge";

@Module({
  imports: [TelegramModule.forRoot(process.env.TELEGRAM_KEY!)],
})
export class AppModule {}
```

Async configuration:

```ts
TelegramModule.forRootAsync({
  inject: [ConfigService],
  useFactory: (config: ConfigService) =>
    config.getOrThrow<string>("TELEGRAM_KEY"),
});
```

## Commands with `@TgCommand`

Methods decorated with `@TgCommand("name")` are registered as Telegram bot commands.

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand } from "nest-teleforge";

@Injectable()
export class BotCommands {
  @TgCommand("help")
  async onHelp(ctx: Context) {
    await ctx.reply("Available commands: /help, /order, /menu");
  }
}
```

## Typed forms with `telegramService.form`

Use class-validator DTO + `@Prompt()` metadata to build a step-by-step conversation.

```ts
import { IsInt, Min, IsDateString } from "class-validator";
import { Prompt } from "nest-teleforge";

export class OrderDto {
  @Prompt("Product name")
  product = "";

  @Prompt("Quantity")
  @IsInt()
  @Min(1)
  quantity = 1;

  @Prompt("Delivery date (YYYY-MM-DD)")
  @IsDateString()
  deliveryDate = "";
}
```

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { TgCommand, TelegramService } from "nest-teleforge";

@Injectable()
export class FormCommands {
  constructor(private readonly telegramService: TelegramService) {}

  @TgCommand("order")
  async onOrder(ctx: Context) {
    const dto = await this.telegramService.form(OrderDto, {
      timeoutMs: 60_000,
      cancelCommand: "/cancel",
    });

    await ctx.reply(`Order accepted: ${dto.product} x${dto.quantity}`);
  }
}
```

Behavior:

- Field-by-field prompts in DTO key order
- Type coercion for `Number`, `Boolean`, `Date`
- Validation retry per field (`Error: ...`)
- Timeout and `/cancel` support through internal waiter pipeline

## Select from list with `ListAnswerService`

`listAnswerService.ask()` renders inline buttons and returns `selected`, `cancel`, or `timeout`.

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { ListAnswerService, TgCommand } from "nest-teleforge";

@Injectable()
export class ListCommands {
  constructor(private readonly listAnswerService: ListAnswerService) {}

  @TgCommand("list")
  async onList(ctx: Context) {
    const result = await this.listAnswerService.ask(
      ctx,
      [
        { key: "key1", label: "Option 1", enabled: true },
        { key: "key2", label: "Option 2", enabled: true },
      ],
      {
        getLabel: (item) => item.label,
        getKey: (item) => item.key,
        message: "Choose an option:",
        timeoutMs: 30_000,
        cancel: { label: "Cancel", value: "cancel" },
        predicate: (item) => item.enabled,
      },
    );

    if (result.type === "selected") {
      await ctx.reply(`Selected: ${result.item.key}`);
      return;
    }

    if (result.type === "cancel") {
      await ctx.reply("Canceled");
      return;
    }

    await ctx.reply("Timed out");
  }
}
```

## Menus with `@MenuAction` and `MenuService`

Menu actions are discovered automatically from decorators.
Flow is started explicitly from a command (or any handler) with `menuService.start(...)`.

```ts
import { Injectable } from "@nestjs/common";
import { Context } from "telegraf";
import { MenuAction, MenuService, TgCommand } from "nest-teleforge";

@Injectable()
export class MenuHandlers {
  constructor(private readonly menuService: MenuService) {}

  @TgCommand("menu")
  async onMenu(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: "main",
      text: "Main menu",
      columns: 2,
    });
  }

  @MenuAction("main", "profile", {
    label: "👤 Profile",
    description: "Profile menu",
  })
  async profile() {
    return "rerender" as const;
  }

  @MenuAction("main", "edit-name", {
    parentFunction: MenuHandlers.prototype.profile,
    label: "✏️ Edit name",
  })
  async editName(ctx: Context) {
    await ctx.reply("Name updated");
    return "handled" as const;
  }
}
```

Menu options:

- `label`, `description`, `order`, `columns`
- `guard` (hide action if predicate fails)
- `disabled` + `disabledText` (show action as unavailable)
- `parentFunction` for nested menus
- `back` to control default back button behavior
- `hidden` to exclude action from rendering

Action return values:

- `"handled"` — action handled without rerender
- `"rerender"` — rerender current branch
- `"rerender-parent"` — pop one level and rerender

Nested flow support:

- `menuService.start(..., { mode: "push" })` starts child flow on top of current flow
- `menuService.closeCurrent(ctx, { renderPrevious: true })` closes current flow and re-renders previous one

### Isolated / Service-initiated (Rootless) menus

If you need to send a menu not from a root command, but from a background job, service, or alert (e.g. notifications), you can define a dummy "anchor" function and use it as `parentFunction` for the root-level buttons of that specific menu to isolate it from other flows.

```ts
import { Controller } from '@nestjs/common';
import { MenuAction, MenuService } from 'nest-teleforge';

// 1. Define an empty anchor function 
const DeployMenuRoot = () => {}; 
const DEPLOY_FLOW = 'deploy_flow';

@Controller()
export class DeployMenuController {
  // 2. Bind top-level buttons to the anchor function
  @MenuAction(DEPLOY_FLOW, 'deploy', {
    label: 'Deploy',
    parentFunction: DeployMenuRoot,
  })
  onDeploy() { return 'rerender'; }

  @MenuAction(DEPLOY_FLOW, 'confirm', {
    label: 'Confirm ✅',
    parentFunction: DeployMenuController.prototype.onDeploy, // nested under 'deploy'
  })
  async onConfirm(ctx) {
    await ctx.reply('Deployed!');
    return 'handled';
  }
}

// 3. From any service, start the menu by providing the anchor function
@Injectable()
export class NotificationService {
  constructor(private readonly menuService: MenuService) {}

  async sendAlert(ctx: Context) {
    await this.menuService.start(ctx, {
      flowId: DEPLOY_FLOW,
      text: 'New image available!',
      parentFunction: DeployMenuRoot, // Context starts directly from anchor
    });
  }
}
```

## Low-level exports

- `TelegramService` — bot instance access (`getBot`) and form API
- `WaitManager` — low-level waiter primitive (`create`, `consume`, `cancel`)
- `TELEGRAM_KEY` — injection token for bot key provider

## Debug update logs

The Telegram service supports optional incoming update logging:

- `TG_DEBUG_UPDATES=1`
- `TG_DEBUG_UPDATES_FILE=1`
- `TG_DEBUG_UPDATES_LOG_PATH=logs/telegram-updates.log`
