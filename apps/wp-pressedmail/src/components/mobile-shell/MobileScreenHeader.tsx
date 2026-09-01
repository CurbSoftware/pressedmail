"use client";

import * as React from "react";
import { ChevronLeft } from "lucide-react";

import { useOptionalBackStack, type BackStackApi } from "@/hooks/useBackStack";
import { cn } from "@/lib/utils";

import { MobileImmersiveToggle } from "./MobileImmersiveToggle";
import { useOptionalMobileLayout } from "./MobileLayoutContext";

/**
 * Fallback back-stack for when the header renders outside a BackStackProvider
 * (e.g. a dedicated mobile route shown on a desktop/tablet-wide viewport, or on
 * resize before the phone shell mounts). No depth → no Back button, no throw.
 */
const NO_BACK_STACK: BackStackApi = {
  depth: 0,
  canGoBack: false,
  push: () => {},
  pop: () => {},
  setCurrentTitle: () => {},
  previousTitle: undefined,
  currentTitle: undefined,
};

export type MobileScreenHeaderVariant = "default" | "large" | "search-active";

export interface MobileScreenHeaderProps {
  title: string;
  /** Custom leading slot. When omitted and back-stack has depth, a back button is shown. */
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  variant?: MobileScreenHeaderVariant;
  className?: string;
  /** Hide the back button even when canGoBack is true. */
  hideBack?: boolean;
  /**
   * Action-page Cancel. When set, a Cancel control renders in the leading group
   * *after* the auto Back button (the two coexist), letting compose/edit screens
   * offer Back (pop one level) AND Cancel (exit the whole flow / discard).
   */
  onCancel?: () => void;
  /** Overrides the automatic back-stack pop when the screen must guard Back. */
  onBack?: () => void;
  /** Label for the Cancel control (default "Cancel"). */
  cancelLabel?: string;
  /** Inject a back-stack stub (used by tests). Defaults to the surrounding
   * BackStackProvider, or a no-op stack when none is mounted. */
  backStackApi?: BackStackApi;
}

export function MobileScreenHeader({
  title,
  leading,
  trailing,
  variant = "default",
  className,
  hideBack = false,
  onCancel,
  onBack,
  cancelLabel = "Cancel",
  backStackApi,
}: MobileScreenHeaderProps) {
  const ctxBack = useOptionalBackStack();
  const back = backStackApi ?? ctxBack ?? NO_BACK_STACK;
  // Screens that hide the tab bar (reader, compose, settings detail, ...) have
  // no other way out, so they keep a Back control even when they were opened
  // cold and the trail is empty. pop() falls back to the inbox in that case.
  const isTabBarHidden = useOptionalMobileLayout()?.isTabBarHidden ?? false;
  const hasBackStack = Boolean(backStackApi ?? ctxBack);
  const showBack =
    !hideBack && !leading && hasBackStack && (back.canGoBack || isTabBarHidden);
  const backLabel = back.previousTitle
    ? `Back to ${back.previousTitle}`
    : "Back";

  const isLarge = variant === "large";
  const headerHeight = isLarge ? "h-24" : "h-14";

  return (
    <header
      data-pm-screen-header
      data-variant={variant}
      className={cn(
        "relative sticky top-0 z-30 flex w-full items-center gap-2 border-b border-border bg-card px-3",
        "pm-safe-pt pm-safe-pl pm-safe-pr",
        headerHeight,
        className,
      )}>
      {/* Leading group: natural width, above the center layer. Holds the menu /
          auto Back, plus an optional Cancel for action pages. */}
      <div className="relative z-10 flex shrink-0 items-center gap-1">
        {leading ??
          (showBack ? (
            <button
              type="button"
              aria-label={backLabel}
              onClick={onBack ?? back.pop}
              className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground hover:bg-muted active:bg-muted">
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          ) : null)}
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full px-3 text-sm font-medium text-muted-foreground active:bg-muted">
            {cancelLabel}
          </button>
        ) : null}
      </div>

      {/* Title. Large variant stays inline + left-aligned (heading style). The
          default variant uses an absolutely-centered layer spanning the header
          so the title is VISUALLY centred regardless of the (differing) left /
          right action-group widths. The layer ignores pointer events so the
          action buttons beneath its transparent edges stay clickable. */}
      {/* The screen title carries the heading role. It is the only thing on a
          mobile screen that names what you are looking at, so without it a
          screen reader user has no landmark to jump to and the shell reads as
          one undifferentiated region. aria-level 2 rather than an <h1>: this
          renders inside wp-admin, which already owns the page's h1. */}
      {isLarge ? (
        <div
          data-variant={variant}
          role="heading"
          aria-level={2}
          className="min-w-0 flex-1 truncate text-left text-2xl font-semibold leading-tight"
          title={title}>
          {title}
        </div>
      ) : (
        <div className="pointer-events-none absolute inset-y-0 left-3 right-3 flex items-center justify-center">
          <div
            data-variant={variant}
            role="heading"
            aria-level={2}
            className="pointer-events-auto max-w-[60%] truncate text-center text-base font-semibold"
            title={title}>
            {title}
          </div>
        </div>
      )}

      {/* Trailing group: natural width, pushed to the right edge, above the
          center layer. The WP admin-bar toggle is always last. */}
      <div className="relative z-10 ml-auto flex shrink-0 items-center justify-end gap-1">
        {trailing}
        <MobileImmersiveToggle />
      </div>
    </header>
  );
}

export default MobileScreenHeader;
