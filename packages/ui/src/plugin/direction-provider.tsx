import type * as React from 'react';

import { DirectionProvider as BaseUiDirectionProvider } from '@base-ui/react/direction-provider';
import { Direction } from 'radix-ui';

/**
 * One direction for every primitive @kit/ui renders. Radix and Base UI each
 * read their own provider and never the page, so a menu, tab list or radio
 * group stays left to right, arrow keys and all, until told otherwise. A
 * product that runs in a right-to-left locale passes
 * `document.documentElement.dir` here once, at its root.
 */
export function DirectionProvider({
  dir,
  children,
}: {
  dir: 'ltr' | 'rtl';
  children?: React.ReactNode;
}) {
  return (
    <Direction.Provider dir={dir}>
      <BaseUiDirectionProvider direction={dir}>
        {children}
      </BaseUiDirectionProvider>
    </Direction.Provider>
  );
}
