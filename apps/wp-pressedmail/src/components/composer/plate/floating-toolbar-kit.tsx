'use client';

import { createPlatePlugin } from '@kit/plate/react';

import { FloatingToolbar } from './floating-toolbar';
import { FloatingToolbarButtons } from './floating-toolbar-buttons';

/**
 * Registers the selection bubble toolbar. It renders after the editable
 * surface (overlay) and positions itself over the current selection.
 */
export const FloatingToolbarKit = [
  createPlatePlugin({
    key: 'composer-floating-toolbar',
    render: {
      afterEditable: () => (
        <FloatingToolbar>
          <FloatingToolbarButtons />
        </FloatingToolbar>
      ),
    },
  }),
];
