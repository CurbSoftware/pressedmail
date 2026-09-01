'use client';

import React from 'react';
import * as ToolbarPrimitive from '@radix-ui/react-toolbar';
import { type VariantProps, cva } from 'class-variance-authority';

import { cn } from '@/lib/utils';
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuSeparator,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/plugin';

export const COMPOSER_TOOLBAR_BUTTON_CLASS =
  'h-7 min-w-7 rounded-md px-1.5 inline-flex items-center justify-center';

export const COMPOSER_TOOLBAR_ICON_CLASS = 'size-4 shrink-0';

export const COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS =
  'h-7 rounded-md px-1.5 inline-flex items-center justify-center gap-1';

export const COMPOSER_TOOLBAR_GROUP_CLASS = 'flex items-center gap-0.5';

export const FONT_SIZE_GROUP_CLASS =
  'inline-flex h-7 items-center rounded-md border border-border bg-card overflow-hidden';

export const FONT_SIZE_STEP_BUTTON_CLASS =
  'h-7 w-7 inline-flex items-center justify-center hover:bg-muted';

export const FONT_SIZE_INPUT_CLASS =
  'h-7 w-12 border-x border-border bg-transparent px-0 text-center text-xs tabular-nums outline-none focus-visible:ring-0';

/* ─── Toolbar Root ─── */

export const Toolbar = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Root>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Root
    ref={ref}
    className={cn(
      'relative flex select-none items-center gap-0.5',
      className,
    )}
    {...props}
  />
));
Toolbar.displayName = 'Toolbar';

/* ─── Toolbar Separator ─── */

export const ToolbarSeparator = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <ToolbarPrimitive.Separator
    ref={ref}
    className={cn('shrink-0 bg-border', 'mx-1 h-4 w-px', className)}
    {...props}
  />
));
ToolbarSeparator.displayName = 'ToolbarSeparator';

/* ─── Toolbar Group ─── */

