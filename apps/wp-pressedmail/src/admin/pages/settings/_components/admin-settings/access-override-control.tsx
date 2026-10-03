import { useRef, type KeyboardEvent } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Ban, Check } from "lucide-react";

import { cn } from "@kit/ui/plugin";

export type AccessOverrideChoice = "inherit" | "allow" | "deny";

const CHOICES: readonly AccessOverrideChoice[] = ["inherit", "allow", "deny"];

/**
 * A status colour as text on its own 10% tint. The theme's status text colour
 * already clears AA on a plain card, but a tint under it darkens the ground and
 * the same colour dropped to 4.0 on four palettes. Pulling it a quarter of the
 * way to the foreground gives every palette in both modes room to spare.
 */
const ALLOW_TEXT =
  "text-[color-mix(in_oklab,var(--pm-success-text,var(--success))_75%,var(--foreground))]";
const DENY_TEXT =
  "text-[color-mix(in_oklab,var(--pm-destructive-text,var(--destructive))_75%,var(--foreground))]";

/**
 * Selected look per choice. Every selected segment gets a mark and a weight, so
 * the state reads at a glance and survives a reader who cannot tell the tints
 * apart. A fill alone sat at 1.0 to 1.2:1 against the track in every palette,
 * which made the resting state of most rows look like nothing was selected, so
 * the mark carries it (WCAG 1.4.11, pinned by access-contrast.test.ts).
 *
 * The two choices that are an exception are the loud ones. Inherit is what most
 * rows show, so it is the quiet one: a soft fill, the dot and the weight,
 * with an edge that stays transparent (a forced-colours display still draws
 * it). Allow and Deny draw their status colour as an edge at full strength, so
 * a person with a setting of their own stands out of a column of Inherit rather
 * than competing with it. The edge is a real border, not a ring or a shadow: the
 * keyboard focus outline belongs to the shared stylesheet and stands 2px outside
 * the segment, and a ring on the selected one would sit beside it and read as the
 * same thing. Plain strings, not cn(): a call at the top of a module is a side
 * effect a bundler cannot prove away, and it would keep this Pro-only module in
 * the Free build.
 */
const SELECTED_CLASS: Record<AccessOverrideChoice, string> = {
  inherit: "border-transparent bg-foreground/10 font-semibold text-foreground",
  allow: `border-current bg-success/10 font-semibold ${ALLOW_TEXT}`,
  deny: `border-current bg-destructive/10 font-semibold ${DENY_TEXT}`,
};

function choiceLabel(choice: AccessOverrideChoice): string {
  switch (choice) {
    case "allow":
      return __("Allow", "pressedmail");
    case "deny":
      return __("Deny", "pressedmail");
    default:
      return __("Inherit", "pressedmail");
  }
}

interface AccessOverrideControlProps {
  /** Who this is for. Part of the group's accessible name. */
  name: string;
  value: AccessOverrideChoice;
  onChange: (next: AccessOverrideChoice) => void;
  disabled?: boolean;
  /** Choices that mean nothing for this person. They stay in view but cannot be picked. */
  unavailable?: readonly AccessOverrideChoice[];
  /** The id of text that says what applies to this person, read after the name. */
  describedBy?: string;
}

/**
 * Inherit, Allow or Deny for one person, as one radio group.
 *
 * Only the selected choice is in the tab order, and the arrow keys move the
 * selection the way a native radio group does, so a whole page of these is one
 * Tab stop per person rather than three. While it is disabled the choices are
 * marked aria-disabled instead, so a focused one keeps the focus. A choice that
 * is unavailable is marked the same way, and the arrow keys step over it.
 *
 * It fills the cell it is given, and never cuts a label short: the three
 * segments share the width, and a label that needs more than its share (a long
 * translation) widens the control instead of being clipped to "All...". The
 * track is 4px deep so the focus outline, which stands 2px off the focused
 * segment, lands inside it and clear of the track's own edge. Tall on a phone
 * and on any touch screen, whatever the panel's width: an iPad in portrait is
 * wide enough for the desktop layout and still a finger.
 */
export function AccessOverrideControl({
  name,
  value,
  onChange,
  disabled = false,
  unavailable = [],
  describedBy,
}: AccessOverrideControlProps) {
  const buttons = useRef<Array<HTMLButtonElement | null>>([]);
  const available = CHOICES.filter((choice) => !unavailable.includes(choice));

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (disabled || available.length === 0) return;

    // -1 when the saved choice is one that can no longer be picked.
    const index = available.indexOf(value);
    // Left and right follow the reading direction, like a native radio group.
    const forward =
      getComputedStyle(event.currentTarget).direction === "rtl"
        ? "ArrowLeft"
        : "ArrowRight";
    const back = forward === "ArrowRight" ? "ArrowLeft" : "ArrowRight";
    let next: number;

    if (event.key === forward || event.key === "ArrowDown") {
      next = index < 0 ? 0 : (index + 1) % available.length;
    } else if (event.key === back || event.key === "ArrowUp") {
      next =
        index < 0
          ? available.length - 1
          : (index + available.length - 1) % available.length;
    } else if (event.key === "Home") {
      next = 0;
    } else if (event.key === "End") {
      next = available.length - 1;
    } else {
      return;
    }

    const choice = available[next] as AccessOverrideChoice;

    event.preventDefault();
    onChange(choice);
    buttons.current[CHOICES.indexOf(choice)]?.focus();
  };

  return (
    <div
      role="radiogroup"
      aria-label={sprintf(
        /* translators: %s: a person's name. */
        __("Access for %s", "pressedmail"),
        name,
      )}
      aria-describedby={describedBy}
      aria-disabled={disabled || undefined}
      onKeyDown={onKeyDown}
      className="grid h-13 w-full min-w-max grid-cols-[repeat(3,minmax(max-content,1fr))] gap-1 rounded-md border bg-transparent p-1 @2xl/people:h-control @2xl/people:pointer-coarse:h-13"
      data-test="access-override-control"
      data-testid="access-override-control">
      {CHOICES.map((choice, index) => {
        const selected = choice === value;
        const blocked = disabled || unavailable.includes(choice);

        return (
          <button
            key={choice}
            ref={(node) => {
              buttons.current[index] = node;
            }}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-disabled={blocked || undefined}
            tabIndex={selected ? 0 : -1}
            onClick={() => {
              if (!blocked) onChange(choice);
            }}
            data-choice={choice}
            className={cn(
              "flex h-full min-w-0 items-center justify-center gap-1 whitespace-nowrap rounded-sm border border-transparent px-1 text-xs outline-none transition-colors duration-150",
              "aria-disabled:pointer-events-none aria-disabled:opacity-50",
              selected
                ? SELECTED_CLASS[choice]
                : "font-medium text-muted-foreground hover:bg-muted/60 hover:text-foreground",
            )}>
            {selected && choice === "inherit" ? (
              // A dot is the mark a radio has always used for "this one", and
              // Inherit has no better picture: it means "whatever the role says".
              <span
                aria-hidden="true"
                data-mark="inherit"
                className="size-1.5 shrink-0 rounded-full bg-current"
              />
            ) : null}
            {selected && choice === "allow" ? (
              <Check aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            {selected && choice === "deny" ? (
              <Ban aria-hidden="true" className="size-3.5 shrink-0" />
            ) : null}
            <span>{choiceLabel(choice)}</span>
          </button>
        );
      })}
    </div>
  );
}
