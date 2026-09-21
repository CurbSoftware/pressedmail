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
    <DialogHeader className="border-b border-border px-6 py-5">
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
    <AlertDialogHeader className="border-b border-border px-6 py-5">
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
    <div className="border-b border-border px-6 py-5">
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
        "flex flex-col-reverse gap-2 border-t border-border px-6 py-4 sm:flex-row sm:justify-end",
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
