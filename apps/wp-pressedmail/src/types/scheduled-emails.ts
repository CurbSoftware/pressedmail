/**
 * Scheduled Emails Types
 *
 * TypeScript types for the Email Scheduling feature.
 *
 * @since 1.5.0
 */

/**
 * Scheduled email status.
 */
export type ScheduledEmailStatus =
  | "pending"
  | "sending"
  | "sent"
  | "failed"
  | "cancelled";

import { __ } from "@wordpress/i18n";

import { unwrapEmailBodyHtml } from "@/services/email-safe-html.service";
import type { ComposeData, EmailContentType } from "@/types";
import type { ContactListRecipientDescriptor } from "@/types/recipients";

export type { EmailContentType } from "@/types";

/**
 * Scheduled email.
 */
export interface ScheduledEmail {
  id: number;
  user_id: number;
  account_id: number;
  draft_uid?: string | null;
  draft_folder?: string | null;
  draft_uidvalidity?: number | null;
  message_id?: string | null;
  in_reply_to?: string | null;
  message_references?: string | null;
  to_addresses: string;
  cc_addresses: string | null;
  bcc_addresses: string | null;
  contact_lists?: ContactListRecipientDescriptor[];
  subject: string | null;
  body: string | null;
  tracking_requested?: boolean;
  tracking_consent_revision?: string | null;
  content_type: EmailContentType;
  attachments: string | null;
  scheduled_at: string;
  status: ScheduledEmailStatus;
  sent_at: string | null;
  error_message: string | null;
  created_at: string | null;
  updated_at: string | null;
}

/**
 * Data for scheduling a new email.
 */
export interface ScheduleEmailData {
  in_reply_to?: string;
  references?: string;
  account_id: number;
  to_addresses: string | string[];
  cc_addresses?: string | string[];
  bcc_addresses?: string | string[];
  subject?: string;
  body?: string;
  content_type?: EmailContentType;
  attachments?: ScheduledAttachmentDescriptor[];
  tracking_requested?: boolean;
  tracking_consent_revision?: string;
  scheduled_at: string;
}

/**
 * Data for updating a scheduled email.
 */
export interface UpdateScheduledEmailData {
  in_reply_to?: string;
  references?: string;
  to_addresses?: string | string[];
  cc_addresses?: string | string[];
  bcc_addresses?: string | string[];
  subject?: string;
  body?: string;
  content_type?: EmailContentType;
  scheduled_at?: string;
  prior_draft_uid?: string;
  prior_draft_folder?: string;
  prior_draft_account_id?: number;
  prior_draft_uidvalidity?: number;
  prior_draft_message_id?: string;
}

/**
 * Status counts for scheduled emails.
 */
export interface ScheduledEmailCounts {
  pending: number;
  sent: number;
  failed: number;
  cancelled: number;
}

/**
 * API response for listing scheduled emails.
 */
export interface ScheduledEmailsListResponse {
  status: "success" | "error";
  message?: string;
  data: {
    emails: ScheduledEmail[];
    counts: ScheduledEmailCounts;
  };
}

/**
 * API response for single scheduled email.
 */
export interface ScheduledEmailResponse {
  status: "success" | "error";
  message?: string;
  data: ScheduledEmail;
}

/**
 * API response for scheduling an email.
 */
export interface ScheduleEmailResponse {
  status: "success" | "error";
  message?: string;
  data?: {
    id: number;
    scheduled_at: string;
  };
}

/**
 * API response for generic operations.
 */
export interface ScheduledEmailActionResponse {
  status: "success" | "error";
  message?: string;
  data?: ScheduledEmail;
}

export interface ScheduledDraftHandoff {
  draft_uid: string;
  draft_folder: string;
  draft_account_id: number;
  draft_uidvalidity: number;
  draft_message_id: string;
}

