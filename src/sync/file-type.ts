/**
 * Decide whether a file is text-like (eligible for CRDT sync) or binary
 * (handled via REST blobs + version snapshots).
 *
 * The list is intentionally conservative — anything we're not sure about
 * is BINARY. Text-mode mishandling on a binary file would corrupt it on
 * disk; the inverse is just an unnecessary upload.
 */

const TEXT_EXTENSIONS: ReadonlySet<string> = new Set([
  'md',
  'markdown',
  'mdx',
  'txt',
  'json',
  'yml',
  'yaml',
  'csv',
  'tsv',
  'html',
  'htm',
  'css',
  'scss',
  'less',
  'js',
  'mjs',
  'cjs',
  'ts',
  'tsx',
  'jsx',
  'svg',
  'xml',
  'log',
  'ini',
  'toml',
  'env',
  'sh',
  'py',
  'rb',
  'rs',
  'go',
  'sql',
]);

export type FileType = 'TEXT' | 'BINARY';

/**
 * Classify a file by extension first, then mime type as a tiebreaker.
 * `text/*` mimes win regardless of extension; `application/json` is a
 * common gotcha (no `text/*` prefix) so we special-case it.
 */
export function classifyFileType(path: string, mimeType?: string | null): FileType {
  if (mimeType) {
    const lower = mimeType.toLowerCase();
    if (lower.startsWith('text/')) return 'TEXT';
    if (lower === 'application/json') return 'TEXT';
    if (lower === 'application/xml') return 'TEXT';
  }
  const dot = path.lastIndexOf('.');
  if (dot < 0) return 'BINARY';
  const ext = path.slice(dot + 1).toLowerCase();
  return TEXT_EXTENSIONS.has(ext) ? 'TEXT' : 'BINARY';
}
