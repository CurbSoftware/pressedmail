import type { CSSProperties } from "react";

import { Toaster } from "@kit/ui/plugin";

/**
 * Success gets a tinted surface; everything else stays on the card surface.
 *
 * A confirmation is the one toast the user should be able to read without
 * focusing on it, and a 4px left border was too quiet for that. The tint is
 * `--success`, the same per-theme token the rest of the app now uses, mixed
 * into the popover surface, so it tracks each theme's `statusHues` and stays
 * legible in light and dark.
 *
 * This is deliberately not sonner's built-in rich palette, which ships its own
 * colours and would ignore the active theme. That option stays off, and
 * `ui-standardization.test.ts` asserts this file never opts into it.
 */
const toastSurfaceStyle = {
  "--normal-bg": "var(--popover)",
  "--normal-text": "var(--popover-foreground)",
  "--normal-border": "var(--border)",
  "--success-bg": "color-mix(in oklch, var(--success) 14%, var(--popover))",
  "--success-text": "var(--popover-foreground)",
  "--success-border": "color-mix(in oklch, var(--success) 40%, var(--border))",
  "--info-bg": "var(--popover)",
  "--info-text": "var(--popover-foreground)",
  "--info-border": "var(--border)",
  "--warning-bg": "var(--popover)",
  "--warning-text": "var(--popover-foreground)",
  "--warning-border": "var(--border)",
  "--error-bg": "var(--popover)",
  "--error-text": "var(--popover-foreground)",
  "--error-border": "var(--border)",
  "--border-radius": "calc(var(--radius) + 2px)",
} as CSSProperties;

const toastClassNames = {
  toast:
    "cn-toast border border-border bg-popover text-popover-foreground shadow-lg px-4 py-3 text-sm gap-3",
  title: "text-sm font-medium leading-5",
  description: "text-muted-foreground",
  success: "border-l-4 border-l-success [&_[data-icon]]:text-success",
  info: "border-l-4 border-l-info",
  warning: "border-l-4 border-l-warning",
  error: "border-l-4 border-l-destructive",
  closeButton:
    "border-border bg-popover text-muted-foreground hover:bg-muted hover:text-foreground",
  actionButton: "bg-primary text-primary-foreground hover:bg-primary/90",
  cancelButton: "bg-muted text-foreground hover:bg-muted/80",
};

export function PressedMailToaster() {
  return (
    <Toaster
      position="bottom-center"
      closeButton
      duration={4000}
      visibleToasts={5}
      expand
      className="pressedmail-standard-toaster"
      style={toastSurfaceStyle}
      toastOptions={{
        classNames: toastClassNames,
      }}
    />
  );
}
