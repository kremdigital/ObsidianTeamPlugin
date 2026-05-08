import { compare, increment, merge, type VectorClock } from '@/sync/vector-clock';

describe('vector clock — merge', () => {
  it('returns a copy of a when b is empty', () => {
    const a: VectorClock = { n1: 5, n2: 2 };
    const merged = merge(a, {});
    expect(merged).toEqual(a);
    expect(merged).not.toBe(a);
  });

  it('takes per-node max', () => {
    expect(merge({ a: 1, b: 7 }, { a: 4, b: 2, c: 9 })).toEqual({ a: 4, b: 7, c: 9 });
  });

  it('does not mutate inputs', () => {
    const a = { n1: 1 };
    const b = { n2: 2 };
    merge(a, b);
    expect(a).toEqual({ n1: 1 });
    expect(b).toEqual({ n2: 2 });
  });
});

describe('vector clock — compare', () => {
  it('returns 0 for equal clocks (including missing zero keys)', () => {
    expect(compare({}, {})).toBe(0);
    expect(compare({ a: 1 }, { a: 1 })).toBe(0);
    expect(compare({ a: 1 }, { a: 1, b: 0 })).toBe(0);
  });

  it('returns -1 when a is strictly dominated', () => {
    expect(compare({ a: 1 }, { a: 2 })).toBe(-1);
    expect(compare({}, { a: 1 })).toBe(-1);
    expect(compare({ a: 1, b: 1 }, { a: 1, b: 2 })).toBe(-1);
  });

  it('returns 1 when a strictly dominates', () => {
    expect(compare({ a: 2 }, { a: 1 })).toBe(1);
    expect(compare({ a: 1, b: 2 }, { a: 1 })).toBe(1);
  });

  it('returns "concurrent" when neither dominates', () => {
    expect(compare({ a: 2, b: 1 }, { a: 1, b: 2 })).toBe('concurrent');
    expect(compare({ a: 1 }, { b: 1 })).toBe('concurrent');
  });
});

describe('vector clock — increment', () => {
  it('initializes a missing node at 1', () => {
    expect(increment({}, 'n1')).toEqual({ n1: 1 });
  });

  it('bumps an existing counter', () => {
    expect(increment({ n1: 4 }, 'n1')).toEqual({ n1: 5 });
  });

  it('does not mutate the input', () => {
    const before = { n1: 4 };
    increment(before, 'n1');
    expect(before).toEqual({ n1: 4 });
  });
});
