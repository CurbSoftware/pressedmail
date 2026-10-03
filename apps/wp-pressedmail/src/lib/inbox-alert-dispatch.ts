import { __, _n, sprintf } from "@wordpress/i18n";

import type { UserPreferences } from "@/hooks/useUserPreferences";
import { isNotificationsPaused } from "@/lib/notification-pause";
import { shouldShowInboxAlert } from "@/lib/preference-behavior";

const toneCache = new Map<"default" | "subtle", string>();

function writeAscii(view: DataView, offset: number, value: string): void {
  for (let index = 0; index < value.length; index += 1) {
    view.setUint8(offset + index, value.charCodeAt(index));
  }
}

function createNotificationTone(sound: "default" | "subtle"): string {
  const cached = toneCache.get(sound);
  if (cached) return cached;

  const sampleRate = 8_000;
  const durationSeconds = sound === "subtle" ? 0.11 : 0.16;
  const sampleCount = Math.floor(sampleRate * durationSeconds);
  const buffer = new ArrayBuffer(44 + sampleCount);
  const view = new DataView(buffer);
  const frequency = sound === "subtle" ? 660 : 880;
  const amplitude = sound === "subtle" ? 28 : 58;

  writeAscii(view, 0, "RIFF");
  view.setUint32(4, 36 + sampleCount, true);
  writeAscii(view, 8, "WAVE");
  writeAscii(view, 12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  writeAscii(view, 36, "data");
  view.setUint32(40, sampleCount, true);

  for (let index = 0; index < sampleCount; index += 1) {
    const progress = index / sampleCount;
    const attack = Math.min(1, progress / 0.08);
    const release = Math.min(1, (1 - progress) / 0.35);
    const envelope = attack * release;
    const phase = (2 * Math.PI * frequency * index) / sampleRate;
    const harmonic = Math.sin(phase) + 0.22 * Math.sin(phase * 2);
    const sample = 128 + Math.round(amplitude * envelope * harmonic);
    view.setUint8(44 + index, Math.max(0, Math.min(255, sample)));
  }

  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  const source = `data:audio/wav;base64,${btoa(binary)}`;
  toneCache.set(sound, source);
  return source;
}

export function playNotificationSound(
  sound: UserPreferences["notification_sound"],
): void {
  if (sound === "none" || typeof Audio === "undefined") {
    return;
  }
  try {
    const audio = new Audio(createNotificationTone(sound));
    audio.volume = sound === "subtle" ? 0.2 : 0.5;
    void audio.play().catch(() => undefined);
  } catch {
    // Autoplay or missing Audio support is non-fatal.
  }
}

export interface DesktopNotificationOptions {
  /**
   * Names the notification, so one that is raised again replaces the first
   * instead of stacking beside it.
   */
  tag?: string;
  /** The in-app route a click opens, the same path the bell row opens. */
  path?: string | null;
}

export function showDesktopNotification(
  title: string,
  body: string,
  options: DesktopNotificationOptions = {},
): void {
  if (typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  try {
    const notification = new Notification(title, {
      body,
      silent: true,
      ...(options.tag ? { tag: options.tag } : {}),
    });
    // The click brings the tab forward. The routes are hash routes, so setting
    // the hash is a navigation, from a callback that has no router to call.
    notification.onclick = () => {
      window.focus();
      if (options.path) window.location.hash = `#${options.path}`;
      notification.close();
    };
  } catch {
    // Notification constructor can throw in unsupported contexts.
  }
}

export function dispatchNewMailAlerts(options: {
  preferences: UserPreferences;
  previousCount: number;
  nextCount: number;
  folder?: string | null;
  unread?: boolean;
  priority?: boolean;
  previewTitle?: string;
  previewBody?: string;
  /** Id of the feed row the alert is for; it names the desktop pop-up. */
  notificationId?: number;
  /** Where clicking the desktop pop-up goes. */
  path?: string | null;
}): void {
  const {
    preferences,
    previousCount,
    nextCount,
    folder,
    unread = true,
    priority = false,
    previewTitle,
    previewBody,
    notificationId,
    path,
  } = options;
  if (nextCount <= previousCount) {
    return;
  }
  // Muting and pausing stop the interruptions, so they are checked here and not
  // in shouldShowInboxAlert: the panel filters its list with that gate, and a
  // pause has to leave the list as it is. Sound and pop-ups are in every edition,
  // so a mute is read in every edition.
  if (preferences.notification_muted || isNotificationsPaused(preferences)) {
    return;
  }
  if (
    !shouldShowInboxAlert({
      preferences,
      folder,
      unread,
      priority,
    })
  ) {
    return;
  }

  playNotificationSound(preferences.notification_sound);

  if (preferences.desktop_notifications) {
    const title = previewTitle ?? __("New mail", "pressedmail");
    // The title is the sender, so at "sender only" the body is left to say what
    // this is. Repeating the title under itself read as a stutter.
    const body =
      preferences.notification_preview_level === "none"
        ? ""
        : preferences.notification_preview_level === "sender"
          ? previewBody || __("New email", "pressedmail")
          : (previewBody ?? title);
    showDesktopNotification(title, body, {
      tag:
        notificationId === undefined
          ? "pressedmail-new-mail"
          : `pressedmail-notification-${notificationId}`,
      path,
    });
  }
}

/** New mail as one pass over the feed found it. */
export interface FreshMailAlert {
  /** Id of the feed row. */
  id: number;
  folder: string;
  title: string;
  summary: string;
  /** Where the row opens: the same path the bell builds. */
  path: string | null;
}

/**
 * Alert for every new-mail row one pass found, as one sound and one pop-up.
 *
 * Coming back to a tab after a while can find a dozen new rows at once. A sound
 * and a pop-up for each would overlap and bury the tray, so one row alerts as
 * itself and several alert as a count that opens the inbox. Rows the alert
 * settings hold back are not counted. The pop-up shows what the preview setting
 * allows, for a single row as much as for the count.
 */
export function dispatchFreshMailAlerts(
  preferences: UserPreferences,
  alerts: readonly FreshMailAlert[],
): void {
  const audible = alerts.filter((alert) =>
    shouldShowInboxAlert({ preferences, folder: alert.folder, unread: true }),
  );
  const newest = audible[audible.length - 1];
  if (!newest) return;

  if (audible.length === 1) {
    const previewed = applyNotificationPreview(
      {
        title: newest.title,
        summary: newest.summary,
        targetKind: "inbox_message",
      },
      preferences.notification_preview_level,
    );
    dispatchNewMailAlerts({
      preferences,
      previousCount: 0,
      nextCount: 1,
      folder: newest.folder,
      previewTitle: previewed.title,
      previewBody: previewed.summary,
      notificationId: newest.id,
      path: newest.path,
    });
    return;
  }

  dispatchNewMailAlerts({
    preferences,
    previousCount: 0,
    nextCount: audible.length,
    folder: newest.folder,
    previewTitle: sprintf(
      /* translators: %d: number of new messages that arrived while the tab was out of sight. */
      _n("%d new message", "%d new messages", audible.length, "pressedmail"),
      audible.length,
    ),
    previewBody: newest.title,
    path: "/inbox",
  });
}

export function applyNotificationPreview<
  T extends { title: string; summary: string; targetKind: string },
>(item: T, level: UserPreferences["notification_preview_level"]): T {
  if (item.targetKind !== "inbox_message") {
    return item;
  }
  if (level === "none") {
    return {
      ...item,
      title: __("New mail", "pressedmail"),
      summary: "",
    };
  }
  if (level === "sender") {
    return { ...item, summary: "" };
  }
  return item;
}
