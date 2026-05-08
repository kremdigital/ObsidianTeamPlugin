/**
 * In-memory TTL set used to break echo loops.
 *
 * Scenario:
 *   1. Server pushes a file mutation.
 *   2. The plugin applies it via `vault.modify(...)`.
 *   3. Obsidian's `vault.on('modify', ...)` fires — but we DON'T want to
 *      ship the same change back upstream.
 *
 * The fix: right before applying, the sync engine calls `mark(path)`.
 * The watcher then consults `take(path)` (or `has(path)`) and skips the
 * event when there's an outstanding marker.
 *
 * Markers expire on a TTL (default 2 s). That's long enough that vault
 * events arriving on the next tick still see them, but short enough that
 * a stuck marker doesn't permanently silence a real edit.
 */

export interface RecentlyAppliedOptions {
  /** TTL in ms before a marked path is automatically forgotten. */
  ttlMs?: number;
  /** Test seam for clock injection. */
  now?: () => number;
}

interface Entry {
  expiresAt: number;
}

export class RecentlyApplied {
  private readonly ttlMs: number;
  private readonly now: () => number;
  private readonly entries = new Map<string, Entry>();

  constructor(options: RecentlyAppliedOptions = {}) {
    this.ttlMs = options.ttlMs ?? 2000;
    this.now = options.now ?? Date.now;
  }

  /** Mark a path as recently mutated by us. Bumps the TTL on repeats. */
  mark(path: string): void {
    this.entries.set(path, { expiresAt: this.now() + this.ttlMs });
  }

  /** True if `path` has a non-expired marker. Does not consume it. */
  has(path: string): boolean {
    const entry = this.entries.get(path);
    if (!entry) return false;
    if (entry.expiresAt <= this.now()) {
      this.entries.delete(path);
      return false;
    }
    return true;
  }

  /**
   * Atomic "consume" — true (and removes the marker) if the path was
   * marked, false otherwise. The watcher uses this to skip exactly one
   * incoming event per `mark()` call — extra noise after that should
   * fall through and be treated as a real change.
   */
  take(path: string): boolean {
    if (!this.has(path)) return false;
    this.entries.delete(path);
    return true;
  }

  /** For tests / debug surfaces. */
  size(): number {
    // Lazy-purge during reads is enough for our scale; size() shouldn't
    // get called on a hot path.
    for (const [path, entry] of this.entries) {
      if (entry.expiresAt <= this.now()) this.entries.delete(path);
    }
    return this.entries.size;
  }

  clear(): void {
    this.entries.clear();
  }
}
