"use client";

/**
 * Free-build theme popover.
 *
 * The pro `HeaderThemeMegaMenu` carries premium palettes, layouts, custom
 * themes, and pro display-preference rows (with lock/upgrade affordances). The
 * Free build intentionally ships only: appearance mode, typography, the two
 * free color themes (default + high-contrast), and speed-dial placement. This
 * component is self-contained and imports none of the pro lock/upgrade
 * machinery, keeping the Free edition boundary clean.
 */
import { __ } from "@wordpress/i18n";
import {
  Check,
  CircleOff,
  LayoutTemplate,
  Monitor,
  Moon,
  MoveDown,
  MoveDownLeft,
  MoveDownRight,
  MoveLeft,
  MoveRight,
  MoveUp,
  MoveUpLeft,
  MoveUpRight,
  Palette,
  Rows3,
  Sun,
  SunMoon,
} from "lucide-react";

import {
  Button,
  cn,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
  Tabs,
  TabsList,
  TabsTrigger,
} from "@kit/ui/plugin";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { ThemePaletteIcon } from "./HeaderIconSvgs";
import { useTheme as useAppearanceTheme } from "@/components/theme-provider";
import { useTheme as useColorTheme } from "@/components/themes/ThemeProvider";
import { useTypographySettings } from "@/hooks/useTypographySettings";
import {
  useUserPreferences,
  type EmailListGroupingPreference,
  type SpeedDialPosition,
} from "@/hooks/useUserPreferences";

type AppearanceThemeOption = "light" | "dark" | "system";

const FREE_THEME_SWATCHES: Array<{
  id: string;
  name: string;
  colors: {
    light: { primary: string; secondary: string; accent: string };
    dark: { primary: string; secondary: string; accent: string };
  };
}> = [
  {
    id: "pressedm",
    name: __("PressedM", "pressedmail"),
    colors: {
      light: { primary: "#0f91b2", secondary: "#3b4f69", accent: "#eef3f7" },
      dark: { primary: "#007696", secondary: "#bfc8cd", accent: "#232f3f" },
    },
  },
  {
    id: "contrast",
    name: __("Contrast", "pressedmail"),
    colors: {
      light: { primary: "#111111", secondary: "#f5f5f5", accent: "#000000" },
      dark: { primary: "#fafafa", secondary: "#1a1a1a", accent: "#ededed" },
    },
  },
];

const GROUPING_OPTIONS: Array<{
  value: EmailListGroupingPreference;
  label: string;
  dataTest: string;
}> = [
  {
    value: "list",
    label: __("List", "pressedmail"),
    dataTest: "inbox-grouping-list",
  },
  {
    value: "threads",
    label: __("Threaded", "pressedmail"),
    dataTest: "inbox-grouping-threads",
  },
];

const SPEED_DIAL_POSITION_OPTIONS: Array<{
  value: SpeedDialPosition;
  label: string;
  icon: typeof MoveUpLeft;
}> = [
  {
    value: "top-left",
    label: __("Top left", "pressedmail"),
    icon: MoveDownRight,
  },
  {
    value: "top-center",
    label: __("Top center", "pressedmail"),
    icon: MoveDown,
  },
  {
    value: "top-right",
    label: __("Top right", "pressedmail"),
    icon: MoveDownLeft,
  },
  {
    value: "middle-left",
    label: __("Middle left", "pressedmail"),
    icon: MoveRight,
  },
  { value: "off", label: __("Off", "pressedmail"), icon: CircleOff },
  {
    value: "middle-right",
    label: __("Middle right", "pressedmail"),
    icon: MoveLeft,
  },
  {
    value: "bottom-left",
    label: __("Bottom left", "pressedmail"),
    icon: MoveUpRight,
  },
  {
    value: "bottom-center",
    label: __("Bottom center", "pressedmail"),
    icon: MoveUp,
  },
  {
    value: "bottom-right",
    label: __("Bottom right", "pressedmail"),
    icon: MoveUpLeft,
  },
];

function SectionLabel({
  icon: Icon,
  children,
  className,
}: {
  icon: typeof Palette;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("mb-2 flex items-center gap-2", className)}>
      <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {children}
      </span>
    </div>
  );
}

