import { __ } from "@wordpress/i18n";

import type {
  EmailImportanceSource,
  EmailMessage,
  EmailMessageTag,
} from "@/types";
import { getAccountBadgeLabel } from "@/lib/account-label";
import { parseEmailDate } from "@/lib/email-date";
import { buildEmailPreviewText } from "@/lib/email-content-normalization";
import { parseSenderEmail, parseSenderName } from "@/lib/mail-utils";
import { formatScheduledTime } from "@/types/scheduled-emails";

import { decodeMimeWords } from "./mail-display";

export type EmailRowVariant =
  | "default-flat"
  | "pressedg-table"
  | "pressedout-classic";

export type EmailRowDensity = "loose" | "comfortable" | "compact" | "dense";

export interface EmailRowViewModel {
  id: string | number;
  senderName: string;
  senderEmail: string | null;
  subject: string;
  preview: string;
  dateLabel: string;
  isUnread: boolean;
  isStarred: boolean;
  isImportant: boolean;
  /** Why the row is important, when the payload says. */
  importanceSource: EmailImportanceSource | null;
  /** True when this row backs a scheduled email; dateLabel then shows the send time. */
  isScheduled: boolean;
  scheduledStatus?: string;
  hasAttachment: boolean;
  visibleLabels: string[];
  extraLabelCount: number;
  allTags: EmailMessageTag[];
  visibleTags: EmailMessageTag[];
  extraTagCount: number;
  accountBadge: {
    label: string;
    title: string;
  } | null;
}

export interface BuildEmailRowViewModelOptions {
  showAccountBadge?: boolean;
  showSenderEmail?: boolean;
  maxPreviewLength?: number;
  maxLabels?: number;
  maxTags?: number;
  now?: Date;
}

const FOLDER_NAMES = new Set([
  "inbox",
  "sent",
  "drafts",
  "trash",
  "spam",
  "junk",
  "archive",
  "all mail",
  "starred",
  "important",
]);

function formatSmartTimestamp(date: Date | null, now = new Date()) {
  if (!date) return "";

  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dateDay = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const diffDays = Math.floor(
    (today.getTime() - dateDay.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays === 0) {
    return date.toLocaleTimeString([], {
      hour: "numeric",
      minute: "2-digit",
    });
  }

  if (diffDays > 0 && diffDays < 7) {
    return date.toLocaleDateString([], { weekday: "short" });
  }

  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

function getVisibleTags(tags: unknown, maxTags: number) {
  const source = Array.isArray(tags) ? tags : [];
  const valid = source.filter((tag): tag is EmailMessageTag => {
    return (
      !!tag &&
      typeof tag === "object" &&
      typeof (tag as EmailMessageTag).id === "number" &&
      typeof (tag as EmailMessageTag).name === "string" &&
      typeof (tag as EmailMessageTag).color === "string"
    );
  });

  return {
    allTags: valid,
    visibleTags: valid.slice(0, maxTags),
    extraTagCount: Math.max(0, valid.length - maxTags),
  };
}

function getVisibleLabels(labels: unknown, maxLabels: number) {
  const source = Array.isArray(labels) ? labels : [];
  const displayLabels = source.filter((label): label is string => {
    return (
      typeof label === "string" &&
      label.trim().length > 0 &&
      !FOLDER_NAMES.has(label.toLowerCase())
    );
  });

  return {
    visibleLabels: displayLabels.slice(0, maxLabels),
    extraLabelCount: Math.max(0, displayLabels.length - maxLabels),
  };
}

export function buildEmailRowViewModel(
  message: EmailMessage,
  options: BuildEmailRowViewModelOptions = {},
): EmailRowViewModel {
  const maxLabels = options.maxLabels ?? 2;
  const { visibleLabels, extraLabelCount } = getVisibleLabels(
    message.labels,
    maxLabels,
  );
  const maxTags = options.maxTags ?? 3;
  const { allTags, visibleTags, extraTagCount } = getVisibleTags(
    message.tags,
    maxTags,
  );
  const accountEmail = message.accountEmail;

  const isScheduled =
    Boolean(message.isScheduled) || message.scheduledEmailId != null;
  const scheduledStatus =
    typeof message.scheduledStatus === "string"
      ? message.scheduledStatus
      : undefined;

  return {
    id: message.uid ?? message.id,
    senderName: parseSenderName(message),
    senderEmail: options.showSenderEmail ? parseSenderEmail(message) : null,
    subject:
      decodeMimeWords(message.subject) || __("No subject", "pressedmail"),
    preview: buildEmailPreviewText(
      [
        message.preview,
        message.snippet,
        message.text,
        message.textBody,
        message.body,
        message.htmlBody,
      ],
      options.maxPreviewLength ?? 120,
    ),
    dateLabel:
      isScheduled && message.scheduledAt
        ? formatScheduledTime(message.scheduledAt)
        : formatSmartTimestamp(
            parseEmailDate(message.receivedDate ?? message.date),
            options.now,
          ),
    isUnread: !message.read,
    isStarred: Boolean(message.starred),
    isImportant:
      typeof message.important === "boolean"
        ? message.important
        : Boolean(message.is_important),
    importanceSource: message.importanceSource ?? null,
    isScheduled,
    scheduledStatus,
    hasAttachment: Boolean(
      message.hasAttachments ||
      message.attachments?.length ||
      message.attachmentsMeta?.length,
    ),
    visibleLabels,
    extraLabelCount,
    allTags,
    visibleTags,
    extraTagCount,
    accountBadge:
      options.showAccountBadge && accountEmail
        ? {
            label: getAccountBadgeLabel(message) ?? accountEmail,
            title: accountEmail,
          }
        : null,
  };
}
