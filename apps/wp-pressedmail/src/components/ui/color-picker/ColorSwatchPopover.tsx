/**
 * Swatch button that opens a picker popover
 *
 * Extracted from the Branding & Appearance palette fields: the checkerboard
 * swatch trigger plus the chrome-less popover that carries a full picker.
 * Callers pass `PalettePicker` as the child, so the whitelabel tab and the
 * custom row of `SwatchColorPicker` open the same picker.
 *
 * @since 1.4.0
 */

import type { CSSProperties, ReactNode } from "react";
import { Popover, PopoverTrigger } from "@kit/ui/plugin";

import { PressedPopoverContent } from "@/components/ui/pressed-overlay";

/**
 * The checkerboard that shows through a translucent swatch, so transparency is
 * visible rather than reading as a lighter solid.
 */
const TRANSPARENCY_GRID: CSSProperties = {
  backgroundImage:
    "repeating-conic-gradient(rgba(148, 163, 184, 0.45) 0% 25%, transparent 0% 50%)",
  backgroundSize: "8px 8px",
};

export interface ColorSwatchPopoverProps {
  /** The color the swatch fill shows. */
  value: string;
  /** Accessible name for the swatch button. */
  label: string;
  /** The picker rendered inside the popover. */
  children: ReactNode;
  className?: string;
  "data-test"?: string;
  "data-testid"?: string;
}

export function ColorSwatchPopover({
  value,
  label,
  children,
  className,
  "data-test": dataTest,
  "data-testid": dataTestId,
}: ColorSwatchPopoverProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          type="button"
          aria-label={label}
          className={className ?? "h-7 w-7 shrink-0 rounded border"}
          style={TRANSPARENCY_GRID}
          data-test={dataTest}
          data-testid={dataTestId}>
          <span
            className="block h-full w-full rounded-[inherit]"
            style={{ backgroundColor: value }}
          />
        </button>
      </PopoverTrigger>
      <PressedPopoverContent
        size="menu"
        align="start"
        className="border-0 bg-transparent p-0 shadow-none">
        {children}
      </PressedPopoverContent>
    </Popover>
  );
}

export default ColorSwatchPopover;
