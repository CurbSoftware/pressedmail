"use client";

import * as React from "react";

import { cn } from "@/lib/utils";

// Shared inbox ribbon button + style constants. Used by the free action bars
// (BulkActionBar, EmailActionBar, ReadingPaneMoreMenu, VerticalRibbonAction,
// PhishingSafetyButton) as well as the Pro "pressedout" layout, so it lives in
// a shared location rather than inside a Pro layout variant. The PRESSED_OUT_*
// export names are retained for import stability.

export const PRESSED_OUT_RIBBON_BUTTON_CLASS =
  "h-[52px] w-16 shrink-0 rounded-md border border-transparent bg-transparent px-1 py-1 inline-flex flex-col items-center justify-center gap-0.5 text-center transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40 disabled:pointer-events-none disabled:opacity-40 disabled:text-muted-foreground data-[disabled=true]:pointer-events-none data-[disabled=true]:opacity-40 data-[disabled=true]:text-muted-foreground";

export const PRESSED_OUT_RIBBON_ICON_CLASS = "size-4 shrink-0";

export const PRESSED_OUT_RIBBON_LABEL_CLASS =
  "max-w-full truncate text-center text-[11px] leading-tight";

export interface PressedOutRibbonButtonProps extends Omit<
  React.ComponentPropsWithoutRef<"button">,
  "children"
> {
  label: string;
  icon?: React.ReactNode;
  ariaLabel?: string;
  dataTest?: string;
}

export const PressedOutRibbonButton = React.forwardRef<
  HTMLButtonElement,
  PressedOutRibbonButtonProps
>(function PressedOutRibbonButton(
  { label, icon, ariaLabel, dataTest, className, disabled, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type="button"
      aria-label={ariaLabel ?? label}
      data-test={dataTest}
      data-testid={dataTest}
      data-disabled={disabled ? "true" : undefined}
      disabled={disabled}
      className={cn(
        PRESSED_OUT_RIBBON_BUTTON_CLASS,
        className,
        "h-[52px] w-16 flex-col items-center justify-center text-center",
      )}
      {...props}>
      {icon && (
        <span className="flex h-5 items-center justify-center">{icon}</span>
      )}
      <span className={PRESSED_OUT_RIBBON_LABEL_CLASS}>{label}</span>
    </button>
  );
});

export default PressedOutRibbonButton;
