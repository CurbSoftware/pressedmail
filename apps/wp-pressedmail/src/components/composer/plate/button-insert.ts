'use client';

import { PathApi } from '@kit/plate';
import type { PlateEditor } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

import { createButtonNode } from '../nodes/button-plugin';

/**
 * Editors that have just been handed a new button. The block opens its form when
 * it mounts, but only for a button a person has just inserted: a saved draft
 * that holds a button with no link must not pop a form up each time it opens.
 */
const justInserted = new WeakSet<object>();
const FRESH_WINDOW_MS = 1000;

/** True once for an editor that has just inserted a button. */
export function takeFreshButton(editor: PlateEditor): boolean {
  return justInserted.delete(editor);
}

/**
 * Drop a button in after the current block, or in place of it when it is empty
 * (the common slash-trigger case), with its form already open. The toolbar and
 * the slash menu both call this.
 */
export function insertButtonBlock(editor: PlateEditor) {
  justInserted.add(editor);
  setTimeout(() => justInserted.delete(editor), FRESH_WINDOW_MS);
  const node = createButtonNode({ label: __('Button', 'pressedmail') });
  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();
    if (!block) {
      editor.tf.insertNodes(node as never, { select: true });
      return;
    }
    const [current, path] = block;
    const isEmpty = editor.api.isEmpty(current);
    editor.tf.insertNodes(node as never, { at: PathApi.next(path), select: true });
    if (isEmpty) editor.tf.removeNodes({ at: path });
  });
  // No editor.tf.focus() here: the block's form opens and takes focus, and
  // gives it back to the editor when it closes. An editor that was not focused
  // (a signature or an auto-reply before anyone clicked into it) focuses on a
  // timer once its operations flush, which landed after the form had opened and
  // closed it as a focus-outside, so the button could never be filled in.
}
