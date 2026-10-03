"use client";

import type { ComponentProps, HTMLAttributes, ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import {
  AlertDialogContent as KitAlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  DialogContent as KitDialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  PopoverContent as KitPopoverContent,
  overlayTitleClassName,
  overlayTitleRowClassName,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";

export type PressedOverlaySize =
  | "menu"
  | "confirmation"
  | "paletteForm"
  | "compactForm"
  | "form"
  | "picker"
  | "workspace";

export const PRESSED_OVERLAY_WIDTH_CLASS_NAMES = {
  // The tiers are named purposes, not rungs: `confirmation` is wider than
  // `paletteForm` because a yes/no prompt has to fit a sentence and a small
  // form does not. `menu` is the one below them all, for a list of choices
  // anchored to a trigger. The tag filter, snooze, schedule and folder menus
  // were between 14rem and 21rem; without this tier they either kept six
  // different widths or jumped to `paletteForm` at 30rem, which is roughly
  // double what a dropdown anchored to a button should be.
  menu: "w-[min(calc(100vw-2rem),18rem)]",
  confirmation: "w-[min(calc(100vw-2rem),36rem)]",
  paletteForm: "w-[min(calc(100vw-2rem),30rem)]",
  compactForm: "w-[min(calc(100vw-2rem),42rem)]",
  form: "w-[min(calc(100vw-2rem),56rem)]",
  picker: "w-[min(calc(100vw-2rem),64rem)]",
  workspace: "w-[min(calc(100vw-2rem),72rem)]",
} as const satisfies Record<PressedOverlaySize, string>;

/**
 * The kit's close X is a bare 16px icon. On phones, grow its hit area to
 * 44px around the same centre (top-4 plus half the icon), so it neither
 * moves nor covers more of the title than it did.
 */
const CLOSE_TOUCH_TARGET =
  "max-sm:[&>button.absolute]:top-0.5 max-sm:[&>button.absolute]:right-0.5 max-sm:[&>button.absolute]:flex max-sm:[&>button.absolute]:size-11 max-sm:[&>button.absolute]:items-center max-sm:[&>button.absolute]:justify-center";

type SizedContentProps<T> = T & {
  size: PressedOverlaySize;
};

export function PressedDialogContent({
  size,
  className,
  ...props
}: SizedContentProps<ComponentProps<typeof KitDialogContent>>) {
  return (
    <KitDialogContent
      {...props}
      data-pm-overlay-size={size}
      className={cn(
        PRESSED_OVERLAY_WIDTH_CLASS_NAMES[size],
        "max-w-none gap-0 overflow-x-hidden overflow-y-auto p-0",
        CLOSE_TOUCH_TARGET,
        className,
      )}
    />
  );
}

export function PressedAlertDialogContent({
  size,
  className,
  ...props
}: SizedContentProps<ComponentProps<typeof KitAlertDialogContent>>) {
  return (
    <KitAlertDialogContent
      {...props}
      data-pm-overlay-size={size}
      className={cn(
        PRESSED_OVERLAY_WIDTH_CLASS_NAMES[size],
        "max-w-none gap-0 overflow-x-hidden overflow-y-auto p-0",
        className,
      )}
    />
  );
}

export function PressedPopoverContent({
  size,
  className,
  ...props
}: SizedContentProps<ComponentProps<typeof KitPopoverContent>>) {
  return (
    <KitPopoverContent
      {...props}
      data-pm-overlay-size={size}
      className={cn(
        PRESSED_OVERLAY_WIDTH_CLASS_NAMES[size],
        "max-w-[min(calc(100vw-2rem),var(--radix-popover-content-available-width))] gap-0 overflow-x-hidden overflow-y-auto p-0",
        className,
      )}
    />
  );
}

type HeaderProps = {
  title: ReactNode;
  icon?: LucideIcon;
  description?: ReactNode;
  descriptionMode?: "visible" | "sr-only";
  tone?: "default" | "destructive";
};

export function PressedDialogHeader(props: HeaderProps) {
  const Icon = props.icon;

  return (
    <DialogHeader
      data-pm-overlay-section="header"
      className="border-b border-border px-6 py-5">
      <DialogTitle>
        <DialogTitleRow variant={props.tone}>
          {Icon ? <Icon aria-hidden="true" /> : null}
          <span>{props.title}</span>
        </DialogTitleRow>
      </DialogTitle>
      {props.description ? (
        <DialogDescription
          className={
            props.descriptionMode === "sr-only" ? "sr-only" : undefined
          }>
          {props.description}
        </DialogDescription>
      ) : null}
    </DialogHeader>
  );
}

export function PressedAlertDialogHeader(props: HeaderProps) {
  const Icon = props.icon;

  return (
    // The kit header centres its text below `sm` while the title row stays
    // start-aligned, so the body sat centred under a left title on phones.
    // Children stay stretched, so an error line in the body is full width.
    <AlertDialogHeader
      data-pm-overlay-section="header"
      className="border-b border-border px-6 py-5 text-start">
      <AlertDialogTitle>
        <AlertDialogTitleRow variant={props.tone}>
          {Icon ? <Icon aria-hidden="true" /> : null}
          <span>{props.title}</span>
        </AlertDialogTitleRow>
      </AlertDialogTitle>
      {props.description ? (
        <AlertDialogDescription
          className={
            props.descriptionMode === "sr-only" ? "sr-only" : undefined
          }>
          {props.description}
        </AlertDialogDescription>
      ) : null}
    </AlertDialogHeader>
  );
}

export function PressedPopoverHeader(props: HeaderProps) {
  const Icon = props.icon;

  return (
    <div
      data-pm-overlay-section="header"
      className="border-b border-border px-6 py-5">
      <h3 className={overlayTitleClassName}>
        <span
          className={cn(
            overlayTitleRowClassName,
            props.tone === "destructive" && "[&_svg]:text-destructive",
          )}>
          {Icon ? <Icon aria-hidden="true" /> : null}
          <span>{props.title}</span>
        </span>
      </h3>
      {props.description ? (
        <p
          className={cn(
            "mt-1.5 text-sm text-muted-foreground",
            props.descriptionMode === "sr-only" && "sr-only",
          )}>
          {props.description}
        </p>
      ) : null}
    </div>
  );
}

export function PressedOverlayBody(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      data-pm-overlay-section="body"
      className={cn("px-6 py-5", props.className)}
    />
  );
}

export function PressedOverlayFooter(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      data-pm-overlay-section="footer"
      className={cn(
        // Pinned to the bottom of a scrolling dialog so its actions stay in
        // reach on short screens.
        "sticky bottom-0 z-10 flex flex-col-reverse gap-2 border-t border-border bg-popover px-6 py-4 sm:flex-row sm:justify-end",
        // A confirm with no body: the header's divider is already there,
        // and a second one right under it drew a 2px line.
        "[[data-pm-overlay-section=header]+&]:border-t-0",
        // Stacked full width on a phone, each button gets a 44px touch height.
        "max-sm:[&>button]:min-h-11",
        props.className,
      )}
    />
  );
}

export function PressedOverlayError(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      role="alert"
      className={cn("text-sm text-destructive", props.className)}
    />
  );
}

/**
 * Scroll a field into view inside the dialog body only. scrollIntoView also
 * scrolled the dialog shell, which pushed the title and close button off a
 * phone screen.
 */
export function revealInBody(target: HTMLElement): void {
  const body = target.closest<HTMLElement>('[data-pm-overlay-section="body"]');
  if (!body) {
    target.scrollIntoView?.({ block: "nearest" });
    return;
  }
  const box = body.getBoundingClientRect();
  const spot = target.getBoundingClientRect();
  const offset = spot.top - box.top - (box.height - spot.height) / 2;
  if (typeof body.scrollBy === "function") body.scrollBy({ top: offset });
  else body.scrollTop += offset;
}
