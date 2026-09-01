'use client';

/**
 * Plugin-specific DropdownMenu Component
 *
 * This component wraps the standard shadcn DropdownMenu to ensure that theme CSS
 * variables are properly applied to portal content.
 */
import * as React from 'react';

import {
  CheckIcon,
  ChevronRightIcon,
  DotFilledIcon,
} from '@radix-ui/react-icons';
import { DropdownMenu as DropdownMenuPrimitive } from 'radix-ui';

import { cn } from '../lib/utils';
import { useThemeClass } from './hooks/use-theme-class';

const DropdownMenu = DropdownMenuPrimitive.Root;

/**
 * Default chrome for a trigger this component renders itself.
 *
 * NOT applied under `asChild`, see the same constant in popover.tsx for the
 * mechanism. Short version: `cn()` tailwind-merges this against the trigger's
 * OWN className, but Radix's Slot merges the child's in by concatenation, so
 * the conflict is never resolved and stylesheet order decides. `.h-9` is
 * emitted late, so it beat every child that asked to be shorter, and
 * `rounded-md` beat `rounded-full` on the mobile overflow button.
 */
const TRIGGER_CHROME =
  'bg-card text-foreground hover:bg-card focus-visible:border-ring focus-visible:ring-ring/30 h-9 rounded-md transition-[border-color,box-shadow,color,background-color] outline-none focus-visible:ring-[2px]';

const DropdownMenuTrigger: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Trigger>
> = ({ className, asChild, ...props }) => (
  <DropdownMenuPrimitive.Trigger
    asChild={asChild}
    className={asChild ? className : cn(TRIGGER_CHROME, className)}
    {...props}
  />
);
DropdownMenuTrigger.displayName = DropdownMenuPrimitive.Trigger.displayName;
const DropdownMenuGroup = DropdownMenuPrimitive.Group;
const DropdownMenuPortal = DropdownMenuPrimitive.Portal;
const DropdownMenuSub = DropdownMenuPrimitive.Sub;
const DropdownMenuRadioGroup = DropdownMenuPrimitive.RadioGroup;

const DropdownMenuSubTrigger: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.SubTrigger> & {
    inset?: boolean;
  }
> = ({ className, inset, children, asChild, ...props }) => (
  <DropdownMenuPrimitive.SubTrigger
    asChild={asChild}
    // Same rule as DropdownMenuTrigger: never dress an element supplied by the
    // caller, because Slot concatenates rather than merges the two class
    // strings. No asChild call site exists today; this keeps it from becoming
    // the next 36px surprise.
    className={
      asChild
        ? className
        : cn(
            'focus:bg-accent data-[state=open]:bg-accent text-foreground flex cursor-default items-center rounded-xs px-2 py-1.5 text-sm outline-hidden select-none',
            inset && 'pl-8',
            className,
          )
    }
    {...props}
  >
    {children}
    <ChevronRightIcon className="ml-auto h-4 w-4" />
  </DropdownMenuPrimitive.SubTrigger>
);
DropdownMenuSubTrigger.displayName =
  DropdownMenuPrimitive.SubTrigger.displayName;

const DropdownMenuSubContent: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.SubContent>
> = ({ className, ...props }) => {
  const { themeClass, isDark, style } = useThemeClass();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const subContent = (
    <div className={themeClass} data-pm-portal style={style}>
      <DropdownMenuPrimitive.SubContent
        className={cn(
          'bg-popover text-popover-foreground data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 border-border z-[200] max-h-[min(var(--radix-dropdown-menu-content-available-height),80vh)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-lg',
          className,
        )}
        {...props}
      />
    </div>
  );

  return <div className={isDark ? 'dark' : undefined}>{subContent}</div>;
};
DropdownMenuSubContent.displayName =
  DropdownMenuPrimitive.SubContent.displayName;

