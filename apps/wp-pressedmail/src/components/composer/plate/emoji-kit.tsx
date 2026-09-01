'use client';

import emojiMartData from '@emoji-mart/data';
import { EmojiInputPlugin, EmojiPlugin } from '@kit/plate/emoji/react';

import { EmojiInputElement } from './emoji-node';

/**
 * `:` emoji autocomplete (template emoji-kit.tsx port). The emoji-mart data
 * JSON is imported eagerly, the WP build drops dynamic chunks (known
 * vite-for-wp quirk), so a lazy import could fail at runtime.
 */
export const EmojiKit = [
  EmojiPlugin.configure({
    options: { data: emojiMartData as never },
  }),
  EmojiInputPlugin.withComponent(EmojiInputElement),
];
