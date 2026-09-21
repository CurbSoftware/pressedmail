"use client";

import { ColorPicker, parseColor } from "@ark-ui/react/color-picker";
import { PipetteIcon } from "lucide-react";
import { useMemo, type CSSProperties, type ReactNode } from "react";
import { __ } from "@wordpress/i18n";

import { normalizeComposerBackgroundColor } from "@/lib/composer-background-color";
import { cn } from "@/lib/utils";

const FALLBACK_HEX = "#000000";

function safeParse(value: string, background: boolean) {
  try {
    return parseColor(
      background
        ? (normalizeComposerBackgroundColor(value) ?? FALLBACK_HEX)
        : value,
    );
  } catch {
    return parseColor(FALLBACK_HEX);
  }
}

export interface PalettePickerProps {
  value: string;
  onChange: (hex: string) => void;
  layout?: "default" | "background";
  /**
   * Rendered inside the picker content, below the hex input. Use it to
   * drop action buttons (Save, Cancel) without wrapping the picker.
   */
  children?: ReactNode;
  className?: string;
  /** Inline styles for the picker content: used to match the swatch grid's width. */
  style?: CSSProperties;
}

/**
 * Controlled inline color picker. Renders the full HSL area, hue/alpha
 * sliders, eyedropper, and a single hex channel input. The hex string
 * surfaces back through `onChange` whenever the user manipulates the picker.
 */
export function PalettePicker({
  value,
  onChange,
  layout = "default",
  children,
  className,
  style,
}: PalettePickerProps) {
  const parsed = useMemo(
    () => safeParse(value || FALLBACK_HEX, layout === "background"),
    [layout, value],
  );
  const channels = useMemo(() => parseHexChannels(value), [value]);

  const isBackgroundLayout = layout === "background";
  const visualControls = (
    <>
      <ColorPicker.Area
        className={cn(
          "relative w-full overflow-hidden rounded-md",
          isBackgroundLayout ? "h-28" : "h-36",
        )}>
        <ColorPicker.AreaBackground className="h-full w-full" />
        <ColorPicker.AreaThumb className="absolute h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow-xs" />
      </ColorPicker.Area>

      <div className="flex items-center gap-3">
        <ColorPicker.EyeDropperTrigger
          className={cn(
            "rounded-md border border-border text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
            isBackgroundLayout ? "p-1.5" : "p-2",
          )}>
          <PipetteIcon className="h-4 w-4" />
        </ColorPicker.EyeDropperTrigger>

        <div className="flex-1 space-y-2">
          <ColorPicker.ChannelSlider
            channel="hue"
            className="relative h-3 w-full overflow-hidden rounded-full">
            <ColorPicker.ChannelSliderTrack className="h-full w-full bg-linear-to-r from-red-500 via-yellow-500 via-green-500 via-cyan-500 via-blue-500 via-purple-500 to-red-500" />
            <ColorPicker.ChannelSliderThumb className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow-xs" />
          </ColorPicker.ChannelSlider>

          <ColorPicker.ChannelSlider
            channel="alpha"
            className="relative h-3 w-full overflow-hidden rounded-full">
            <ColorPicker.TransparencyGrid className="h-full w-full [--size:8px]" />
            <ColorPicker.ChannelSliderTrack className="h-full w-full" />
            <ColorPicker.ChannelSliderThumb className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-black bg-white shadow-xs" />
          </ColorPicker.ChannelSlider>
        </div>
      </div>
    </>
  );

  return (
    <ColorPicker.Root
      inline
      value={parsed}
      onValueChange={(details) => {
        onChange(
          layout === "background"
            ? compactHexAlpha(details.value.toString("hexa"))
            : details.value.toString("hex").toLowerCase(),
        );
      }}>
      <ColorPicker.Content
        data-test="palette-picker-content"
        data-testid="palette-picker-content"
        style={style}
        className={cn(
          "bg-popover text-popover-foreground border border-border rounded-lg shadow-lg z-50 w-full",
          layout === "background" ? "p-2.5 space-y-2" : "p-4 space-y-4",
          className,
        )}>
        {layout === "background" ? (
          /* Single compact column so the editor never grows wider than the
             swatch palette above it: area, sliders, then Hex + RGBA in two
             dense rows. */
          <div
            data-test="background-picker-layout"
            data-testid="background-picker-layout"
            className="space-y-2">
            {visualControls}
            <label className="flex items-center gap-2 text-xs font-medium">
              <span className="shrink-0">{__("Hex", "pressedmail")}</span>
              <input
                autoComplete="off"
                type="text"
                aria-label={__("Hex", "pressedmail")}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="w-full min-w-0 rounded-md border border-input bg-background px-2 py-1 text-xs text-foreground focus:border-transparent"
              />
            </label>
            <div className="grid grid-cols-4 gap-1.5">
              <ChannelNumberInput
                label={__("Red", "pressedmail")}
                shortLabel="R"
                value={channels.red}
                max={255}
                onChange={(red) =>
                  onChange(formatHexChannels({ ...channels, red }))
                }
              />
              <ChannelNumberInput
                label={__("Green", "pressedmail")}
                shortLabel="G"
                value={channels.green}
                max={255}
                onChange={(green) =>
                  onChange(formatHexChannels({ ...channels, green }))
                }
              />
              <ChannelNumberInput
                label={__("Blue", "pressedmail")}
                shortLabel="B"
                value={channels.blue}
                max={255}
                onChange={(blue) =>
                  onChange(formatHexChannels({ ...channels, blue }))
                }
              />
              <ChannelNumberInput
                label={__("Alpha", "pressedmail")}
                shortLabel="A"
                value={channels.alpha}
                max={100}
                suffix="%"
                onChange={(alpha) =>
                  onChange(formatHexChannels({ ...channels, alpha }))
                }
              />
            </div>
          </div>
        ) : (
          <>
            {visualControls}
            <ColorPicker.ChannelInput
              channel="hex"
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground focus:border-transparent"
            />
          </>
        )}

        {children}
      </ColorPicker.Content>
      <ColorPicker.HiddenInput />
    </ColorPicker.Root>
  );
}