const DropdownMenuContent: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Content>
> = ({ className, sideOffset = 4, ...props }) => {
  const { themeClass, isDark, style } = useThemeClass();

  // Dark mode CSS uses `.dark .theme-class` selector, so we need nested wrappers
  const menuContent = (
    <div className={themeClass} data-pm-portal style={style}>
      <DropdownMenuPrimitive.Content
        sideOffset={sideOffset}
        className={cn(
          'bg-popover text-popover-foreground border-border z-[200] max-h-[min(var(--radix-dropdown-menu-content-available-height),80vh)] min-w-[8rem] overflow-x-hidden overflow-y-auto rounded-md border p-1 shadow-lg',
          'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
          className,
        )}
        {...props}
      />
    </div>
  );

  return (
    <DropdownMenuPrimitive.Portal>
      {/* Outer wrapper for dark mode - CSS uses `.dark .theme-class` selector */}
      <div className={isDark ? 'dark' : undefined}>{menuContent}</div>
    </DropdownMenuPrimitive.Portal>
  );
};
DropdownMenuContent.displayName = DropdownMenuPrimitive.Content.displayName;

const DropdownMenuItem: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Item> & {
    inset?: boolean;
  }
> = ({ className, inset, ...props }) => (
  <DropdownMenuPrimitive.Item
    className={cn(
      'focus:bg-accent focus:text-accent-foreground text-foreground relative flex cursor-default items-center rounded-xs px-2 py-1.5 text-sm outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
);
DropdownMenuItem.displayName = DropdownMenuPrimitive.Item.displayName;

const DropdownMenuCheckboxItem: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.CheckboxItem>
> = ({ className, children, checked, ...props }) => (
  <DropdownMenuPrimitive.CheckboxItem
    className={cn(
      'focus:bg-accent focus:text-accent-foreground text-foreground relative flex cursor-default items-center rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    checked={checked}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <CheckIcon className="h-4 w-4" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.CheckboxItem>
);
DropdownMenuCheckboxItem.displayName =
  DropdownMenuPrimitive.CheckboxItem.displayName;

const DropdownMenuRadioItem: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.RadioItem>
> = ({ className, children, ...props }) => (
  <DropdownMenuPrimitive.RadioItem
    className={cn(
      'focus:bg-accent focus:text-accent-foreground text-foreground relative flex cursor-default items-center rounded-xs py-1.5 pr-2 pl-8 text-sm outline-hidden transition-colors select-none data-disabled:pointer-events-none data-disabled:opacity-50',
      className,
    )}
    {...props}
  >
    <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
      <DropdownMenuPrimitive.ItemIndicator>
        <DotFilledIcon className="h-4 w-4 fill-current" />
      </DropdownMenuPrimitive.ItemIndicator>
    </span>
    {children}
  </DropdownMenuPrimitive.RadioItem>
);
DropdownMenuRadioItem.displayName = DropdownMenuPrimitive.RadioItem.displayName;

const DropdownMenuLabel: React.FC<
  React.ComponentPropsWithRef<typeof DropdownMenuPrimitive.Label> & {
    inset?: boolean;
  }
> = ({ className, inset, ...props }) => (
  <DropdownMenuPrimitive.Label
    className={cn(
      'text-foreground px-2 py-1.5 text-sm font-semibold',
      inset && 'pl-8',
      className,
    )}
    {...props}
  />
);
DropdownMenuLabel.displayName = DropdownMenuPrimitive.Label.displayName;

const DropdownMenuSeparator: React.FC<
  React.ComponentPropsWithoutRef<typeof DropdownMenuPrimitive.Separator>
> = ({ className, ...props }) => (
  <DropdownMenuPrimitive.Separator
    className={cn('bg-muted -mx-1 my-1 h-px', className)}
    {...props}
  />
);
DropdownMenuSeparator.displayName = DropdownMenuPrimitive.Separator.displayName;

const DropdownMenuShortcut = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLSpanElement>) => {
  return (
    <span
      className={cn(
        'text-muted-foreground ml-auto text-xs tracking-widest opacity-60',
        className,
      )}
      {...props}
    />
  );
};
DropdownMenuShortcut.displayName = 'DropdownMenuShortcut';

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuRadioGroup,
};
