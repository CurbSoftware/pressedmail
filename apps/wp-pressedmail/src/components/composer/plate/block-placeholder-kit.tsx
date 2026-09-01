'use client';

import { KEYS } from '@kit/plate';
import { BlockPlaceholderPlugin } from '@kit/plate/react';
import { __ } from '@wordpress/i18n';

/**
 * "Type / for commands…" hint in empty top-level paragraphs (template port).
 * `before:content-[attr(placeholder)]` is an arbitrary VALUE (emitted by
 * this build), unlike the `has-[...]` arbitrary variants that are not.
 */
export const BlockPlaceholderKit = [
  BlockPlaceholderPlugin.configure({
    options: {
      className:
        'before:absolute before:cursor-text before:text-muted-foreground/80 before:content-[attr(placeholder)]',
      placeholders: {
        [KEYS.p]: __('Type / for commands…', 'pressedmail'),
      },
      query: ({ path }) => path.length === 1,
    },
  }),
];
