"use client";

import { __ } from "@wordpress/i18n";
import { Menu } from "lucide-react";

import { useImmersiveMode } from "@/hooks/useImmersiveMode";

/** More-menu control; only the app shell chooses the initial immersive state. */
export function MobileImmersiveToggle() {
  const { isImmersive, toggle } = useImmersiveMode();
  const label = isImmersive
    ? __("Show WordPress menu", "pressedmail")
    : __("Hide WordPress menu", "pressedmail");

  return (
    <button
      type="button"
      onClick={toggle}
      aria-expanded={!isImmersive}
      aria-controls="wpadminbar"
      data-test="mobile-immersive-toggle"
      data-testid="mobile-immersive-toggle"
      className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-xl border border-border bg-card px-3 py-3 text-left text-sm font-medium text-foreground active:bg-muted">
      <Menu className="h-5 w-5" aria-hidden="true" />
      {label}
    </button>
  );
}

export default MobileImmersiveToggle;
