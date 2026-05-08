# Obsidian Sync Plugin — work log

Newest entries on top. Each entry covers one stage from `tasks.md`.

## 2026-05-08 — Stage 14: integration + release prep — **PLUGIN COMPLETE**

The final stage. The plugin previously consisted of well-tested
components but had no plumbing in `main.ts` — Stage 14 was about wiring
everything together, then preparing the project for an actual release.

**Concrete Obsidian adapters (`src/integration/`)**

- `ObsidianVaultAdapter` — concrete `VaultAdapter` over `app.vault.adapter`
  with recursive parent-folder creation; uses `FileSystemAdapter.getBasePath()`
  (desktop-only — declared by `manifest.json#isDesktopOnly`).
- `ObsidianLogStorage` — concrete `LogStorage` over `app.vault.adapter`.
- `ObsidianWatchableVault` — translates `TFile` / `TFolder` instances
  into `WatchableFile` (`kind: 'file' | 'folder'`) so the watcher's
  Obsidian-free interface stays free of Obsidian imports.

**`src/main.ts` — fully wired bootstrap**

`onload()` now goes through five phases:

1. `loadSettings()` + `setLanguage()`. First run generates a stable
   `clientId` (UUIDv4) and persists it; subsequent loads reuse it.
2. `bootstrapLogger()` — opens `<vault>/.obsidian/plugins/obsidian-sync/sync.log`
   via `FileLogSink`, attaches `ConsoleLogSink` when `logLevel === 'debug'`.
3. `bootstrapState()` — `OperationLog` (SQLite at `<base>/.obsidian/plugins/.../state.db`),
   `DocManager` with a `y-indexeddb` persistence factory, `RecentlyApplied`.
4. `bootstrapManager()` — builds `EngineManager` with `UiConflictResolver`.
5. `bootstrapWatchers()` — `ObsidianWatcher` + `FsWatcher`, with the
   FS watcher receiving `notifyObsidianEvent` for every non-rename
   Obsidian event so chokidar's near-duplicate is suppressed.
6. `bootstrapUi()` — settings tab, status bar, `HISTORY_VIEW_TYPE`
   registration, command palette entries.

`saveSettings()` re-routes the language switch and log-level update
into the live subsystems and calls `engineManager.refreshFromSettings()`
so binding add / remove takes effect without a plugin reload.

`onunload()` tears everything down in reverse: stop engines, destroy
status bar, stop FS watcher, stop Obsidian watcher, destroy doc
manager, close SQLite handle.

**`PluginSettings` extension**

- New `clientId: string` field (default `''`). Boot path generates a
  UUID on first run, persists once. Documented in the JSDoc — never
  re-roll, would break causality across reconnects.
- `mergeWithDefaults` extended with `clientId` defaulting + sanity check.

**Settings UI — log buttons**

Settings → Behavior gains an "Event log" row:

- **Open log** — copies the current `sync.log` into a new vault note as
  a code-fenced markdown file (so users can read it without touching
  the OS file system).
- **Clear log** — empties the active log file (archives stay).

13 new i18n keys under `settings.behavior.log.*`.

**README + CHANGELOG + release workflow**

- Full README rewrite: install (manual), API-key setup, server +
  binding setup, behavior settings, command palette, status-bar
  reference table, troubleshooting, MVP limitations, dev commands,
  source-tree map.
- `CHANGELOG.md` — Keep-a-Changelog-style entry for `0.1.0` with
  Added / Tests / Known limitations sections.
- `.github/workflows/release.yml` — push a `v*` tag, the workflow:
  installs deps, runs the five sanity gates (typecheck / lint /
  format:check / test / build), builds `main.js`, touches an empty
  `styles.css` if missing, validates `manifest.json#version === tag`,
  and publishes a GitHub release with the three Obsidian artifacts.

**Bundle size**

`main.js` is now **210.4 KB** (up from the trivial 27.4 KB skeleton)
— that's the full active code path: Yjs + socket.io-client + every
sync subsystem. Native modules (`better-sqlite3`, `chokidar`) stay
external; CodeMirror packages stay external (Obsidian provides them).

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — **261 / 261 pass** across 26 suites.
- `pnpm build` — emits `main.js` (210.4 KB).
- `pnpm cli help` — CLI emulator still runs.

Stage 14 complete — **the plugin is done**. The code path is end-to-end
wired; the remaining work is the manual-test sweep from `tasks.md` 13.4
(two-device sync, external-agent edits, conflict modals, long-offline
drain) followed by tagging `v0.1.0` to fire the release workflow.

## 2026-05-08 — Stage 13: testing + CLI emulator

Added the protocol-debug CLI (`tasks.md` 13.3) and tightened the
boundary between core code and Obsidian's runtime so it actually loads
in Node.

**`scripts/cli-emulator.ts` — protocol debug tool**

Talks to the sync server over the same REST + Socket.IO protocol the
plugin uses, driven from the shell. Use it to verify a server / API key
combination without launching Obsidian.

Commands:

- `list-projects` — `apiClient.getProjects()` printed as TSV.
- `list-files --project <id>` — same for files within a project.
- `pull --project <id> --folder <path>` — download every project file
  into the local folder; mirrors directories.
- `push --project <id> --folder <path>` — upload every file in the
  local folder. Conflicts (server-side `path_exists`) report as
  `! path: conflict (409)` and skip; everything else propagates.
- `watch --project <id>` — connect via Socket.IO, run `project:join`,
  print every server event (`file:created`, `file:updated-binary`,
  `yjs:update`, …) until interrupted.

Implementation:

- `scripts/cli-args.ts` — hand-rolled parser (no `yargs` dep). 5 commands,
  `--server` / `--api-key` always required, per-command requires
  `--project` / `--folder`. Exports `parseArgs(argv)` + `HELP_TEXT`.
- `scripts/cli-emulator.ts` — wires the parser to the existing
  `ApiClient` / `SocketClient`. Provides a Node-side `RequestFn` that
  speaks `globalThis.fetch` (Node 18+) so the API client doesn't try to
  pull `requestUrl` from `obsidian`.
- Run via `pnpm cli <command> --server …` or
  `tsx scripts/cli-emulator.ts ...`.

**Loadability fix — `obsidian` is types-only**

The npm `obsidian` package ships nothing but `obsidian.d.ts` (`main: ""`),
so `import { requestUrl } from 'obsidian'` at module load fails outside
Obsidian. Switched `ApiClient`'s default request function to a lazy
`await import('obsidian')` — the module never loads in Jest / CLI / Node
contexts because callers there always supply a custom `RequestFn`. In
production (Obsidian) the import succeeds at first call.

This unblocked the CLI (and any future Node-side tools) without
disrupting the existing Jest + Obsidian flows.

**Tests**

- `tests/cli-args.test.ts` — 11 cases covering empty args (help),
  every command shape, `--client-id` override, unknown command,
  positional after command, missing required option, missing project /
  folder, missing flag value.

The integration scenarios from `tasks.md` 13.4 (live two-device sync,
external-agent edits, conflict modals, long-offline drain) are
manual-test territory — the CLI emulator is the right tool to drive
them by hand once we have a real server up.

Total Jest: **26 suites, 261 tests, all pass**.

**Tooling**

