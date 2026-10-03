import { useEffect, useSyncExternalStore } from "react";
import { __ } from "@wordpress/i18n";
import {
  setEmailCachePolicy,
  EMAIL_CACHE_POLICY_EVENT,
} from "@/lib/principal-storage";
import { apiFetch } from "@/lib/api-client";
import { syncServerClock } from "@/lib/notification-pause";
import {
  publishTabMessage,
  subscribeTabMessages,
  type TabMessage,
} from "@/lib/tab-channel";

import type { ComposerPaletteLevel } from "@/lib/composer-color-palettes";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

/** The eight fixed spots the retired position grid offered, kept as stored values. */
export type SpeedDialCorner =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

/**
 * Where the launcher sits: a legacy corner token, or `<x>,<y>` viewport
 * percentages for the launcher centre, which is what dragging writes.
 */
export type SpeedDialPosition = SpeedDialCorner | `${number},${number}`;

/** Viewport percentage centre each legacy corner token maps to. */
const SPEED_DIAL_CORNER_POINTS: Record<
  SpeedDialCorner,
  { x: number; y: number }
> = {
  "top-left": { x: 4, y: 5 },
  "top-center": { x: 50, y: 5 },
  "top-right": { x: 96, y: 5 },
  "middle-left": { x: 4, y: 50 },
  "middle-right": { x: 96, y: 50 },
  "bottom-left": { x: 4, y: 94 },
  "bottom-center": { x: 50, y: 94 },
  "bottom-right": { x: 96, y: 94 },
};

const SPEED_DIAL_CORNERS = Object.keys(
  SPEED_DIAL_CORNER_POINTS,
) as SpeedDialCorner[];

/**
 * Where the dial sits, and which way its menu opens. The fan points away from the
 * nearest edge; index 0 is east, going clockwise, so each legacy corner keeps the
 * exact fan angle the position grid gave it.
 */
const SPEED_DIAL_OPENINGS: Array<{
  corner: SpeedDialCorner;
  fanStartAngle: number;
}> = [
  { corner: "middle-right", fanStartAngle: 135 },
  { corner: "bottom-right", fanStartAngle: 180 },
  { corner: "bottom-center", fanStartAngle: 225 },
  { corner: "bottom-left", fanStartAngle: 270 },
  { corner: "middle-left", fanStartAngle: 315 },
  { corner: "top-left", fanStartAngle: 0 },
  { corner: "top-center", fanStartAngle: 45 },
  { corner: "top-right", fanStartAngle: 90 },
];

const DEFAULT_SPEED_DIAL_POSITION: SpeedDialCorner = "bottom-right";

/** The opening a dial at the exact centre of the viewport gets. */
const DEFAULT_SPEED_DIAL_OPENING = {
  corner: "bottom-right" as SpeedDialCorner,
  fanStartAngle: 180,
};

const SPEED_DIAL_COORDINATE = /^\d{1,3}(?:\.\d{1,2})?,\d{1,3}(?:\.\d{1,2})?$/;

function clampSpeedDialPercent(value: number): number {
  if (!Number.isFinite(value)) {
    return 50;
  }

  return Math.min(100, Math.max(0, Math.round(value * 100) / 100));
}

function speedDialCornerPoints(value: string): { x: number; y: number } | null {
  return SPEED_DIAL_CORNERS.includes(value as SpeedDialCorner)
    ? SPEED_DIAL_CORNER_POINTS[value as SpeedDialCorner]
    : null;
}

/** The launcher centre, as viewport percentages, for either stored shape. */
export function parseSpeedDialPosition(value: unknown): {
  x: number;
  y: number;
} {
  if (typeof value === "string") {
    const corner = speedDialCornerPoints(value);

    if (corner) {
      return corner;
    }

    if (SPEED_DIAL_COORDINATE.test(value)) {
      const [rawX, rawY] = value.split(",");
      return {
        x: clampSpeedDialPercent(Number(rawX)),
        y: clampSpeedDialPercent(Number(rawY)),
      };
    }
  }

  return SPEED_DIAL_CORNER_POINTS[DEFAULT_SPEED_DIAL_POSITION];
}

