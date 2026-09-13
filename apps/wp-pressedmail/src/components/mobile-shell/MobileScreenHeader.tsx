"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { ChevronLeft } from "lucide-react";

import { useOptionalBackStack, type BackStackApi } from "@/hooks/useBackStack";
import { cn } from "@/lib/utils";

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
  /** Keep the heading accessible without a visible title beside dense actions. */
  hideTitle?: boolean;
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
  hideTitle = false,
  onCancel,
  onBack,
  cancelLabel,
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
    ? sprintf(
        /* translators: %s: title of the screen the Back button returns to. */
        __("Back to %s", "pressedmail"),
        back.previousTitle,
      )
    : __("Back", "pressedmail");
  const resolvedCancelLabel = cancelLabel ?? __("Cancel", "pressedmail");

  const isLarge = variant === "large";
  const headerHeight = isLarge ? "h-24" : "h-14";

  return (
    <header
      data-pm-screen-header
      data-variant={variant}
      className={cn(
        // Three columns, not an absolutely-centred title layer over the whole
        // header. The layer centred the title perfectly and then let any
        // trailing action sit straight on top of it: Email Rules registers a
        // "Run rules now" and a "Create Rule" button, and the header rendered
        // as "Run rul[Email Ru]". Every settings screen with unsaved edits
        // (Security, Access Control, Allowed Domains) put Cancel + Save into
        // the same collision. A column the title owns cannot be overlapped;
        // the cost is that the title centres within the space the actions
        // leave, which is what iOS does too.
        "relative sticky top-0 z-30 grid w-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2 border-b border-border bg-card px-3",
        "pm-safe-pt pm-safe-pl pm-safe-pr",
        headerHeight,
        className,
      )}>
      {/* Leading group: holds the menu / auto Back, plus an optional Cancel for
          action pages. */}
      <div className="flex min-w-0 shrink-0 items-center gap-1">
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
            {resolvedCancelLabel}
          </button>
        ) : null}
      </div>

      {/* The screen title carries the heading role. It is the only thing on a
          mobile screen that names what you are looking at, so without it a
          screen reader user has no landmark to jump to and the shell reads as
          one undifferentiated region. aria-level 2 rather than an <h1>: this
          renders inside wp-admin, which already owns the page's h1. */}
      {hideTitle ? (
        <div role="heading" aria-level={2} className="sr-only">
          {title}
        </div>
      ) : (
        <div
          data-variant={variant}
          role="heading"
          aria-level={2}
          className={cn(
            "min-w-0 truncate",
            isLarge
              ? "text-left text-2xl font-semibold leading-tight"
              : "text-center text-base font-semibold",
          )}
          title={title}>
          {title}
        </div>
      )}

      {/* Per-screen actions; the WordPress menu toggle lives in More. */}
      <div className="flex min-w-0 shrink-0 items-center justify-end gap-1">
        {trailing}
      </div>
    </header>
  );
}

export default MobileScreenHeader;
