"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";

import { useOptionalBackStack } from "@/hooks/useBackStack";
import { useEdgeSwipe } from "@/hooks/useEdgeSwipe";
import { cn } from "@/lib/utils";

import { useOptionalMobileLayout } from "./MobileLayoutContext";
import { isNonTouchPointer } from "./pointerStream";

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

  // A phone emits both streams. Its pointercancel must not erase the gesture
  // still tracked by touch events; touchcancel handles an actual interruption.
  const toPointerLike = (event: React.TouchEvent) => {
    const touch = event.changedTouches[0] ?? event.touches[0];
    return {
      clientX: touch?.clientX ?? 0,
      clientY: touch?.clientY ?? 0,
    } as React.PointerEvent;
  };

  const focusContent = (event: React.MouseEvent<HTMLAnchorElement>) => {
    const content = document.getElementById("pm-screen-content");
    if (!content) return;
    event.preventDefault();
    content.focus({ preventScroll: true });
    content.scrollIntoView?.({ block: "start" });
  };

  const tabBarVisible = layout ? !layout.isTabBarHidden : false;

  return (
    <div
      data-pm-screen
      onPointerDown={(event) =>
        isNonTouchPointer(event) && edgeSwipe.onPointerDown(event)
      }
      onPointerMove={(event) =>
        isNonTouchPointer(event) && edgeSwipe.onPointerMove(event)
      }
      onPointerUp={(event) =>
        isNonTouchPointer(event) && edgeSwipe.onPointerUp(event)
      }
      onPointerCancel={(event) =>
        isNonTouchPointer(event) && edgeSwipe.onPointerCancel(event)
      }
      onTouchStart={(event) => edgeSwipe.onPointerDown(toPointerLike(event))}
      onTouchMove={(event) => edgeSwipe.onPointerMove(toPointerLike(event))}
      onTouchEnd={(event) => edgeSwipe.onPointerUp(toPointerLike(event))}
      onTouchCancel={(event) => edgeSwipe.onPointerCancel(toPointerLike(event))}
      className={cn(
        "flex h-full min-h-0 w-full flex-col bg-background text-foreground",
        back?.canGoBack && "pm-screen-slide-in",
        className,
      )}>
      {/* Focus is moved in JS rather than left to the browser: the hash router
          treats any location.hash write as a route, so the bare href alone
          navigated to the inbox instead of skipping the header. The href stays
          for semantics and for the status bar. */}
      <a
        href="#pm-screen-content"
        onClick={focusContent}
        className="sr-only focus-visible:not-sr-only focus-visible:absolute focus-visible:left-3 focus-visible:top-3 focus-visible:z-50 focus-visible:rounded-md focus-visible:bg-primary focus-visible:px-3 focus-visible:py-2 focus-visible:text-sm focus-visible:font-medium focus-visible:text-primary-foreground">
        {__("Skip to content", "pressedmail")}
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
      {/* The footer sits outside the padded scroll body, so the FAB's 28px
          overhang landed straight on top of it: on the inbox the pager's
          previous-page button and its "Showing 1-50 of ..." count were
          physically unreachable. Reserve that strip whenever the tab bar (and
          therefore the FAB) is actually on screen. */}
      {footer ? (
        <div data-pm-screen-footer className={cn(tabBarVisible && "pb-7")}>
          {footer}
        </div>
      ) : null}
    </div>
  );
}

export default MobileScreen;
