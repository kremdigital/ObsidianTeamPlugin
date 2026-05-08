import { isFolderInUse, normalizeFolderPath } from '@/settings/folder-utils';
import type { VaultBinding } from '@/settings/settings';

function makeBinding(localFolder: string): VaultBinding {
  return {
    id: 'b',
    serverId: 's',
    projectId: 'p',
    projectName: 'Proj',
    localFolder,
    enabled: true,
    lastSyncedAt: 0,
    lastVectorClock: {},
  };
}

describe('normalizeFolderPath', () => {
  it('treats empty and slash as root', () => {
    expect(normalizeFolderPath('')).toBe('/');
    expect(normalizeFolderPath('/')).toBe('/');
    expect(normalizeFolderPath('  ')).toBe('/');
  });

  it('strips leading and trailing slashes', () => {
    expect(normalizeFolderPath('/notes/')).toBe('notes');
    expect(normalizeFolderPath('//notes//work//')).toBe('notes//work');
  });

  it('keeps inner slashes', () => {
    expect(normalizeFolderPath('a/b/c')).toBe('a/b/c');
  });
});

describe('isFolderInUse', () => {
  it('returns false for a fresh path', () => {
    expect(isFolderInUse([], 'notes')).toBe(false);
  });

  it('detects exact match', () => {
    expect(isFolderInUse([makeBinding('notes')], 'notes')).toBe(true);
  });

  it('treats / as colliding with any folder', () => {
    expect(isFolderInUse([makeBinding('/')], 'notes')).toBe(true);
    expect(isFolderInUse([makeBinding('notes')], '/')).toBe(true);
  });

  it('detects nested collisions in both directions', () => {
    expect(isFolderInUse([makeBinding('notes')], 'notes/work')).toBe(true);
    expect(isFolderInUse([makeBinding('notes/work')], 'notes')).toBe(true);
  });

  it('does not collide for sibling folders', () => {
    expect(isFolderInUse([makeBinding('notes')], 'work')).toBe(false);
    expect(isFolderInUse([makeBinding('notes/a')], 'notes/b')).toBe(false);
  });
});
