import type { ElementType, ReactNode } from "react";
import { __ } from "@wordpress/i18n";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@kit/ui/plugin";
import {
  InboxHeaderIcon,
  SettingsLinkIcon,
} from "@/components/application-layout/HeaderIconSvgs";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { cn } from "@/lib/utils";

export interface NavigationItemsProps {
  orientation: "vertical" | "horizontal";
  variant: "icons-only" | "icons-with-labels" | "tabs";
  appearance?: "default" | "header";
  tooltipSide?: "top" | "right" | "bottom" | "left";
  showAnalytics?: boolean;
  showSettings?: boolean;
  beforeSettingsSlot?: ReactNode;
  className?: string;
}

interface NavigationItem {
  id: string;
  icon: ElementType;
  label: string;
  path: string;
}

export function NavigationItems({
  orientation,
  variant,
  appearance = "default",
  tooltipSide = "right",
  showSettings = true,
  beforeSettingsSlot,
  className,
}: NavigationItemsProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isHeaderAppearance = appearance === "header";
  const items: NavigationItem[] = [
    {
      id: "inbox",
      icon: InboxHeaderIcon,
      label: __("Inbox", "pressedmail"),
      path: "/inbox",
    },
    ...(showSettings
      ? [
          {
            id: "settings",
            icon: SettingsLinkIcon,
            label: __("Settings", "pressedmail"),
            path: "/settings",
          },
        ]
      : []),
  ];

  const isActive = (item: NavigationItem) =>
    item.path === "/inbox"
      ? location.pathname === "/" || location.pathname === "/inbox"
      : location.pathname === item.path ||
        location.pathname.startsWith(`${item.path}/`);

  if (variant === "tabs") {
    return (
      <nav className={cn("flex items-center", className)}>
        {items.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => navigate(item.path)}
            className={cn(
              "border-b-2 px-3 py-2 text-sm font-medium transition-colors",
              isActive(item)
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}>
            {item.label}
          </button>
        ))}
      </nav>
    );
  }

  return (
    <nav
      className={cn(
        "flex items-center gap-1",
        orientation === "vertical" ? "flex-col" : "flex-row",
        className,
      )}>
      {items.map((item) => {
        const Icon = item.icon;
        const button = (
          <PressedTooltip key={item.id} content={item.label} side={tooltipSide}>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                variant === "icons-with-labels"
                  ? "h-11 w-11 flex flex-col items-center gap-0.5 rounded-lg"
                  : isHeaderAppearance
                    ? "h-8 w-8 rounded-md"
                    : "h-11 w-11 rounded-md",
                isActive(item)
                  ? isHeaderAppearance
                    ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                    : "bg-primary/10 text-primary"
                  : "text-muted-foreground hover:text-foreground",
              )}
              onClick={() => navigate(item.path)}
              data-test={`nav-${item.id}`}
              aria-label={item.label}>
              <Icon
                className={
                  variant === "icons-with-labels"
                    ? "h-4 w-4"
                    : isHeaderAppearance
                      ? "h-5 w-5"
                      : "size-7"
                }
              />
              {variant === "icons-with-labels" ? (
                <span className="text-[10px] font-medium leading-none">
                  {item.label}
                </span>
              ) : null}
            </Button>
          </PressedTooltip>
        );

        return item.id === "settings" && beforeSettingsSlot ? (
          <span key={item.id} className="contents">
            {beforeSettingsSlot}
            {button}
          </span>
        ) : (
          button
        );
      })}
    </nav>
  );
}

export default NavigationItems;
