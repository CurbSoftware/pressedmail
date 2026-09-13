import { useEffect, useSyncExternalStore } from "react";
import { __ } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";

import type { ComposerPaletteLevel } from "@/lib/composer-color-palettes";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

export type SpeedDialPosition =
  | "top-left"
  | "top-center"
  | "top-right"
  | "middle-left"
  | "off"
  | "middle-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right";

const SPEED_DIAL_POSITIONS = new Set<SpeedDialPosition>([
  "top-left",
  "top-center",
  "top-right",
  "middle-left",
  "off",
  "middle-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);

const ADMIN_FAVICON_MODES = new Set<AdminFaviconModePreference>([
  "site",
  "pressed",
]);

const UNDO_SEND_DELAYS = new Set<UndoSendDelaySeconds>([15, 30, 60]);

function normalizeSpeedDialPosition(value: unknown): SpeedDialPosition {
  if (typeof value !== "string") {
    return "bottom-right";
  }

  return SPEED_DIAL_POSITIONS.has(value as SpeedDialPosition)
    ? (value as SpeedDialPosition)
    : "bottom-right";
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
export type ComposerDefaultFormat = "rich_text" | "plain_text";
export type ComposerDefaultFont = "system" | "sans" | "serif" | "mono";
export type ComposerDefaultFontSize = "12" | "14" | "16" | "18";
export type ComposerSignaturePlacement = "end" | "before_quote";
export type ComposerReplySignatureBehavior =
  | "include"
  | "new_messages_only"
  | "none";
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
  | "insert_image_library"
  | "content_blocks"
  | "clear_formatting"
  | "more_menu"
  | "preview"
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
  speed_dial_position: [
    "top-left",
    "top-center",
    "top-right",
    "middle-left",
    "off",
    "middle-right",
    "bottom-left",
    "bottom-center",
    "bottom-right",
  ],
  calendar_time_format: ["12h", "24h"],
  calendar_default_reminder_minutes: [0, 5, 15, 30, 60, 1440],
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
  composer_ai_default_tone: ["professional", "casual", "friendly", "formal"],
  composer_default_format: ["rich_text", "plain_text"],
  composer_default_font: ["system", "sans", "serif", "mono"],
  composer_default_font_size: ["12", "14", "16", "18"],
  composer_signature_placement: ["end", "before_quote"],
  composer_reply_signature_behavior: ["include", "new_messages_only", "none"],
  undo_send_delay_seconds: [15, 30, 60],
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
  email_list_unread_indicator: EmailListUnreadIndicator;
  email_list_date_grouping: EmailListDateGrouping;
  /** Flat list (one row per message) vs threads (one row per conversation). */
  email_list_grouping: EmailListGroupingPreference;
  email_list_remember_folder: boolean;
  // Sweep: senders auto-routed to trash / spam (lowercased email addresses)
  // v2 composer preferences (Area 2J)
  composer_typography_auto_format: boolean;
  composer_ai_default_tone: "professional" | "casual" | "friendly" | "formal";
  composer_default_format: ComposerDefaultFormat;
  composer_default_font: ComposerDefaultFont;
  composer_default_font_size: ComposerDefaultFontSize;
  composer_signature_placement: ComposerSignaturePlacement;
  composer_reply_signature_behavior: ComposerReplySignatureBehavior;
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
const DEFAULT_PREFERENCES: UserPreferences = {
  desktop_notifications: false,
  email_notifications: true,
  auto_archive: false,
  confirm_delete: true,
  admin_bar_enabled: false,
  admin_favicon_mode: "pressed",
  speed_dial_position: "bottom-right",
  auto_save_drafts: false,
  auto_add_contacts: false,
  contacts_default_list_id: 0,
  auto_show_images: false,
  cache_email_body_content: true,
  disabled_palettes: [],
  font_preset_id: "system-default",
  custom_display_font: "",
  custom_text_font: "",
  calendar_day_start_hour: 0,
  calendar_day_end_hour: 23,
  calendar_time_format: "12h",
  calendar_default_reminder_minutes: 15,
  email_list_mode: "pagination",
  email_list_page_size: 50,
  notification_scope: "all",
  notification_preview_level: "sender_subject",
  notification_unread_only: true,
  notification_sound: "default",
  notification_quiet_hours_enabled: false,
  notification_quiet_hours_start: "22:00",
  notification_quiet_hours_end: "07:00",
  notification_badge_count_mode: "unread",
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
  email_list_unread_indicator: "dot_and_bold",
  email_list_date_grouping: "none",
  email_list_grouping: "list",
  email_list_remember_folder: true,
  composer_typography_auto_format: true,
  composer_ai_default_tone: "professional",
  composer_default_format: "rich_text",
  composer_default_font: "system",
  composer_default_font_size: "14",
  composer_signature_placement: "end",
  composer_reply_signature_behavior: "include",
  composer_confirm_unsaved_close: true,
  undo_send_enabled: false,
  undo_send_delay_seconds: 15,
  composer_toolbar_preset: "standard",
  composer_toolbar_items: [],
  composer_mobile_toolbar_preset: "recommended_mobile",
  composer_mobile_toolbar_items: [],
  palette_custom_colors: [],
  palette_recent_colors: [],
  composer_palette_level: "reduced",
  contact_flag_colors: {},
};

function normalizePreferences(
  preferences: Partial<UserPreferences>,
): UserPreferences {
  const merged = { ...DEFAULT_PREFERENCES, ...preferences };

  return {
    ...merged,
    speed_dial_position: normalizeSpeedDialPosition(merged.speed_dial_position),
    admin_favicon_mode: normalizeAdminFaviconMode(merged.admin_favicon_mode),
    undo_send_delay_seconds: normalizeUndoSendDelay(
      merged.undo_send_delay_seconds,
    ),
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

async function fetchPreferences(): Promise<void> {
  if (fetchInFlight) return fetchInFlight;
  const fetchStartedAtWriteVersion = preferenceWriteVersion;
  setState((prev) => ({ ...prev, loading: true, error: null }));
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
        setState((prev) => ({
          ...prev,
          preferences:
            fetchStartedAtWriteVersion === preferenceWriteVersion
              ? normalizePreferences(data.preferences)
              : prev.preferences,
          loading: false,
        }));
      } else {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            data.message || __("Failed to load preferences", "pressedmail"),
        }));
      }
    } catch (err) {
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
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? normalizePreferences(data.preferences)
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      }));
      return true;
    } else {
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? { ...prev.preferences, [key]: previous }
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
          ? { ...prev.preferences, [key]: previous }
          : prev.preferences,
      saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      error:
        writeVersion === preferenceWriteVersion
          ? __("Failed to save preference", "pressedmail")
          : prev.error,
    }));
    return false;
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
      setState((prev) => ({
        ...prev,
        preferences:
          writeVersion === preferenceWriteVersion
            ? normalizePreferences(data.preferences)
            : prev.preferences,
        saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      }));
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
          ? previous
          : prev.preferences,
      saving: writeVersion === preferenceWriteVersion ? false : prev.saving,
      error:
        writeVersion === preferenceWriteVersion
          ? __("Failed to save preferences", "pressedmail")
          : prev.error,
    }));
    return false;
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
  }, []);

  return {
    preferences: snapshot.preferences,
    loading: snapshot.loading,
    saving: snapshot.saving,
    error: snapshot.error,
    updatePreference,
    updatePreferences,
    refetch: fetchPreferences,
  };
}