/** The value a drop commits. */
export function speedDialPositionValue(
  x: number,
  y: number,
): SpeedDialPosition {
  return `${clampSpeedDialPercent(x)},${clampSpeedDialPercent(y)}`;
}

/**
 * Which way the menu opens, from where the dial itself sits: the fan points away
 * from the nearest edge, so a dial dragged mid-screen opens toward the centre.
 */
export function speedDialOpeningAt(
  x: number,
  y: number,
): { corner: SpeedDialCorner; fanStartAngle: number } {
  const dx = x - 50;
  const dy = y - 50;

  if (dx === 0 && dy === 0) {
    return DEFAULT_SPEED_DIAL_OPENING;
  }

  const degrees = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;

  return (
    SPEED_DIAL_OPENINGS[Math.round(degrees / 45) % 8] ??
    DEFAULT_SPEED_DIAL_OPENING
  );
}

const ADMIN_FAVICON_MODES = new Set<AdminFaviconModePreference>([
  "site",
  "pressed",
]);

const UNDO_SEND_DELAYS = new Set<UndoSendDelaySeconds>([15, 30, 60]);

function normalizeSpeedDialPosition(value: unknown): SpeedDialPosition {
  if (typeof value !== "string") {
    return DEFAULT_SPEED_DIAL_POSITION;
  }

  if (speedDialCornerPoints(value)) {
    return value as SpeedDialCorner;
  }

  if (SPEED_DIAL_COORDINATE.test(value)) {
    const [rawX, rawY] = value.split(",");
    return speedDialPositionValue(Number(rawX), Number(rawY));
  }

  return DEFAULT_SPEED_DIAL_POSITION;
}

function normalizeAdminFaviconMode(value: unknown): AdminFaviconModePreference {
  if (typeof value !== "string") {
    return "pressed";
  }

  return ADMIN_FAVICON_MODES.has(value as AdminFaviconModePreference)
    ? (value as AdminFaviconModePreference)
    : "pressed";
}

function normalizeUndoSendDelay(value: unknown): UndoSendDelaySeconds {
  const numeric = typeof value === "number" ? value : Number(value);

  return UNDO_SEND_DELAYS.has(numeric as UndoSendDelaySeconds)
    ? (numeric as UndoSendDelaySeconds)
    : 15;
}

export type NotificationScope = "all" | "inbox" | "priority";
export type NotificationPreviewLevel = "sender_subject" | "sender" | "none";
export type NotificationSound = "default" | "subtle" | "none";
export type NotificationBadgeCountMode = "unread" | "inbox_unread" | "none";
export type MarkAsReadBehavior = "on_open" | "after_delay" | "manual";
export type DefaultReplyAction = "reply" | "reply_all";
export type AfterMessageAction = "message_list" | "next_message";
export type SendSafetyConfirmation = "external" | "always" | "never";
export type EmailListDefaultSort = "newest" | "oldest" | "sender" | "subject";
export type EmailListDensityPreference =
  | "loose"
  | "comfortable"
  | "compact"
  | "dense";
export type EmailListPreviewPreference = "full" | "snippet" | "hidden";
export type EmailListUnreadIndicator = "dot_and_bold" | "dot" | "bold";
export type EmailListDateGrouping = "none" | "day" | "week";
export type EmailListGroupingPreference = "list" | "threads";
export type AdminFaviconModePreference = "site" | "pressed";
export type ComposerDefaultFormat = "rich_text" | "rtf" | "plain_text";
export type ComposerDefaultFont = "system" | "sans" | "serif" | "mono";
export type ComposerDefaultFontSize = "12" | "14" | "16" | "18";
export type ComposerSignaturePlacement = "end" | "before_quote";
export type UndoSendDelaySeconds = 15 | 30 | 60;
export type ComposerToolbarPreset =
  | "simple"
  | "standard"
  | "advanced"
  | "recommended_mobile"
  | "custom";