- `tsx@4.21` added as a dev dependency for running the TS CLI without a
  build step.
- New npm script: `pnpm cli` (proxy to `tsx scripts/cli-emulator.ts`).
- `lint` / `lint:fix` extended to include `scripts/`.
- ESLint flat config: added `scripts/**/*.ts` to the typed-files block,
  added `BodyInit` / `RequestInit` globals (used by the Node fetch
  adapter).
- `tsconfig.json` `include` extended with `scripts/**/*.ts` so the
  CLI shows up in `pnpm typecheck`.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems (now also covers `scripts/`).
- `pnpm format:check` — clean.
- `pnpm test` — 261 / 261 pass.
- `pnpm build` — `main.js` builds cleanly.
- `pnpm cli help` — prints the help banner end-to-end.

Stage 13 complete. Next: Stage 14 — README rewrite, GitHub release
workflow, Community Plugins submission prep.

## 2026-05-08 — Stage 12: file-rotated logger

Pluggable logger with size-rotated file sink + DevTools mirror. Drop-in
ready — call sites still use `console.log` for now; `main.ts` (Stage 13)
swaps in the `Logger` instance.

**`src/utils/logger.ts` — `Logger`**

- Levels `error < warn < info < debug`. Below-active are dropped before
  the sink is touched.
- Sinks pluggable via `LogSink` interface. Logger writes are
  fire-and-forget (`void this.sink.write(entry)`) so a slow file flush
  doesn't stall the engine.
- `child(context)` produces a logger with merged context. Each entry
  carries `{ level, timestamp, message, context, args }`.
- `formatLogEntry(entry)` — single-line renderer:
  `2026-05-08T12:00:00Z [info] [k=v k=v] message arg1 arg2`. Errors
  print as `Name: message`; objects JSON-stringify; primitives stringified.

**`src/utils/console-log-sink.ts` — `ConsoleLogSink`**

- Routes `error` / `warn` through `console.error` / `console.warn`,
  the rest through `console.log`. The console reference is injectable
  for tests.

**`src/utils/composite-log-sink.ts` — `CompositeLogSink`**

- Fan-out wrapper. Wraps each child sink in try/catch + .catch on the
  promise — one sink failing must not silence the others.

**`src/utils/file-log-sink.ts` — `FileLogSink`**

- `LogStorage` interface (mirrors the slice of `Obsidian.DataAdapter`
  we use: `exists` / `stat` / `append` / `write` / `rename` / `remove`
  / `read` / `mkdir`). Tests pass a `MemoryStorage`; the plugin
  top-level wires `app.vault.adapter`.
- Size-based rotation: when `currentSize + nextLine > maxSizeBytes`
  (default 1 MiB), shifts archives:
  drop `log.<maxArchives>` → rename `log.N-1` → `log.N` → … → `log.1`,
  then `log` → `log.1`, then write the line into a fresh `log`.
- Default `maxArchives = 3`. Empty active file is never rotated (so a
  pathologically large single line at startup doesn't infinite-loop).
- Concurrent `write()`s serialize through a single in-flight `Promise`
  chain — order is deterministic across overlapping fire-and-forget
  calls.
- `readLog()` returns the active file's content (chained on the same
  serializer so it sees a consistent snapshot). `clear()` empties the
  active log but leaves archives intact.

**Tests added**

- `tests/logger.test.ts` — 12 cases:
  - Level filter (active level + below; `setLevel`).
  - Entry shape (timestamp / message / context / args).
  - Child loggers — context merge, override, level snapshot.
  - `formatLogEntry` — empty context, k=v context, Error args, JSON args.
  - `ConsoleLogSink` — error→console.error, warn→console.warn.
  - `CompositeLogSink` — fan-out, throwing sink isolation,
    rejected-promise isolation.
- `tests/file-log-sink.test.ts` — 11 cases:
  - Append: fresh file, sequential lines, concurrent serialize.
  - Rotation: triggers on overflow, archive cap, empty file no-op.
  - readLog / clear (empties active, archives kept).

Total Jest: **25 suites, 250 tests, all pass**.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 250 / 250 pass.
- `pnpm build` — `main.js` builds cleanly. Logger modules will land in
  the bundle once `main.ts` (Stage 13) imports them.

Stage 12 complete. Next: Stage 13 — testing pass (more integration
coverage, CLI emulator script for protocol debugging).

## 2026-05-08 — Stage 11: i18n finalization

Audited every `t(...)` call across `src/`, confirmed full coverage in
`ru.json`, populated `en.json` to match, and added an automated coverage
guard so the catalog can't drift again.

**Coverage**

- 99 unique keys in `ru.json` cover every static `t('key')` call across
  `src/` (verified by walking the source tree with a regex).
- A handful of pre-emptive keys (`status.menu.bindings`, `history.refresh`,
  `history.openVersion`, `settings.bindings.localFolder`, …) are in the
  catalog but not yet used. Left in place — they'll land in the UI on
  the next iteration and removing them would just churn the file.

**`src/i18n/en.json`** — full English translation of every key in `ru.json`.
Russian remains the source of truth (per spec); English exists so:

1. The plugin works for non-Russian users out of the box.
2. The catalog files are stable enough that the (eventual) Community
   Plugins submission can ship without a "TODO: translate" warning.

**`tests/i18n-coverage.test.ts`** — the new automation:

