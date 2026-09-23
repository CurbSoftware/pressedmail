import type { EmailListSortState } from "@/lib/email-list-sort";
import type { PlateEmailEditorDialect } from "@kit/plate/email-surfaces";
import { utcIsoToZonedInput } from "@/components/calendar/calendar-timezone";
import { getRuntimeSiteTimezone } from "@/lib/runtime-config";
import { getMessageIdentityKey } from "@/lib/message-identity";
import type { EmailMessage } from "@/types";
import type {
  EmailListDateGrouping,
  EmailListDefaultSort,
  EmailListDensityPreference,
  EmailListPreviewPreference,
  EmailListUnreadIndicator,
  MarkAsReadBehavior,
  SendSafetyConfirmation,
  UserPreferences,
} from "@/hooks/useUserPreferences";

export function composerDefaultFormatToContentType(
  format: UserPreferences["composer_default_format"] | undefined,
): "html" | "plain" {
  return format === "plain_text" ? "plain" : "html";
}

/**
 * `rich_text` is the legacy preference value that currently means Markdown.
 * `rtf` selects the existing chrome-less Rich text dialect.
 */
export function composerDefaultFormatToDialect(
  format: UserPreferences["composer_default_format"] | undefined,
): PlateEmailEditorDialect {
  switch (format) {
    case "rtf":
      return "rich_text";
    case "plain_text":
      return "plain";
    case "rich_text":
    default:
      return "markdown";
  }
}

export function markAsReadDelayMs(
  behavior: MarkAsReadBehavior,
  delaySeconds: number,
): number | null {
  if (behavior === "manual") {
    return null;
  }
  if (behavior === "after_delay") {
    return Math.max(0, delaySeconds) * 1000;
  }
  return 0;
}

export function shouldConfirmSend(
  policy: SendSafetyConfirmation,
  hasExternalRecipient: boolean,
): boolean {
  if (policy === "never") {
    return false;
  }
  if (policy === "always") {
    return true;
  }
  return hasExternalRecipient;
}

export function emailListSortStateFromPreference(
  sort: EmailListDefaultSort,
): EmailListSortState {
  switch (sort) {
    case "oldest":
      return { column: "date", order: "asc" };
    case "sender":
      return { column: "from", order: "asc" };
    case "subject":
      return { column: "subject", order: "asc" };
    case "newest":
    default:
      return { column: "date", order: "desc" };
  }
}

export function composerFontFamilyCss(
  font: UserPreferences["composer_default_font"],
): string {
  switch (font) {
    case "sans":
      return "ui-sans-serif, system-ui, sans-serif";
    case "serif":
      return "ui-serif, Georgia, serif";
    case "mono":
      return "ui-monospace, SFMono-Regular, monospace";
    case "system":
    default:
      return "system-ui, sans-serif";
  }
}

export function getEmailListRowPresentation(preferences: UserPreferences): {
  density: EmailListDensityPreference;
  showPreview: boolean;
  preview: EmailListPreviewPreference;
  showAccountBadge: boolean;
  showAttachmentIcon: boolean;
  unreadIndicator: EmailListUnreadIndicator;
  dateGrouping: EmailListDateGrouping;
} {
  const preview = preferences.email_list_preview ?? "full";
  return {
    density: preferences.email_list_density ?? "comfortable",
    showPreview: preview !== "hidden",
    preview,
    showAccountBadge: preferences.email_list_show_account_badge ?? true,
    showAttachmentIcon: preferences.email_list_show_attachment_icon ?? true,
    unreadIndicator: preferences.email_list_unread_indicator ?? "dot_and_bold",
    dateGrouping: preferences.email_list_date_grouping ?? "none",
  };
}

export function isQuietHoursActive(
  preferences: Pick<
    UserPreferences,
    | "notification_quiet_hours_enabled"
    | "notification_quiet_hours_start"
    | "notification_quiet_hours_end"
  >,
  now: Date = new Date(),
): boolean {
  if (!preferences.notification_quiet_hours_enabled) {
    return false;
  }

  const siteWallTime = utcIsoToZonedInput(
    now.toISOString(),
    getRuntimeSiteTimezone(),
  );
  const current = parseHm(siteWallTime.slice(11, 16));
  const start = parseHm(preferences.notification_quiet_hours_start);
  const end = parseHm(preferences.notification_quiet_hours_end);
  if (start === end) {
    return true;
  }
  if (start < end) {
    return current >= start && current < end;
  }
  return current >= start || current < end;
}

