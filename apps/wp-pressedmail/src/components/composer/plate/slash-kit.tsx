'use client';

import { SlashInputPlugin, SlashPlugin } from '@kit/plate/slash-command/react';
import { KEYS, type SlateEditor } from '@kit/plate';

import { SlashInputElement } from './slash-node';

/**
 * Slash "/" command menu. Typing "/" at the start of an empty block opens
 * an inline combobox to insert email blocks (headings, lists, blockquote,
 * divider).
 */
export const SlashKit = [
  SlashPlugin.configure({
    options: {
      triggerQuery: (editor: SlateEditor) =>
        !editor.api.some({
          match: { type: editor.getType(KEYS.codeBlock) },
        }),
    },
  }),
  SlashInputPlugin.withComponent(SlashInputElement),
];
