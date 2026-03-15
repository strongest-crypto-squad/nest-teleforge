export type Waiter = {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
  matcher?: (text: string) => boolean;
  createdAt: number;
};

export type WaiterOptions = {
  scope?: string;
  matcher?: (text: string) => boolean;
};

const DEFAULT_SCOPE = "__default__";

export class WaitManager {
  private pending = new Map<number, Map<string, Waiter>>();

  has(chatId: number, scope?: string) {
    const scoped = this.pending.get(chatId);
    if (!scoped) return false;
    if (scope) {
      return scoped.has(scope);
    }
    return scoped.size > 0;
  }

  create(
    chatId: number,
    ms: number,
    onTimeoutMsg?: () => void,
    options?: WaiterOptions,
  ) {
    const scope = options?.scope ?? DEFAULT_SCOPE;
    const scoped = this.pending.get(chatId) ?? new Map<string, Waiter>();
    const prev = scoped.get(scope);
    if (prev) {
      clearTimeout(prev.timeoutId);
      prev.reject(new Error("Replaced by new waiter"));
      scoped.delete(scope);
    }

    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        const currentScoped = this.pending.get(chatId);
        currentScoped?.delete(scope);
        if (currentScoped && currentScoped.size === 0) {
          this.pending.delete(chatId);
        }
        onTimeoutMsg?.();
        reject(new Error("Timed out"));
      }, ms);

      scoped.set(scope, {
        resolve,
        reject,
        timeoutId,
        matcher: options?.matcher,
        createdAt: Date.now(),
      });
      this.pending.set(chatId, scoped);
    });
  }

  consume(chatId: number, text: string, scope?: string) {
    const scoped = this.pending.get(chatId);
    if (!scoped) return false;

    const w = this.findConsumable(scoped, text, scope);
    if (!w) return false;

    clearTimeout(w.timeoutId);
    scoped.delete(w.scope);
    if (scoped.size === 0) {
      this.pending.delete(chatId);
    }
    w.resolve(text);
    return true;
  }

  cancel(chatId: number, reason = "Canceled", scope?: string) {
    const scoped = this.pending.get(chatId);
    if (!scoped) return false;

    const targetScope = scope ?? DEFAULT_SCOPE;
    const w = scoped.get(targetScope);
    if (!w) return false;

    clearTimeout(w.timeoutId);
    scoped.delete(targetScope);
    if (scoped.size === 0) {
      this.pending.delete(chatId);
    }
    w.reject(new Error(reason));
    return true;
  }

  private findConsumable(
    scoped: Map<string, Waiter>,
    text: string,
    scope?: string,
  ): (Waiter & { scope: string }) | null {
    if (scope) {
      const waiter = scoped.get(scope);
      if (!waiter) return null;
      if (waiter.matcher && !waiter.matcher(text)) return null;
      return { ...waiter, scope };
    }

    const candidates = [...scoped.entries()]
      .map(([entryScope, waiter]) => ({ entryScope, waiter }))
      .sort((a, b) => b.waiter.createdAt - a.waiter.createdAt);

    for (const { entryScope, waiter } of candidates) {
      if (!waiter.matcher || waiter.matcher(text)) {
        return { ...waiter, scope: entryScope };
      }
    }

    return null;
  }
}
