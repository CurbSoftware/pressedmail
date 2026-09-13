'use client';

/**
 * Plugin-specific AlertDialog Component
 *
 * This component wraps the standard shadcn AlertDialog to ensure that theme CSS
 * variables are properly applied to portal content.
 */
import * as React from 'react';

import { AlertDialog as AlertDialogPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { buttonVariants } from '../shadcn/button';
import {
  DialogTitleRow as AlertDialogTitleRow,
  overlayTitleClassName,
  useAppFrameCoverStyle,
} from './dialog';
import { useThemeClass } from './hooks/use-theme-class';

const AlertDialog = AlertDialogPrimitive.Root;
const AlertDialogTrigger = AlertDialogPrimitive.Trigger;
const AlertDialogPortal = AlertDialogPrimitive.Portal;

const AlertDialogOverlay: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Overlay>
> = ({ className, ...props }) => (
  <AlertDialogPrimitive.Overlay
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-background/80 fixed inset-0 z-50',
      className,
    )}
    {...props}
  />
);
AlertDialogOverlay.displayName = AlertDialogPrimitive.Overlay.displayName;

const AlertDialogContent: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Content>
> = ({ className, ...props }) => {
  const { themeClass, isDark, style, lang } = useThemeClass();
  const frameStyle = useAppFrameCoverStyle();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const wrapperContent = (
    <div className={themeClass} data-pm-portal lang={lang} style={style}>
      <AlertDialogPrimitive.Content
        className={cn(
          'bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=open]:fade-in-0 data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 pointer-events-auto relative z-50 grid max-h-[min(calc(100dvh-2rem),90dvh)] w-full max-w-lg gap-4 overflow-x-hidden overflow-y-auto rounded-lg border p-6 shadow-xl duration-200',
          className,
        )}
        {...props}
      />
    </div>
  );

  return (
    <AlertDialogPortal>
      <AlertDialogOverlay />
      {/* Outer wrapper for positioning and dark mode */}
      <div
        className={isDark ? 'dark' : undefined}
        data-pm-overlay-frame
        style={{
          ...frameStyle,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        {wrapperContent}
      </div>
    </AlertDialogPortal>
  );
};
AlertDialogContent.displayName = AlertDialogPrimitive.Content.displayName;

const AlertDialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col gap-y-3 text-center sm:text-left', className)}
    {...props}
  />
);
AlertDialogHeader.displayName = 'AlertDialogHeader';

const AlertDialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2',
      className,
    )}
    {...props}
  />
);
AlertDialogFooter.displayName = 'AlertDialogFooter';

const AlertDialogTitle: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Title>
> = ({ className, ...props }) => (
  <AlertDialogPrimitive.Title
    className={cn(overlayTitleClassName, className)}
    {...props}
  />
);
AlertDialogTitle.displayName = AlertDialogPrimitive.Title.displayName;

const AlertDialogDescription: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Description>
> = ({ className, ...props }) => (
  <AlertDialogPrimitive.Description
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
);
AlertDialogDescription.displayName =
  AlertDialogPrimitive.Description.displayName;

const AlertDialogAction: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Action>
> = ({ className, ...props }) => (
  <AlertDialogPrimitive.Action
    className={cn(buttonVariants(), className)}
    {...props}
  />
);
AlertDialogAction.displayName = AlertDialogPrimitive.Action.displayName;

const AlertDialogCancel: React.FC<
  React.ComponentPropsWithoutRef<typeof AlertDialogPrimitive.Cancel>
> = ({ className, ...props }) => (
  <AlertDialogPrimitive.Cancel
    className={cn(
      buttonVariants({ variant: 'outline' }),
      'mt-2 sm:mt-0',
      className,
    )}
    {...props}
  />
);
AlertDialogCancel.displayName = AlertDialogPrimitive.Cancel.displayName;

export {
  AlertDialog,
  AlertDialogPortal,
  AlertDialogOverlay,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogTitleRow,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
};
