import { Injectable } from '@nestjs/common';
import type { MenuNode, Predicate, TgCtx } from './menu.types';
import { SchemaRegistryService } from './schema.registry';
import { CallbackPacker } from './callback.packer';
@Injectable()
export class MenuRenderer {
  constructor(
    private readonly registry: SchemaRegistryService,
    private readonly packer: CallbackPacker,
  ) {}
  private async evalPred(
    p: Predicate | Predicate[] | undefined,
    ctx: TgCtx,
  ): Promise<boolean> {
    console.log('p', p, typeof p);
    if (!p) return true;
    const arr = Array.isArray(p) ? p : [p];
    for (const fn of arr) {
      console.log('fn', fn, typeof fn);
      const ok = await Promise.resolve(fn(ctx));
      if (!ok) return false;
    }
    return true;
  }
  async renderNode(
    rootKey: string,
    nodeKey: string,
    mctx: TgCtx,
    pathSegments: string[],
  ) {
    const node = this.registry.getNodeByKey(nodeKey);
    if (!node) throw new Error(`Node not found: ${nodeKey}`);
    const children = this.registry.getChildrenKeys(nodeKey);
    const visible: string[] = [];
    for (const ck of children) {
      const ch = this.registry.getNodeByKey(ck)!;
      if (ch.hidden) continue;
      console.log(ch);
      const allowed = await this.evalPred(ch.guard, mctx);
      if (allowed) visible.push(ck);
    }
    visible.sort((a, b) => {
      const A = this.registry.getNodeByKey(a)!;
      const B = this.registry.getNodeByKey(b)!;
      const ao = A.order ?? 0,
        bo = B.order ?? 0;
      if (ao !== bo) return ao - bo;
      const av = A.value ?? '',
        bv = B.value ?? '';
      if (av !== bv) return av.localeCompare(bv);
      return a.localeCompare(b);
    });
    const columns = Math.max(1, Math.min(5, node.layout?.columns ?? 2));
    const rows: any[] = [];
    let row: any[] = [];
    const rootShort = this.registry.getRootShort(rootKey)!;
    for (const ck of visible) {
      const ch = this.registry.getNodeByKey(ck)!;
      const segShort = this.registry.getChildShort(nodeKey, ck)!;
      const nextPath = [...pathSegments, segShort];
      const data = this.packer.pack(rootShort, nextPath);
      row.push({ text: ch.value ?? ch.key, callback_data: data });
      if (row.length >= columns) {
        rows.push(row);
        row = [];
      }
    }
    if (row.length) rows.push(row);
    const parent = this.registry.getParentKey(nodeKey);
    const isRoot = parent == null;
    const showBack = isRoot ? false : (node.back ?? true);
    if (showBack) {
      const backPath = pathSegments.slice(0, -1);
      const data = this.packer.pack(rootShort, backPath);
      rows.push([{ text: '⬅️ Назад', callback_data: data }]);
    }
    const text = node.description ?? node.value ?? node.key;
    const reply_markup = { inline_keyboard: rows };
    return { text, reply_markup };
  }
}
