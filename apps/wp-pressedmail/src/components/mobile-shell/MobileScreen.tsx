"use client";

import * as React from "react";

import { useOptionalBackStack } from "@/hooks/useBackStack";
import { useEdgeSwipe } from "@/hooks/useEdgeSwipe";
import { cn } from "@/lib/utils";

import { useOptionalMobileLayout } from "./MobileLayoutContext";

export interface MobileScreenProps {
  header?: React.ReactNode;
  footer?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
  /** Forward the scroll container ref so screens can drive pull-to-refresh. */
  scrollRef?: React.Ref<HTMLDivElement>;
  /** Force-disable the edge-swipe-back gesture for this screen. */
  disableEdgeSwipeBack?: boolean;
}

/**
 * Full-viewport mobile screen wrapper with sticky header/footer and a
 * momentum-scrolling body. Screens compose MobileScreenHeader into `header`
 * and BottomActionBar into `footer`. Listens for a left-edge drag and pops
 * the back-stack to mimic the OS swipe-back gesture; honours
 * MobileLayoutContext.isDragBackDisabled (set by dirty composers) and the
 * disableEdgeSwipeBack prop.
 */
export function MobileScreen({
  header,
  footer,
  children,
  className,
  scrollRef,
  disableEdgeSwipeBack,
}: MobileScreenProps) {
  const back = useOptionalBackStack();
  const layout = useOptionalMobileLayout();
  const swipeDisabled =
    disableEdgeSwipeBack ||
    !back?.canGoBack ||
    Boolean(layout?.isDragBackDisabled);
  const popRef = React.useRef(back?.pop);
  React.useEffect(() => {
    popRef.current = back?.pop;
  }, [back]);
  const edgeSwipe = useEdgeSwipe({
    edge: "left",
    threshold: 80,
    disabled: swipeDisabled,
    onComplete: () => popRef.current?.(),
  });

  return (
    <div
      data-pm-screen
      onPointerDown={edgeSwipe.onPointerDown}
      onPointerMove={edgeSwipe.onPointerMove}
      onPointerUp={edgeSwipe.onPointerUp}
      onPointerCancel={edgeSwipe.onPointerCancel}
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-background text-foreground",
        back?.canGoBack && "pm-screen-slide-in",
        className,
      )}>
      <a
        href="#pm-screen-content"
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground">
        Skip to content
      </a>
      {header}
      <div
        ref={scrollRef}
        id="pm-screen-content"
        tabIndex={-1}
        data-pm-screen-body
        className={cn(
          "pm-momentum-scroll min-h-0 flex-1 outline-none",
          "pm-safe-pl pm-safe-pr",
          // Clear the compose FAB. MobileTabBar centres it with
          // -translate-y-1/2 on an h-14 button, so it hangs 28px above the bar
          // and floats over whatever is scrolled underneath. Without this the
          // last row of every scrollable screen sits behind it: on Settings the
          // first card of the ADMIN group was half-covered at rest.
          // pb-8 is the 28px overhang plus 4px so the content clears rather
          // than just touches it.
          "pb-8",
        )}>
        {children}
      </div>
      {footer}
    </div>
  );
}

export default MobileScreen;
