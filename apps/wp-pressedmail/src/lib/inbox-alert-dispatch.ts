import { __ } from "@wordpress/i18n";

import type { UserPreferences } from "@/hooks/useUserPreferences";
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

export function showDesktopNotification(title: string, body: string): void {
  if (typeof Notification === "undefined") {
    return;
  }
  if (Notification.permission !== "granted") {
    return;
  }
  try {
    new Notification(title, { body, silent: true });
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
  } = options;
  if (nextCount <= previousCount) {
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
    const body =
      preferences.notification_preview_level === "none"
        ? ""
        : preferences.notification_preview_level === "sender"
          ? title
          : (previewBody ?? title);
    showDesktopNotification(title, body);
  }
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
