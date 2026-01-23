import { Injectable } from '@nestjs/common';
import { MenuNode } from './menu.types';
type ShortMap = Map<string, string>;
type ShortRev = Map<string, string>;
@Injectable()
export class SchemaRegistryService {
  private roots = new Map<string, MenuNode>();
  private keyIndex = new Map<string, MenuNode>();
  private parentIndex = new Map<string, string | null>();
  private childrenIndex = new Map<string, string[]>();
  private commandIndex = new Map<string, string>();
  private shortIndex = new Map<string, ShortMap>();
  private shortRevIndex = new Map<string, ShortRev>();
  private rootShort = new Map<string, string>();
  private rootShortRev = new Map<string, string>();
  registerSchema(
    node: MenuNode,
    opts?: { parentKey?: string; onConflict?: 'error' | 'override' },
  ) {
    const onConflict = opts?.onConflict ?? 'override';
    if (opts?.parentKey) {
      const parent = this.keyIndex.get(opts.parentKey);
      if (!parent) throw new Error(`Parent key not found: ${opts.parentKey}`);
      parent.c = parent.c ?? {};
      const last = node.key.split('.').pop()!;
      if (parent.c[last] && onConflict === 'error')
        throw new Error(
          `Conflict at child '${last}' under '${opts.parentKey}'`,
        );
      parent.c[last] = this.mergeNodes(parent.c[last], node);
      this.rebuildIndexes();
      return;
    }
    if (!node?.key) throw new Error('Node.key is required');
    const existing = this.roots.get(node.key);
    if (existing && onConflict === 'error')
      throw new Error(`Root already registered: ${node.key}`);
    this.roots.set(node.key, this.mergeNodes(existing, node));
    this.rebuildIndexes();
  }
  getNodeByKey(key: string) {
    return this.keyIndex.get(key);
  }
  getRootKeys(): string[] {
    return [...this.roots.keys()];
  }
  getRootByCommand(commandName: string): string | undefined {
    return this.commandIndex.get(commandName.replace(/^\//, ''));
  }
  getParentKey(key: string) {
    return this.parentIndex.get(key);
  }
  getChildrenKeys(parentKey: string) {
    return this.childrenIndex.get(parentKey) ?? [];
  }
  getChildShort(parentKey: string, childKey: string) {
    return this.shortIndex.get(parentKey)?.get(childKey);
  }
  getChildByShort(parentKey: string, short: string) {
    return this.shortRevIndex.get(parentKey)?.get(short);
  }
  getRootShort(rootKey: string) {
    return this.rootShort.get(rootKey);
  }
  getRootByShort(short: string) {
    return this.rootShortRev.get(short);
  }
  private rebuildIndexes() {
    this.keyIndex.clear();
    this.parentIndex.clear();
    this.childrenIndex.clear();
    this.commandIndex.clear();
    this.shortIndex.clear();
    this.shortRevIndex.clear();
    this.rootShort.clear();
    this.rootShortRev.clear();
    const rootKeys = [...this.roots.keys()].sort();
    rootKeys.forEach((rk, i) => {
      const s = i.toString(36);
      this.rootShort.set(rk, s);
      this.rootShortRev.set(s, rk);
    });
    for (const [rootKey, root] of this.roots) {
      if (root.command) {
        const cmd = root.command.replace(/^\//, '');
        if (this.commandIndex.has(cmd))
          throw new Error(`Duplicate command '${cmd}' across roots`);
        this.commandIndex.set(cmd, rootKey);
      }
      this.walk(root, null);
    }
    for (const [parentKey, children] of this.childrenIndex) {
      const ordered = [...children].sort((a, b) => {
        const A = this.keyIndex.get(a)!;
        const B = this.keyIndex.get(b)!;
        const ao = A.order ?? 0,
          bo = B.order ?? 0;
        if (ao !== bo) return ao - bo;
        const av = A.value ?? '',
          bv = B.value ?? '';
        if (av !== bv) return av.localeCompare(bv);
        return a.localeCompare(b);
      });
      const map: ShortMap = new Map();
      const rev: ShortRev = new Map();
      ordered.forEach((k, idx) => {
        const s = idx.toString(36);
        map.set(k, s);
        rev.set(s, k);
      });
      this.shortIndex.set(parentKey, map);
      this.shortRevIndex.set(parentKey, rev);
    }
  }
  private walk(node: MenuNode, parentKey: string | null) {
    if (!node.key || typeof node.key !== 'string')
      throw new Error('Empty node.key');
    if (parentKey && node.command)
      throw new Error(`'command' is only allowed on root (key=${node.key})`);
    this.keyIndex.set(node.key, node);
    this.parentIndex.set(node.key, parentKey);
    const children = Object.values(node.c ?? {});
    this.childrenIndex.set(
      node.key,
      children.map((c) => c.key),
    );
    for (const child of children) this.walk(child, node.key);
  }
  private mergeNodes(base: MenuNode | undefined, incoming: MenuNode): MenuNode {
    if (!base) {
      return this.cloneNode(incoming);
    }
    const merged: MenuNode = { ...base, ...incoming };
    const bc = base.c ?? {};
    const ic = incoming.c ?? {};
    const out: Record<string, MenuNode> = {};
    const keys = new Set([...Object.keys(bc), ...Object.keys(ic)]);
    for (const k of keys) {
      const b = bc[k];
      const i = ic[k];
      if (b && i) out[k] = this.mergeNodes(b, i);
      else out[k] = (b ?? i)!;
    }
    if (Object.keys(out).length) merged.c = out;
    return merged;
  }

  private cloneNode(node: MenuNode): MenuNode {
    const cloned: MenuNode = {
      key: node.key,
      value: node.value,
      description: node.description,
      order: node.order,
      back: node.back,
      guard: node.guard,
      disabled: node.disabled,
      disabledText: node.disabledText,
      hidden: node.hidden,
      layout: node.layout ? { ...node.layout } : undefined,
      command: node.command,
    };
    if (node.c) {
      const out: Record<string, MenuNode> = {};
      for (const [k, v] of Object.entries(node.c)) {
        out[k] = this.cloneNode(v);
      }
      cloned.c = out;
    }
    return cloned;
  }
}