export function parseScheduledDraftHandoff(
  value: unknown,
): ScheduledDraftHandoff | null {
  if (!value || typeof value !== "object") return null;

  const response = value as Record<string, unknown>;
  if (
    response.status !== "success" ||
    !response.data ||
    typeof response.data !== "object"
  ) {
    return null;
  }

  const handoff = response.data as Record<string, unknown>;
  if (
    typeof handoff.draft_uid !== "string" ||
    !handoff.draft_uid.trim() ||
    typeof handoff.draft_folder !== "string" ||
    !handoff.draft_folder.trim() ||
    !Number.isInteger(handoff.draft_account_id) ||
    Number(handoff.draft_account_id) <= 0 ||
    !Number.isInteger(handoff.draft_uidvalidity) ||
    Number(handoff.draft_uidvalidity) <= 0 ||
    typeof handoff.draft_message_id !== "string" ||
    !handoff.draft_message_id.trim()
  ) {
    return null;
  }

  return handoff as unknown as ScheduledDraftHandoff;
}

/**
 * Durable descriptor stored for each scheduled-email attachment. Only Media
 * Library items (which have a persistent WordPress attachment id) can be
 * scheduled, since transient upload temp files do not survive until send time.
 */
export interface ScheduledAttachmentDescriptor {
  id?: number;
  wpAttachmentId?: number;
  sha256?: string;
  filename?: string;
  mimeType?: string;
  mime?: string;
  size?: number;
  url?: string;
  source?: string;
}

/**
 * Parse the stored attachments JSON (ScheduledEmail.attachments) into descriptor
 * objects. Tolerates null / malformed JSON and ignores non-object entries.
 */
export function parseScheduledAttachments(
  raw?: string | null,
  strict = false,
): ScheduledAttachmentDescriptor[] {
  if (!raw) {
    return [];
  }

  try {
    const parsed: unknown = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (Array.isArray(parsed)) {
      if (
        strict &&
        parsed.some(
          (entry) =>
            !entry || typeof entry !== "object" || Array.isArray(entry),
        )
      ) {
        throw new Error("Invalid scheduled attachment record.");
      }
      return parsed.filter(
        (entry): entry is ScheduledAttachmentDescriptor =>
          !!entry && typeof entry === "object",
      );
    }
  } catch {
    if (strict)
      throw new Error(
        __(
          "The saved attachments cannot be restored. Cancel this schedule and select the files again.",
          "pressedmail",
        ),
      );
  }
  if (strict)
    throw new Error(
      __(
        "The saved attachments cannot be restored. Cancel this schedule and select the files again.",
        "pressedmail",
      ),
    );
  return [];
}

export function parseScheduledAddresses(addresses?: string | null): string[] {
  if (!addresses) {
    return [];
  }

  try {
    const parsed = JSON.parse(addresses);
    if (Array.isArray(parsed)) {
      return parsed.map(String).filter(Boolean);
    }
  } catch {
    // Fall back to the raw string below.
  }

  return addresses
    .split(",")
    .map((address) => address.trim())
    .filter(Boolean);
}

