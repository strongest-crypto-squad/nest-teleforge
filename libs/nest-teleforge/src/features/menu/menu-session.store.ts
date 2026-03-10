import { randomUUID } from "crypto";
import { LRUCache } from "lru-cache";

// ─── Session interface ──────────────────────────────────────────

/**
 * A mutable per‑menu‑instance session.
 *
 * Created when `menuService.start()` is called, accessible in every
 * `@MenuAction` handler via `mctx.session`.
 *
 * ```ts
 * @MenuAction('main', 'products', { ... })
 * async onProducts(ctx: Context, mctx: MenuContext<{ cart: string[] }>) {
 *   mctx.session.data.cart.push('item-1');
 *   return 'rerender';
 * }
 * ```
 */
export interface MenuSession<T = any> {
  /** Unique session identifier. */
  readonly id: string;
  /** The flow this session belongs to. */
  readonly flowId: string;
  /** Mutable user‑defined data, persists for the lifetime of this menu instance. */
  data: T;
}

// ─── Store abstraction ──────────────────────────────────────────

/**
 * Persistence layer for menu sessions.
 *
 * The default {@link InMemoryMenuSessionStore} uses an LRU cache with TTL.
 * Swap in a Redis implementation for multi‑instance / persistence.
 */
export interface IMenuSessionStore {
  /** Create a new session and return it. */
  create<T>(flowId: string, initialData: T, ttlMs?: number): MenuSession<T>;

  /** Retrieve a session by ID, or `undefined` if expired / missing. */
  get<T>(id: string): MenuSession<T> | undefined;

  /** Explicitly remove a session. */
  delete(id: string): void;
}

export const MENU_SESSION_STORE = Symbol("MENU_SESSION_STORE");

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_ENTRIES = 10_000;

/** @internal LRU entry wrapper. */
type Entry = { session: MenuSession };

export class InMemoryMenuSessionStore implements IMenuSessionStore {
  private readonly cache: LRUCache<string, Entry>;

  constructor(opts?: { maxEntries?: number; defaultTtlMs?: number }) {
    this.cache = new LRUCache<string, Entry>({
      max: opts?.maxEntries ?? DEFAULT_MAX_ENTRIES,
      ttl: opts?.defaultTtlMs ?? DEFAULT_TTL_MS,
    });
  }

  create<T>(flowId: string, initialData: T, ttlMs?: number): MenuSession<T> {
    const session: MenuSession<T> = {
      id: randomUUID(),
      flowId,
      data: initialData,
    };
    const entry: Entry = { session };
    if (ttlMs !== undefined) {
      this.cache.set(session.id, entry, { ttl: ttlMs });
    } else {
      this.cache.set(session.id, entry);
    }
    return session;
  }

  get<T>(id: string): MenuSession<T> | undefined {
    const entry = this.cache.get(id);
    return entry ? (entry.session as MenuSession<T>) : undefined;
  }

  delete(id: string): void {
    this.cache.delete(id);
  }
}
