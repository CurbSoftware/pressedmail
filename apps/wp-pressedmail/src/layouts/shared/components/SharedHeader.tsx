"use client";

/**
 * Shared Header Component
 *
 * Communal header used by all three layouts (Default, PressedG, PressedOut).
 * Search-first header with account selector, inline search, and the three
 * right-side control clusters:
 *
 *   [AccountSelector] [Search] [beforeControlsSlot?] |
 *   nav (Inbox [+Contacts+Calendar Pro]) |
 *   utility (Notifications, Activity Log, Settings, Themes) |
 *   display (Expand Sidebar, Immersive, Fullscreen)
 *
 * Account new-mail watermarks stay hoisted for the account selector; the bell
 * receives the separate persisted notification feed.
 *
 * @since 3.1.0
 */

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { HeaderAccountSelector } from "@/components/application-layout/HeaderAccountSelector";
import {
  DisplayModeControls,
  HeaderThemeControl,
} from "@/components/application-layout/DisplayModeControls";
import { HeaderActivityButton } from "@/components/application-layout/HeaderActivityButton";
import { HeaderSettingsButton } from "@/components/application-layout/HeaderSettingsButton";
import { HeaderNotificationsButton } from "@/components/application-layout/HeaderNotificationsButton";
import { HeaderSearchInput } from "@/components/search";
import { NavigationItems } from "@/layouts/shared/components/NavigationItems";
import { useAccountNotifications } from "@/layouts/shared/hooks/useAccountNotifications";
import { useNotificationFeed } from "@/layouts/shared/hooks/useNotificationFeed";

export interface SharedHeaderProps {
  /** Optional override for the account selector. */
  accountSelectorSlot?: ReactNode;
  /** Optional override for the search area. Defaults to HeaderSearchInput. */
  searchSlot?: ReactNode;
  /** Content rendered before the nav cluster on the right (e.g. PressedOut
   *  folders control on narrow widths) with its own trailing separator. */
  beforeControlsSlot?: ReactNode;
  /** Use compact flower menu size */
  compact?: boolean;
  /** Additional CSS classes */
  className?: string;
}

function Separator() {
  return <div className="mx-2 h-6 w-px shrink-0 bg-border" />;
}

export function SharedHeader({
  accountSelectorSlot,
  searchSlot,
  beforeControlsSlot,
  compact = false,
  className,
}: SharedHeaderProps) {
  const resolvedSearchSlot = searchSlot ?? <HeaderSearchInput />;

  const { getNewCount } = useAccountNotifications();
  const notificationFeed = useNotificationFeed();

  return (
    <header
      className={cn(
        "flex items-center gap-3 border-b bg-background px-3 shrink-0",
        compact ? "h-11" : "h-14",
        className,
      )}>
      {/* Account Selector */}
      <div className="min-w-[11.75rem] shrink-0 md:min-w-[15.75rem] lg:min-w-[19.75rem]">
        {accountSelectorSlot ?? (
          <HeaderAccountSelector getNewCount={getNewCount} />
        )}
      </div>

      {/* Search Slot */}
      <div className="min-w-48 flex-1 md:max-w-2xl">{resolvedSearchSlot}</div>

      <div
        data-test="header-right-controls"
        data-testid="header-right-controls"
        className="ml-auto flex shrink-0 items-center gap-2">
        {/* Optional layout-specific control with its own separator (PressedOut
            folders on narrow widths). Does not change the three-cluster order. */}
        {beforeControlsSlot && (
          <>
            {beforeControlsSlot}
            <Separator />
          </>
        )}

        {/* Cluster 1: navigation: Inbox (Pro adds Contacts, Calendar). */}
        <div
          data-test="header-navigation-cluster"
          data-testid="header-navigation-cluster"
          className="flex shrink-0 items-center gap-1">
          <NavigationItems
            orientation="horizontal"
            variant="icons-only"
            appearance="header"
            tooltipSide="bottom"
            showAnalytics={false}
            showSettings={false}
            className="flex shrink-0"
          />
        </div>

        <Separator />

        {/* Cluster 2: utility: Notifications, Activity Log, Settings, Themes. */}
        <div
          data-test="header-utility-cluster"
          data-testid="header-utility-cluster"
          className="flex shrink-0 items-center gap-1">
          <HeaderNotificationsButton
            {...notificationFeed}
            tooltipSide="bottom"
          />
          <HeaderActivityButton appearance="control" tooltipSide="bottom" />
          <HeaderSettingsButton tooltipSide="bottom" />
          <HeaderThemeControl orientation="horizontal" tooltipSide="bottom" />
        </div>

        <Separator />

        {/* Cluster 3: display toggles only: Expand Sidebar, Immersive, Fullscreen. */}
        <DisplayModeControls
          orientation="horizontal"
          tooltipSide="bottom"
          includeThemeToggle={false}
          includeActivity={false}
          includeSettings={false}
        />
      </div>
    </header>
  );
}

export default SharedHeader;