export function getScheduledComposeData(
  email: ScheduledEmail,
  draft: ScheduledDraftHandoff,
): Partial<ComposeData> {
  const attachments = parseScheduledAttachments(email.attachments, true)
    .map((descriptor) => {
      const wpId = descriptor.wpAttachmentId ?? descriptor.id;
      if (
        typeof wpId !== "number" ||
        !Number.isSafeInteger(wpId) ||
        wpId <= 0 ||
        descriptor.source !== "media-library" ||
        typeof descriptor.filename !== "string" ||
        typeof descriptor.mimeType !== "string" ||
        !Number.isSafeInteger(descriptor.size) ||
        (descriptor.size ?? -1) < 0 ||
        typeof descriptor.sha256 !== "string" ||
        !/^[a-f0-9]{64}$/.test(descriptor.sha256)
      ) {
        throw new Error(
          __(
            "The saved attachments cannot be restored. Cancel this schedule and select the files again.",
            "pressedmail",
          ),
        );
      }
      return {
        id: `wp-media-${wpId}`,
        wpAttachmentId: wpId,
        sha256: descriptor.sha256,
        filename: descriptor.filename ?? "",
        mimeType: descriptor.mimeType ?? descriptor.mime ?? "",
        size: descriptor.size ?? 0,
        url: descriptor.url,
        source: "media-library" as const,
      };
    })
    .filter((attachment): attachment is NonNullable<typeof attachment> =>
      Boolean(attachment),
    );

  const contentType = email.content_type ?? "html";
  const trackingRequested =
    contentType === "html" && email.tracking_requested === true;
  if (
    trackingRequested &&
    !/^[a-f0-9]{32}$/.test(email.tracking_consent_revision ?? "")
  ) {
    throw new Error(
      __(
        "The saved read receipt consent cannot be verified. Cancel this schedule and compose the message again.",
        "pressedmail",
      ),
    );
  }
  // The row stores send-prepared HTML, wrapper and all. Strip it on the way
  // back into the composer, and recover the background: nothing else persists
  // that colour, so the wrapper is the only record of it.
  const unwrapped =
    contentType === "plain"
      ? { html: email.body ?? "", bodyBackgroundColor: undefined }
      : unwrapEmailBodyHtml(email.body ?? "");

  return {
    to: parseScheduledAddresses(email.to_addresses).join(", "),
    cc: parseScheduledAddresses(email.cc_addresses).join(", "),
    bcc: parseScheduledAddresses(email.bcc_addresses).join(", "),
    contactLists: email.contact_lists ?? [],
    subject: email.subject ?? "",
    readReceipt: {
      requested: trackingRequested,
      revision: trackingRequested ? email.tracking_consent_revision! : "",
    },
    inReplyTo: email.in_reply_to ?? undefined,
    references: email.message_references ?? undefined,
    body: unwrapped.html,
    bodyBackgroundColor: unwrapped.bodyBackgroundColor,
    contentType,
    attachments,
    scheduledEmailId: email.id,
    scheduledAccountId: email.account_id,
    scheduledAt: email.scheduled_at,
    draftUid: draft.draft_uid,
    draftFolder: draft.draft_folder,
    draftAccountId: draft.draft_account_id,
    draftUidValidity: draft.draft_uidvalidity,
    draftMessageId: draft.draft_message_id,
  };
}

/**
 * Quick schedule options.
 */
export type QuickScheduleOption =
  | "tomorrow_9am"
  | "tomorrow_1pm"
  | "monday_9am"
  | "next_week"
  | "custom";

/**
 * Get next occurrence of a time.
 */
export function getQuickScheduleDate(option: QuickScheduleOption): Date | null {
  const now = new Date();

  switch (option) {
    case "tomorrow_9am": {
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      date.setHours(9, 0, 0, 0);
      return date;
    }
    case "tomorrow_1pm": {
      const date = new Date(now);
      date.setDate(date.getDate() + 1);
      date.setHours(13, 0, 0, 0);
      return date;
    }
    case "monday_9am": {
      const date = new Date(now);
      const daysUntilMonday = (8 - date.getDay()) % 7 || 7;
      date.setDate(date.getDate() + daysUntilMonday);
      date.setHours(9, 0, 0, 0);
      return date;
    }
    case "next_week": {
      const date = new Date(now);
      date.setDate(date.getDate() + 7);
      date.setHours(9, 0, 0, 0);
      return date;
    }
    case "custom":
      return null;
  }
}

/**
 * Format scheduled time for display.
 */
export function formatScheduledTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const isToday = date.toDateString() === now.toDateString();
  const isTomorrow = date.toDateString() === tomorrow.toDateString();

  const timeStr = date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

  if (isToday) {
    return `Today at ${timeStr}`;
  }
  if (isTomorrow) {
    return `Tomorrow at ${timeStr}`;
  }

  return date.toLocaleDateString([], {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}
