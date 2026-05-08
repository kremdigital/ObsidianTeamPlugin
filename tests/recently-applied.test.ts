import { RecentlyApplied } from '@/watcher/recently-applied';

describe('RecentlyApplied', () => {
  it('reports unmarked paths as absent', () => {
    const r = new RecentlyApplied();
    expect(r.has('a.md')).toBe(false);
    expect(r.take('a.md')).toBe(false);
  });

  it('mark + has returns true within the TTL window', () => {
    let now = 0;
    const r = new RecentlyApplied({ ttlMs: 100, now: () => now });
    r.mark('a.md');
    now = 50;
    expect(r.has('a.md')).toBe(true);
  });

  it('expires after the TTL window', () => {
    let now = 0;
    const r = new RecentlyApplied({ ttlMs: 100, now: () => now });
    r.mark('a.md');
    now = 200;
    expect(r.has('a.md')).toBe(false);
    // Expired entries are purged from the map on read.
    expect(r.size()).toBe(0);
  });

  it('take() consumes the marker', () => {
    let now = 0;
    const r = new RecentlyApplied({ ttlMs: 100, now: () => now });
    r.mark('a.md');
    expect(r.take('a.md')).toBe(true);
    expect(r.take('a.md')).toBe(false);
    expect(r.has('a.md')).toBe(false);
  });

  it('mark() bumps the TTL on repeats', () => {
    let now = 0;
    const r = new RecentlyApplied({ ttlMs: 100, now: () => now });
    r.mark('a.md');
    now = 80;
    r.mark('a.md');
    now = 150;
    expect(r.has('a.md')).toBe(true);
  });

  it('clear() drops everything', () => {
    const r = new RecentlyApplied();
    r.mark('a.md');
    r.mark('b.md');
    r.clear();
    expect(r.has('a.md')).toBe(false);
    expect(r.has('b.md')).toBe(false);
  });
});
