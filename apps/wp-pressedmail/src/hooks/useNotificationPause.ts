"use client";

import * as React from "react";

import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  pausedUntilMs,
  pauseUntilFor,
  serverNow,
  type PausePreset,
} from "@/lib/notification-pause";

/** The longest a browser timer can wait, about 24.8 days. */
const MAX_TIMER_MS = 2_147_483_647;

export interface NotificationPause {
  /** When the pause ends (ms since the epoch, `Infinity` until resumed), or null. */
  endsAt: number | null;
  paused: boolean;
  pause: (preset: PausePreset) => Promise<boolean>;
  resume: () => Promise<boolean>;
}

/**
 * Pause for the notification popup.
 *
 * It lives in the user's preferences, so it persists and survives a reload.
 * There is no job to end it: it is compared with the server's clock, which is
 * the one the server holds the pause to (see `serverNow`), and this hook only
 * has to look again when its end time arrives, and when a tab that was asleep
 * (its timers stopped) wakes up, which also re-reads the stored pause. Mute is a
 * plain preference with its own button, so it is not in this hook.
 */
export function useNotificationPause(): NotificationPause {
  const { preferences, updatePreferences, revalidate } = useUserPreferences();
  // The clock is read on every render, never held from an earlier one. The first
  // preferences answer teaches it the server's time after this hook has mounted,
  // and a time held from before then would read a pause that is still running as
  // over. `tick` only asks for another render when the pause may have ended.
  const [tick, bump] = React.useReducer((count: number) => count + 1, 0);
  const endsAt = pausedUntilMs(preferences);

  React.useEffect(() => {
    if (endsAt === null || endsAt === Infinity) return;
    const wait = Math.min(Math.max(endsAt - serverNow(), 0), MAX_TIMER_MS);
    const timer = window.setTimeout(bump, wait + 50);
    return () => window.clearTimeout(timer);
  }, [endsAt, tick]);

  // A tab that was away also asks whether the pause changed while it was: it is
  // set from other tabs and devices, and not every browser can tell this one.
  React.useEffect(() => {
    const wake = () => {
      bump();
      void revalidate();
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") wake();
    };
    window.addEventListener("focus", wake);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      window.removeEventListener("focus", wake);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [revalidate]);

  const pause = React.useCallback(
    (preset: PausePreset) =>
      updatePreferences({
        notification_paused_until: pauseUntilFor(preset, new Date(serverNow())),
      }),
    [updatePreferences],
  );
  const resume = React.useCallback(
    () => updatePreferences({ notification_paused_until: 0 }),
    [updatePreferences],
  );

  return { endsAt, paused: endsAt !== null, pause, resume };
}
