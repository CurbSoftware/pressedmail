import { useState, type CSSProperties } from "react";
import { __ } from "@wordpress/i18n";
import { useNavigate } from "react-router-dom";

import { EmailComposeNewIcon } from "@/components/icons/MailActionIcons";
import {
  InboxHeaderIcon,
  SettingsLinkIcon,
} from "@/components/application-layout/HeaderIconSvgs";
import { PressedMailLaunchIcon } from "@/components/Icons/PressedMailLaunchIcon";
import { useAppContext } from "@/context/AppProvider";
import { usePaneCompose } from "@/context/composer";
import { cn } from "@/lib/utils";
import { FLOATING_NAVIGATION_Z_INDEX } from "@/components/ui/pane-layers";
import type { SpeedDialPosition } from "@/hooks/useUserPreferences";

export interface SpeedDialMenuSizeConfig {
  launcherDiameter: number;
  launcherIconDiameter: number;
  launcherPadding: number;
  itemDiameter: number;
  itemIconDiameter: number;
  itemPadding: number;
  radius: number;
}

export type SpeedDialMenuPaletteTone =
  | "surface"
  | "inverse"
  | "primary"
  | "secondary"
  | "accent";

export interface SpeedDialMenuPaletteConfig {
  launcher: SpeedDialMenuPaletteTone;
  item: SpeedDialMenuPaletteTone;
  activeItem: SpeedDialMenuPaletteTone;
}

type FixedSpeedDialPosition = Exclude<SpeedDialPosition, "off">;
export type SpeedDialMenuPlacement =
  | "inline"
  | `fixed-${FixedSpeedDialPosition}`;

const DEFAULT_SIZE: SpeedDialMenuSizeConfig = {
  launcherDiameter: 48,
  launcherIconDiameter: 36,
  launcherPadding: 6,
  itemDiameter: 40,
  itemIconDiameter: 20,
  itemPadding: 10,
  radius: 140,
};

export const SPEED_DIAL_MENU_SIZE_PRESETS = {
  default: DEFAULT_SIZE,
  header: DEFAULT_SIZE,
  compactHeader: { ...DEFAULT_SIZE, itemDiameter: 38, radius: 130 },
} as const;

export const SPEED_DIAL_MENU_PALETTE_PRESETS = {
  default: { launcher: "inverse", item: "inverse", activeItem: "primary" },
  inversePrimary: {
    launcher: "inverse",
    item: "inverse",
    activeItem: "primary",
  },
  surfacePrimary: {
    launcher: "primary",
    item: "surface",
    activeItem: "primary",
  },
} as const satisfies Record<string, SpeedDialMenuPaletteConfig>;

function placementClasses(placement: SpeedDialMenuPlacement) {
  if (placement === "inline") return "relative";
  const fixed = placement.replace(/^fixed-/, "");
  return cn(
    "fixed",
    fixed.startsWith("top-") &&
      "top-[calc(var(--wp-admin-bar-height,32px)_+_4.75rem)]",
    fixed.startsWith("middle-") && "top-1/2 -translate-y-1/2",
    fixed.startsWith("bottom-") && "bottom-5",
    fixed.endsWith("-left") && "left-5",
    fixed.endsWith("-center") && "left-1/2 -translate-x-1/2",
    fixed.endsWith("-right") && "right-5",
  );
}

interface SpeedDialMenuProps {
  className?: string;
  size?: Partial<SpeedDialMenuSizeConfig>;
  palette?: Partial<SpeedDialMenuPaletteConfig>;
  placement?: SpeedDialMenuPlacement;
}

export function SpeedDialMenu({
  className,
  size,
  placement = "inline",
}: SpeedDialMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const compose = usePaneCompose();
  const { accounts, setIsAddAccount } = useAppContext();
  const resolvedSize = { ...DEFAULT_SIZE, ...size };
  const actions = [
    {
      id: "compose",
      label: __("Compose", "pressedmail"),
      icon: EmailComposeNewIcon,
      run: () => {
        navigate("/inbox");
        if (accounts.length === 0) setIsAddAccount(true);
        else compose?.requestPaneCompose();
      },
    },
    {
      id: "inbox",
      label: __("Inbox", "pressedmail"),
      icon: InboxHeaderIcon,
      run: () => navigate("/inbox"),
    },
    {
      id: "settings",
      label: __("Settings", "pressedmail"),
      icon: SettingsLinkIcon,
      run: () => navigate("/settings"),
    },
  ];

  return (
    <div
      className={cn(placementClasses(placement), className)}
      style={
        {
          zIndex:
            placement === "inline" ? undefined : FLOATING_NAVIGATION_Z_INDEX,
          width: resolvedSize.launcherDiameter,
          minHeight: resolvedSize.launcherDiameter,
        } as CSSProperties
      }>
      {open ? (
        <div className="absolute bottom-full right-0 mb-2 flex flex-col gap-2">
          {actions.map((action) => {
            const Icon = action.icon;
            return (
              <button
                key={action.id}
                type="button"
                title={action.label}
                aria-label={action.label}
                onClick={() => {
                  setOpen(false);
                  action.run();
                }}
                className="flex items-center justify-center rounded-full border bg-background text-foreground shadow-md"
                style={{
                  width: resolvedSize.itemDiameter,
                  height: resolvedSize.itemDiameter,
                }}>
                <Icon
                  style={{
                    width: resolvedSize.itemIconDiameter,
                    height: resolvedSize.itemIconDiameter,
                  }}
                />
              </button>
            );
          })}
        </div>
      ) : null}
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label={__("Navigation menu", "pressedmail")}
        className="flex items-center justify-center rounded-full border bg-primary text-primary-foreground shadow-lg"
        style={{
          width: resolvedSize.launcherDiameter,
          height: resolvedSize.launcherDiameter,
          padding: resolvedSize.launcherPadding,
        }}>
        <PressedMailLaunchIcon
          style={{
            width: resolvedSize.launcherIconDiameter,
            height: resolvedSize.launcherIconDiameter,
          }}
        />
      </button>
    </div>
  );
}

export default SpeedDialMenu;
