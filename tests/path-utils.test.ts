import {
  absoluteToVault,
  isAlwaysIgnored,
  isInBinding,
  normalizeSeparators,
} from '@/watcher/path-utils';

describe('isInBinding', () => {
  it('matches everything for root binding', () => {
    expect(isInBinding('any/path.md', '/')).toBe(true);
    expect(isInBinding('', '/')).toBe(true);
  });

  it('matches the folder itself and direct children', () => {
    expect(isInBinding('notes', 'notes')).toBe(true);
    expect(isInBinding('notes/file.md', 'notes')).toBe(true);
    expect(isInBinding('notes/sub/deep.md', 'notes')).toBe(true);
  });

  it('does not match prefix-similar siblings', () => {
    expect(isInBinding('notes-other.md', 'notes')).toBe(false);
    expect(isInBinding('notesfoo', 'notes')).toBe(false);
  });

  it('handles user input with leading/trailing slashes', () => {
    expect(isInBinding('notes/file.md', '/notes/')).toBe(true);
  });
});

describe('absoluteToVault', () => {
  it('returns vault-relative path with forward slashes', () => {
    const vault = 'D:\\Vaults\\Mine';
    expect(absoluteToVault('D:\\Vaults\\Mine\\note.md', vault)).toBe('note.md');
    expect(absoluteToVault('D:\\Vaults\\Mine\\sub\\note.md', vault)).toBe('sub/note.md');
  });

  it('returns empty string when path matches the vault root', () => {
    expect(absoluteToVault('/vault', '/vault')).toBe('');
  });

  it('returns null for paths outside the vault', () => {
    expect(absoluteToVault('/other/file.md', '/vault')).toBeNull();
    expect(absoluteToVault('/vaultfoo/file.md', '/vault')).toBeNull();
  });

  it('handles trailing slash on the vault path', () => {
    expect(absoluteToVault('/vault/note.md', '/vault/')).toBe('note.md');
  });
});

describe('normalizeSeparators', () => {
  it('replaces backslashes with forward slashes', () => {
    expect(normalizeSeparators('a\\b\\c')).toBe('a/b/c');
  });
});

describe('isAlwaysIgnored', () => {
  it('drops empty and well-known dirs', () => {
    expect(isAlwaysIgnored('')).toBe(true);
    expect(isAlwaysIgnored('.obsidian')).toBe(true);
    expect(isAlwaysIgnored('.obsidian/plugins/x')).toBe(true);
    expect(isAlwaysIgnored('a/.git/HEAD')).toBe(true);
    expect(isAlwaysIgnored('.versions/file.md')).toBe(true);
  });

  it('drops common temp suffixes', () => {
    expect(isAlwaysIgnored('foo.tmp')).toBe(true);
    expect(isAlwaysIgnored('foo~')).toBe(true);
  });

  it('keeps real markdown content', () => {
    expect(isAlwaysIgnored('notes/work/idea.md')).toBe(false);
  });
});
