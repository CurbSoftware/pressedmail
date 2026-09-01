"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

export interface PullToRefreshProps {
  onRefresh: () => Promise<unknown> | void;
  threshold?: number;
  /** Resistance factor: indicator follows finger by 1/resistance to feel rubbery. */
  resistance?: number;
  disabled?: boolean;
  className?: string;
  children: React.ReactNode;
}

interface DragState {
  startY: number;
  active: boolean;
}

/**
 * Drag-to-refresh container. Activates only when the inner scroll container
 * is at the top (scrollTop === 0) at gesture start. Distances are dampened by
 * `resistance` so the indicator feels rubbery rather than 1:1.
 */
export function PullToRefresh({
  onRefresh,
  threshold = 80,
  resistance = 2.2,
  disabled = false,
  className,
  children,
}: PullToRefreshProps) {
  const rootRef = React.useRef<HTMLDivElement>(null);
  const state = React.useRef<DragState>({ startY: 0, active: false });
  const [pull, setPull] = React.useState(0);
  const [refreshing, setRefreshing] = React.useState(false);

  const fire = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh]);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (disabled || refreshing) return;
    // The real scroller is MobileScreen's body; this component no longer owns
    // one. Fall back to self so a standalone usage still behaves.
    const root =
      rootRef.current?.closest("[data-pm-screen-body]") ?? rootRef.current;
    if (!root || root.scrollTop > 0) {
      state.current = { startY: 0, active: false };
      return;
    }
    state.current = { startY: event.clientY, active: true };
  };

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!state.current.active) return;
    const dy = event.clientY - state.current.startY;
    if (dy <= 0) {
      setPull(0);
      return;
    }
    setPull(dy / resistance);
  };

  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!state.current.active) return;
    const dy = event.clientY - state.current.startY;
    state.current = { startY: 0, active: false };
    if (dy / resistance >= threshold / resistance && dy >= threshold) {
      void fire();
    } else {
      setPull(0);
    }
  };

  return (
    <div
      ref={rootRef}
      data-pm-pull-to-refresh
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      className={cn(
        // NOT a scroller. This used to be `pm-momentum-scroll h-full
        // overflow-y-auto`, which nested a second scroll container inside
        // MobileScreen's own scroll body. Two consequences: the screen body's
        // bottom padding never applied to the inbox, so the last row sat under
        // the compose FAB, and pm-momentum-scroll sets
        // overscroll-behavior: contain, so scrolling could not chain out to the
        // parent and this element's final pixels were simply unreachable.
        // Pull-to-refresh only needs to read scrollTop, which it now does from
        // the real scroller.
        "relative w-full",
        className,
      )}>
      {(pull > 0 || refreshing) && (
        <div
          data-pm-pull-indicator
          className="pointer-events-none absolute inset-x-0 top-0 z-10 flex items-center justify-center text-muted-foreground"
          style={{ height: refreshing ? threshold : pull }}>
          <RefreshCw
            className={cn("h-5 w-5", refreshing && "animate-spin")}
            aria-hidden="true"
          />
        </div>
      )}
      <div
        style={{ transform: `translateY(${refreshing ? threshold : pull}px)` }}>
        {children}
      </div>
    </div>
  );
}

export default PullToRefresh;
