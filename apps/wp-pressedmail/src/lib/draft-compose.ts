import { getFolderRole } from "@/lib/bulk-mail-actions";
import { unwrapEmailBodyHtml } from "@/services/email-safe-html.service";
import type { ComposeData, EmailMessage } from "@/types";
import type { ScheduledEmail } from "@/types/scheduled-emails";

export interface DraftComposeIdentity {
  uid: string;
  folder: string;
  accountId: number;
  uidValidity: number;
  messageId: string;
}

function hasDraftFolderRole(value: string | null | undefined): boolean {
  if (!value) return false;

  return (
    getFolderRole({
      name: value,
      path: value,
      count: 0,
    }) === "drafts"
  );
}

export function isScheduledMessage(message: EmailMessage | null): boolean {
  if (!message) return false;
  return message.isScheduled === true || getScheduledEmailId(message) !== null;
}

export function getScheduledEmailId(
  message: EmailMessage | null,
): number | null {
  const id = Number(message?.scheduledEmailId);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export function isDraftMessage(
  message: EmailMessage | null,
): message is EmailMessage {
  if (!message) return false;

  if (message.is_draft || message.isDraft) {
    return true;
  }

  return (
    hasDraftFolderRole(message.folder) ||
    hasDraftFolderRole(message.folderLabel)
  );
}

export function hasDraftComposeDetail(message: EmailMessage): boolean {
  const bodyState = message.bodyState ?? message.body_state;
  if (bodyState === "pending" || bodyState === "partial") return false;
  if (bodyState === "full") return true;

  // Older complete detail/cache records can omit bodyState. An explicit empty
  // MIME body is still a saved draft; list summaries omit these fields.
  return [
    message.htmlBody,
    message.plainBody,
    message.textBody,
    message.body,
  ].some((body) => typeof body === "string");
}

export function getDraftComposeData(
  message: EmailMessage,
  selectedFolder: string | null | undefined,
  selectedAccountId?: string | number | null,
): Partial<ComposeData> {
  const draftUid = message.uid ?? message.draftUid ?? message.draft_uid;
  const draftUidValidity = message.uidValidity ?? message.uid_validity;
  const draftMessageId = message.messageId ?? message.message_id;
  const draftFolder =
    (hasDraftFolderRole(message.folder) ? message.folder : undefined) ||
    (hasDraftFolderRole(message.folderLabel)
      ? message.folderLabel
      : undefined) ||
    (hasDraftFolderRole(selectedFolder) ? selectedFolder : undefined) ||
    message.folder ||
    message.folderLabel;

  const explicitHtml =
    typeof message.htmlBody === "string" && message.htmlBody.trim()
      ? message.htmlBody
      : null;
  const explicitPlain =
    typeof message.plainBody === "string"
      ? message.plainBody
      : typeof message.textBody === "string"
        ? message.textBody
        : null;
  const legacyBody = typeof message.body === "string" ? message.body : "";
  const explicitContentType = message.contentType ?? message.content_type;
  const rawBody = explicitHtml ?? explicitPlain ?? legacyBody;
  const contentType =
    explicitContentType ??
    (explicitHtml ? "html" : explicitPlain !== null ? "plain" : "html");
  // A stored draft carries the send/draft wrapper the composer put on it. Take
  // it off before it reaches the editor, and keep the background it was holding
  // - the wrapper is the only thing that persists that colour.
  const unwrapped =
    contentType === "plain"
      ? { html: rawBody, bodyBackgroundColor: undefined }
      : unwrapEmailBodyHtml(rawBody);
  const body = unwrapped.html;
  const attachments = message.attachments ?? [];
  const bodyState = String(
    message.bodyState ?? message.body_state ?? "",
  ).toLowerCase();
  const hasCompleteDetail = bodyState !== "partial" && bodyState !== "pending";
  const hasAttachmentManifest =
    hasCompleteDetail &&
    (attachments.length > 0
      ? attachments.every(
          (attachment) =>
            typeof attachment.part === "string" &&
            attachment.part.trim() !== "",
        )
      : message.hasAttachments === false);

  return {
    to: message.to ?? "",
    cc: message.cc ?? "",
    bcc: message.bcc ?? "",
    contactLists: Array.isArray(message.contactLists)
      ? message.contactLists
      : Array.isArray(message.contact_lists)
        ? message.contact_lists
        : [],
    inReplyTo: message.inReplyTo,
    references: message.references,
    subject: message.subject ?? "",
    body,
    draftDocument: message.draftDocument,
    contentType,
    bodyBackgroundColor:
      message.bodyBackgroundColor ?? unwrapped.bodyBackgroundColor,
    attachments,
    draftUid:
      draftUid !== null && draftUid !== undefined
        ? String(draftUid)
        : undefined,
    draftFolder:
      draftUid !== null && draftUid !== undefined && draftFolder
        ? String(draftFolder)
        : undefined,
    draftAccountId:
      draftUid !== null && draftUid !== undefined
        ? (message.accountId ?? selectedAccountId ?? undefined)
        : undefined,
    draftUidValidity:
      draftUid !== null &&
      draftUid !== undefined &&
      draftUidValidity !== null &&
      draftUidValidity !== undefined
        ? String(draftUidValidity)
        : undefined,
    draftMessageId:
      draftUid !== null &&
      draftUid !== undefined &&
      typeof draftMessageId === "string" &&
      draftMessageId
        ? draftMessageId
        : undefined,
    draftAttachmentManifestComplete: hasAttachmentManifest,
    draftOpened: true,
  };
}

export function getDraftComposeSignature(
  message: EmailMessage,
  selectedFolder: string | null | undefined,
  selectedAccountId?: string | number | null,
): string {
  const draft = getDraftComposeData(message, selectedFolder, selectedAccountId);

  return JSON.stringify({
    selectedFolder,
    messageId: message.consolidatedUid ?? message.id,
    uid: draft.draftUid,
    folder: draft.draftFolder,
    accountId: draft.draftAccountId,
    uidValidity: draft.draftUidValidity,
    draftMessageId: draft.draftMessageId,
    inReplyTo: draft.inReplyTo,
    references: draft.references,
    attachmentManifestComplete: draft.draftAttachmentManifestComplete,
    to: draft.to,
    cc: draft.cc,
    bcc: draft.bcc,
    contactLists: draft.contactLists,
    subject: draft.subject,
    body: draft.body,
    contentType: draft.contentType,
    attachmentCount: draft.attachments?.length ?? 0,
  });
}

export function getDraftComposeIdentity(
  draft: Partial<ComposeData>,
): DraftComposeIdentity | null {
  const uid = String(draft.draftUid ?? "").trim();
  const folder = String(draft.draftFolder ?? "").trim();
  const accountId = Number(draft.draftAccountId);
  const uidValidity = Number(draft.draftUidValidity);
  const messageId = String(draft.draftMessageId ?? "").trim();

  if (
    !uid ||
    !folder ||
    !Number.isInteger(accountId) ||
    accountId <= 0 ||
    !Number.isInteger(uidValidity) ||
    uidValidity <= 0 ||
    !messageId
  ) {
    return null;
  }

  return { uid, folder, accountId, uidValidity, messageId };
}

export function getScheduledEmailDraftIdentity(
  email: ScheduledEmail | null,
): DraftComposeIdentity | null {
  if (!email) return null;

  return getDraftComposeIdentity({
    draftUid: email.draft_uid ?? undefined,
    draftFolder: email.draft_folder ?? undefined,
    draftAccountId: email.account_id,
    draftUidValidity: email.draft_uidvalidity ?? undefined,
    draftMessageId: email.message_id ?? undefined,
  });
}

export function draftComposeIdentitiesMatch(
  left: DraftComposeIdentity | null,
  right: DraftComposeIdentity | null,
): boolean {
  return Boolean(
    left &&
    right &&
    left.uid === right.uid &&
    left.folder === right.folder &&
    left.accountId === right.accountId &&
    left.uidValidity === right.uidValidity &&
    left.messageId === right.messageId,
  );
}