function parseHm(value: string): number {
  const [hours, minutes] = value.split(":").map((part) => Number(part));
  if (
    hours === undefined ||
    minutes === undefined ||
    !Number.isFinite(hours) ||
    !Number.isFinite(minutes)
  ) {
    return 0;
  }
  return hours * 60 + minutes;
}

export function shouldShowInboxAlert(options: {
  preferences: Pick<
    UserPreferences,
    | "notification_scope"
    | "notification_unread_only"
    | "notification_quiet_hours_enabled"
    | "notification_quiet_hours_start"
    | "notification_quiet_hours_end"
  >;
  folder?: string | null;
  unread?: boolean;
  priority?: boolean;
  now?: Date;
}): boolean {
  const { preferences, folder, unread = true, priority = false, now } = options;
  if (isQuietHoursActive(preferences, now)) {
    return false;
  }
  if (preferences.notification_unread_only && !unread) {
    return false;
  }
  if (preferences.notification_scope === "inbox") {
    return (folder ?? "INBOX").toUpperCase() === "INBOX";
  }
  if (preferences.notification_scope === "priority") {
    return priority;
  }
  return true;
}

export function resolveNotificationBadgeCount(options: {
  mode: UserPreferences["notification_badge_count_mode"];
  unreadCount: number;
  inboxUnreadCount: number;
}): number {
  switch (options.mode) {
    case "none":
      return 0;
    case "inbox_unread":
      return options.inboxUnreadCount;
    case "unread":
    default:
      return options.unreadCount;
  }
}

export function isPaletteDisabled(
  paletteId: string,
  disabledPalettes: readonly string[],
): boolean {
  return disabledPalettes.includes(paletteId);
}

export function hasExternalRecipient(
  recipientEmails: readonly string[],
  accountEmail: string,
): boolean {
  const ownDomain = domainFromAddress(accountEmail);
  if (!ownDomain) {
    return recipientEmails.length > 0;
  }
  return recipientEmails.some((address) => {
    const domain = domainFromAddress(address);
    return Boolean(domain) && domain !== ownDomain;
  });
}

function domainFromAddress(value: string): string | null {
  const match = value
    .trim()
    .toLowerCase()
    .match(/[a-z0-9._%+-]+@([a-z0-9.-]+\.[a-z]{2,})/);
  return match?.[1] ?? null;
}

export function emailListDateGroupKey(
  iso: string | undefined,
  grouping: EmailListDateGrouping,
): string | null {
  if (grouping === "none") {
    return null;
  }
  const date = iso ? new Date(iso) : null;
  if (!date || Number.isNaN(date.getTime())) {
    return "unknown";
  }
  if (grouping === "day") {
    return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
  }
  const weekStart = new Date(date);
  const weekday = (weekStart.getDay() + 6) % 7;
  weekStart.setDate(weekStart.getDate() - weekday);
  return `w-${weekStart.getFullYear()}-${weekStart.getMonth() + 1}-${weekStart.getDate()}`;
}

export function nextVisibleMessageAfterRemoval<
  T extends {
    id?: string | number;
    uid?: string | number;
    accountId?: string | number | null;
    consolidatedUid?: string | number;
    folder?: string;
    uidValidity?: string | number;
    uid_validity?: string | number;
  },
>(messages: readonly T[], removedIds: readonly string[]): T | null {
  const removed = new Set(removedIds.map(String));
  const isRemoved = (message: T) => {
    const key = getMessageIdentityKey(message as unknown as EmailMessage);
    return key !== "" && removed.has(key);
  };
  const index = messages.findIndex(isRemoved);
  const remaining = messages.filter((message) => !isRemoved(message));
  if (remaining.length === 0) {
    return null;
  }
  if (index < 0) {
    return remaining[0] ?? null;
  }
  return remaining[Math.min(index, remaining.length - 1)] ?? null;
}
