import { useCallback, useId, useState, type CSSProperties } from "react";
import { __ } from "@wordpress/i18n";
import { Move } from "lucide-react";
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
import {
  parseSpeedDialPosition,
  type SpeedDialPosition,
} from "@/hooks/useUserPreferences";
import { useSpeedDialDrag } from "@/layouts/shared/components/use-speed-dial-drag";

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

interface SpeedDialMenuProps {
  className?: string;
  size?: Partial<SpeedDialMenuSizeConfig>;
  palette?: Partial<SpeedDialMenuPaletteConfig>;
  /** Stored position: a legacy corner token or `<x>,<y>` viewport percentages. */
  position?: SpeedDialPosition;
  /** WordPress admin bar height, which the launcher must stay below. */
  topInset?: number;
  /** Called on drop with the position to store. */
  onPositionChange?: (position: SpeedDialPosition) => void;
}

export function SpeedDialMenu({
  className,
  size,
  position = "bottom-right",
  topInset = 0,
  onPositionChange,
}: SpeedDialMenuProps) {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const compose = usePaneCompose();
  const { accounts, setIsAddAccount } = useAppContext();
  const resolvedSize = { ...DEFAULT_SIZE, ...size };
  const commitPosition = useCallback(
    (next: string) => onPositionChange?.(next as SpeedDialPosition),
    [onPositionChange],
  );
  const { offset, isDragging, handleProps } = useSpeedDialDrag({
    position,
    diameter: resolvedSize.launcherDiameter,
    topInset,
    onCommit: commitPosition,
  });
  const gripHintId = useId();
  const dialPoint = parseSpeedDialPosition(position);
  // The stack opens away from the nearest edge, like the Pro dial's fan.
  const opensUpward = dialPoint.y >= 50;
  const alignsRight = dialPoint.x >= 50;
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
      data-test="pressedmail-speed-dial"
      data-testid="pressedmail-speed-dial"
      className={cn("group/dial fixed shrink-0", className)}
      style={
        {
          zIndex: FLOATING_NAVIGATION_Z_INDEX,
          left: offset.left,
          top: offset.top,
          width: resolvedSize.launcherDiameter,
          minHeight: resolvedSize.launcherDiameter,
        } as CSSProperties
      }>
      {open ? (
        <div
          className={cn(
            "absolute flex flex-col gap-2",
            opensUpward ? "bottom-full mb-2" : "top-full mt-2",
            alignsRight ? "right-0" : "left-0",
          )}>
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

      {/* Drag grip: hover the launcher to reveal it, drag it to move the dial,
          or focus it and press the arrow keys. A real button, so the one way to
          place the launcher without a pointer is focusable and announced rather
          than hidden from assistive tech. */}
      <button
        {...handleProps}
        type="button"
        aria-label={__("Move speed dial", "pressedmail")}
        aria-describedby={gripHintId}
        data-test="speed-dial-drag-handle"
        data-testid="speed-dial-drag-handle"
        className={cn(
          "absolute -top-1 -right-1 z-50 flex size-5 touch-none items-center justify-center rounded-full border bg-background text-muted-foreground shadow-md transition-opacity",
          isDragging
            ? "cursor-grabbing opacity-100"
            : "cursor-grab opacity-0 group-hover/dial:opacity-100 group-focus-within/dial:opacity-100",
        )}>
        <Move className="size-3" aria-hidden="true" />
      </button>
      <span id={gripHintId} className="sr-only">
        {__("Use the arrow keys to move the speed dial.", "pressedmail")}
      </span>
    </div>
  );
}

export default SpeedDialMenu;
