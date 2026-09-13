'use client';

/**
 * Plugin-specific Select Component
 *
 * This component wraps the standard shadcn Select to ensure that theme CSS
 * variables are properly applied to portal content. Radix portals render
 * outside the main app container, so they don't inherit theme styles.
 */
import * as React from 'react';

import {
  CaretSortIcon,
  CheckIcon,
  ChevronDownIcon,
  ChevronUpIcon,
} from '@radix-ui/react-icons';
import { Select as SelectPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

const Select = SelectPrimitive.Root;
const SelectGroup = SelectPrimitive.Group;
const SelectValue = SelectPrimitive.Value;

const SelectTrigger: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.Trigger>
> = ({ className, children, asChild, ...props }) => (
  <SelectPrimitive.Trigger
    asChild={asChild}
    // Same rule as the popover and dropdown triggers: these defaults describe
    // the box this component draws itself, and must not be concatenated onto a
    // caller's element, where tailwind-merge cannot resolve them.
    className={
      asChild
        ? className
        : cn(
            // The `!` on the touch floor is load-bearing. WordPress core's forms.css
            // sets `min-height:40px` on every text input and select, and it is
            // UNLAYERED: an unlayered normal declaration beats anything in Tailwind's
            // @layer utilities no matter how specific, so a plain `min-h-11` silently
            // resolves to 40px. An important declaration is the one thing that wins.
            // The same rule is why `py-1` computes to zero padding in wp-admin.
            'border-input bg-card text-foreground placeholder:text-muted-foreground/70 hover:bg-card focus-visible:border-ring focus-visible:ring-ring/30 flex h-9 w-full items-center justify-between rounded-md border px-3 py-1 text-sm whitespace-nowrap shadow-2xs transition-[border-color,box-shadow,color,background-color] outline-none focus-visible:ring-[2px] disabled:cursor-not-allowed disabled:opacity-50 max-sm:min-h-11! [&>span]:line-clamp-1',
            className,
          )
    }
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <CaretSortIcon className="h-4 w-4 opacity-50" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
);
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.ScrollUpButton>
> = ({ className, ...props }) => (
  <SelectPrimitive.ScrollUpButton
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronUpIcon />
  </SelectPrimitive.ScrollUpButton>
);
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.ScrollDownButton>
> = ({ className, ...props }) => (
  <SelectPrimitive.ScrollDownButton
    className={cn(
      'flex cursor-default items-center justify-center py-1',
      className,
    )}
    {...props}
  >
    <ChevronDownIcon />
  </SelectPrimitive.ScrollDownButton>
);
SelectScrollDownButton.displayName =
  SelectPrimitive.ScrollDownButton.displayName;

const SelectContent: React.FC<
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content>
> = ({ className, children, position = 'popper', ...props }) => {
  const { themeClass, isDark, style, lang } = useThemeClass();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const selectContent = (
    <div className={themeClass} data-pm-portal lang={lang} style={style}>
      <SelectPrimitive.Content
        className={cn(
          'bg-popover text-popover-foreground border-border data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 relative z-50 max-h-[min(var(--radix-select-content-available-height),80vh)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-lg',
          position === 'popper' &&
            'data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1',
          className,
        )}
        position={position}
        {...props}
      >
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          className={cn(
            position === 'popper' &&
              'h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]',
          )}
        >
          {children}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </div>
  );

  return (
    <SelectPrimitive.Portal>
      {/* Outer wrapper for dark mode - CSS uses `.dark .theme-class` selector */}
      <div className={isDark ? 'dark' : undefined}>{selectContent}</div>
    </SelectPrimitive.Portal>
  );
};
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.Label>
> = ({ className, ...props }) => (
  <SelectPrimitive.Label
    className={cn(
      'text-foreground px-2 py-1.5 text-sm font-semibold',
      className,
    )}
    {...props}
  />
);
SelectLabel.displayName = SelectPrimitive.Label.displayName;

const SelectItem: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.Item>
> = ({ className, children, ...props }) => (
  <SelectPrimitive.Item
    className={cn(
      'focus:bg-accent focus:text-accent-foreground text-foreground relative flex min-h-8 w-full cursor-default items-center rounded-xs py-1.5 pr-8 pl-2 text-sm outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
      <SelectPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4" />
      </SelectPrimitive.ItemIndicator>
    </span>
    <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
  </SelectPrimitive.Item>
);
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator: React.FC<
  React.ComponentPropsWithRef<typeof SelectPrimitive.Separator>
> = ({ className, ...props }) => (
  <SelectPrimitive.Separator
    className={cn('bg-muted -mx-1 my-1 h-px', className)}
    {...props}
  />
);
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
