'use client';

import * as React from 'react';
import type { EmojiMartData } from '@emoji-mart/data';
import { EmojiInputPlugin, EmojiPlugin } from '@kit/plate/emoji/react';

import { loadEmojiData, loadedEmojiData } from './emoji-data';
import { EmojiInputElement } from './emoji-node';

/**
 * `:` emoji autocomplete (template emoji-kit.tsx port). The emoji set loads on
 * demand (see emoji-data.ts) and is handed to each editor as it mounts. The
 * layout effect gives an editor an already-loaded set before paint, so a
 * second composer never flashes a disabled emoji button.
 */
export const EmojiKit = [
  EmojiPlugin.extend({
    useHooks: ({ editor }) => {
      React.useLayoutEffect(() => {
        let live = true;
        const adopt = (data: EmojiMartData) => {
          if (live && editor.getOption(EmojiPlugin, 'data') !== data) {
            editor.setOption(EmojiPlugin, 'data', data);
          }
        };

        const ready = loadedEmojiData();
        if (ready) {
          adopt(ready);
        } else {
          loadEmojiData().then(adopt, () => {
            // Emoji stays unavailable in this editor; nothing else needs it.
          });
        }

        return () => {
          live = false;
        };
      }, [editor]);
    },
  }),
  EmojiInputPlugin.withComponent(EmojiInputElement),
];
