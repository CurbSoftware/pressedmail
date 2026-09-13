'use client';

/**
 * Plugin-specific CommandDialog Component
 *
 * Wraps cmdk Command inside a plugin-specific Dialog to ensure that theme CSS
 * variables are properly applied to portal content. The base shadcn CommandDialog
 * uses the standard Dialog which doesn't inherit theme styles in WordPress portals.
 *
 * Follows the same pattern as packages/ui/src/plugin/dialog.tsx
 */
import * as React from 'react';

import { Command as CommandPrimitive } from 'cmdk';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

type CommandDialogProps = React.ComponentProps<typeof DialogPrimitive.Root> & {
  children?: React.ReactNode;
  /** Accessible title for the dialog (sr-only). */
  title?: string;
  /** Accessible description for the dialog (sr-only). */
  description?: string;
};

const CommandDialog = ({
  children,
  title,
  description,
  ...props
}: CommandDialogProps) => {
  const { themeClass, isDark, style, lang } = useThemeClass();

  return (
    <DialogPrimitive.Root {...props}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay
          className={cn(
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 fixed inset-0 z-50 bg-black/50 backdrop-blur-sm',
          )}
        />
        <div
          className={isDark ? 'dark' : undefined}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 50,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingTop: '15vh',
            pointerEvents: 'none',
          }}
        >
          <div
            className={cn(themeClass, 'mx-auto w-full max-w-2xl')}
            data-pm-portal
            lang={lang}
            style={style}
          >
            <DialogPrimitive.Content
              aria-describedby={undefined}
              className={cn(
                'bg-background text-foreground border-border pointer-events-auto relative w-full overflow-hidden rounded-xl border shadow-2xl',
                'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'duration-200',
              )}
            >
              <DialogPrimitive.Title className="sr-only">
                {title || 'Command menu'}
              </DialogPrimitive.Title>
              {description && (
                <DialogPrimitive.Description className="sr-only">
                  {description}
                </DialogPrimitive.Description>
              )}
              <CommandPrimitive
                shouldFilter={false}
                className={cn(
                  'flex h-full w-full flex-col overflow-hidden',
                  '[&_[cmdk-group-heading]]:text-muted-foreground [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:font-medium',
                  '[&_[cmdk-group]]:px-2 [&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0',
                  '[&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5',
                  '[&_[cmdk-input]]:h-12',
                  '[&_[cmdk-item]]:rounded-md [&_[cmdk-item]]:px-2 [&_[cmdk-item]]:py-2',
                  '[&_[cmdk-item]_svg]:h-4 [&_[cmdk-item]_svg]:w-4',
                )}
              >
                {children}
              </CommandPrimitive>
            </DialogPrimitive.Content>
          </div>
        </div>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
};

export { CommandDialog };
