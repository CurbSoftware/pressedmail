"use client";

import * as React from "react";
import { RefreshCw } from "lucide-react";

import { cn } from "@/lib/utils";

import { isNonTouchPointer } from "./pointerStream";

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
 *
 * Touch is tracked with native touch events on a non-passive listener, not
 * with pointer events. The phone shell sets `touch-action: manipulation`, so
 * the browser takes over vertical panning and fires pointercancel as soon as
 * it does; the pull never reached its threshold and the advertised gesture did
 * nothing on a real phone while passing with a desktop mouse and in jsdom.
 * Touch events keep firing through a pan, and preventDefault on the move (only
 * once the gesture is genuinely a downward pull from the top) stops the
 * browser from scrolling underneath it. React attaches touchmove passively at
 * the root, where preventDefault is a no-op, which is why the listener is
 * registered by hand.
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
  // Read by the native listeners, which are attached once and must not close
  // over a stale render.
  const live = React.useRef({ disabled, refreshing, threshold, resistance });
  live.current = { disabled, refreshing, threshold, resistance };

  const fire = React.useCallback(async () => {
    setRefreshing(true);
    try {
      await onRefresh();
    } finally {
      setRefreshing(false);
      setPull(0);
    }
  }, [onRefresh]);
  const fireRef = React.useRef(fire);
  fireRef.current = fire;

  const atTop = React.useCallback((): boolean => {
    // The real scroller is MobileScreen's body; this component no longer owns
    // one. Fall back to self so a standalone usage still behaves.
    const root =
      rootRef.current?.closest("[data-pm-screen-body]") ?? rootRef.current;
    return Boolean(root) && (root as Element).scrollTop <= 0;
  }, []);

  const begin = React.useCallback(
    (clientY: number) => {
      if (live.current.disabled || live.current.refreshing) return;
      if (!atTop()) {
        state.current = { startY: 0, active: false };
        return;
      }
      state.current = { startY: clientY, active: true };
    },
    [atTop],
  );

  const move = React.useCallback((clientY: number): boolean => {
    if (!state.current.active) return false;
    const dy = clientY - state.current.startY;
    if (dy <= 0) {
      setPull(0);
      return false;
    }
    setPull(dy / live.current.resistance);
    return true;
  }, []);

  const end = React.useCallback((clientY: number) => {
    if (!state.current.active) return;
    const dy = clientY - state.current.startY;
    state.current = { startY: 0, active: false };
    if (dy >= live.current.threshold) {
      void fireRef.current();
    } else {
      setPull(0);
    }
  }, []);

  React.useEffect(() => {
    const node = rootRef.current;
    if (!node) return;

    const onTouchStart = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      begin(touch.clientY);
    };
    const onTouchMove = (event: TouchEvent) => {
      const touch = event.touches[0];
      if (!touch) return;
      // Only claim the gesture once it is a real downward pull from the top;
      // anything else stays a normal scroll.
      if (move(touch.clientY) && event.cancelable) {
        event.preventDefault();
      }
    };
    const onTouchEnd = (event: TouchEvent) => {
      const touch = event.changedTouches[0] ?? event.touches[0];
      end(touch?.clientY ?? 0);
    };
    const onTouchCancel = () => {
      state.current = { startY: 0, active: false };
      setPull(0);
    };

    node.addEventListener("touchstart", onTouchStart, { passive: true });
    node.addEventListener("touchmove", onTouchMove, { passive: false });
    node.addEventListener("touchend", onTouchEnd);
    node.addEventListener("touchcancel", onTouchCancel);
    return () => {
      node.removeEventListener("touchstart", onTouchStart);
      node.removeEventListener("touchmove", onTouchMove);
      node.removeEventListener("touchend", onTouchEnd);
      node.removeEventListener("touchcancel", onTouchCancel);
    };
  }, [begin, end, move]);

  return (
    <div
      ref={rootRef}
      data-pm-pull-to-refresh
      onPointerDown={(event) =>
        isNonTouchPointer(event) && begin(event.clientY)
      }
      onPointerMove={(event) => isNonTouchPointer(event) && move(event.clientY)}
      onPointerUp={(event) => isNonTouchPointer(event) && end(event.clientY)}
      onPointerCancel={(event) => {
        // Only touchcancel may abort the touch stream's pull.
        if (!isNonTouchPointer(event)) return;
        state.current = { startY: 0, active: false };
        setPull(0);
      }}
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
