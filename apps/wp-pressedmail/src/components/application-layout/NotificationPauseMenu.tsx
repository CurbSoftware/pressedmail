"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { CirclePause, CirclePlay } from "lucide-react";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@kit/ui/plugin";
import { focusQuietly, PressedTooltip } from "@/components/ui/pressed-tooltip";
import type { PausePreset } from "@/lib/notification-pause";

type TooltipSide = "top" | "right" | "bottom" | "left";

interface NotificationPauseMenuProps {
  /** Whether notifications are paused now, which adds Resume to the menu. */
  paused: boolean;
  /** When the pause ends, in words, such as "Paused until 3:40 PM". Names the trigger while paused. */
  pausedText?: string;
  tooltipSide?: TooltipSide;
  /** Classes for the trigger, so the toolbar can style its switched-on state. */
  buttonClassName?: string;
  onPause: (preset: PausePreset) => void | Promise<void>;
  onResume: () => void | Promise<void>;
}

/**
 * Escape inside a menu closes the menu and nothing else. The phone's sheet is a
 * Base UI dialog and these menus are Radix, so the sheet never learns the menu
 * took the key: it listens on the document too, and one press closed both and
 * threw the reader back to the bell. Stopping the event where the menu has taken
 * it leaves the second press for the sheet.
 */
export function closeMenuOnly(event: KeyboardEvent) {
  event.stopPropagation();
}

/**
 * How long a pause can last, in the order the menu offers them. The words are
 * the length a person asks for, not the time it ends at: the header says when.
 */
const PRESETS: ReadonlyArray<{ preset: PausePreset; label: () => string }> = [
  { preset: "15-minutes", label: () => __("15 minutes", "pressedmail") },
  { preset: "1-hour", label: () => __("1 hour", "pressedmail") },
  { preset: "8-hours", label: () => __("8 hours", "pressedmail") },
  {
    preset: "tomorrow-morning",
    label: () => __("Until tomorrow morning", "pressedmail"),
  },
  { preset: "until-resumed", label: () => __("Until I resume", "pressedmail") },
];

/**
 * The pause control in the notification popup's toolbar.
 *
 * It is a menu, not a toggle: a pause needs an end. Resume shows only while
 * paused, first, so lifting a pause is one keystroke from the trigger.
 */
export function NotificationPauseMenu({
  paused,
  pausedText,
  tooltipSide = "bottom",
  buttonClassName,
  onPause,
  onResume,
}: NotificationPauseMenuProps) {
  const trigger = React.useRef<HTMLButtonElement>(null);
  // A trigger that is styled as switched on has to say so to a screen reader too.
  const label =
    paused && pausedText
      ? sprintf(
          /* translators: %s: when the pause ends, such as "Paused until 3:40 PM". */
          __("%s. Change or resume", "pressedmail"),
          pausedText,
        )
      : __("Pause notifications", "pressedmail");

  return (
    <PressedTooltip content={label} side={tooltipSide}>
      <span className="inline-flex">
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <Button
              ref={trigger}
              type="button"
              variant="ghost"
              size="icon"
              data-roving-item=""
              data-test="notifications-pause"
              aria-label={label}
              className={buttonClassName}>
              <CirclePause className="size-4" aria-hidden="true" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            data-test="notifications-pause-menu"
            onEscapeKeyDown={closeMenuOnly}
            // The menu hands focus back to its trigger as it closes. Done
            // quietly, because after a choice made with the keyboard that focus
            // counts as the keyboard's and the tooltip would open over the
            // button, and take the first Escape the reader presses to close the
            // popup.
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              if (trigger.current) focusQuietly(trigger.current);
            }}>
            {paused ? (
              <>
                <DropdownMenuItem
                  data-test="notifications-resume"
                  className="gap-2"
                  onSelect={() => void onResume()}>
                  <CirclePlay className="size-4" aria-hidden="true" />
                  {__("Resume notifications", "pressedmail")}
                </DropdownMenuItem>
                <DropdownMenuSeparator />
              </>
            ) : null}
            <DropdownMenuLabel className="text-xs font-medium text-muted-foreground">
              {__("Pause for", "pressedmail")}
            </DropdownMenuLabel>
            {PRESETS.map(({ preset, label: presetLabel }) => (
              <DropdownMenuItem
                key={preset}
                data-test={`notifications-pause-${preset}`}
                onSelect={() => void onPause(preset)}>
                {presetLabel()}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </span>
    </PressedTooltip>
  );
}
