import type { Extension } from '@codemirror/state';
import type * as Y from 'yjs';
import type { Awareness } from 'y-protocols/awareness';
import { yCollab } from 'y-codemirror.next';

/**
 * Build the CodeMirror 6 extension that ties a `Y.Text` to the current
 * editor instance. Stage 5 only exposes the factory — Stage 7 (sync
 * engine) is responsible for wiring it into the live `EditorView` via
 * a `Compartment.reconfigure(...)` dispatch when a synced file is
 * opened.
 *
 * `awareness` is optional because the plugin doesn't show remote cursors
 * yet — it'll get plugged in later when we ship the awareness UI. Passing
 * `undefined` is fine; `yCollab` tolerates it.
 */
export function buildEditorExtension(ytext: Y.Text, awareness?: Awareness): Extension {
  return yCollab(ytext, awareness ?? null);
}

/**
 * Re-export the ambient Yjs `Y.Doc` type so call sites can type their
 * locals against `import type { Doc } from 'yjs'` without dragging a full
 * Yjs import path into UI code.
 */
export type { Doc as YDoc } from 'yjs';