export type ComposerToolbarItemId =
  | "history_undo"
  | "history_redo"
  | "ai"
  | "import_export"
  | "block_style"
  | "font_family"
  | "font_size"
  | "bold"
  | "italic"
  | "underline"
  | "strikethrough"
  | "inline_code"
  | "text_color"
  | "highlight_color"
  | "body_background"
  | "align"
  | "list_menu"
  | "line_height"
  | "indent"
  | "outdent"
  | "insert_link"
  | "horizontal_rule"
  | "insert_table"
  | "emoji"
  | "insert_variable"
  | "insert_template_block"
  | "insert_image_library"
  | "content_blocks"
  | "clear_formatting"
  | "more_menu"
  | "preview"
  | "templates"
  | "signature"
  | "print";

/**
 * User preference keys and their types.
 */
/** Mirrors UserPreferences::ALLOWED_VALUES['calendar_default_reminder_minutes']. */
export type CalendarReminderMinutes = 0 | 5 | 15 | 30 | 60 | 1440;

/**
 * Allowed enum values for constrained preferences.
 * Mirrors `UserPreferences::ALLOWED_VALUES`, UI selects must read from here,
 * never from a second hardcoded list.
 */
export const PREFERENCE_ALLOWED_VALUES = {
  admin_favicon_mode: ["site", "pressed"],
  // Calendar is Pro: the Free build carries no calendar preference.
  ...(__ENABLE_CALENDAR__
    ? {
        calendar_time_format: ["12h", "24h"] as const,
        calendar_default_reminder_minutes: [0, 5, 15, 30, 60, 1440] as const,
      }
    : {}),
  email_list_mode: ["pagination", "lazy_loading"],
  email_list_page_size: [20, 50, 100],
  notification_scope: ["all", "inbox", "priority"],
  notification_preview_level: ["sender_subject", "sender", "none"],
  notification_sound: ["default", "subtle", "none"],
  notification_badge_count_mode: ["unread", "inbox_unread", "none"],
  mark_as_read_behavior: ["on_open", "after_delay", "manual"],
  mark_as_read_delay_seconds: [0, 3, 5, 10],
  default_reply_action: ["reply", "reply_all"],
  after_delete_action: ["message_list", "next_message"],
  after_archive_action: ["message_list", "next_message"],
  send_safety_confirmation: ["external", "always", "never"],
  email_list_default_sort: ["newest", "oldest", "sender", "subject"],
  email_list_density: ["loose", "comfortable", "compact", "dense"],
  email_list_preview: ["full", "snippet", "hidden"],
  email_list_unread_indicator: ["dot_and_bold", "dot", "bold"],
  email_list_date_grouping: ["none", "day", "week"],
  email_list_grouping: ["list", "threads"],
  // AI is Pro: the Free build carries no AI preference.
  ...(__ENABLE_AI_SETTINGS__
    ? {
        composer_ai_default_tone: [
          "professional",
          "casual",
          "friendly",
          "formal",
        ] as const,
      }
    : {}),
  composer_default_format: ["rich_text", "rtf", "plain_text"],
  composer_default_font: ["system", "sans", "serif", "mono"],
  composer_default_font_size: ["12", "14", "16", "18"],
  composer_signature_placement: ["end", "before_quote"],
  // Undo send is Pro.
  ...(__ENABLE_UNDO_SEND__
    ? { undo_send_delay_seconds: [15, 30, 60] as const }
    : {}),
  composer_toolbar_preset: [
    "simple",
    "standard",
    "advanced",
    "recommended_mobile",
    "custom",
  ],
  composer_mobile_toolbar_preset: [
    "simple",
    "standard",
    "advanced",
    "recommended_mobile",
    "custom",
  ],
  composer_palette_level: ["full", "reduced", "minimal"],
} as const;

