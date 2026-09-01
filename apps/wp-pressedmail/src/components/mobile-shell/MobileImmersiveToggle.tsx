"use client";

import { ChevronDown } from "lucide-react";

import { useImmersiveMode } from "@/hooks/useImmersiveMode";
import { cn } from "@/lib/utils";

/**
 * MobileImmersiveToggle - Mobile-only header button that toggles the WP admin bar.
 *
 * Reads and flips the shared immersive state, nothing more. The shell owns the
 * hide-by-default choice (MobileAppShell), because a fresh toggle mounts with
 * every header and re-forcing the default here undid the user's choice on
 * every navigation. Tap to reveal the WP admin bar (icon rotates 180 degrees
 * to point up); tap again to hide it.
 */
export function MobileImmersiveToggle() {
  const { isImmersive, toggle } = useImmersiveMode();
  const label = isImmersive ? "Show WordPress menu" : "Hide WordPress menu";

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={label}
      data-test="mobile-immersive-toggle"
      className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground hover:bg-muted active:bg-muted">
      <ChevronDown
        aria-hidden="true"
        className={cn(
          "h-6 w-6 transition-transform duration-200",
          !isImmersive && "rotate-180",
        )}
      />
    </button>
  );
}

export default MobileImmersiveToggle;
