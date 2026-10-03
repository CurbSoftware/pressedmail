"use client";

import { __, sprintf } from "@wordpress/i18n";
import { BellOff, CirclePause } from "lucide-react";
import { Button, toast } from "@kit/ui/plugin";

import { useNotificationPause } from "@/hooks/useNotificationPause";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { describePause } from "@/lib/notification-pause";

/**
 * What the bell has switched off, with the way to switch it back on.
 *
 * Mute and Pause are set from the notification popup and live nowhere else, so a
 * reader who muted a week ago and wonders why the pop-ups stopped had nowhere in
 * Settings to find out. This sits above the alert controls and is gone when
 * neither is on.
 */
export function NotificationSilenceNote() {
  const silence = useNotificationPause();
  const { preferences, updatePreferences } = useUserPreferences();
  const muted = preferences.notification_muted === true;
  if (!silence.paused && !muted) return null;

  const resume = async () => {
    if (!(await silence.resume())) {
      toast.error(__("Could not resume notifications", "pressedmail"));
    }
  };
  const unmute = async () => {
    if (!(await updatePreferences({ notification_muted: false }))) {
      toast.error(__("Could not unmute notifications", "pressedmail"));
    }
  };

  // What a pause holds back is only what this edition has. The email copy of a
  // notification is Pro's, and a sentence that promised it in Free would claim an
  // effect that is not there.
  const pausedEffect = __IS_FREE__
    ? /* translators: %s: when the pause ends, such as "Paused until 3:40 PM". */
      __("%s. Sound, pop-ups and the badge wait until then.", "pressedmail")
    : /* translators: %s: when the pause ends, such as "Paused until 3:40 PM". */
      __(
        "%s. Sound, pop-ups, email copies and the badge wait until then.",
        "pressedmail",
      );

  return (
    <div
      data-test="notifications-silence-note"
      // One grid for every row, so the buttons share a column and line up whether
      // one thing is switched on or both. A row of its own let the sentence push
      // Resume under its text while Unmute sat at the edge.
      className="mb-3 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-2 rounded-md border bg-muted/40 p-3 text-sm">
      {silence.paused && silence.endsAt !== null ? (
        <div data-test="notifications-silence-paused" className="contents">
          <p className="flex min-w-0 items-start gap-2">
            <CirclePause
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              {sprintf(pausedEffect, describePause(silence.endsAt))}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            data-test="notifications-silence-resume"
            className="w-full"
            onClick={() => void resume()}>
            {__("Resume", "pressedmail")}
          </Button>
        </div>
      ) : null}
      {muted ? (
        <div data-test="notifications-silence-muted" className="contents">
          <p className="flex min-w-0 items-start gap-2">
            <BellOff
              className="mt-0.5 size-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span>
              {__(
                "Sound and pop-ups are muted. The list and the badge carry on.",
                "pressedmail",
              )}
            </span>
          </p>
          <Button
            type="button"
            variant="outline"
            data-test="notifications-silence-unmute"
            className="w-full"
            onClick={() => void unmute()}>
            {__("Unmute", "pressedmail")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
