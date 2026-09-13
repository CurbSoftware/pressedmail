"use client";

import * as React from "react";

import { Button } from "@kit/ui/plugin";

import { useIsMobileOrTablet } from "@/hooks/useMobile";

export interface SettingsHeaderActionButtonProps {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  /** Extra classes applied to the desktop (icon + text) button only. */
  className?: string;
  /**
   * Rendered on whichever variant is showing, so a spec addresses the action by
   * one id on both desktop and mobile. Without it these buttons ("Add Account"
   * and "New Signature", the entry point to two whole settings flows) are
   * reachable only by their translated label.
   */
  dataTest?: string;
}

/**
 * A settings header creation action ("Add Account", "New Signature", …).
 *
 * On desktop it is the familiar icon + text Button. On phone/tablet it collapses
 * to a compact icon-only Button so it no longer crowds the centered mobile
 * header title (the action is registered into the mobile settings-detail header
 * via useSettingsHeaderAction). The accessible label is preserved in both modes.
 */
export function SettingsHeaderActionButton({
  icon: Icon,
  label,
  onClick,
  disabled,
  className,
  dataTest,
}: SettingsHeaderActionButtonProps) {
  const isMobile = useIsMobileOrTablet();

  if (isMobile) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={label}
        onClick={onClick}
        disabled={disabled}
        data-test={dataTest}
        data-testid={dataTest}
        className="pm-touch-target h-11 w-11">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </Button>
    );
  }

  return (
    <Button
      type="button"
      onClick={onClick}
      disabled={disabled}
      data-test={dataTest}
      data-testid={dataTest}
      className={className}>
      <Icon className="mr-2 h-4 w-4" aria-hidden="true" />
      {label}
    </Button>
  );
}

export default SettingsHeaderActionButton;
