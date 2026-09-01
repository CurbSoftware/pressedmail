'use client';

import * as React from 'react';
import {
  flip,
  offset,
  useFloatingToolbar,
  useFloatingToolbarState,
} from '@kit/plate/floating';
import { KEYS } from '@kit/plate';
import {
  useEditorId,
  useEventEditorValue,
  usePluginOption,
} from '@kit/plate/react';

import { cn } from '@/lib/utils';
import { Toolbar } from '@/components/composer/toolbar';

/**
 * Compose multiple refs into one callback ref (replaces @udecode/cn's
 * useComposedRef, which is not a composer dependency).
 */
function useComposedRef<T>(
  ...refs: Array<React.Ref<T> | undefined>
): React.RefCallback<T> {
  return React.useCallback((node: T | null) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<T | null>).current = node;
    }

  }, refs);
}

/**
 * Selection bubble toolbar. Positions itself over the current text
 * selection via @platejs/floating and self-renders through the
 * FloatingToolbarKit plugin (render.afterEditable), so it lives inside
 * the Plate provider.
 */
export function FloatingToolbar({
  children,
  className,
  ...props
}: React.ComponentProps<typeof Toolbar>) {
  const editorId = useEditorId();
  const focusedEditorId = useEventEditorValue('focus');
  // Hide the bubble while the inline link UI is open (avoids overlap).
  const isFloatingLinkOpen = !!usePluginOption({ key: KEYS.link }, 'mode');

  const floatingToolbarState = useFloatingToolbarState({
    editorId,
    focusedEditorId,
    hideToolbar: isFloatingLinkOpen,
    floatingOptions: {
      middleware: [
        offset(12),
        flip({
          fallbackPlacements: [
            'top-start',
            'top-end',
            'bottom-start',
            'bottom-end',
          ],
          padding: 12,
        }),
      ],
      placement: 'top',
    },
  });

  const {
    clickOutsideRef,
    hidden,
    props: rootProps,
    ref: floatingRef,
  } = useFloatingToolbar(floatingToolbarState);

  const ref = useComposedRef<HTMLDivElement>(
    props.ref as React.Ref<HTMLDivElement>,
    floatingRef as React.Ref<HTMLDivElement>,
  );

  if (hidden) return null;

  return (
    <div ref={clickOutsideRef}>
      <Toolbar
        {...props}
        {...rootProps}
        ref={ref}
        data-test="composer-floating-toolbar"
        className={cn(
          'absolute z-50 flex max-w-[80vw] items-center gap-0.5 overflow-x-auto whitespace-nowrap rounded-md border border-border bg-popover p-1 text-popover-foreground opacity-100 shadow-md print:hidden',
          className,
        )}
      >
        {children}
      </Toolbar>
    </div>
  );
}
