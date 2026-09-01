import { HeaderActivityButton } from "@/components/application-layout/HeaderActivityButton";
import { HeaderFullscreenToggle } from "@/components/application-layout/HeaderFullscreenToggle";
import { HeaderLogoButton } from "@/components/application-layout/HeaderLogoButton";
import { HeaderSettingsButton } from "@/components/application-layout/HeaderSettingsButton";
import { HeaderSidebarToggle } from "@/components/application-layout/HeaderSidebarToggle";
import { FreeThemePopover } from "@/components/application-layout/FreeThemePopover";
import { cn } from "@/lib/utils";

export interface HeaderThemeControlProps {
  orientation?: "horizontal" | "vertical";
  tooltipSide?: "top" | "right" | "bottom" | "left";
}

/**
 * Edition-safe theme trigger for the Free build. Renders the Free appearance
 * popover. Props are accepted for interface parity with the Pro
 * `HeaderThemeControl` (aliased module) even though the current Free popover
 * does not consume them.
 */
export function HeaderThemeControl(_props: HeaderThemeControlProps) {
  return <FreeThemePopover />;
}

interface DisplayModeControlsProps {
  orientation?: "horizontal" | "vertical";
  tooltipSide?: "top" | "right" | "bottom" | "left";
  includeThemeToggle?: boolean;
  includeActivity?: boolean;
  includeSettings?: boolean;
  className?: string;
}

export function DisplayModeControls({
  orientation = "horizontal",
  tooltipSide = "right",
  includeThemeToggle = true,
  includeActivity = true,
  includeSettings = true,
  className,
}: DisplayModeControlsProps) {
  return (
    <div
      className={cn(
        "flex shrink-0 items-center",
        orientation === "vertical" ? "flex-col gap-1" : "flex-row gap-1",
        className,
      )}>
      <HeaderSidebarToggle tooltipSide={tooltipSide} />
      <HeaderLogoButton tooltipSide={tooltipSide} />
      {includeThemeToggle ? (
        <HeaderThemeControl
          orientation={orientation}
          tooltipSide={tooltipSide}
        />
      ) : null}
      <HeaderFullscreenToggle tooltipSide={tooltipSide} />
      {includeActivity ? (
        <HeaderActivityButton tooltipSide={tooltipSide} />
      ) : null}
      {includeSettings ? (
        <HeaderSettingsButton tooltipSide={tooltipSide} />
      ) : null}
    </div>
  );
}

export default DisplayModeControls;
