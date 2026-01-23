import { Injectable, Logger, OnModuleInit } from "@nestjs/common";
import { DiscoveryService, MetadataScanner, Reflector } from "@nestjs/core";
import type { Context } from "telegraf";
import { SchemaRegistryService } from "./schema.registry";
import { MenuContextBuilder } from "./menu.context.builder";
import { MenuRenderer } from "./menu.renderer";
import { CallbackPacker } from "./callback.packer";
import { MENU_ACTION_METADATA, MenuActionResult } from "./menu.decorator";
import { TelegramService } from "libs/my-lib/src/telegram.service";
@Injectable()
export class MenuExplorer implements OnModuleInit {
  private readonly logger = new Logger(MenuExplorer.name);
  private handlers = new Map<
    string,
    (ctx: Context, mctx: any) => Promise<MenuActionResult | void>
  >();
  constructor(
    private readonly discovery: DiscoveryService,
    private readonly scanner: MetadataScanner,
    private readonly reflector: Reflector,
    private readonly botService: TelegramService,
    private readonly registry: SchemaRegistryService,
    private readonly builder: MenuContextBuilder,
    private readonly renderer: MenuRenderer,
    private readonly packer: CallbackPacker,
  ) {}
  onModuleInit() {
    this.scanActionHandlers();
    this.registerCommands();
    this.registerCallbackQuery();
  }
  private scanActionHandlers() {
    for (const w of this.discovery.getProviders()) {
      const instance = w.instance as any;
      if (!instance || typeof instance !== "object") continue;
      const proto = Object.getPrototypeOf(instance);
      this.scanner.scanFromPrototype(instance, proto, (methodName: string) => {
        const method = proto[methodName];
        const key = this.reflector.get<string>(MENU_ACTION_METADATA, method);
        if (key) {
          this.logger.log(
            `@MenuAction('${key}') -> ${instance.constructor.name}.${methodName}`,
          );
          this.handlers.set(key, method.bind(instance));
        }
      });
    }
  }
  private registerCommands() {
    const bot = this.botService.getBot();
    for (const rootKey of this.registry.getRootKeys()) {
      const root = this.registry.getNodeByKey(rootKey)!;
      if (!root.command) continue;
      const cmd = root.command.replace(/^\//, "");
      this.logger.log(`Registering menu command /${cmd} -> ${rootKey}`);
      bot.command(cmd, async (ctx: Context) => {
        const chatId = ctx.chat?.id;
        if (chatId == null) return;
        const mctx = await this.builder.build(ctx);
        const { text, reply_markup } = await this.renderer.renderNode(
          rootKey,
          rootKey,
          mctx,
          [],
        );
        await ctx.reply(text, { reply_markup });
      });
    }
  }
  private registerCallbackQuery() {
    const bot = this.botService.getBot();
    bot.on("callback_query", async (ctx: Context) => {
      const data = (ctx.update as any)?.callback_query?.data as
        | string
        | undefined;
      if (!data || !data.startsWith("m:")) return;
      const unpacked = this.packer.unpack(data);
      if (!unpacked || !unpacked.valid) {
        try {
          await ctx.answerCbQuery("Ссылка устарела");
        } catch {}
        return;
      }
      const chatId = ctx.chat?.id;
      if (chatId == null) return;
      const rootKey = this.registry.getRootByShort(unpacked.rootShort);
      if (!rootKey) {
        try {
          await ctx.answerCbQuery("Меню недоступно");
        } catch {}
        return;
      }
      let nodeKey = rootKey;
      let parentKey: string | null = null;
      for (const seg of unpacked.segments) {
        const childKey = this.registry.getChildByShort(nodeKey, seg);
        if (!childKey) break;
        parentKey = nodeKey;
        nodeKey = childKey;
      }
      const mctx = await this.builder.build(ctx);
      const node = this.registry.getNodeByKey(nodeKey)!;
      const allowed = await this.evalPred(node.guard as any, mctx);
      if (!allowed) {
        const fallbackKey = parentKey ?? rootKey;
        const pathSegs = unpacked.segments.slice(0, -1);
        const { text, reply_markup } = await this.renderer.renderNode(
          rootKey,
          fallbackKey,
          mctx,
          pathSegs,
        );
        await this.safeEditOrSend(ctx, text, reply_markup);
        try {
          await ctx.answerCbQuery("Недоступно");
        } catch {}
        return;
      }
      const notDisabled = await this.evalDisabled(node.disabled as any, mctx);
      if (!notDisabled) {
        try {
          await ctx.answerCbQuery(node.disabledText || "Недоступно");
        } catch {}
        return;
      }
      const handler = this.handlers.get(nodeKey);
      let outcome: MenuActionResult | void = undefined;
      if (handler) {
        outcome = await this.botService.runWithChat(chatId, async () =>
          handler(ctx, mctx),
        );
      }
      if (outcome === "handled") {
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }
      if (outcome === "rerender-parent") {
        const pathSegs = unpacked.segments.slice(0, -1);
        const fallbackKey = parentKey ?? rootKey;
        const { text, reply_markup } = await this.renderer.renderNode(
          rootKey,
          fallbackKey,
          mctx,
          pathSegs,
        );
        await this.safeEditOrSend(ctx, text, reply_markup);
        try {
          await ctx.answerCbQuery();
        } catch {}
        return;
      }
      const { text, reply_markup } = await this.renderer.renderNode(
        rootKey,
        nodeKey,
        mctx,
        unpacked.segments,
      );
      await this.safeEditOrSend(ctx, text, reply_markup);
      try {
        await ctx.answerCbQuery();
      } catch {}
    });
  }
  private async safeEditOrSend(ctx: Context, text: string, reply_markup: any) {
    try {
      await ctx.editMessageText(text, { reply_markup });
    } catch {
      await ctx.reply(text, { reply_markup });
    }
  }
  private async evalPred(p: any, mctx: any): Promise<boolean> {
    if (!p) return true;
    const arr = Array.isArray(p) ? p : [p];
    for (const fn of arr) {
      const ok = await Promise.resolve(fn(mctx));
      if (!ok) return false;
    }
    return true;
  }
  private async evalDisabled(p: any, mctx: any): Promise<boolean> {
    if (!p) return true;
    const arr = Array.isArray(p) ? p : [p];
    for (const fn of arr) {
      const ok = await Promise.resolve(fn(mctx));
      if (!ok) return true;
    }
    return false;
  }
}
