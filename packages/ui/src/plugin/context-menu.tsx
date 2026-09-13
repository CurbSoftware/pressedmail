'use client';

/**
 * Plugin-specific ContextMenu Component
 *
 * Wraps the shadcn (Base UI) ContextMenu so theme CSS variables and dark mode are
 * applied to the portaled popup. Base UI portals render outside the plugin app
 * container, so without this wrapper the menu surface loses PressedMail theme
 * tokens (bg-popover, text-popover-foreground, border, etc.) and dark mode.
 *
 * Mirrors the canonical pattern used by sheet/dialog/popover/select/dropdown-menu:
 * an outer `.dark` wrapper (the dark CSS uses a `.dark .theme-class` selector) and
 * an inner themeClass + data-pm-portal node carrying the theme scope.
 */
import * as React from 'react';

import { ContextMenu as ContextMenuPrimitive } from '@base-ui/react/context-menu';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

// Non-portaled parts inherit theme from the trigger's own DOM scope, so they are
// re-exported unchanged. Only the portaled Content/SubContent need wrapping.
export {
  ContextMenu,
  ContextMenuTrigger,
  ContextMenuItem,
  ContextMenuCheckboxItem,
  ContextMenuRadioItem,
  ContextMenuLabel,
  ContextMenuSeparator,
  ContextMenuShortcut,
  ContextMenuGroup,
  ContextMenuPortal,
  ContextMenuSub,
  ContextMenuSubTrigger,
  ContextMenuRadioGroup,
} from '../shadcn/context-menu';

function ContextMenuContent({
  className,
  align = 'start',
  alignOffset = 4,
  side = 'right',
  sideOffset = 0,
  ...props
}: ContextMenuPrimitive.Popup.Props &
  Pick<
    ContextMenuPrimitive.Positioner.Props,
    'align' | 'alignOffset' | 'side' | 'sideOffset'
  >) {
  const { themeClass, isDark, style, lang } = useThemeClass();

  return (
    <ContextMenuPrimitive.Portal>
      <ContextMenuPrimitive.Positioner
        className="isolate z-50 outline-none"
        align={align}
        alignOffset={alignOffset}
        side={side}
        sideOffset={sideOffset}
      >
        {/* Outer wrapper for dark mode - CSS uses `.dark .theme-class` selector */}
        <div className={isDark ? 'dark' : undefined}>
          <div className={themeClass} data-pm-portal lang={lang} style={style}>
            <ContextMenuPrimitive.Popup
              data-slot="context-menu-content"
              className={cn(
                'data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 ring-foreground/10 bg-popover text-popover-foreground z-50 max-h-(--available-height) min-w-36 origin-(--transform-origin) overflow-x-hidden overflow-y-auto rounded-md p-1 shadow-md ring-1 duration-100 outline-none',
                className,
              )}
              {...props}
            />
          </div>
        </div>
      </ContextMenuPrimitive.Positioner>
    </ContextMenuPrimitive.Portal>
  );
}

function ContextMenuSubContent({
  ...props
}: React.ComponentProps<typeof ContextMenuContent>) {
  return (
    <ContextMenuContent
      data-slot="context-menu-sub-content"
      className="shadow-lg"
      side="right"
      {...props}
    />
  );
}

export { ContextMenuContent, ContextMenuSubContent };
