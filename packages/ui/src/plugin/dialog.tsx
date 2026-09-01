'use client';

/**
 * Plugin-specific Dialog Component
 *
 * This component wraps the standard shadcn Dialog to ensure that theme CSS
 * variables are properly applied to portal content. Radix portals render
 * outside the main app container, so they don't inherit theme styles.
 *
 * This component solves this by:
 * 1. Detecting the current theme class from the body element
 * 2. Applying the theme class to the dialog portal content wrapper
 * 3. Preserving dark mode support
 */
import * as React from 'react';

import { Cross2Icon } from '@radix-ui/react-icons';
import { Dialog as DialogPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = DialogPrimitive.Portal;
const DialogClose = DialogPrimitive.Close;

const APP_FRAME_SELECTOR = '[data-pm-app-frame]';

interface FrameBox {
  top: number;
  left: number;
  width: number;
  height: number;
}

/**
 * Style for the wrapper that centres a portalled overlay.
 *
 * It has to cover the PressedMail app frame, not the browser viewport: the
 * portal lands on document.body, and WordPress paints #wpadminbar (z-index
 * 99999) and #adminmenuwrap (9990) above anything a plugin can stack. A
 * viewport-sized `inset: 0` therefore centres the dialog over the admin menu
 * and slides it under the admin bar on short screens.
 *
 * Same measurement and same fallback contract as `useAppFrameRect` in the
 * plugin app (which cannot be imported here: packages never depend on apps).
 * No frame element means the front end or jsdom, where viewport coordinates
 * are correct, so the style falls back to `inset: 0`.
 */
function useAppFrameCoverStyle(): React.CSSProperties {
  const [box, setBox] = React.useState<FrameBox | null>(null);

  React.useEffect(() => {
    if (typeof document === 'undefined') return;

    const element = document.querySelector<HTMLElement>(APP_FRAME_SELECTOR);
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      const next: FrameBox = {
        top: Math.round(rect.top),
        left: Math.round(rect.left),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      };
      setBox((current) =>
        current &&
        current.top === next.top &&
        current.left === next.left &&
        current.width === next.width &&
        current.height === next.height
          ? current
          : next,
      );
    };
    update();

    // The frame moves and resizes when the admin bar changes height, the admin
    // menu folds, or the window resizes.
    const resizeObserver =
      typeof ResizeObserver !== 'undefined' ? new ResizeObserver(update) : null;
    resizeObserver?.observe(element);
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, { passive: true });

    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update);
    };
  }, []);

  return box
    ? {
        position: 'fixed',
        top: box.top,
        left: box.left,
        width: box.width,
        height: box.height,
      }
    : { position: 'fixed', inset: 0 };
}

const DialogOverlay: React.FC<
  React.ComponentPropsWithRef<typeof DialogPrimitive.Overlay>
> = ({ className, ...props }) => (
  <DialogPrimitive.Overlay
    className={cn(
      'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 bg-background/80 fixed inset-0 z-50',
      className,
    )}
    {...props}
  />
);
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent: React.FC<
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    showCloseButton?: boolean;
  }
> = ({ className, children, showCloseButton = true, ...props }) => {
  const { themeClass, isDark, style } = useThemeClass();
  const frameStyle = useAppFrameCoverStyle();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  // for proper CSS variable inheritance
  const wrapperContent = (
    <div className={themeClass} data-pm-portal style={style}>
      <DialogPrimitive.Content
        className={cn(
          'bg-popover text-popover-foreground border-border pointer-events-auto relative z-50 grid max-h-[min(calc(100dvh-2rem),90dvh)] w-full max-w-lg gap-4 overflow-x-hidden overflow-y-auto rounded-lg border p-6 shadow-xl duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
          className,
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close className="ring-offset-background focus:ring-ring data-[state=open]:bg-accent data-[state=open]:text-muted-foreground absolute top-4 right-4 rounded-xs opacity-70 transition-opacity hover:opacity-100 focus:ring-2 focus:ring-offset-2 focus:outline-hidden disabled:pointer-events-none">
            <Cross2Icon className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </div>
  );

  return (
    <DialogPortal>
      <DialogOverlay />
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
    </DialogPortal>
  );
};
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-left', className)}
    {...props}
  />
);
DialogHeader.displayName = 'DialogHeader';

const DialogFooter = ({
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
DialogFooter.displayName = 'DialogFooter';

const overlayTitleClassName =
  'text-foreground text-lg leading-none font-semibold tracking-tight';
// Base row layout without an icon color so callers can pick a tone.
const overlayTitleRowBaseClassName =
  'flex min-w-0 items-center gap-2 text-left [&_svg]:h-5 [&_svg]:w-5 [&_svg]:shrink-0';
const overlayTitleRowClassName = `${overlayTitleRowBaseClassName} [&_svg]:text-primary`;

const DialogTitle: React.FC<
  React.ComponentPropsWithRef<typeof DialogPrimitive.Title>
> = ({ className, ...props }) => (
  <DialogPrimitive.Title
    className={cn(overlayTitleClassName, className)}
    {...props}
  />
);
DialogTitle.displayName = DialogPrimitive.Title.displayName;

type DialogTitleRowProps = React.HTMLAttributes<HTMLSpanElement> & {
  /** Icon tone. `destructive` renders the icon in the destructive color. */
  variant?: 'default' | 'destructive';
};

const DialogTitleRow = ({
  className,
  children,
  variant = 'default',
  ...props
}: DialogTitleRowProps) => (
  <span
    className={cn(
      overlayTitleRowBaseClassName,
      variant === 'destructive'
        ? '[&_svg]:text-destructive'
        : '[&_svg]:text-primary',
      className,
    )}
    {...props}
  >
    {children}
  </span>
);
DialogTitleRow.displayName = 'DialogTitleRow';

const DialogDescription: React.FC<
  React.ComponentPropsWithRef<typeof DialogPrimitive.Description>
> = ({ className, ...props }) => (
  <DialogPrimitive.Description
    className={cn('text-muted-foreground text-sm', className)}
    {...props}
  />
);
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  useAppFrameCoverStyle,
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogTitleRow,
  DialogDescription,
  overlayTitleClassName,
  overlayTitleRowClassName,
};
