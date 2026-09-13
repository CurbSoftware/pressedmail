"use client";

import * as React from "react";
import {
  EmailArchiveIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";

interface SwipeActionsProps {
  children: React.ReactNode;
  mail: EmailMessage;
  onArchive?: () => void;
  onDelete?: () => void;
  disabled?: boolean;
  threshold?: number;
}

type SwipeDirection = "left" | "right" | null;

/**
 * Drag-to-archive / drag-to-delete wrapper for a mail row. The row content is
 * the only hit target at rest: nothing overlays it, so a tap always reaches the
 * row underneath instead of firing a hidden action.
 */
export function SwipeActions({
  children,
  mail,
  onArchive,
  onDelete,
  disabled = false,
  threshold = 80,
}: SwipeActionsProps) {
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [startX, setStartX] = React.useState(0);
  const [currentX, setCurrentX] = React.useState(0);
  const [isDragging, setIsDragging] = React.useState(false);
  const [direction, setDirection] = React.useState<SwipeDirection>(null);
  // A drag that turned out to be a scroll. Archive and delete are destructive
  // and there is no undo in this layout, so a flick down the list must never
  // land on one: once the vertical travel dominates, the gesture is over.
  const scrolling = React.useRef(false);
  const startY = React.useRef(0);

  const offset = isDragging && !scrolling.current ? currentX - startX : 0;
  const absOffset = Math.abs(offset);
  const isOverThreshold = absOffset > threshold;

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled) return;
    const touch = e.touches[0];
    if (!touch) return;

    setStartX(touch.clientX);
    setCurrentX(touch.clientX);
    startY.current = touch.clientY;
    scrolling.current = false;
    setIsDragging(true);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled) return;
    if (!isDragging) return;

    const touch = e.touches[0];
    if (!touch) return;
    if (scrolling.current) return;

    const x = touch.clientX;
    const dx = x - startX;
    const dy = touch.clientY - startY.current;
    // Same rule the shell's edge-swipe uses: vertical travel that beats the
    // horizontal travel (and clears a 24px slop) is a scroll, not a swipe.
    if (Math.abs(dy) > Math.max(24, Math.abs(dx))) {
      scrolling.current = true;
      setDirection(null);
      setCurrentX(startX);
      return;
    }
    setCurrentX(x);

    if (dx > 0) {
      setDirection("right");
    } else if (dx < 0) {
      setDirection("left");
    }
  };

  const handleTouchEnd = () => {
    if (disabled) return;
    if (!isDragging) return;

    if (isOverThreshold && !scrolling.current) {
      if (direction === "left" && onDelete) {
        onDelete();
      } else if (direction === "right" && onArchive) {
        onArchive();
      }
    }

    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
    setDirection(null);
    scrolling.current = false;
    startY.current = 0;
  };

  const handleTouchCancel = () => {
    setIsDragging(false);
    setStartX(0);
    setCurrentX(0);
    setDirection(null);
    scrolling.current = false;
    startY.current = 0;
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (disabled) return;
    setStartX(e.clientX);
    setCurrentX(e.clientX);
    startY.current = e.clientY;
    scrolling.current = false;
    setIsDragging(true);
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (disabled) return;
    if (!isDragging) return;

    const x = e.clientX;
    setCurrentX(x);

    const diff = x - startX;
    if (diff > 0) {
      setDirection("right");
    } else if (diff < 0) {
      setDirection("left");
    }
  };

  const handleMouseUp = () => {
    handleTouchEnd();
  };

  const handleMouseLeave = () => {
    if (isDragging) {
      handleTouchEnd();
    }
  };

  const getActionStyle = (side: "left" | "right") => {
    if (!isDragging) return { opacity: 0 };

    const isActive = direction === side;
    const progress = Math.min(absOffset / threshold, 1);

    return {
      opacity: isActive ? progress : 0,
      transform: isActive ? `scale(${0.8 + progress * 0.2})` : "scale(0.8)",
    };
  };

  return (
    <div
      ref={containerRef}
      // The browser keeps vertical panning; horizontal drags still reach these
      // handlers. Without it the shell's `touch-action: manipulation` leaves
      // the list scrolling and the swipe fighting for the same finger.
      className="relative touch-pan-y overflow-hidden"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchCancel}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseLeave}>
      {/* Left action (archive) */}
      <div
        className={cn(
          "absolute inset-y-0 left-0 flex w-20 items-center justify-center transition-colors",
          isOverThreshold && direction === "right"
            ? "bg-success"
            : "bg-success/70",
        )}
        style={getActionStyle("right")}>
        <EmailArchiveIcon className="h-6 w-6 text-white" />
      </div>

      {/* Right action (delete) */}
      <div
        className={cn(
          "absolute inset-y-0 right-0 flex w-20 items-center justify-center transition-colors",
          isOverThreshold && direction === "left"
            ? "bg-destructive"
            : "bg-destructive/70",
        )}
        style={getActionStyle("left")}>
        <EmailTrashIcon className="h-6 w-6 text-white" />
      </div>

      {/* Content */}
      <div
        className={cn(
          "relative bg-background transition-transform",
          !isDragging && "transition-transform duration-200",
        )}
        style={{
          transform: `translateX(${
            isDragging ? Math.max(-threshold, Math.min(threshold, offset)) : 0
          }px)`,
        }}>
        {children}
      </div>
    </div>
  );
}