export function ToolbarGroup({ children, className, ...props }: React.ComponentProps<'div'>) {
  // Note: the upstream registry version hides empty groups via the
  // `has-[button]:flex` arbitrary variant; this app's Tailwind build does
  // not emit that variant, which left every group display:none (invisible
  // toolbar). Our groups always contain buttons, so render them plainly.
  return (
    <div
      className={cn(
        'group/toolbar-group relative',
        COMPOSER_TOOLBAR_GROUP_CLASS,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/* ─── Toolbar Button Variants ─── */

const toolbarButtonVariants = cva(
  cn(
    'inline-flex items-center justify-center rounded-md text-sm font-medium',
    'ring-offset-background transition-colors focus-visible:outline-none',
    'focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
    'disabled:pointer-events-none disabled:opacity-50',
    '[&_svg:not([data-icon])]:size-4',
  ),
  {
    defaultVariants: {
      size: 'default',
      variant: 'default',
    },
    variants: {
      size: {
        default: COMPOSER_TOOLBAR_BUTTON_CLASS,
        icon: 'h-7 w-7 rounded-md inline-flex items-center justify-center',
        sm: 'h-6 w-6 px-0',
        lg: 'h-8 w-8 px-0',
      },
      variant: {
        default: 'bg-transparent hover:bg-muted hover:text-accent-foreground',
        outline:
          'border border-input bg-transparent hover:bg-accent hover:text-accent-foreground',
      },
    },
  },
);

/* ─── Toolbar Button (with built-in tooltip support) ─── */

export const ToolbarButton = React.forwardRef<
  React.ComponentRef<typeof ToolbarPrimitive.Button>,
  React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> &
    VariantProps<typeof toolbarButtonVariants> & {
      pressed?: boolean;
      isDropdown?: boolean;
      tooltip?: string;
    }
>(({
  className,
  children,
  isDropdown,
  pressed,
  size = 'default',
  tooltip,
  variant = 'default',
  ...props
}, ref) => {
  const buttonClassName = cn(
    toolbarButtonVariants({ size, variant }),
    pressed && 'bg-accent text-accent-foreground',
    className,
  );

  const button = (
    <ToolbarPrimitive.Button
      ref={ref as React.Ref<HTMLButtonElement>}
      className={buttonClassName}
      data-state={pressed != null ? (pressed ? 'on' : 'off') : undefined}
      aria-pressed={pressed != null ? pressed : undefined}
      aria-label={tooltip}
      {...(props as React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button>)}
    >
      {children}
      {isDropdown && (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="ml-0.5"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      )}
    </ToolbarPrimitive.Button>
  );

  if (!tooltip) return button;

  return (
    <TooltipProvider delayDuration={300}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent side="bottom" sideOffset={6}>
          {tooltip}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});
ToolbarButton.displayName = 'ToolbarButton';

/* ─── Toolbar Split Button ───
 *
 * Template parity port (plate-playground toolbar.tsx). The upstream version
 * styles the pressed state via the `group-data-[pressed=true]:` arbitrary
 * variant; this app's Tailwind build does not reliably emit data-attribute
 * variants, so the pressed state is passed down as an explicit prop instead.
 */

export function ToolbarSplitButton({
  children,
  className,
  pressed: _pressed,
  ...props
}: React.ComponentPropsWithoutRef<typeof ToolbarPrimitive.Button> & {
  pressed?: boolean;
  tooltip?: string;
}) {
  return (
    <ToolbarPrimitive.Button
      className={cn('group flex items-stretch gap-0 px-0 hover:bg-transparent', className)}
      {...props}
    >
      {children}
    </ToolbarPrimitive.Button>
  );
}

export function ToolbarSplitButtonPrimary({
  children,
  className,
  pressed,
  ...props
}: React.ComponentPropsWithoutRef<'span'> & { pressed?: boolean }) {
  return (
    <span
      className={cn(
        toolbarButtonVariants({ size: 'default', variant: 'default' }),
        'rounded-r-none',
        pressed && 'bg-accent text-accent-foreground',
        className,
      )}
      {...props}
    >
      {children}
    </span>
  );
}

// forwardRef required: used as a DropdownMenuTrigger asChild child, and the
// free build's WP React 18 runtime drops refs on plain function components
// (breaks the dropdown's popper anchor). See forward-ref-contract.test.ts.
export const ToolbarSplitButtonSecondary = React.forwardRef<
  HTMLSpanElement,
  React.ComponentPropsWithoutRef<'span'> & { pressed?: boolean }
>(function ToolbarSplitButtonSecondary({ className, pressed, ...props }, ref) {
  return (
    <span
      ref={ref}
      className={cn(
        'inline-flex h-7 w-4 items-center justify-center rounded-r-md text-sm font-medium text-foreground transition-colors',
        'bg-transparent hover:bg-muted hover:text-muted-foreground',
        'disabled:pointer-events-none disabled:opacity-50',
        pressed && 'bg-accent text-accent-foreground',
        className,
      )}
      onClick={(e) => e.stopPropagation()}
      role="button"
      {...props}
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="12"
        height="12"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="text-muted-foreground"
      >
        <path d="m6 9 6 6 6-6" />
      </svg>
    </span>
  );
});

/* ─── Toolbar Menu Group ───
 *
 * Labelled radio group inside dropdown menus. The upstream registry version
 * hides empty groups via `has-[[role=menuitem]]` variants; this app's build
 * does not emit `has-[...]`, and our menu groups always contain items, so the
 * separator + group render unconditionally.
 */
export function ToolbarMenuGroup({
  children,
  className,
  label,
  ...props
}: React.ComponentProps<typeof DropdownMenuRadioGroup> & { label?: string }) {
  return (
    <>
      <DropdownMenuSeparator className="mb-0 shrink-0" />
      <DropdownMenuRadioGroup {...props} className={cn('my-1.5', className)}>
        {label && (
          <DropdownMenuLabel className="select-none text-xs font-semibold text-muted-foreground">
            {label}
          </DropdownMenuLabel>
        )}
        {children}
      </DropdownMenuRadioGroup>
    </>
  );
}