export interface UserPreferences {
  desktop_notifications: boolean;
  email_notifications: boolean;
  auto_archive: boolean;
  confirm_delete: boolean;
  admin_bar_enabled: boolean;
  admin_favicon_mode: AdminFaviconModePreference;
  header_templates_enabled: boolean;
  header_activity_enabled: boolean;
  speed_dial_enabled: boolean;
  speed_dial_position: SpeedDialPosition;
  /** Pro only: when true, skip the discard dialog and silently save to drafts on composer close / route change. */
  auto_save_drafts: boolean;
  // Contacts preferences
  auto_add_contacts: boolean;
  /** Contact list new inbox-saved contacts join. 0 = no default list. */
  contacts_default_list_id: number;
  // Security preferences
  auto_show_images: boolean;
  /** When true, opened email bodies are cached in the site DB for instant reading-pane loads. When false, each email is fetched live from the mail server on open. */
  cache_email_body_content: boolean;
  /** Read-only, from the server: an earlier "stop storing" purge did not finish, so stored content may remain. */
  body_purge_pending?: boolean;
  // Appearance preferences
  disabled_palettes: string[];
  font_preset_id: string;
  custom_display_font: string;
  custom_text_font: string;
  // Calendar display preferences
  calendar_day_start_hour: number;
  calendar_day_end_hour: number;
  calendar_time_format: "12h" | "24h";
  /** Minutes before an event a reminder fires by default (0 = none). */
  calendar_default_reminder_minutes: CalendarReminderMinutes;
  // Email list display preferences
  email_list_mode: "pagination" | "lazy_loading";
  email_list_page_size: 20 | 50 | 100;
  notification_scope: NotificationScope;
  notification_preview_level: NotificationPreviewLevel;
  notification_unread_only: boolean;
  notification_sound: NotificationSound;
  notification_quiet_hours_enabled: boolean;
  notification_quiet_hours_start: string;
  notification_quiet_hours_end: string;
  notification_badge_count_mode: NotificationBadgeCountMode;
  /** Set from the notification popup: no sound and no desktop pop-ups until unmuted. */
  notification_muted: boolean;
  /**
   * Set from the notification popup: the Unix time, in seconds, a pause ends at.
   * -1 pauses until the user resumes, and 0 is not paused. Mirrors the PHP
   * `notification_paused_until`, and is compared with the clock on every read.
   */
  notification_paused_until: number;
  mark_as_read_behavior: MarkAsReadBehavior;
  mark_as_read_delay_seconds: 0 | 3 | 5 | 10;
  default_reply_action: DefaultReplyAction;
  after_delete_action: AfterMessageAction;
  after_archive_action: AfterMessageAction;
  send_safety_confirmation: SendSafetyConfirmation;
  email_list_default_sort: EmailListDefaultSort;
  email_list_density: EmailListDensityPreference;
  email_list_preview: EmailListPreviewPreference;
  email_list_show_account_badge: boolean;
  email_list_show_attachment_icon: boolean;
  email_list_show_reports: boolean;
  email_list_unread_indicator: EmailListUnreadIndicator;
  email_list_date_grouping: EmailListDateGrouping;
  /** Flat list (one row per message) vs threads (one row per conversation). */
  email_list_grouping: EmailListGroupingPreference;
  email_list_remember_folder: boolean;
  // Sweep: senders auto-routed to trash / spam (lowercased email addresses)
  // v2 composer preferences (Area 2J)
  composer_typography_auto_format: boolean;
  composer_ai_default_tone: "professional" | "casual" | "friendly" | "formal";
  /** Replaces the default draft/reply system prompt when non-empty. */
  composer_ai_custom_prompt: string;
  /** Let the auto-tagger apply every matching tag, not just the best one. */
  ai_autotag_multiple: boolean;
  composer_default_format: ComposerDefaultFormat;
  composer_default_font: ComposerDefaultFont;
  composer_default_font_size: ComposerDefaultFontSize;
  composer_signature_placement: ComposerSignaturePlacement;
  composer_confirm_unsaved_close: boolean;
  /** Pro only: queue outbound messages briefly so the user can undo before delivery. */
  undo_send_enabled: boolean;
  undo_send_delay_seconds: UndoSendDelaySeconds;
  composer_toolbar_preset: ComposerToolbarPreset;
  composer_toolbar_items: ComposerToolbarItemId[];
  composer_mobile_toolbar_preset: ComposerToolbarPreset;
  composer_mobile_toolbar_items: ComposerToolbarItemId[];
  // Composer color palette (per-user). The 12 x 11 default grid is locked
  // and lives in @/lib/composer-color-palettes. Only the right-most custom
  // column and the recently-used row are stored here. Both lists are
  // lowercased and validated server-side.
  palette_custom_colors: string[];
  palette_recent_colors: string[];
  /** Density of the composer color popover grid (full / reduced / minimal). */
  composer_palette_level: ComposerPaletteLevel;
  /**
   * Per-user color for each contact flag, keyed by the normalized flag name.
   * Flags are plain strings on `contact.tags`; this map gives the user-chosen
   * color used by the flag badge. Unset flags fall back to a stable hash color.
   */
  contact_flag_colors: Record<string, string>;
}

