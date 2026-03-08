export type Waiter = {
  resolve: (text: string) => void;
  reject: (err: Error) => void;
  timeoutId: NodeJS.Timeout;
};
export class WaitManager {
  private pending = new Map<number, Waiter>();
  has(chatId: number) {
    return this.pending.has(chatId);
  }
  create(chatId: number, ms: number, onTimeoutMsg?: () => void) {
    const prev = this.pending.get(chatId);
    if (prev) {
      clearTimeout(prev.timeoutId);
      prev.reject(new Error('Replaced by new waiter'));
      this.pending.delete(chatId);
    }

    return new Promise<string>((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        this.pending.delete(chatId);
        onTimeoutMsg?.();
        reject(new Error('Timed out'));
      }, ms);
      this.pending.set(chatId, { resolve, reject, timeoutId });
    });
  }
  consume(chatId: number, text: string) {
    const w = this.pending.get(chatId);
    if (!w) return false;
    clearTimeout(w.timeoutId);
    this.pending.delete(chatId);
    w.resolve(text);
    return true;
  }
  cancel(chatId: number, reason = 'Canceled') {
    const w = this.pending.get(chatId);
    if (!w) return false;
    clearTimeout(w.timeoutId);
    this.pending.delete(chatId);
    w.reject(new Error(reason));
    return true;
  }
}
