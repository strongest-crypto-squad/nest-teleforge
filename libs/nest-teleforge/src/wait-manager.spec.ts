import { WaitManager } from "./wait-manager";

describe("WaitManager flow", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("resolves waiter when message is consumed", async () => {
    const manager = new WaitManager();
    const chatId = 101;

    const promise = manager.create(chatId, 10_000);

    expect(manager.has(chatId)).toBe(true);
    expect(manager.consume(chatId, "hello")).toBe(true);

    await expect(promise).resolves.toBe("hello");
    expect(manager.has(chatId)).toBe(false);
  });

  it("rejects previous waiter when replaced by new one", async () => {
    const manager = new WaitManager();
    const chatId = 202;

    const first = manager.create(chatId, 10_000);
    const second = manager.create(chatId, 10_000);

    await expect(first).rejects.toThrow("Replaced by new waiter");

    manager.consume(chatId, "next");
    await expect(second).resolves.toBe("next");
  });

  it("returns false for unknown consume/cancel", () => {
    const manager = new WaitManager();

    expect(manager.consume(999, "x")).toBe(false);
    expect(manager.cancel(999)).toBe(false);
  });

  it("times out and calls timeout callback", async () => {
    const manager = new WaitManager();
    const onTimeout = jest.fn();

    const promise = manager.create(303, 1_000, onTimeout);

    jest.advanceTimersByTime(1_000);

    await expect(promise).rejects.toThrow("Timed out");
    expect(onTimeout).toHaveBeenCalledTimes(1);
    expect(manager.has(303)).toBe(false);
  });

  it("cancels waiter with reason", async () => {
    const manager = new WaitManager();

    const promise = manager.create(404, 10_000);

    expect(manager.cancel(404, "User canceled")).toBe(true);

    await expect(promise).rejects.toThrow("User canceled");
    expect(manager.has(404)).toBe(false);
  });

  it("supports parallel scoped waiters in one chat", async () => {
    const manager = new WaitManager();
    const first = manager.create(505, 10_000, undefined, { scope: "form" });
    const second = manager.create(505, 10_000, undefined, { scope: "list" });

    expect(manager.consume(505, "first", "form")).toBe(true);
    expect(manager.consume(505, "second", "list")).toBe(true);

    await expect(first).resolves.toBe("first");
    await expect(second).resolves.toBe("second");
  });

  it("consumes only matching waiter when matcher is defined", async () => {
    const manager = new WaitManager();
    const list = manager.create(606, 10_000, undefined, {
      scope: "list",
      matcher: (text) => text.startsWith("la:"),
    });

    expect(manager.consume(606, "menu:1")).toBe(false);
    expect(manager.consume(606, "la:item-1")).toBe(true);

    await expect(list).resolves.toBe("la:item-1");
  });
});