/**
 * Default values for user preferences.
 */
// Cast: the Free build leaves out preferences for features that only Pro reads.
const DEFAULT_PREFERENCES = {
  desktop_notifications: false,
  email_notifications: true,
  auto_archive: false,
  confirm_delete: true,
  admin_bar_enabled: false,
  admin_favicon_mode: "pressed",
  ...(__ENABLE_TEMPLATES__ ? { header_templates_enabled: true } : {}),
  header_activity_enabled: true,
  speed_dial_enabled: true,
  speed_dial_position: "bottom-right",
  auto_save_drafts: false,
  // Contacts are Pro: the Free build carries no contacts preference.
  ...(__ENABLE_CONTACTS__
    ? { auto_add_contacts: false, contacts_default_list_id: 0 }
    : {}),
  auto_show_images: false,
  cache_email_body_content:
    typeof window === "undefined" ||
    window.pressedmailPlugin?.emailCacheEnabled !== false,
  disabled_palettes: [],
  font_preset_id: "system-default",
  custom_display_font: "",
  custom_text_font: "",
  // Calendar is Pro.
  ...(__ENABLE_CALENDAR__
    ? {
        calendar_day_start_hour: 0,
        calendar_day_end_hour: 23,
        calendar_time_format: "12h" as const,
        calendar_default_reminder_minutes: 15 as const,
      }
    : {}),
  email_list_mode: "pagination",
  email_list_page_size: 50,
  notification_scope: "all",
  notification_preview_level: "sender_subject",
  notification_unread_only: true,
  notification_sound: "none",
  notification_quiet_hours_enabled: false,
  notification_quiet_hours_start: "22:00",
  notification_quiet_hours_end: "07:00",
  notification_badge_count_mode: "unread",
  notification_muted: false,
  notification_paused_until: 0,
  mark_as_read_behavior: "on_open",
  mark_as_read_delay_seconds: 0,
  default_reply_action: "reply",
  after_delete_action: "message_list",
  after_archive_action: "message_list",
  send_safety_confirmation: "external",
  email_list_default_sort: "newest",
  email_list_density: "comfortable",
  email_list_preview: "full",
  email_list_show_account_badge: true,
  email_list_show_attachment_icon: true,
  ...(__ENABLE_TAGS__ ? { email_list_show_reports: true } : {}),
  email_list_unread_indicator: "dot_and_bold",
  email_list_date_grouping: "none",
  email_list_grouping: "list",
  email_list_remember_folder: true,
  composer_typography_auto_format: true,
  // AI is Pro: the Free build carries no AI preference.
  ...(__ENABLE_AI_SETTINGS__
    ? {
        composer_ai_default_tone: "professional" as const,
        composer_ai_custom_prompt: "",
        ai_autotag_multiple: true,
      }
    : {}),
  composer_default_format: "rich_text",
  composer_default_font: "system",
  composer_default_font_size: "14",
  // Above the quoted original, which is where a signature belongs on a reply:
  // at the foot of what the author wrote, not below the message they are
  // answering. Defaulting to "end" is what put it under the quote. The setting
  // still offers that for anyone who wants it there.
  composer_signature_placement: "before_quote",
  composer_confirm_unsaved_close: true,
  // Undo send is Pro.
  ...(__ENABLE_UNDO_SEND__
    ? { undo_send_enabled: false, undo_send_delay_seconds: 15 as const }
    : {}),
  composer_toolbar_preset: "standard",
  composer_toolbar_items: [],
  composer_mobile_toolbar_preset: "recommended_mobile",
  composer_mobile_toolbar_items: [],
  palette_custom_colors: [],
  palette_recent_colors: [],
  composer_palette_level: "reduced",
  contact_flag_colors: {},
} as UserPreferences;

