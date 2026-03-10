import { randomUUID } from "crypto";
import { LRUCache } from "lru-cache";

/**
 * Abstraction for storing arbitrary data attached to inline‑keyboard buttons.
 *
 * The default implementation keeps everything in‑process via {@link LRUCache}.
 * Swap in a Redis‑backed class (same interface) when you need persistence
 * or multi‑instance support.
 */
export interface IButtonDataStore {
  /** Store `data` and return a short ID to reference it later. */
  set<T>(data: T, ttlMs?: number): string;

  /** Retrieve previously stored data by its ID, or `undefined` if expired / missing. */
  get<T>(id: string): T | undefined;

  /** Explicitly remove an entry. */
  delete(id: string): void;
}

export const BUTTON_DATA_STORE = Symbol("BUTTON_DATA_STORE");

const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes
const DEFAULT_MAX_ENTRIES = 50_000;

/** @internal Wrapper so we can store primitives inside LRUCache<string, object>. */
type Entry = { v: unknown };

export class InMemoryButtonDataStore implements IButtonDataStore {
  private readonly cache: LRUCache<string, Entry>;

  constructor(opts?: { maxEntries?: number; defaultTtlMs?: number }) {
    this.cache = new LRUCache<string, Entry>({
      max: opts?.maxEntries ?? DEFAULT_MAX_ENTRIES,
      ttl: opts?.defaultTtlMs ?? DEFAULT_TTL_MS,
    });
  }

  set<T>(data: T, ttlMs?: number): string {
    const id = randomUUID();
    const entry: Entry = { v: data };
    if (ttlMs !== undefined) {
      this.cache.set(id, entry, { ttl: ttlMs });
    } else {
      this.cache.set(id, entry);
    }
    return id;
  }

  get<T>(id: string): T | undefined {
    const entry = this.cache.get(id);
    return entry ? (entry.v as T) : undefined;
  }

  delete(id: string): void {
    this.cache.delete(id);
  }
}
