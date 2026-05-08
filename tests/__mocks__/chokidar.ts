/**
 * Manual mock for `chokidar` — Jest can't load the real ESM-only package
 * via ts-jest, and our tests inject their own factory anyway. Production
 * code (and `pnpm build`) uses the real module via the esbuild `external`
 * config + the host runtime.
 */
export class FSWatcher {
  on(): this {
    return this;
  }
  close(): Promise<void> {
    return Promise.resolve();
  }
}

export function watch(): FSWatcher {
  throw new Error('chokidar.watch should be replaced with a factory in tests');
}

export type ChokidarOptions = Record<string, unknown>;