function normalizePreferences(
  preferences: Partial<UserPreferences>,
): UserPreferences {
  const merged = { ...DEFAULT_PREFERENCES, ...preferences };

  return {
    ...merged,
    speed_dial_position: normalizeSpeedDialPosition(merged.speed_dial_position),
    admin_favicon_mode: normalizeAdminFaviconMode(merged.admin_favicon_mode),
    ...(__ENABLE_UNDO_SEND__
      ? {
          undo_send_delay_seconds: normalizeUndoSendDelay(
            merged.undo_send_delay_seconds,
          ),
        }
      : {}),
  };
}

function getApiUrl(): string {
  return (window as any).pressedmailPlugin?.apiUrl || "";
}

interface PreferencesState {
  preferences: UserPreferences;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

// Module-level singleton store so every useUserPreferences() consumer
// shares the same state. Optimistic updates in one component are immediately
// visible to every other component that reads preferences (e.g. the speed
// dial position control updating the ApplicationLayout render guard).
let state: PreferencesState = {
  preferences: DEFAULT_PREFERENCES,
  loading: true,
  saving: false,
  error: null,
};

const listeners = new Set<() => void>();

function setState(updater: (prev: PreferencesState) => PreferencesState) {
  state = updater(state);
  if (!state.saving || !state.preferences.cache_email_body_content)
    setEmailCachePolicy(state.preferences.cache_email_body_content);
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot() {
  return state;
}

/** Live preference snapshot for non-React consumers (composer plugins, formatters). */
export function getUserPreferencesSnapshot(): UserPreferences {
  return state.preferences;
}

let fetchInFlight: Promise<void> | null = null;
let initialFetchStarted = false;
let preferenceWriteVersion = 0;

/**
 * The preferences a second open tab has to hear about at once. Pausing or muting
 * in one tab has to silence the others too, and this store fetches preferences a
 * single time per page, so a change would otherwise wait for a reload. Muting is
 * Pro's: the Free build has no sound or pop-up to silence, and relays no mute.
 */
const RELAYED_PREFERENCE_KEYS: ReadonlySet<string> = new Set([
  "notification_paused_until",
  "notification_muted",
]);

function relayPreferences(updates: Partial<UserPreferences>): void {
  const values = Object.fromEntries(
    Object.entries(updates).filter(
      (entry): entry is [string, boolean | number] =>
        RELAYED_PREFERENCE_KEYS.has(entry[0]) &&
        (typeof entry[1] === "boolean" || typeof entry[1] === "number"),
    ),
  );
  if (Object.keys(values).length > 0) {
    publishTabMessage({ type: "preferences", values });
  }
}

let relayStarted = false;

/**
 * Relayed keys this tab has a save in flight for, and how many. The server has
 * the last word on those, and its answer to the save is what settles them.
 */
const relayedWritesInFlight = new Map<string, number>();

function trackRelayedWrites(keys: string[], change: 1 | -1): void {
  for (const key of keys) {
    if (!RELAYED_PREFERENCE_KEYS.has(key)) continue;
    const count = (relayedWritesInFlight.get(key) ?? 0) + change;
    if (count > 0) relayedWritesInFlight.set(key, count);
    else relayedWritesInFlight.delete(key);
  }
}

function applyRelayedPreferences(message: TabMessage): void {
  if (message.type !== "preferences") return;
  const values = Object.fromEntries(
    Object.entries(message.values).filter(
      ([key]) =>
        RELAYED_PREFERENCE_KEYS.has(key) && !relayedWritesInFlight.has(key),
    ),
  );
  if (Object.keys(values).length === 0) return;
  // Merged in place. The write version is not touched: bumping it made this
  // tab's own saves and its first read discard their answers, so `saving` could
  // stay on and a failed save could keep its optimistic value.
  state = { ...state, preferences: { ...state.preferences, ...values } };
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener(EMAIL_CACHE_POLICY_EVENT, (event) => {
    const detail = (
      event as CustomEvent<{ enabled: boolean; external: boolean }>
    ).detail;
    if (!detail?.external) return;
    preferenceWriteVersion++;
    state = {
      ...state,
      preferences: {
        ...state.preferences,
        cache_email_body_content: detail.enabled,
      },
    };
    listeners.forEach((listener) => listener());
  });
}

/** How soon a tab coming back into view may read the preferences again. */
const REVALIDATE_MIN_INTERVAL_MS = 30_000;
let lastLoadedAt = 0;

/**
 * Read the preferences. A quiet read shows no loading state and reports no
 * error: it is the tab checking whether something changed while it was away.
 */
async function loadPreferences(quiet: boolean): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  const fetchStartedAtWriteVersion = preferenceWriteVersion;
  if (!quiet) setState((prev) => ({ ...prev, loading: true, error: null }));
  fetchInFlight = (async () => {
    try {
      const response = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/user/preferences`,
        {
          headers: {},
        },
      );
      const data = await response.json();
      if (data.status === "success" && data.preferences) {
        lastLoadedAt = Date.now();
        syncServerClock(data.serverTime);
        setState((prev) => ({
          ...prev,
          preferences:
            fetchStartedAtWriteVersion === preferenceWriteVersion
              ? normalizePreferences(data.preferences)
              : prev.preferences,
          loading: false,
        }));
      } else if (!quiet) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            data.message || __("Failed to load preferences", "pressedmail"),
        }));
      }
    } catch (err) {
      if (quiet) return;
      console.error("Failed to fetch user preferences:", err);
      setState((prev) => ({
        ...prev,
        loading: false,
        error:
          fetchStartedAtWriteVersion === preferenceWriteVersion
            ? __("Failed to load preferences", "pressedmail")
            : prev.error,
      }));
    } finally {
      fetchInFlight = null;
    }
  })();
  return fetchInFlight;
}

const fetchPreferences = (): Promise<void> => loadPreferences(false);

/**
 * Read the preferences again for a tab that has just come back into view, at
 * most every half minute. Pause and mute are set from other tabs and other
 * devices, and a tab with no channel to them (no BroadcastChannel or Web Locks,
 * or another device) would otherwise keep the state it loaded with.
 */
function revalidatePreferences(): Promise<void> {
  if (Date.now() - lastLoadedAt < REVALIDATE_MIN_INTERVAL_MS) {
    return Promise.resolve();
  }
  return loadPreferences(true);
}

async function updatePreference<K extends keyof UserPreferences>(
  key: K,
  value: UserPreferences[K],
): Promise<boolean> {
  const writeVersion = preferenceWriteVersion + 1;
  preferenceWriteVersion = writeVersion;
  const previous = state.preferences[key];
  setState((prev) => ({
    ...prev,
    preferences: { ...prev.preferences, [key]: value },
    saving: true,
    error: null,
  }));
  trackRelayedWrites([key], 1);
  try {
    const response = await apiFetch(
      `${getApiUrl()}${getRuntimeRestNamespace()}/user/preferences`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ [key]: value }),
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.preferences) {
      syncServerClock(data.serverTime);
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? normalizePreferences(data.preferences)
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      }));
      // What the server kept, not what was sent: it may have held the value back.
      relayPreferences({ [key]: data.preferences[key] } as Partial<UserPreferences>);
      return true;
    } else {
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? data.preferences
              ? normalizePreferences(data.preferences)
              : { ...prev.preferences, [key]: previous }
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
        error:
          writeVersion === preferenceWriteVersion
            ? data.message || __("Failed to update preference", "pressedmail")
            : prev.error,
      }));
      return false;
    }
  } catch (err) {
    console.error("Failed to update user preference:", err);
    setState((prev) => ({
      ...prev,
      preferences:
        writeVersion === preferenceWriteVersion
          ? {
              ...prev.preferences,
              [key]:
                key === "cache_email_body_content" && value === false
                  ? false
                  : previous,
            }
          : prev.preferences,
      saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      error:
        writeVersion === preferenceWriteVersion
          ? __("Failed to save preference", "pressedmail")
          : prev.error,
    }));
    return false;
  } finally {
    trackRelayedWrites([key], -1);
  }
}

async function updatePreferences(
  updates: Partial<UserPreferences>,
  options: { optimistic?: boolean } = {},
): Promise<boolean> {
  const writeVersion = preferenceWriteVersion + 1;
  preferenceWriteVersion = writeVersion;
  const previous = state.preferences;
  const optimistic = options.optimistic !== false;
  setState((prev) => ({
    ...prev,
    preferences: optimistic
      ? { ...prev.preferences, ...updates }
      : prev.preferences,
    saving: true,
    error: null,
  }));
  trackRelayedWrites(Object.keys(updates), 1);
  try {
    const response = await apiFetch(
      `${getApiUrl()}${getRuntimeRestNamespace()}/user/preferences`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(updates),
      },
    );
    const data = await response.json();
    if (data.status === "success" && data.preferences) {
      syncServerClock(data.serverTime);
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? normalizePreferences(data.preferences)
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      }));
      relayPreferences(
        Object.fromEntries(
          Object.keys(updates).map((key) => [key, data.preferences[key]]),
        ) as Partial<UserPreferences>,
      );
      return true;
    } else {
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion && optimistic
            ? previous
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
        error:
          writeVersion === preferenceWriteVersion
            ? data.message || __("Failed to update preferences", "pressedmail")
            : prev.error,
      }));
      return false;
    }
  } catch (err) {
    console.error("Failed to update user preferences:", err);
    setState((prev) => ({
      ...prev,
      preferences:
        writeVersion === preferenceWriteVersion && optimistic
          ? updates.cache_email_body_content === false
            ? { ...previous, cache_email_body_content: false }
            : previous
          : prev.preferences,
      saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      error:
        writeVersion === preferenceWriteVersion
          ? __("Failed to save preferences", "pressedmail")
          : prev.error,
    }));
    return false;
  } finally {
    trackRelayedWrites(Object.keys(updates), -1);
  }
}

/**
 * Hook for managing user preferences with backend persistence.
 *
 * Backed by a module-level singleton store so all consumers see the same
 * state and optimistic updates propagate across the component tree.
 */
export function useUserPreferences() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    if (!initialFetchStarted) {
      initialFetchStarted = true;
      fetchPreferences();
    }
    if (!relayStarted) {
      relayStarted = true;
      subscribeTabMessages(applyRelayedPreferences);
    }
  }, []);

  return {
    preferences: snapshot.preferences,
    loading: snapshot.loading,
    saving: snapshot.saving,
    error: snapshot.error,
    updatePreference,
    updatePreferences,
    refetch: fetchPreferences,
    revalidate: revalidatePreferences,
  };
}
