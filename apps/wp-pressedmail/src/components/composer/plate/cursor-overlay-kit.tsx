'use client';

import { CursorOverlayPlugin } from '@kit/plate/selection/react';

import { CursorOverlay } from './cursor-overlay';

/** Selection/caret overlay (keeps the selection visible when the editor blurs). */
export const CursorOverlayKit = [
  CursorOverlayPlugin.configure({
    render: {
      afterEditable: () => <CursorOverlay />,
    },
  }),
];
