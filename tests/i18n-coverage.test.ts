/**
 * Catalog coverage check.
 *
 * Walks every `.ts` file under `src/` and extracts every `t('...')`
 * literal call. Asserts each extracted key exists in `ru.json` (the
 * source-of-truth catalog).
 *
 * Limitations: only matches static string literals — `t(\`prefix.${var}\`)`
 * isn't checked. We don't use dynamic keys anywhere yet; if a future
 * refactor introduces them, this test will accept them silently.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import ru from '@/i18n/ru.json';

const SRC = join(__dirname, '..', 'src');
const KEY_REGEX = /\bt\(\s*['"]([\w.-]+)['"]/g;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const s = statSync(full);
    if (s.isDirectory()) walk(full, files);
    else if (full.endsWith('.ts') && !full.endsWith('.test.ts') && !full.endsWith('.d.ts')) {
      files.push(full);
    }
  }
  return files;
}

function collectUsedKeys(): Set<string> {
  const keys = new Set<string>();
  for (const file of walk(SRC)) {
    // Normalize Windows paths so the i18n-module skip below works regardless
    // of separator.
    const normalized = file.replace(/\\/g, '/');
    // The i18n module's own JSDoc carries example calls like
    // `t('modal.addServer.testSuccess', ...)` that are illustrative — skip.
    if (normalized.endsWith('/i18n/index.ts')) continue;
    const source = readFileSync(file, 'utf8');
    let match: RegExpExecArray | null;
    while ((match = KEY_REGEX.exec(source)) !== null) {
      const key = match[1];
      if (key) keys.add(key);
    }
  }
  return keys;
}

describe('i18n catalog coverage', () => {
  it('every t() key used in src has a translation in ru.json', () => {
    const dict = ru as Record<string, string>;
    const missing: string[] = [];
    for (const key of collectUsedKeys()) {
      if (!Object.prototype.hasOwnProperty.call(dict, key)) missing.push(key);
    }
    expect(missing).toEqual([]);
  });
});
