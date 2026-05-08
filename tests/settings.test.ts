import { DEFAULT_SETTINGS, mergeWithDefaults } from '@/settings/settings';

describe('mergeWithDefaults', () => {
  it('returns defaults for empty input', () => {
    expect(mergeWithDefaults(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults(null)).toEqual(DEFAULT_SETTINGS);
    expect(mergeWithDefaults({})).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps known fields and falls back to defaults for missing ones', () => {
    const merged = mergeWithDefaults({
      debounceMs: 1500,
      logLevel: 'debug',
    });
    expect(merged.debounceMs).toBe(1500);
    expect(merged.logLevel).toBe('debug');
    expect(merged.syncOnStartup).toBe(DEFAULT_SETTINGS.syncOnStartup);
    expect(merged.servers).toEqual([]);
  });

  it('rejects unknown enum values and uses defaults', () => {
    const merged = mergeWithDefaults({ logLevel: 'banana', language: 'fr' });
    expect(merged.logLevel).toBe(DEFAULT_SETTINGS.logLevel);
    expect(merged.language).toBe(DEFAULT_SETTINGS.language);
  });

  it('clamps negative debounceMs to zero', () => {
    expect(mergeWithDefaults({ debounceMs: -42 }).debounceMs).toBe(0);
  });

  it('drops malformed servers and bindings', () => {
    const merged = mergeWithDefaults({
      servers: [
        { id: 'a', name: 'one', url: 'https://x', apiKey: 'k', addedAt: 1 },
        { id: '', url: 'https://y', apiKey: 'k' }, // missing id → dropped
        'not-an-object',
      ],
      bindings: [
        {
          id: 'b1',
          serverId: 'a',
          projectId: 'p',
          projectName: 'Proj',
          localFolder: '/notes',
          enabled: true,
          lastSyncedAt: 0,
          lastVectorClock: { node1: 7 },
        },
        { id: 'broken' }, // missing serverId/projectId → dropped
      ],
    });
    expect(merged.servers).toHaveLength(1);
    expect(merged.servers[0]?.id).toBe('a');
    expect(merged.bindings).toHaveLength(1);
    expect(merged.bindings[0]?.lastVectorClock).toEqual({ node1: 7 });
  });

  it('filters non-numeric vector clock entries', () => {
    const merged = mergeWithDefaults({
      bindings: [
        {
          id: 'b1',
          serverId: 's',
          projectId: 'p',
          lastVectorClock: { node1: 5, node2: 'bad', node3: NaN },
        },
      ],
    });
    expect(merged.bindings[0]?.lastVectorClock).toEqual({ node1: 5 });
  });
});