export function FreeThemePopover() {
  const { theme: appearanceTheme, setTheme: setAppearanceTheme } =
    useAppearanceTheme();
  const { currentTheme, setTheme: setColorTheme } = useColorTheme();
  const {
    fontStack,
    setFontStack,
    fontSize,
    setFontSize,
    fontStackOptions,
    fontSizeOptions,
  } = useTypographySettings();
  const { preferences, updatePreference } = useUserPreferences();

  const currentAppearance = (appearanceTheme ??
    "system") as AppearanceThemeOption;
  const effectiveMode: "light" | "dark" =
    currentAppearance === "system"
      ? typeof window !== "undefined" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light"
      : currentAppearance;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="size-8"
          data-test="free-theme-popover-trigger"
          aria-label={__("Appearance", "pressedmail")}>
          <ThemePaletteIcon className="size-4" aria-hidden="true" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-4">
        {/* Mode */}
        <div className="mb-4">
          <SectionLabel icon={SunMoon}>
            {__("Mode", "pressedmail")}
          </SectionLabel>
          <Tabs
            value={currentAppearance}
            onValueChange={(value) =>
              setAppearanceTheme(value as AppearanceThemeOption)
            }
            className="w-full">
            <TabsList className="grid h-9 w-full grid-cols-3 gap-1.5 bg-muted p-1">
              <TabsTrigger value="light" className="text-xs">
                <Sun className="mr-1.5 size-3.5" aria-hidden="true" />
                {__("Light", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger value="dark" className="text-xs">
                <Moon className="mr-1.5 size-3.5" aria-hidden="true" />
                {__("Dark", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger value="system" className="text-xs">
                <Monitor className="mr-1.5 size-3.5" aria-hidden="true" />
                {__("System", "pressedmail")}
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {/* Typography */}
        <div className="mb-4 grid grid-cols-2 gap-2">
          <div>
            <SectionLabel icon={Palette}>
              {__("Font", "pressedmail")}
            </SectionLabel>
            <Select
              value={fontStack}
              onValueChange={(value) => setFontStack(value)}>
              <SelectTrigger
                className="h-9 text-xs"
                data-test="free-font-family">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontStackOptions.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    className="text-xs">
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <SectionLabel icon={Palette}>
              {__("Size", "pressedmail")}
            </SectionLabel>
            <Select
              value={fontSize}
              onValueChange={(value) => setFontSize(value)}>
              <SelectTrigger className="h-9 text-xs" data-test="free-font-size">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {fontSizeOptions.map((option) => (
                  <SelectItem
                    key={option.id}
                    value={option.id}
                    className="text-xs">
                    {option.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <Separator className="my-3" />

        {/*
          Conversation grouping. The Pro popover carries the same row, and the
          two popovers are the only control for the key, one per edition.
        */}
        <div className="mb-3">
          <SectionLabel icon={Rows3}>{__("Inbox", "pressedmail")}</SectionLabel>
          <div className="grid grid-cols-2 gap-1.5 rounded-lg bg-muted p-1">
            {GROUPING_OPTIONS.map(({ value, label, dataTest }) => {
              const selected =
                (preferences.email_list_grouping ?? "list") === value;
              return (
                <Button
                  key={value}
                  type="button"
                  variant={selected ? "default" : "ghost"}
                  size="sm"
                  className="h-8 text-xs"
                  aria-pressed={selected}
                  data-test={dataTest}
                  onClick={() =>
                    void updatePreference("email_list_grouping", value)
                  }>
                  {label}
                </Button>
              );
            })}
          </div>
        </div>

        <div
          className="grid grid-cols-2 items-start gap-3"
          data-test="free-theme-controls-grid">
          {/* Speed dial position */}
          <div data-test="free-speed-dial-column">
            <SectionLabel icon={Palette}>
              {__("Speed Dial", "pressedmail")}
            </SectionLabel>
            <div
              className="grid aspect-square grid-cols-3 grid-rows-3 gap-1.5 rounded-lg bg-muted p-1"
              data-test="free-speed-dial-position">
              {SPEED_DIAL_POSITION_OPTIONS.map(
                ({ value, label, icon: Icon }) => {
                  const selected = preferences.speed_dial_position === value;
                  return (
                    <PressedTooltip key={value} content={label} side="top">
                      <Button
                        type="button"
                        variant={selected ? "default" : "outline"}
                        size="icon"
                        className="aspect-square h-auto w-full"
                        aria-label={label}
                        aria-pressed={selected}
                        onClick={() =>
                          void updatePreference("speed_dial_position", value)
                        }>
                        <Icon className="size-4" aria-hidden="true" />
                      </Button>
                    </PressedTooltip>
                  );
                },
              )}
            </div>
          </div>

          <div
            className="grid grid-rows-[auto_auto_auto_auto_auto] gap-2"
            data-test="free-theme-selection-column">
            <SectionLabel icon={Palette} className="mb-0">
              {__("Color Scheme", "pressedmail")}
            </SectionLabel>
            {FREE_THEME_SWATCHES.map((theme) => {
              const colors = theme.colors[effectiveMode] ?? theme.colors.light;
              const isSelected = currentTheme === theme.id;
              return (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => setColorTheme(theme.id)}
                  data-test={`free-theme-${theme.id}`}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex items-center gap-2 rounded-md border p-2 text-left transition-colors",
                    isSelected
                      ? "border-primary ring-1 ring-primary"
                      : "border-border hover:bg-muted",
                  )}>
                  <span
                    className="flex size-6 shrink-0 overflow-hidden rounded-full border"
                    aria-hidden="true">
                    <span
                      className="h-full w-1/3"
                      style={{ backgroundColor: colors.primary }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ backgroundColor: colors.secondary }}
                    />
                    <span
                      className="h-full w-1/3"
                      style={{ backgroundColor: colors.accent }}
                    />
                  </span>
                  <span className="flex-1 text-xs font-medium">
                    {theme.name}
                  </span>
                  {isSelected ? (
                    <Check
                      className="size-3.5 text-primary"
                      aria-hidden="true"
                    />
                  ) : null}
                </button>
              );
            })}
            <SectionLabel icon={LayoutTemplate} className="mb-0">
              {__("Layout", "pressedmail")}
            </SectionLabel>
            <button
              type="button"
              disabled
              aria-label={__("PressedM layout", "pressedmail")}
              aria-pressed="true"
              data-test="free-layout-pressedm"
              className="flex w-full items-center gap-2 rounded-md border border-primary bg-muted p-2 text-left ring-1 ring-primary disabled:opacity-100">
              <LayoutTemplate
                className="size-4 text-primary"
                aria-hidden="true"
              />
              <span className="flex-1 text-xs font-medium">
                {__("PressedM", "pressedmail")}
              </span>
              <Check className="size-3.5 text-primary" aria-hidden="true" />
            </button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default FreeThemePopover;
