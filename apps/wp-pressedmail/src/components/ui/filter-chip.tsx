import type { ButtonHTMLAttributes } from "react";

import { cn } from "@kit/ui/plugin";

/**
 * A filter, drawn as a pill with a hairline, with the number of people it holds.
 *
 * Access Control's Users tab and the AI Tools team list narrow a list the same
 * way, so a chip that is on has to read as on the same way in both, in every
 * palette: the chosen one takes the edge, fill and weight a selected segment
 * takes, because a fill alone is a hair's width from the card in the light
 * schemes. It is a finger on a touch screen.
 */
const CHIP =
  "inline-flex min-h-control shrink-0 items-center gap-1.5 justify-center whitespace-nowrap rounded-full border px-3 text-xs outline-none transition-colors duration-150 pointer-coarse:min-h-11 pointer-coarse:min-w-11";
const CHIP_ON = "border-foreground/60 bg-muted font-semibold text-foreground";
const CHIP_OFF =
  "border-border font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground";

interface FilterChipProps extends Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "type"
> {
  selected: boolean;
  /** How many are in it. Left out, or null from a server that does not say, the chip shows only its name. */
  count?: number | null;
}

export function FilterChip({
  selected,
  count,
  className,
  children,
  ...props
}: FilterChipProps) {
  return (
    <button
      {...props}
      type="button"
      aria-pressed={selected}
      className={cn(CHIP, selected ? CHIP_ON : CHIP_OFF, className)}>
      {children}
      {count != null ? <span className="tabular-nums">{count}</span> : null}
    </button>
  );
}