1. Walks every `.ts` file in `src/` (excluding `.test.ts` / `.d.ts`
   and the i18n module's own JSDoc samples).
2. Extracts every static `t('key', ...)` literal.
3. Asserts each key exists in `ru.json`.

Falls silent for dynamic keys (e.g. `t(\`prefix.${var}\`)`) — the
plugin doesn't use any yet; if a future refactor introduces them the
test will accept them, which is the safe default.

**Test rewrite** — `tests/i18n.test.ts` had a "fall back to ru when en is
empty" check; flipped to "returns the English translation when language
is en" now that `en.json` is populated. The raw-key fallback path is
still covered by the existing `does.not.exist` case.

**Module docs** — refreshed the JSDoc on `src/i18n/index.ts` to reflect
that English is no longer a stub.

**ESLint config** — added `__dirname` / `__filename` to the test-file
globals (used by the coverage walker).

Total Jest: **23 suites, 227 tests, all pass**.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 227 / 227 pass.
- `pnpm build` — `main.js` builds cleanly.

Stage 11 complete. Next: Stage 12 — file-rotated logger
(`src/utils/logger.ts` writing to `<vault>/.obsidian/plugins/obsidian-sync/sync.log`,
DevTools dual-output at `logLevel=debug`).

## 2026-05-08 — Stage 10: UI components

The pieces the user actually sees: status bar, command palette entries,
right-pane history view, notice plumbing, plus the top-level
`EngineManager` that ties multiple per-binding `SyncEngine`s together.

**`src/sync/engine-manager.ts` — `EngineManager`**

Coordinates one `SyncEngine` per active binding:

- `start()` / `stop()` — bring up/down all engines from current settings.
- `refreshFromSettings()` — diff-based reconciliation: spawn engines for
  newly-enabled bindings, drop engines whose binding got disabled or
  removed, leave the rest alone.
- `pause()` / `resume()` — global toggle. Pause stops every engine and
  ignores `refreshFromSettings` until `resume`.
- `dispatchVaultEvent(event)` — fans an event from the watcher layer to
  the engine that owns the matching binding id (drops the rest).
- `getAggregateStatus()` / `onAggregateStatus(cb)` — single-state view
  for the status bar. Reduction priority:
  `error > syncing > connecting > all-offline → offline > all-connected
→ connected`. Latest engine `detail` is preserved on the aggregate
  so the bar can render a tooltip.
- `runDeepSyncOnAll()` — calls `SyncEngine.runDeepSyncDiff` for every
  active engine; powers the "Sync now" command.

DI seam: `engineFactory` lets tests substitute a `FakeEngine`; the
default constructs real `SyncEngine`s.

**UI surfaces**

- `src/ui/notices.ts` — `NoticeService` wrapper over `Notice` that
  honors `showSyncNotifications`. Errors and conflict notices always
  fire (silencing them would be too dangerous); informational notices
  only fire when the setting is on. Test seam over the underlying
  `new Notice(...)` call.
- `src/ui/status-bar.ts` — `StatusBar` widget. Icon + label that mirror
  the aggregate state (`check-circle` / `refresh-cw` / `pause` /
  `wifi-off` / `alert-circle` / `circle`). Clicking opens an Obsidian
  `Menu` with **Sync now / Pause** (or **Resume**) / **History** /
  **Settings**. Status detail surfaces as a tooltip on hover.
- `src/ui/views/history-view.ts` — `HistoryView extends ItemView`.
  Read-only timeline: version number, ISO date, author (`name (email)`),
  optional commit message. Re-renders on `active-leaf-change`. The
  view doesn't reach into engine internals — the plugin top-level
  resolves the active file's `(server, projectId, fileId)` triple and
  passes it to the view's `resolveActive` callback.
- `src/ui/commands.ts` — `registerCommands(plugin, deps)` wires five
  commands into the palette (`Sync now`, `Pause` / `Resume` with
  `checkCallback` so only the relevant one is shown, `Show history`,
  `Open settings`). On `Sync now` success, fires the
  `notice.syncCompleted` notice.

**i18n**

37 new strings under `status.*`, `status.menu.*`, `command.*`,
`notice.*`, `history.*`.

**Tests added**

- `tests/engine-manager.test.ts` — 14 cases:
  - roster: spawn-on-start, skip disabled / orphan bindings,
    `refreshFromSettings` add+drop, `pause/resume` cycle creates a fresh
    engine, `refreshFromSettings` is a no-op while paused.
  - aggregate status: `idle`, `paused`, error wins, syncing wins over
    connected, all-connected, all-offline, `onAggregateStatus` delivers
    immediately, fan-out on engine status change.
  - vault event dispatch: target hit, unknown id ignored.
- `tests/notices.test.ts` — 5 cases (informational shown when enabled,
  silenced when disabled, error / conflict always shown, default
  timeout honored).

Total Jest: **22 suites, 226 tests, all pass**.

**ESLint config** — added `MouseEvent` to the globals list (used by
`StatusBar.onClick`).

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 226 / 226 pass.
- `pnpm build` — `main.js` builds cleanly. Stage 10 modules will land
  in the bundle once `main.ts` (Stage 13) imports them.

Stage 10 complete. Next: Stage 11 — `i18n` finalization (already mostly
done; double-check coverage), then Stage 12 — file-rotated logger.

## 2026-05-08 — Stage 9: conflict resolution

Three-way binary conflict + delete-vs-update guard. Text files don't get a
conflict path because Yjs already merges concurrent edits per-character
(per `tasks.md` 9.1).

**`src/sync/conflict.ts`**

Pure-function detectors + a resolver contract:

- `detectBinaryConflict({ storedHash, localHash, serverHash })` —
  three-way: only `true` when local diverged from `storedHash` AND
  server diverged AND the two ends don't agree. Both-sides-same and
  one-sided changes are clean adopt cases.
- `detectDeleteConflict({ storedHash, localHash })` — local has
  uncommitted edits and the server is trying to delete.
- `buildConflictPath(filePath, timestamp)` — sibling rename helper for
  the keep-both branch (`note.png` → `note.conflict-{ts}.png`; handles
  bare names, dot-prefixed, deep paths).
- `ConflictResolver` interface with two async hooks; `defaultConflictResolver`
  = "always keep server" (used by tests + as a fallback).

**Engine integration**

- `SyncEngineDeps` gains `conflictResolver?` and `now?` (used for the
  conflict timestamp). Default resolver is keep-server / delete-local.
- `applyServerUpdateBinary` now hashes the local file before adopting,
  detects, and routes through the resolver:
  - **keep-server** — usual apply.
  - **keep-local** — emit `file:update-binary` upstream with the local
    bytes (the eventual server broadcast becomes a no-op).
  - **keep-both** — `vault.rename` the local file to
    `<name>.conflict-<ts>.<ext>` (marked in `RecentlyApplied`), then
    write the server bytes.
- `applyServerDelete` similarly: if local has uncommitted edits and the
  user picks **restore-server**, the engine emits `file:create` with the
  local content instead of accepting the delete.

**`src/ui/modals/conflict-modal.ts`** — `UiConflictResolver` (an
`Obsidian`-dependent resolver) with two modal classes. Bare-bones for
Stage 9 — file path, sizes, action buttons. Defaults on close:
binary-conflict → keep-server, delete-conflict → restore-server (we
prefer to err on the side of not silently dropping the user's edits).

**i18n**

- 13 new strings under `modal.conflict.*` and `modal.deleteConflict.*`
  in `ru.json`.

**Tests added**

- `tests/conflict.test.ts` — 13 cases:
  - `detectBinaryConflict` (5) — same hashes, server-only move,
    local-only move, both-sides-same, true diverge.
  - `detectDeleteConflict` (2) — clean and dirty.
  - `buildConflictPath` (5) — middle-extension, no-extension, dot-files,
    deep paths, bare filenames.
  - `defaultConflictResolver` (2) — keep-server / delete-local defaults.
- `tests/sync-engine.test.ts` — 2 new integration cases:
  - `keep-both` rename path (server pushes binary update, local has
    different bytes — engine asks resolver, resolver picks keep-both,
    local file lands at `image.conflict-{ts}.png`, server bytes occupy
    the original path).
  - `restore-server` on delete (server deletes a file the user has
    edits to, resolver picks restore — engine emits `file:create` with
    the local bytes; the local file stays).

Total Jest: **20 suites, 207 tests, all pass**.

**Bundle size**

`main.js` is now 27.4 KB (up from 25.5) — the engine now reaches into
`conflict.ts` from the active code path, so the tree-shaker keeps it.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 207 / 207 pass.
- `pnpm build` — emits `main.js` (27.4 KB).

Stage 9 complete. Next: Stage 10 — UI components (status bar, commands,
history view, notices).

## 2026-05-08 — Stage 8: offline catch-up

Pulled the reusable bits of the engine's reconnect flow into a dedicated
module that's testable in isolation, and added the deep-sync diff helper
the long-offline scenario needs.

**`src/sync/reconnect.ts`**

Two stand-alone helpers; both are pure-ish (zero engine state):

- `flushPendingQueue(bindingId, log, emit)` — drains
  `pending_operations` for a binding by feeding them one at a time to a
  caller-supplied `PendingEmitter`. Result is `{ sent, dropped, haltedOn,
remaining }`:
  - `dropped` — first op the emitter rejected as **non-retryable** (e.g.
    `forbidden`, `*_not_found`); we keep going so a single permanently
    broken op doesn't block the rest.
  - `haltedOn` — first op that failed retryably; we stop there and leave
    the tail queued so a transient 5xx doesn't drop the user's edits.
  - Thrown errors are normalized to retryable failures.
- `computeDeepSyncDiff(bindingId, projectId, apiClient, operationLog)` —
  compares the server's authoritative file list (`getProjectFiles`)
  against the local cache (`listFileMeta`) and returns three buckets:
  - `serverOnly: ApiFile[]` — server has, we don't (need to download).
  - `localOnly: FileMeta[]` — we have, server doesn't (offline create
    not yet flushed, or server purge).
  - `hashMismatches: { server, local }[]` — same path, different hash.
    Engine reconciles: text via Yjs, binary via the conflict modal
    (Stage 9).

**Engine refactor**

- `flushPendingOperations` now delegates to `flushPendingQueue`.
- `replayPending` returns the richer `ReplayOutcome` shape (success /
  retryable / non-retryable) so the helper can route correctly. A new
  `ackToOutcome(ack)` heuristic translates server ack errors into the
  classification: `*_not_found` and `forbidden` become non-retryable;
  everything else is retryable.
- New public `runDeepSyncDiff(): Promise<DeepSyncDiff>` on `SyncEngine`
  for the eventual "Sync now" UI command (Stage 10).

**Tests added (`tests/reconnect.test.ts`)**

11 cases:

- `flushPendingQueue` (6) — full drain, halt on retryable failure,
  drop on non-retryable, exception → retryable, empty queue,
  long-offline scenario (50 queued ops drained in one pass).
- `computeDeepSyncDiff` (5) — empty diff when both sides agree,
  server-only, local-only, hash mismatch, mixed long-offline scenario.

The existing `tests/sync-engine.test.ts` already exercises the engine's
reconnect flow end-to-end (`drains the queue on reconnect`); the new
tests focus on the helper's behavior at the boundaries that the
end-to-end test doesn't expose.

Total Jest: **19 suites, 191 tests, all pass**.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 191 / 191 pass.
- `pnpm build` — `main.js` still 25.5 KB.

Stage 8 complete. Next: Stage 9 — conflict resolution (binary file
conflict modal, delete-vs-update modal).

## 2026-05-08 — Stage 7: sync engine

The orchestrator class that finally wires every previous stage together.
One `SyncEngine` instance per `VaultBinding`; the (Stage 9-10) plugin
top-level will create one per active binding and feed vault events to all
of them.

**Supporting modules**

- `src/sync/vault-adapter.ts` — `VaultAdapter` interface (read/write/
  create/delete/rename/exists + `ensureParentFolder`). Engine talks to the
  vault exclusively through this — keeps unit tests away from Obsidian
  and lets a future `ObsidianVaultAdapter` (Stage 9) drop in unchanged.
- `src/sync/file-type.ts` — `classifyFileType(path, mime?)` → TEXT /
  BINARY. Extension-driven; mime types `text/*`, `application/json`,
  `application/xml` win over the extension when provided.
- `src/sync/hash.ts` — `sha256Hex(string | ArrayBuffer | Uint8Array)`
  via `crypto.subtle.digest`. Both Electron and Node 20 have it on
  `globalThis.crypto`.

**`src/sync/engine.ts` — `SyncEngine` class**

Single class, ~400 LOC, fully DI-able. Construction takes:

`binding`, `server`, `clientId`, `vault: VaultAdapter`,
`operationLog`, `docManager`, `recentlyApplied`, optional
`apiClient` / `socketClient` test seams, `diskSnapshotDebounceMs`.

Lifecycle:

- `start()` — register socket listeners, call `socket.connect()`.
- On the `connect` callback (fire-and-forget): emit `project:join`
  synchronously, run `refreshFileIndex()` (REST `/api/projects/{id}/files`)
  in parallel, await both, apply server-pushed catch-up operations,
  hydrate Yjs docs from sync-step1 payloads, wire each text doc's
  `onLocalUpdate` to `socket.emitYjsUpdate`, set status `connected`,
  drain `pending_operations` in the background.
- `stop()` — detach all listeners, cancel snapshot debouncers, disconnect.
- `onStatus(cb)` — subscribe to `connecting | syncing | connected | offline | error | stopped`.

Local → server (`handleVaultEvent`):

- `create` — read bytes, hash, classify; if connected emit `file:create`
  with the buffer serialized as `number[]`; else queue in
  `pending_operations`.
- `modify` — text files run through the doc manager (`setText` triggers
  a Yjs update which the `onLocalUpdate` subscriber forwards as
  `yjs:update`); binary files emit `file:update-binary` (or queue).
- `delete` — emit `file:delete` (or queue).
- `rename` — emit `file:rename` (or queue).

Vector clock is bumped before every outgoing op and persisted to
`bindings_state` after every successful flow.

Server → local:

- `file:created` — register meta in the in-memory index; for binaries
  download via REST and write to the vault, for text wire the Yjs hook;
  the path is marked in `RecentlyApplied` so the watcher's downstream
  echo is suppressed.
- `file:updated-binary` — download fresh bytes, overwrite, mark.
- `file:deleted` — remove file + meta + release the doc manager entry.
- `file:renamed` / `file:moved` — `vault.rename`, mark both paths.
- `yjs:update` — `docManager.applyRemoteUpdate(...)` (tagged
  `REMOTE_ORIGIN` so the local fan-out doesn't echo) + a debounced
  disk snapshot (`writeText` after `diskSnapshotDebounceMs`, default
  500 ms).

Pending queue replay happens on reconnect; failures (e.g. transient 5xx)
break the chain so we don't drop a user's offline edit.

**Tests**

- `tests/file-type.test.ts` — 5 cases (extension, binary fallback, mime
  override, case-insensitivity).
- `tests/hash.test.ts` — 4 cases (empty / "abc" / cross-type input
  parity / shape).
- `tests/sync-engine.test.ts` — 9 cases driving the engine through
  hand-rolled fakes (`MemoryVault`, `FakeSocket`, mock `RequestFn`):
  - status lifecycle (connecting → syncing → connected → stopped),
  - `file:create` payload shape (path, type, `data: number[]`),
  - `file:delete` against the in-memory file index,
  - offline `pending_operations` queueing,
  - reconnect drains the queue and emits replays,
  - server `file:deleted` removes the local file + marks
    `RecentlyApplied`,
  - server `yjs:update` round-trips through the doc manager,
  - vector clock persistence (`device-1: 1` in `bindings_state`),
  - bindings filter (events for other bindings are dropped).
- The harness exposes a lazy `socket()` getter — the underlying fake
  is only constructed inside `engine.start()`.

Total Jest: **18 suites, 180 tests, all pass**.

**Tooling**

- ESLint global list picked up `BufferSource` (used in `crypto.subtle.digest`
  parameter typing).

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 180 / 180 pass.
- `pnpm build` — `main.js` still 25.5 KB (the engine + sync helpers
  are tree-shaken until `main.ts` imports them; the integration plug-in
  on Stage 9 is what pulls them into the bundle).

Stage 7 complete. Next: Stage 8 — offline-mode catch-up (`reconnect.ts`
wrapper + tests around the long-offline scenario, optional deep-sync
hash compare).

## 2026-05-08 — Stage 6: vault watcher (Obsidian + chokidar)

Two parallel watchers feeding a single typed `VaultEvent` stream — one
listens to Obsidian's vault events for in-app edits, the other to chokidar
for "external agent" writes to the filesystem (CLI scripts, AI agents).
Echo-loop suppression and Obsidian↔FS deduping live in shared helpers.

**Shared building blocks**

- `src/utils/debounce.ts` — trailing-edge debounce with `cancel` /
  `flush` and an injectable timer (so tests use a deterministic clock
  instead of `jest.useFakeTimers`). ~50 LOC; pulling lodash for one
  function would have added ~20 KB to the bundle.
- `src/watcher/recently-applied.ts` — TTL set used to break the
  apply-then-rebroadcast loop. The sync engine `mark(path)`s right
  before calling `vault.modify`, the watchers `take(path)` to skip the
  resulting event. Default TTL 2 s.
- `src/watcher/path-utils.ts` — `isInBinding`, `absoluteToVault`,
  `normalizeSeparators`, `isAlwaysIgnored`, plus `ALWAYS_IGNORED_SEGMENTS`
  for `.obsidian` / `.git` / `.versions` and a tmp/`~` suffix list.

**`src/watcher/obsidian-events.ts` — `ObsidianWatcher`**

- Subscribes to `vault.on('create' | 'modify' | 'delete' | 'rename')`
  through a minimal `WatchableVault` adapter (no hard dependency on the
  Obsidian module).
- Files vs. folders disambiguated via `WatchableFile.kind`: the adapter
  on top of Obsidian sets `'folder'` for `TFolder` instances; tests pass
  bare `{ path, kind: 'file' }` objects.
- Per-`(binding, path)` debounce on `modify` (default 300 ms — Obsidian
  fires several times per save).
- Rename handling translates cross-binding moves into delete+create:
  `notes/old.md → archive/old.md` becomes a `delete` for the bound binding;
  `archive/x.md → notes/x.md` becomes a `create`. In-binding renames stay
  as a single `rename` event.
- Listener errors are swallowed so a buggy subscriber never tears down
  the chain.
- `start(vault)` / `stop()` pair, idempotent; `stop()` cancels every
  pending debounced fire.

**`src/watcher/fs-watcher.ts` — `FsWatcher`**

- Wraps `chokidar.watch(vaultBasePath, { ignored, ignoreInitial,
awaitWriteFinish })`. The factory is injectable for tests.
- Path filter chain: chokidar-level `ignored` predicate (drops
  `.obsidian` / `.git` / `.versions`), then `absoluteToVault` to vault
  relative, then `isAlwaysIgnored`, then per-binding `isInBinding`.
- `notifyObsidianEvent(type, path)` lets the engine tell us "Obsidian
  already saw this one"; a per-`(type, path)` dedupe map kills any
  chokidar event arriving inside the dedupe window (default 800 ms).
- Per-`(binding, path)` debounce on FS-driven `modify` (default 1000 ms,
  longer than the Obsidian debounce because external agents commonly do
  several writes per logical edit).
- `chokidar` added to esbuild `external[]` (heavy native fs deps; loaded
  by the Obsidian host at runtime from the plugin's `node_modules/`).

**Tests**

- `tests/debounce.test.ts` — 5 cases (single fire, latest args wins,
  cancel, flush with pending, flush no-op).
- `tests/recently-applied.test.ts` — 6 cases (mark/has, TTL expiry,
  take consumes, TTL bump on repeat, clear).
- `tests/path-utils.test.ts` — 11 cases across `isInBinding`,
  `absoluteToVault`, `normalizeSeparators`, `isAlwaysIgnored`.
- `tests/obsidian-watcher.test.ts` — 13 cases (scoping, folder drop,
  always-ignored, multi-binding fan-out, debounce, recently-applied
  suppression, rename in/out/cross-binding, lifecycle + error isolation).
- `tests/fs-watcher.test.ts` — 12 cases (chokidar wiring, scoping,
  ignored paths, out-of-vault paths, debounce, dedupe-with-Obsidian
  inside / outside the window, recently-applied marker, lifecycle).

Total Jest: **15 suites, 162 tests, all pass**.

**Tooling**

- Added a manual `chokidar` mock at `tests/__mocks__/chokidar.ts` and a
  `moduleNameMapper` entry — chokidar 5+ is pure ESM and ts-jest can't
  load it directly. Tests inject their own factory anyway, so the mock
  only has to make the import resolve.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 162 / 162 pass.
- `pnpm build` — `main.js` still 25.5 KB (Stage 6 modules are
  tree-shaken; the engine on Stage 7 will pull them into the bundle).

Stage 6 complete. Next: Stage 7 — sync engine, the central orchestrator
that finally wires settings + operation log + REST + socket + CRDT +
watchers together into a working sync loop.

## 2026-05-08 — Stage 5: CRDT (Yjs) layer

Built the per-text-file `Y.Doc` cache, the Y.Text↔string diff helper, and a
thin CodeMirror 6 binding factory. Stage 5 ends at "ready to wire up" — the
sync engine on Stage 7 is what actually opens documents in response to vault
events.

**`src/crdt/text-diff.ts` — `applyTextDiff(ytext, newContent, origin?)`**

- Char-level diff via `jsdiff`'s `diffChars`, translated to `insert` /
  `delete` calls inside a single `transact()`.
- Picks single-update batching over wholesale rewrite specifically so
  concurrent typing in the editor doesn't get clobbered when an external
  agent rewrites the file at the same time — CRDT semantics still merge
  cleanly.
- Forwards a custom `origin` so callers (the doc manager) can tag mutations
  as disk-driven vs. editor-driven.

**`src/crdt/doc-manager.ts` — `DocManager` class**

- `Map<bindingId::filePath, ManagedEntry>` cache. Each entry holds the
  `Y.Doc`, the `Y.Text` named `'content'` (the canonical editor target),
  the optional `DocPersistence`, and a per-doc local-update fan-out set.
- Public surface:
  - `get(bindingId, filePath)` — lazily creates and caches.
  - `setText(...)` / `getText(...)` — disk-side mutations & reads.
  - `applyRemoteUpdate(...)` — server → doc, tagged `REMOTE_ORIGIN`.
  - `onLocalUpdate(...)` — fan-out for outgoing Yjs updates; callbacks
    are NOT invoked for `REMOTE_ORIGIN` updates so we never echo a
    server-pushed update back upstream.
  - `encodeStateAsUpdate(...)` — snapshot helper for the eventual
    `project:join` payload.
  - `release` / `releaseBinding` / `destroy` — lifecycle.
- DI seam: `persistenceFactory` + `dbName` are both injectable. The
  default factory returns `null` (in-memory), so anything that doesn't
  pass a factory just works in Node tests; production passes a
  `y-indexeddb` factory.
- Exports three origin symbols: `REMOTE_ORIGIN`, `DISK_ORIGIN`,
  `EDITOR_ORIGIN`. `applyRemoteUpdate` uses the first; `setText` defaults
  to the second; the editor binding will mark its mutations with the
  third (Stage 7 wires it).
- Listener errors swallowed inside the fan-out — a buggy subscriber must
  not propagate up into the doc and tear down the connection.

**Persistence naming** — `tasks.md` suggested one IDB DB per binding, but
`y-indexeddb` is one-doc-per-DB by design. Diverged: the default name is
`obsidian-sync-{bindingId}-{slug(filePath)}` so we get one DB per file
inside a binding's namespace. The choice is documented in the doc-manager
JSDoc and surfaced via `dbName` so a future migration can re-shape it.

**`src/crdt/editor-binding.ts` — `buildEditorExtension`**

- Tiny factory that returns the CodeMirror 6 `Extension` produced by
  `y-codemirror.next`'s `yCollab(ytext, awareness ?? null)`.
- Awareness is optional — Stage 5 ships no remote-cursor UI yet, so
  most callers will just pass `undefined`.
- The actual `view.dispatch({ effects: compartment.reconfigure(...) })`
  call lives in Stage 7 where the file-open hook fires.

**Tooling**

- Added `@codemirror/state@6.5.0` + `@codemirror/view@6.38.6` as dev deps
  (pinned to Obsidian's peer-deps to avoid pnpm peer warnings) so the
  editor-binding factory can carry a real `Extension` return type. They
  stay in `external[]` of the esbuild config (Obsidian provides them at
  runtime).

**Tests**

- `tests/text-diff.test.ts` — 8 cases (no-op match, insert into empty,
  middle replace, removal, full replace, origin forwarding, single-update
  per call, non-ASCII).
- `tests/doc-manager.test.ts` — 21 cases across caching, persistence
  factory wiring, text mutations, remote-update intake (state import +
  origin tagging + no-echo invariant), `onLocalUpdate` (subscribe /
  unsubscribe / error isolation), release / releaseBinding / destroy,
  and `encodeStateAsUpdate` rehydration.

Total Jest: **10 suites, 115 tests, all pass**.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 115 / 115 pass.
- `pnpm build` — `main.js` still 25.5 KB (Stage 5 modules are
  tree-shaken; will land in the bundle once the sync engine on Stage 7
  imports them from `main.ts`).

Stage 5 complete. Next: Stage 6 — vault watcher (`vault.on(create/modify/delete/rename)`

- chokidar for external agents, debounce, `recentlyAppliedFiles` set to
  break echo loops).

## 2026-05-08 — Stage 4: Socket.IO client wrapper

`src/client/socket.ts` — typed wrapper around `socket.io-client`. The module
is now imported by `main.js` indirectly through type declarations only; no
runtime consumer yet (the sync engine on Stage 7 will create instances).

**Wire-format mirrors**

Hand-copied from `server/src/socket/handlers/{project,files,yjs}.ts`:

- `ServerLogEntry`, `ServerOperation` (the per-operation entries the server
  sends in the `project:join` ack and via per-event `log` field).
- `YjsDocSnapshot` (the `sync1` payload returned by `project:join` so a
  fresh client can fold in server state).
- `JoinResult` discriminated union.
- `FileEvent` discriminated union covering the five broadcast types
  (`created` / `updated-binary` / `deleted` / `renamed` / `moved`). The
  raw socket events use kebab-case names (`file:updated-binary`); the
  wrapper hides that detail from callers.

**Auth & reconnect (4.1 + 4.2)**

- API key passed via `auth: { apiKey }` — matches the server's
  `socket.handshake.auth.apiKey` lookup.
- `transports: ['websocket']` (no long-poll fallback — Caddy handles WS
  cleanly; long-poll just adds an extra round-trip and a CORS surface).
- Reconnect tuned per spec:
  `reconnectionAttempts: Infinity`, `reconnectionDelay: 1000`,
  `reconnectionDelayMax: 30000`, `randomizationFactor: 0` (single-user
  plugin doesn't benefit from jitter; it just adds noise to debugging).
- Defaults exported as `DEFAULT_RECONNECT`; `SocketClient` accepts a
  `Partial<ReconnectStrategy>` override (used by tests).

**Subscriptions & emits**

- `onConnect` / `onDisconnect(reason)` / `onError(Error)` —
  return `() => void` unsubscribe handles.
- `onFileEvent(FileEvent)` — single fan-out for all five broadcast types.
- `onYjsUpdate({ fileId, update: Uint8Array })` — payload is decoded back
  from `number[]` to `Uint8Array` at the boundary so callers can hand it
  straight to `Y.applyUpdate`.
- `joinProject(projectId, sinceVectorClock)` / `leaveProject(projectId)`
  — Promise-based ack helpers.
- `emitFileCreate` / `emitFileUpdateBinary` / `emitFileDelete` /
  `emitFileRename` / `emitFileMove` — each takes a typed payload, the
  envelope helper serializes `data: ArrayBuffer` as `number[]` (matches
  what the server expects from JSON-encoded transport).
- `emitYjsUpdate` — same pattern for `Uint8Array` updates.
- Listener errors are swallowed (`fan` helper) — a buggy subscriber must
  not tear down the socket.

**DI seam for tests**

- Public `SocketLike` and `SocketFactory` types so tests can plug in a
  `FakeSocket` without ever touching the network.
- Default factory wraps `io()` from `socket.io-client`.

**Tests added (`tests/socket.test.ts`)**

17 cases across handshake config, lifecycle subscriptions (incl.
unsubscribe), outgoing emits (payload shape, binary serialization,
event names), and incoming events (typed union translation, Uint8Array
decoding, listener-error isolation). The test harness is a `FakeSocket`
that records emits and lets each test ack the most recent one (`ackLast`)
or simulate server pushes (`fire`).

Total Jest: **8 suites, 86 tests, all pass**.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 86 / 86 pass.
- `pnpm build` — `main.js` still 25.5 KB (the socket module is currently
  tree-shaken because nothing imports it at runtime; the bundle will grow
  once the sync engine wires it in).

Stage 4 complete. Next: Stage 5 — CRDT layer (`Y.Doc` cache,
`y-indexeddb` persistence, `y-codemirror.next` editor binding,
two-way sync between `Y.Text` and the file on disk).

## 2026-05-08 — Stage 3: full REST client

Built out the REST surface the sync engine will need (every server route the
plugin talks to). Server-side TODO from Stage 1 closed in the same pass.

**Server fixes (cross-cutting)**

Three read-endpoints had been session-only via `getCurrentUser()`; switched
them to the universal `authenticateRequest()` so the plugin's `X-API-Key`
auth works against them:

- `GET /api/auth/me` — used by the "Test connection" flow.
- `GET /api/projects` — used by the "Add binding" project picker.
- `GET /api/projects/[id]` — read symmetric with the listing.

Mutating endpoints (POST/PATCH/DELETE on projects) stayed session-only —
project lifecycle remains a web-UI concern. File endpoints
(`/api/projects/[id]/files/...` + version routes) already used
`authenticateRequest()` and needed no changes.

Server checks: typecheck / lint clean, **48/48** unit tests still pass.
See `server/log.md` for the matching entry.

**DTO mirrors (`src/client/types.ts`)**

Hand-copied response shapes from the Next.js routes:

- `ApiUser`, `ApiProject` (light fields the plugin actually uses).
- `ApiFile` (full per-file payload from `/api/projects/[id]/files`),
  `ApiFileMeta` (POST/PUT response — leaner; no `deletedAt` / `lastModifiedById`),
  `ApiFileVersion` (with embedded `author` summary).

Documented the BigInt → string serialization gotcha (server emits `size` as
a string; the plugin parses it to `number` at the API boundary). With the
`MAX_FILE_SIZE` cap on the server, precision loss isn't a real concern.

**Client (`src/client/api.ts`) — extended**

Stage 1 only had `getMe` + `getProjects`. Added:

- `getProject(id)` — single project fetch (URL-encodes id).
- `getProjectFiles(projectId, { includeDeleted? })` — listing with the
  optional `?includeDeleted=true` flag.
- `downloadFile(projectId, fileId)` → `ArrayBuffer`.
- `uploadFile(projectId, path, content, { mimeType? })` — POST as
  multipart/form-data; we hand-build the body since `requestUrl` doesn't
  accept `FormData`. Boundary derived from `crypto.randomUUID()`.
- `updateFile(projectId, fileId, content)` — PUT with `application/octet-stream`.
- `moveFile(projectId, fileId, newPath)` — PATCH with JSON.
- `deleteFile(projectId, fileId)` — DELETE.
- `getFileVersions(projectId, fileId)` and `downloadFileVersion(...)`.

Refactor highlights:

- Single internal `send(method, path, options)` builds headers, runs the
  call, classifies HTTP errors. `json()` and `binary()` thin wrappers
  pick the response decoder.
- `RequestUrlResponse` interface exported so test code can build mock
  responses without depending on Obsidian types in the manual mock.
- `ApiErrorKind` extended with `not_found` (404) and `conflict` (409 — the
  upload endpoint surfaces `path_exists` this way).
- DTOs re-exported from `api.ts` so call sites can `import { ApiProject }
from '@/client/api'` without knowing about `client/types.ts`.

**Tests added (`tests/api.test.ts` rewritten)**

Now 18 cases (was 7) covering: URL trim + `X-API-Key` header injection;
each method's HTTP shape (method, headers, body, URL encoding); `?includeDeleted`
flag; size string→number conversion; multipart body inspection (path field,
file field, payload); error mapping for 401 / 403 / 404 / 409 / 5xx;
transport throw → network ApiError.

Total Jest: **7 suites, 69 tests, all pass**.

**Tooling**

- ESLint flat config picked up `TextEncoder` / `TextDecoder` globals (used
  in the multipart body builder + the upload test).

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 69 / 69 pass.
- `pnpm build` — `main.js` now 25.5 KB (up from 22.8 — extra REST methods,
  the multipart builder, and DTO re-exports; everything else still tree-shaken).

Stage 3 complete. Next: Stage 4 — Socket.IO client wrapper (auth handshake,
project:join, server-event subscriptions, exponential-backoff reconnect).

## 2026-05-08 — Stage 2: local SQLite operation log

Implemented the offline-first state layer. No live consumer yet — same pattern
as Stage 1: the building blocks land first, the sync engine wires them up at
Stage 7.

**Vector clock helpers (`src/sync/vector-clock.ts`)**

- `merge(a, b)` — per-node max, returns a new object.
- `compare(a, b)` — `-1` / `0` / `1` / `'concurrent'`. Missing keys treated as 0.
- `increment(vc, nodeId)` — bump one counter, immutable.

These belong to Stage 7.x in tasks.md but are tightly coupled to the operation
log (the log persists vector clocks per binding), so it made sense to ship
them together.

**Operation log (`src/sync/operation-log.ts`)**

- Wraps `better-sqlite3` (synchronous; one connection on the main thread —
  intentional for a desktop plugin).
- WAL mode + `foreign_keys = ON` enabled at construction.
- Schema (migration #1):
  - `bindings_state` (PK bindingId, lastVectorClock JSON, lastSyncedAt)
  - `pending_operations` (auto-id, bindingId, opType, filePath, newPath nullable, payload JSON, createdAt; index on (bindingId, id))
  - `file_meta` (composite PK bindingId+relativePath; serverFileId, contentHash, size, fileType, lastSyncedAt; index on bindingId)
- API:
  - `enqueueOperation(bindingId, op)` / `dequeueOperations(bindingId)` / `markSent(ids)` / `pendingCount(bindingId?)`
  - `getFileMeta` / `setFileMeta` (UPSERT) / `deleteFileMeta` / `listFileMeta`
  - `getBindingState` / `updateLastVectorClock(bindingId, vc, syncedAt?)`
- Migration system: `MIGRATIONS: readonly string[]`, current index tracked via
  `PRAGMA user_version`. Each migration runs in its own transaction. Rule:
  never edit a published migration, only append.
- Constructor accepts an injected `now()` clock for deterministic tests.

**Build wiring**

- Added `better-sqlite3` to `esbuild.config.mjs` `external[]` — it's a
  native module loaded at runtime from the plugin's `node_modules/` by
  the Obsidian host, not bundled into `main.js`. Pre-empted before the
  sync engine starts importing it from `main.ts`.

**Tests added**

- `vector-clock.test.ts` — 10 cases (merge max, no mutation, compare equal /
  dominate / concurrent, increment fresh / existing, immutability).
- `operation-log.test.ts` — 19 cases against `:memory:` SQLite covering
  schema version, pending-ops round-trip / order / per-binding isolation /
  newPath / markSent (including empty-array no-op) / pending counts /
  injected clock; file_meta UPSERT / cross-binding isolation / delete;
  bindings_state insert / overwrite / explicit syncedAt.

Total Jest suite: **7 suites, 57 tests, all pass**.

**Tooling**

- Added `@types/better-sqlite3` as a dev dep — TS needed declarations to
  compile the import.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 57 / 57 pass.
- `pnpm build` — emits `main.js` (still 22.8 KB; the operation log is dead-code-eliminated until something imports it).

Stage 2 complete. Next: Stage 3 — REST client (full surface: file CRUD,
version history, download/upload), zod-validated DTOs, mocked tests.

## 2026-05-08 — Stage 1: settings + settings UI

Wired the persisted settings layer and the settings tab. No live sync yet — the
modals already validate and save, but the saved data has no consumer beyond the
settings UI.

**Settings model (`src/settings/settings.ts`)**

- `ServerConfig`, `VaultBinding`, `PluginSettings` interfaces, `LogLevel` /
  `Language` unions, `DEFAULT_SETTINGS` constant.
- `mergeWithDefaults(raw)` — defensive normalizer. Drops malformed servers /
  bindings, clamps `debounceMs >= 0`, validates enum fields, filters
  non-numeric vector clock entries. Used in `loadSettings()`.

**i18n (`src/i18n/`)**

- `ru.json` — every string the Stage 1 UI emits (tab + 2 modals + folder picker).
- `en.json` — placeholder, empty in MVP.
- `index.ts` — `t(key, params?)` with `{name}` substitution, ru fallback,
  raw-key fallback for missing translations.

**REST client stub (`src/client/api.ts`)**

- `ApiClient` with just `getMe()` and `getProjects()` — what the modals need
  to test connectivity / list projects.
- Goes through Obsidian's `requestUrl` (CORS-bypass via Electron IPC).
- Uses `X-API-Key` header (matches `server/src/lib/auth/api-key-middleware.ts`).
- `ApiError` taxonomy: `network` / `unauthorized` / `forbidden` / `server` / `unknown`,
  with a `retryable` flag the sync engine will use later.
- Constructor takes an optional `RequestFn` for tests — no real HTTP in unit tests.

**Settings tab (`src/settings/tab.ts`)**

- `PluginSettingTab` subclass with three sections: Servers, Bindings, Behavior.
- Servers section: list, "Test" (calls `getMe()` and shows email in a Notice),
  "Remove" (with `window.confirm`, also disables affected bindings rather than
  cascading-deleting them).
- Bindings section: list with toggle / remove, "Add binding" CTA disabled when
  no servers exist yet.
- Behavior section: debounce (text), syncOnStartup (toggle), notifications
  (toggle), log level (dropdown).

**Modals**

- `AddServerModal` (`modals/server-modal.ts`) — name / URL / API-key fields,
  "Test" required before "Save" (we never persist credentials we know don't
  work). Trims trailing slashes from the URL before save.
- `AddBindingModal` (`modals/binding-modal.ts`) — server dropdown, project
  dropdown (lazily populated via `getProjects()` after server pick), folder
  picker via `FolderSuggestModal`. Validates the picked folder against
  `existingBindings` before save.
- `FolderSuggestModal` (`modals/folder-suggest-modal.ts`) — `FuzzySuggestModal<TFolder>`
  walking the vault tree, root rendered as `(корень vault'а)`.
- `folder-utils.ts` — `normalizeFolderPath` and `isFolderInUse` (collision rules:
  exact match, root-vs-anything, parent-child in either direction).

**Tests added (`tests/`)**

- `settings.test.ts` — 6 cases covering `mergeWithDefaults` edge behavior.
- `i18n.test.ts` — 5 cases (substitution, missing param leaves placeholder,
  raw-key fallback, en→ru fallback).
- `folder-utils.test.ts` — 9 cases on path normalization + collision detection.
- `api.test.ts` — 7 cases on `ApiClient` (URL trim, header injection, payload
  unwrapping, error mapping for 401 / 403 / 5xx, transport-throw → network error).

Total Jest now: **5 suites, 28 tests, all pass**.

**Tooling notes**

- Added `tslib` as a dev dep — `tsconfig` has `importHelpers: true`, ts-jest
  noticed the missing module on the i18n test (JSON import emit pulled
  `__importDefault`).
- `src/client/api.ts` defines its own minimal `RequestUrlParam` interface
  rather than importing it from `obsidian` — keeps the manual Jest mock thin.
- `pnpm build` now produces `main.js` at 22.8 KB (up from 899 bytes — Yjs et al.
  are still tree-shaken away because Stage 1 doesn't use them).

**Server-side TODO (not blocking Stage 1, surfaces during real testing)**

- `/api/auth/me` and `/api/projects` currently use `getCurrentUser()`, which only
  honors session cookies / `Authorization: Bearer <access JWT>`. They need to
  switch to the universal `authenticateRequest()` so the plugin (which uses
  `X-API-Key`) can hit them. Will fix when wiring up Stage 3.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 28 / 28 pass.
- `pnpm build` — emits `main.js`.

Stage 1 complete. Next: Stage 2 — local SQLite operation log (better-sqlite3,
schema, enqueue / dequeue / file_meta API, Jest tests with `:memory:`).

## 2026-05-08 — Stage 0: project scaffolding

Set up the plugin workspace from scratch (no sample-plugin clone) following the same conventions
as the server.

**Tooling**

- `package.json` — author `krem.digital`, license MIT, scripts (`dev` / `dev:vault` / `build` /
  `build:vault` / `lint` / `lint:fix` / `typecheck` / `format` / `format:check` / `test` /
  `test:watch` / `test:coverage` / `prepare`), lint-staged config, `pnpm.onlyBuiltDependencies`
  whitelist for native deps (`better-sqlite3`, `esbuild`, `unrs-resolver`).
- `manifest.json` — id `obsidian-sync`, version `0.1.0`, minAppVersion `1.5.0`, desktopOnly.
- `tsconfig.json` — strict, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, target
  ES2022, module ESNext, `@/*` → `src/*` path alias.
- ESLint flat config (`eslint.config.mjs`) — `@eslint/js` + `@typescript-eslint` + `eslint-config-prettier`,
  with browser/Node globals for the runtime block and Jest globals scoped to `tests/**`.
- Prettier (`.prettierrc`, `.prettierignore`) — single quotes, trailing commas, 100-col print width.
- Husky (`.husky/pre-commit`, `.husky/commit-msg`) + commitlint (config-conventional) wired to
  conventional commits.
- Jest (`jest.config.mjs`) — `ts-jest/presets/default-esm`, manual obsidian mock at
  `tests/__mocks__/obsidian.ts`, `@/*` resolves to `src/*`.

**Dependencies installed**

- Runtime: `yjs`, `y-indexeddb`, `y-protocols`, `y-codemirror.next`, `socket.io-client`,
  `chokidar`, `better-sqlite3`, `diff`, `lib0`.
- Dev: `typescript@5.9.3`, `esbuild`, `builtin-modules`, `obsidian` types, `@types/node`,
  `@types/diff`, `jest`, `@types/jest`, `ts-jest`, `prettier`, `eslint` flat-config stack,
  `husky`, `lint-staged`, `@commitlint/cli` + config-conventional.

**Scaffolding**

- `src/` tree with `.gitkeep` placeholders: `settings/`, `client/`, `sync/`, `crdt/`, `watcher/`,
  `ui/`, `i18n/`, `utils/`.
- `src/main.ts` — minimal `Plugin` skeleton with onload/onunload + a single status command
  (placeholder until Stage 1+).
- `tests/sanity.test.ts` — Jest sanity coverage (`1 + 1 = 2`, async assertion).
- `esbuild.config.mjs` — CJS bundle to `main.js`, externals for `obsidian` / `electron` /
  CodeMirror packages / Node built-ins, `--watch` and `--vault` flags. `--vault` copies
  `main.js` + `manifest.json` into `$TEST_VAULT/.obsidian/plugins/obsidian-sync/` after build.
- `.gitignore`, `.env.example` (documents the `TEST_VAULT` env var), `LICENSE` (MIT),
  `README.md` (high-level orientation, deferring detail to `tasks.md` / `log.md`).
- Test vault at `D:\DEV\Claude\ObsidianTeams\test-vault\` with `.obsidian/community-plugins.json`
  enabling the plugin and an empty `.hotreload` marker file inside the plugin dir for the
  obsidian-hot-reload community plugin.

**Verified end-to-end**

- `pnpm typecheck` — clean.
- `pnpm lint` — 0 problems.
- `pnpm format:check` — clean.
- `pnpm test` — 2 / 2 pass.
- `pnpm build` — emits `main.js` (899 bytes minified).
- `TEST_VAULT=… pnpm build:vault` — bundle + manifest copied into the test vault correctly.

Stage 0 complete. Next: Stage 1 — settings (`SyncSettings` interface, defaults, settings tab UI).
