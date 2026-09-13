"use client";

import * as React from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { NavLink } from "react-router-dom";

import { cn } from "@/lib/utils";

import { useMobileLayout } from "./MobileLayoutContext";

type MobileTabBarIcon = React.ElementType<{
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
}>;

export interface MobileTabItemLink {
  id: string;
  kind?: "link";
  label: string;
  to: string;
  icon: MobileTabBarIcon;
  badge?: number;
}

export interface MobileTabItemAction {
  id: string;
  kind: "action";
  label: string;
  icon: MobileTabBarIcon;
  onAction?: () => void;
  badge?: number;
}

export type MobileTabItem = MobileTabItemLink | MobileTabItemAction;

export interface MobileTabBarCenterAction {
  label: string;
  icon: MobileTabBarIcon;
  onAction: () => void;
}

export interface MobileTabBarProps {
  items: MobileTabItem[];
  centerAction?: MobileTabBarCenterAction;
  className?: string;
}

function Badge({ count }: { count: number }) {
  if (!count || count <= 0) return null;
  const text = count > 99 ? "99+" : String(count);
  return (
    <span
      aria-label={sprintf(
        /* translators: %d: number of unread messages. */
        _n("%d unread", "%d unread", count, "pressedmail"),
        count,
      )}
      className="absolute -top-1 right-3 inline-flex min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-semibold leading-4 text-primary-foreground">
      {text}
    </span>
  );
}

function TabItemContent({
  label,
  Icon,
  badge,
}: {
  label: string;
  Icon: MobileTabBarIcon;
  badge?: number;
}) {
  return (
    <span className="relative flex flex-col items-center gap-0.5">
      <Icon className="h-5 w-5" aria-hidden="true" />
      <span className="text-[11px] font-medium leading-none">{label}</span>
      {badge ? <Badge count={badge} /> : null}
    </span>
  );
}

function renderTab(item: MobileTabItem) {
  const Icon = item.icon;
  if (item.kind === "action") {
    return (
      <button
        key={item.id}
        type="button"
        onClick={item.onAction}
        className="pm-touch-target flex flex-1 flex-col items-center justify-center py-2 text-muted-foreground active:bg-muted">
        <TabItemContent label={item.label} Icon={Icon} badge={item.badge} />
      </button>
    );
  }
  return (
    <NavLink
      key={item.id}
      to={item.to}
      state={{ pmMobileTabRoot: true }}
      className={({ isActive }) =>
        cn(
          "pm-touch-target flex flex-1 flex-col items-center justify-center py-2 active:bg-muted",
          isActive ? "text-primary" : "text-muted-foreground",
        )
      }>
      <TabItemContent label={item.label} Icon={Icon} badge={item.badge} />
    </NavLink>
  );
}

export function MobileTabBar({
  items,
  centerAction,
  className,
}: MobileTabBarProps) {
  const { isTabBarHidden } = useMobileLayout();
  if (isTabBarHidden) return null;

  // Split the tabs into two equal-flex halves with a fixed-width spacer between
  // them. The FAB sits absolutely centered (left-1/2), so a centered spacer is
  // the only reliable way to keep it from overlapping a tab, for both the
  // 2-item (Inbox/More) and 4-item (Inbox/Calendar/Contacts/More) configs the
  // two halves are equal width, so the gap is always dead-centre.
  const split = Math.ceil(items.length / 2);
  const leftItems = centerAction ? items.slice(0, split) : items;
  const rightItems = centerAction ? items.slice(split) : [];

  return (
    <nav
      aria-label={__("Mobile navigation", "pressedmail")}
      data-pm-tab-bar
      className={cn(
        "sticky bottom-0 z-40 flex w-full shrink-0 items-stretch border-t border-border bg-card",
        "pm-safe-pb pm-safe-pl pm-safe-pr pm-no-tap-highlight",
        className,
      )}>
      {centerAction ? (
        <>
          <div className="flex flex-1 items-stretch">
            {leftItems.map(renderTab)}
          </div>
          <span
            data-pm-tab-spacer
            aria-hidden="true"
            className="w-14 shrink-0"
          />
          <div className="flex flex-1 items-stretch">
            {rightItems.map(renderTab)}
          </div>
          <div className="pointer-events-none absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2">
            <button
              type="button"
              aria-label={centerAction.label}
              onClick={centerAction.onAction}
              className="pointer-events-auto pm-no-tap-highlight inline-flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg active:bg-primary/90">
              {React.createElement(centerAction.icon, {
                className: "h-6 w-6",
                "aria-hidden": "true",
              })}
            </button>
          </div>
        </>
      ) : (
        items.map(renderTab)
      )}
    </nav>
  );
}

export default MobileTabBar;