interface HexChannels {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}

function parseHexChannels(value: string): HexChannels {
  const normalized = normalizeComposerBackgroundColor(value);
  if (!normalized) {
    return { red: 0, green: 0, blue: 0, alpha: 100 };
  }

  const rgb = normalized.slice(1, 7);
  const alphaHex = normalized.length === 9 ? normalized.slice(7, 9) : undefined;
  return {
    red: Number.parseInt(rgb.slice(0, 2), 16),
    green: Number.parseInt(rgb.slice(2, 4), 16),
    blue: Number.parseInt(rgb.slice(4, 6), 16),
    alpha: alphaHex
      ? Math.round((Number.parseInt(alphaHex, 16) / 255) * 100)
      : 100,
  };
}

function formatHexChannels({ red, green, blue, alpha }: HexChannels): string {
  const rgb = [red, green, blue]
    .map((channel) => channel.toString(16).padStart(2, "0"))
    .join("");
  if (alpha >= 100) return `#${rgb}`;

  const alphaHex = Math.round((alpha / 100) * 255)
    .toString(16)
    .padStart(2, "0");
  return `#${rgb}${alphaHex}`;
}

function compactHexAlpha(value: string): string {
  const normalized = normalizeComposerBackgroundColor(value) ?? FALLBACK_HEX;
  return normalized.endsWith("ff") ? normalized.slice(0, -2) : normalized;
}

function ChannelNumberInput({
  label,
  value,
  max,
  shortLabel,
  suffix,
  onChange,
}: {
  label: string;
  value: number;
  max: number;
  shortLabel?: string;
  suffix?: string;
  onChange: (value: number) => void;
}) {
  return (
    <label className="space-y-1 text-xs font-medium">
      <span>
        {shortLabel ?? label}
        {suffix ? ` (${suffix})` : ""}
      </span>
      <input
        autoComplete="off"
        type="number"
        aria-label={label}
        min={0}
        max={max}
        step={1}
        value={value}
        onChange={(event) => {
          const parsed = Number.parseInt(event.target.value, 10);
          onChange(
            Number.isFinite(parsed) ? Math.min(max, Math.max(0, parsed)) : 0,
          );
        }}
        className="w-full min-w-0 rounded-md border border-input bg-background px-1.5 py-1 text-xs text-foreground focus:border-transparent"
      />
    </label>
  );
}
