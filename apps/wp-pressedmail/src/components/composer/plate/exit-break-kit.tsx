'use client';

import { ExitBreakPlugin } from '@kit/plate';

/** mod+enter / mod+shift+enter exit nested blocks (template port). */
export const ExitBreakKit = [
  ExitBreakPlugin.configure({
    shortcuts: {
      insert: { keys: 'mod+enter' },
      insertBefore: { keys: 'mod+shift+enter' },
    },
  }),
];
