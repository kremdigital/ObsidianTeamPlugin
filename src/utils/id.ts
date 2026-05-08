/**
 * UUID v4 helper. Wraps the platform's `crypto.randomUUID` so call sites
 * stay short and tests can mock the indirection if they ever need to.
 *
 * Both Electron (Obsidian's runtime) and Node 19+ (Jest) ship `crypto.randomUUID`
 * on `globalThis`, so this needs no polyfill.
 */
export function uuid(): string {
  return globalThis.crypto.randomUUID();
}
