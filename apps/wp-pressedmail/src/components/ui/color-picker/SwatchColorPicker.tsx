/**
 * Swatch colour picker
 *
 * The Tags picker, shared: a row of circular swatches as a radio group with
 * arrow-key roving focus, plus an optional custom hex field whose swatch
 * opens the same picker popover the Branding & Appearance page uses. Tags,
 * contact lists, contact flags and calendars render it with their own
 * palette. The Plate editor keeps
 * `ComposerColorPalette`, which has levels and a different job.
 *
 * The `data-test` ids are the Tags contract names. Keep them.
 *
 * @since 1.4.0
 */

import { useId, useState } from "react";
import { __ } from "@wordpress/i18n";
import { Input, Label } from "@kit/ui/plugin";

import { ColorSwatchPopover } from "@/components/ui/color-picker/ColorSwatchPopover";
import { PalettePicker } from "@/components/ui/color-picker/PalettePicker";
import { isHexColor } from "@/lib/hex-color";
import { cn } from "@/lib/utils";

export interface SwatchColorPickerProps {
  /** Pickable hex colours, in display order. */
  colors: readonly string[];
  value: string;
  onChange: (hex: string) => void;
  /** Show the custom hex field. */
  allowCustom?: boolean;
}

/** Names for the Tailwind 500 swatches every palette here draws from. Built at render time for i18n. */
function swatchNames(): Record<string, string> {
  return {
    "#ef4444": __("Red", "pressedmail"),
    "#f97316": __("Orange", "pressedmail"),
    "#f59e0b": __("Amber", "pressedmail"),
    "#eab308": __("Yellow", "pressedmail"),
    "#84cc16": __("Lime", "pressedmail"),
    "#22c55e": __("Green", "pressedmail"),
    "#10b981": __("Emerald", "pressedmail"),
    "#14b8a6": __("Teal", "pressedmail"),
    "#06b6d4": __("Cyan", "pressedmail"),
    "#0ea5e9": __("Sky", "pressedmail"),
    "#3b82f6": __("Blue", "pressedmail"),
    "#6366f1": __("Indigo", "pressedmail"),
    "#8b5cf6": __("Violet", "pressedmail"),
    "#a855f7": __("Purple", "pressedmail"),
    "#d946ef": __("Fuchsia", "pressedmail"),
    "#ec4899": __("Pink", "pressedmail"),
    "#f43f5e": __("Rose", "pressedmail"),
    "#64748b": __("Slate", "pressedmail"),
  };
}

export function SwatchColorPicker({
  colors,
  value,
  onChange,
  allowCustom = false,
}: SwatchColorPickerProps) {
  const labelId = useId();
  const customId = useId();
  const customErrorId = useId();
  const names = swatchNames();
  const selectedIndex = colors.findIndex(
    (hex) => hex.toLowerCase() === value.toLowerCase(),
  );
  const [custom, setCustom] = useState(selectedIndex === -1 ? value : "");
  const customInvalid = custom !== "" && !isHexColor(custom);

  const select = (index: number, group: HTMLElement | null) => {
    const hex = colors[index];
    if (!hex) return;
    onChange(hex);
    setCustom("");
    const radios = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[index]?.focus();
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="text-sm font-medium leading-none">
        {__("Color", "pressedmail")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        data-test="tag-color-swatches"
        className="flex flex-wrap gap-1.5"
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!step) return;
          event.preventDefault();
          const from = selectedIndex === -1 ? 0 : selectedIndex;
          select((from + step + colors.length) % colors.length, event.currentTarget);
        }}>
        {colors.map((hex, index) => {
          const checked = index === selectedIndex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={names[hex.toLowerCase()] ?? hex}
              tabIndex={checked || (selectedIndex === -1 && index === 0) ? 0 : -1}
              onClick={(event) =>
                select(index, event.currentTarget.parentElement)
              }
              className={cn(
                "size-7 rounded-full border border-black/10 transition-shadow",
                checked &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
      {allowCustom ? (
        <>
          <div className="flex items-center gap-2">
            <Label htmlFor={customId} className="text-sm font-normal">
              {__("Custom", "pressedmail")}
            </Label>
            <Input
              id={customId}
              autoComplete="off"
              spellCheck={false}
              value={custom}
              maxLength={7}
              placeholder="#3b82f6"
              data-test="tag-color-custom"
              aria-invalid={customInvalid || undefined}
              aria-describedby={customInvalid ? customErrorId : undefined}
              onChange={(event) => {
                const next = event.target.value.trim();
                setCustom(next);
                if (isHexColor(next)) onChange(next);
              }}
              className="w-28 font-mono text-sm"
            />
            <ColorSwatchPopover
              value={custom || value}
              label={__("Choose a custom color", "pressedmail")}
              data-test="tag-color-custom-swatch">
              <PalettePicker
                value={custom || value}
                layout="background"
                onChange={(hex) => {
                  // These colours are hex-only (no alpha), so an eight-digit
                  // pick from the picker collapses to its opaque six digits.
                  const opaque = hex.slice(0, 7);
                  setCustom(opaque);
                  if (isHexColor(opaque)) onChange(opaque);
                }}
              />
            </ColorSwatchPopover>
          </div>
          {customInvalid ? (
            <p id={customErrorId} className="text-xs text-destructive">
              {__("Use a hex color such as #3b82f6.", "pressedmail")}
            </p>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
