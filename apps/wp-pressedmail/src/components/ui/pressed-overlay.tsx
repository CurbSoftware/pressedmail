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
  "max-sm:[&>button.absolute]:top-0.5 max-sm:[&>button.absolute]:end-0.5 max-sm:[&>button.absolute]:flex max-sm:[&>button.absolute]:size-11 max-sm:[&>button.absolute]:items-center max-sm:[&>button.absolute]:justify-center";

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
  /**
   * Dialog header only: controls that belong to what the dialog shows, such as a
   * viewer's zoom. They sit on the title's row, so the dialog has one header and
   * not a header and a toolbar under it. They wrap below the title when the row
   * is too narrow.
   */
  actions?: ReactNode;
  /** Dialog header only: the padding of a bar, for a dialog that wants its room for content. */
  compact?: boolean;
};

export function PressedDialogHeader(props: HeaderProps) {
  const Icon = props.icon;
  const text = (
    <>
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
    </>
  );

  return (
    <DialogHeader
      data-pm-overlay-section="header"
      // The end padding keeps a title that wraps clear of the close button,
      // which is 44 px wide on a touch screen. A compact dialog hides that
      // button, so it keeps its bar padding.
      className={cn(
        "border-b border-border",
        props.compact ? "px-4 py-2" : "py-5 ps-6 pe-14",
      )}>
      {props.actions ? (
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          {/* The same stack the header has without actions: title over description. */}
          <div className="flex min-w-0 flex-1 basis-48 flex-col space-y-1.5">
            {text}
          </div>
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-x-2 gap-y-1">
            {props.actions}
          </div>
        </div>
      ) : (
        text
      )}
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

/**
 * The body's padding is published as --pm-dialog-pad-x and --pm-dialog-pad-y,
 * because companion footers reach through it to the dialog's edges: the
 * SDK's DialogActions and the host's own slot skeleton. They are part of the
 * companion contract (COMPANION_CSS_VARIABLES in
 * packages/pressedmail-companion/src/contract.ts): change the values here
 * freely, never the names.
 */
export function PressedOverlayBody(props: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      data-pm-overlay-section="body"
      className={cn(
        "[--pm-dialog-pad-x:--spacing(6)] [--pm-dialog-pad-y:--spacing(5)] px-(--pm-dialog-pad-x) py-(--pm-dialog-pad-y)",
        props.className,
      )}
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
