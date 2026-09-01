import React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarPlus,
  Download,
  Loader2,
  Mail,
  Paperclip,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Star,
  Tags,
  UserRoundCheck,
} from "lucide-react";

import { useAppContext } from "@/context/AppProvider";
import {
  useCanDownloadAttachments,
  useCanShowExternalImages,
} from "@/context/admin-settings";
import {
  useAutoTagger,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { useEmailSummaries } from "@/context/email-summary";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import { useInboxState } from "@/context/InboxContext";
import { useTags } from "@/context/tags";
import { prepareEmailBodyForDisplay } from "@/lib/email-content-normalization";
import { isApiAuthError } from "@/lib/api-auth-errors";
import { parseEmailDate } from "@/lib/email-date";
import { parseSenderEmail, parseSenderName } from "@/lib/mail-utils";
import { useMessagePhishingAutoScan } from "@/hooks/useMessagePhishingAutoScan";
import { useSenderContact } from "@/hooks/useSenderContact";
import {
  getMessageRequestId,
  resolveMessageAccountId,
} from "@/lib/message-identity";
import { useEmailMessageTagActions } from "@/hooks/useEmailMessageTagActions";
import { cn } from "@/lib/utils";
import { isAiSummarizeBuildEnabled } from "@/lib/build-variant";
import { getInboxService } from "@/services/implementations";
import { formatFileSize } from "./compose/compose-utils";
import { EmailSandbox } from "./EmailSandbox";
import { getPluginRestBase, getRuntimeWpNonce } from "@/lib/runtime-config";
import { ITipBanner } from "./itip-banner";
import {
  ImportIcsPreview,
  type IcsImportSource,
} from "@/components/calendar/ImportIcsPreview";
import type { MessageAttachmentRef } from "@/services/ics-import.service";
import { useCalendar } from "@/context/calendar/CalendarContext";
import { MailDetailSkeleton } from "./mail-detail-skeleton";
import { PhishingResultBadge } from "@/components/phishing/PhishingResultBadge";
import {
  AddSenderContactIcon,
  AiFileIcon,
  DetailsBlockIcon,
  RemoveSenderContactIcon,
} from "@/components/icons/MailActionIcons";
import { EmailTagBadges } from "@/components/tags/EmailTagBadges";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { SectionCard } from "@/components/ui/section-card";
import { EmailSummaryMarkdown } from "./EmailSummaryMarkdown";
import { MailTagActionDropdown } from "./MailTagActionDropdown";

import type { EmailAttachment, EmailMessage, EmailMessageTag } from "@/types";
import type { Tag } from "@/types/tags";

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  Button,
  Separator,
} from "@kit/ui/plugin";
type AttachmentLike = EmailAttachment & {
  content?: string;
  mime?: string;
};

interface MailDisplayProps {
  mail: EmailMessage | null;
  /** Mobile readers let the MobileScreen body own vertical scrolling. */
  layout?: "default" | "mobile";
  /** Content rendered after sender/message metadata and before the body. */
  afterMetadata?: React.ReactNode;
  /** Whether external images should be shown */
  showImages?: boolean;
  /** Callback when blocked image count changes */
  onBlockedImageCount?: (count: number) => void;
  /** Toggle the selected message's starred state from the reading pane header. */
  onToggleStar?: () => void;
  /**
   * The surrounding surface already offers Summarize and the sender-contact
   * toggle in its own action row, so this pane must not repeat them. Set by
   * the desktop reading pane; mobile renders MailDisplay with no action bar
   * and therefore leaves it off, keeping both controls inline.
   */
  actionsInToolbar?: boolean;
}

function MessagePhishingAutoScanGate({
  mail,
  accountId,
}: {
  mail: EmailMessage | null;
  accountId: number | null;
}) {
  useMessagePhishingAutoScan({
    message: mail,
    accountId,
  });

  return null;
}

function getHeaderValue(
  headers: Record<string, string> | undefined,
  names: string[],
): string {
  if (!headers) return "";
  const entries = Object.entries(headers);

  for (const name of names) {
    const match = entries.find(
      ([key]) => key.toLowerCase() === name.toLowerCase(),
    );
    if (match) return match[1];
  }

  return "";
}

function summarizeAuthentication(value: string): string[] {
  if (!value) return [];
  const lower = value.toLowerCase();
  const status = (key: "spf" | "dkim" | "dmarc") => {
    if (lower.includes(`${key}=pass`)) return `${key.toUpperCase()} pass`;
    if (lower.includes(`${key}=fail`)) return `${key.toUpperCase()} fail`;
    if (lower.includes(`${key}=softfail`)) {
      return `${key.toUpperCase()} softfail`;
    }
    return `${key.toUpperCase()} unknown`;
  };

  return [status("spf"), status("dkim"), status("dmarc")];
}

function HeaderDetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
      <span className="font-medium text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words text-foreground">{value}</span>
    </div>
  );
}

function toEmailMessageTag(tag: Tag | EmailMessageTag): EmailMessageTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
  };
}

function resolveLocalMessageId(message: EmailMessage): string | number {
  return (
    message.consolidatedUid ?? message.id ?? message.uid ?? message.msg_no ?? ""
  );
}

function resolveMessageUid(message: EmailMessage): string {
  return String(message.uid ?? message.msg_no ?? message.id ?? "");
}

function getAutoTagBody(message: EmailMessage, body: string): string {
  return (
    message.htmlBody ||
    message.body ||
    message.textBody ||
    message.plainBody ||
    message.text ||
    body ||
    ""
  );
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function mergeAiReturnedTags(
  currentTags: EmailMessageTag[],
  returnedTags: Array<{ id?: number; name?: string }>,
  availableTags: Tag[],
): EmailMessageTag[] {
  const next = [...currentTags];
  const seen = new Set(next.map((tag) => Number(tag.id)));

  for (const returned of returnedTags) {
    const matched =
      availableTags.find((tag) => Number(tag.id) === Number(returned.id)) ??
      availableTags.find(
        (tag) =>
          returned.name &&
          normalizeTagName(tag.name) === normalizeTagName(returned.name),
      );

    if (!matched || seen.has(Number(matched.id))) continue;
    seen.add(Number(matched.id));
    next.push(toEmailMessageTag(matched));
  }

  return next;
}

export function decodeMimeWords(str: string) {
  // Basic decode for =?UTF-8?...?=, for production use a library!
  if (!str) return "";
  try {
    // Handle base64 and quoted-printable
    const match = str.match(/^=\?UTF-8\?([BQ])\?(.+)\?=$/i);
    if (match) {
      const encoding = match[1];
      const content = match[2];
      if (encoding && content) {
        if (encoding.toUpperCase() === "B") {
          // Base64
          return decodeURIComponent(escape(window.atob(content)));
        } else if (encoding.toUpperCase() === "Q") {
          // Quoted-printable
          return decodeURIComponent(
            content
              .replace(/_/g, " ")
              .replace(/=([A-Fa-f0-9]{2})/g, (_match, hex) =>
                String.fromCharCode(parseInt(hex, 16)),
              ),
          );
        }
      }
    }
  } catch {
    /* MIME decode failed -- fall through to return original string */
  }
  return str;
}

export function MailDisplay({
  mail,
  layout = "default",
  afterMetadata,
  showImages = false,
  onBlockedImageCount,
  onToggleStar,
  actionsInToolbar = false,
}: MailDisplayProps) {
  const {
    isMessageDetailLoading,
    detailBodyPending,
    detailBodyError,
    retryMessageDetail,
  } = useInboxState();
  const messagesRef = React.useRef<HTMLDivElement>(null);
  const [showHeaderDetails, setShowHeaderDetails] = React.useState(false);
  const [showAISummary, setShowAISummary] = React.useState(false);
  const [manageSummaryOpen, setManageSummaryOpen] = React.useState(false);
  const [summaryMutationPending, setSummaryMutationPending] =
    React.useState(false);
  const { accounts, selectedAccount } = useAppContext();
  const { filterByTag, removeMessageTag } = useEmailMessageTagActions();
  const { tags, assignTag, removeTag, getMessageTags } = useTags();
  const { classifyEmails } = useAutoTagger();
  const autoTaggerAvailable = useAutoTaggerToolAvailable();

  // Inline AI summary disclosure availability is feature/build gated. The
  // summarize runtime can use its own provider settings, so do not gate this on
  // the legacy global AI provider.
  const aiSummarizeFeatureAvailable = useFeatureAvailable("ai_summarize");
  const calendarFeatureAvailable = useFeatureAvailable("calendar");
  const { refreshVisibleLocalEvents } = useCalendar();
  // Build-gate as well: Summarize is a Pro AI feature with no routes in the free
  // build, so never surface the trigger there (parity with BulkActionBar).
  //
  // The define is read directly rather than through `isAiSummarizeBuildEnabled()`
  // because esbuild can only fold a bare identifier. Behind a function call the
  // whole summarize UI stayed compiled into the Free bundle, hidden at runtime.
  const aiSummariesAvailable =
    __ENABLE_AI_SUMMARIZE__ && aiSummarizeFeatureAvailable;
  const { getSummary, summarizeMessages, deleteSummary, isSummarizing } =
    useEmailSummaries();
  const summaryRecord = aiSummariesAvailable ? getSummary(mail) : null;
  const hasCachedAISummary =
    summaryRecord?.status === "success" && Boolean(summaryRecord.summary);
  const mailId = React.useMemo(() => getMessageRequestId(mail), [mail]);
  const [messageTagSelection, setMessageTagSelection] = React.useState<
    EmailMessageTag[]
  >(() => (mail?.tags ?? []).map(toEmailMessageTag));
  const [messageTagsLoaded, setMessageTagsLoaded] = React.useState(
    Boolean(mail?.tags),
  );

  React.useEffect(() => {
    setMessageTagSelection((mail?.tags ?? []).map(toEmailMessageTag));
    setMessageTagsLoaded(Boolean(mail?.tags));
  }, [mailId, mail?.tags]);

  React.useEffect(() => {
    setShowAISummary(false);
  }, [mailId]);

  React.useEffect(() => {
    if (hasCachedAISummary) {
      setShowAISummary(true);
    }
  }, [hasCachedAISummary]);

  const requestSummary = React.useCallback(
    async (force = false) => {
      if (!mail || isSummarizing) return;
      setManageSummaryOpen(false);
      setShowAISummary(true);
      try {
        await summarizeMessages([mail], force ? { force: true } : undefined);
      } catch (error) {
        if (!isApiAuthError(error)) {
          throw error;
        }
      }
    },
    [isSummarizing, mail, summarizeMessages],
  );

  const handleSummarizeClick = React.useCallback(() => {
    if (hasCachedAISummary) {
      setManageSummaryOpen(true);
      return;
    }
    void requestSummary(false);
  }, [hasCachedAISummary, requestSummary]);

  const handleOverwriteSummary = React.useCallback(async () => {
    setSummaryMutationPending(true);
    try {
      await requestSummary(true);
    } finally {
      setSummaryMutationPending(false);
    }
  }, [requestSummary]);

  const handleDeleteSummary = React.useCallback(async () => {
    if (!mail) return;
    setSummaryMutationPending(true);
    try {
      const deleted = await deleteSummary(mail);
      if (deleted) {
        setShowAISummary(false);
        setManageSummaryOpen(false);
      }
    } finally {
      setSummaryMutationPending(false);
    }
  }, [deleteSummary, mail]);

  // Admin security settings
  const canDownloadAttachments = useCanDownloadAttachments();
  const canShowExternalImages = useCanShowExternalImages();
  const accountId = React.useMemo(
    () => resolveMessageAccountId(mail, accounts, selectedAccount),
    [accounts, mail, selectedAccount],
  );
  const [calendarImportSource, setCalendarImportSource] =
    React.useState<IcsImportSource | null>(null);
  const canImportCalendar = __IS_PRO__ && calendarFeatureAvailable;

  const buildCalendarAttachmentRef = React.useCallback(
    (part: string | null | undefined): MessageAttachmentRef | null => {
      const normalizedAccountId = Number(accountId);
      const folder = String(mail?.folder ?? "").trim();
      if (
        !canImportCalendar ||
        !mail ||
        !Number.isInteger(normalizedAccountId) ||
        normalizedAccountId <= 0 ||
        !folder ||
        !part ||
        !isExactMimePart(part)
      ) {
        return null;
      }
      const uid = String(mail.uid ?? "");
      const msgNo = String(mail.msg_no ?? "");
      const base = {
        accountId: normalizedAccountId,
        folder,
        part,
      };
      if (/^[1-9]\d*$/.test(uid)) return { ...base, uid };
      if (/^[1-9]\d*$/.test(msgNo)) return { ...base, msgNo };
      return null;
    },
    [accountId, canImportCalendar, mail],
  );

  const openCalendarAttachment = React.useCallback(
    (part: string | null | undefined) => {
      const attachment = buildCalendarAttachmentRef(part);
      if (attachment) {
        setCalendarImportSource({ kind: "attachment", attachment });
      }
    },
    [buildCalendarAttachmentRef],
  );
  const canReferenceCalendarMessage = buildCalendarAttachmentRef("1") !== null;
  const handleTagRemove = React.useCallback(
    (tag: EmailMessageTag) => {
      if (!mail) return;

      setMessageTagSelection((current) =>
        current.filter((item) => Number(item.id) !== Number(tag.id)),
      );
      void removeMessageTag(mail, tag, {
        accountId,
        folder: mail.folder,
      });
    },
    [accountId, mail, removeMessageTag],
  );
  const tagsEnabled = __ENABLE_TAGS__ && accountId !== null;
  const showAutoTagAction =
    !__IS_FREE__ &&
    __ENABLE_AUTO_TAGGER__ &&
    __ENABLE_AI_AUTO_TAGGER__ &&
    autoTaggerAvailable;
  const selectedTagIds = messageTagSelection.map((tag) => Number(tag.id));

  const handleTagDropdownOpenChange = React.useCallback(
    async (open: boolean) => {
      if (!open || !mail || accountId === null || messageTagsLoaded) return;

      try {
        const loadedTags = await getMessageTags(
          accountId,
          resolveMessageUid(mail),
          mail.folder ?? "INBOX",
        );
        setMessageTagSelection(loadedTags.map(toEmailMessageTag));
        setMessageTagsLoaded(true);
      } catch (error) {
        console.error("Failed to load message tags:", error);
      }
    },
    [accountId, getMessageTags, mail, messageTagsLoaded],
  );

  const handleApplyMessageTags = React.useCallback(
    async (nextTagIds: number[]) => {
      if (!mail || accountId === null) return;

      const previousTags = messageTagSelection;
      const previousTagIds = new Set(previousTags.map((tag) => Number(tag.id)));
      const nextTagIdSet = new Set(nextTagIds.map(Number));
      const addedTagIds = nextTagIds.filter((id) => !previousTagIds.has(id));
      const removedTagIds = Array.from(previousTagIds).filter(
        (id) => !nextTagIdSet.has(id),
      );

      if (addedTagIds.length === 0 && removedTagIds.length === 0) return;

      const knownTags = new Map<number, EmailMessageTag>();
      for (const tag of previousTags) {
        knownTags.set(Number(tag.id), toEmailMessageTag(tag));
      }
      for (const tag of tags) {
        knownTags.set(Number(tag.id), toEmailMessageTag(tag));
      }

      const nextTags = nextTagIds
        .map((id) => knownTags.get(Number(id)))
        .filter((tag): tag is EmailMessageTag => Boolean(tag));

      setMessageTagSelection(nextTags);
      getInboxService().updateMessage(resolveLocalMessageId(mail), {
        tags: nextTags,
      });

      try {
        await Promise.all([
          ...addedTagIds.map((tagId) =>
            assignTag(tagId, accountId, resolveMessageUid(mail), mail.folder),
          ),
          ...removedTagIds.map((tagId) =>
            removeTag(tagId, accountId, resolveMessageUid(mail), mail.folder),
          ),
        ]);
        setMessageTagsLoaded(true);
      } catch (error) {
        setMessageTagSelection(previousTags);
        getInboxService().updateMessage(resolveLocalMessageId(mail), {
          tags: previousTags,
        });
        console.error("Failed to update message tags:", error);
      }
    },
    [accountId, assignTag, mail, messageTagSelection, removeTag, tags],
  );

  // All useMemo hooks must be called unconditionally (before any early returns)
  // to satisfy React's Rules of Hooks
  const senderName = React.useMemo(
    () => (mail ? parseSenderName(mail) : "Unknown sender"),
    [mail],
  );

  const senderEmail = React.useMemo(
    () => (mail ? parseSenderEmail(mail) : ""),
    [mail],
  );

  const {
    available: contactsAvailable,
    existingContact,
    canCreate: canCreateContact,
    pending: contactMutationPending,
    confirmRemoveOpen,
    setConfirmRemoveOpen,
    addSender: handleAddSenderToContacts,
    removeSender: handleRemoveSenderFromContacts,
  } = useSenderContact(senderEmail, senderName);

  const { body, isHtml, hasLoadedBody } = React.useMemo(() => {
    if (!mail) return { body: "", isHtml: false, hasLoadedBody: false };

    const prepared = prepareEmailBodyForDisplay({
      htmlBody: mail.htmlBody,
      body: mail.body,
      textBody: mail.textBody,
      plainBody: mail.plainBody,
      contentType: mail.contentType,
      content_type: mail.content_type,
    });
    const explicitContentType = mail.contentType ?? mail.content_type;
    const _hasLoadedBody = Boolean(
      mail.htmlBody ||
      mail.plainBody ||
      mail.body ||
      mail.textBody ||
      ((explicitContentType === "plain" || explicitContentType === "html") &&
        (typeof mail.body === "string" ||
          typeof mail.plainBody === "string" ||
          typeof mail.textBody === "string" ||
          typeof mail.htmlBody === "string")),
    );

    return {
      body: prepared.body,
      isHtml: prepared.isHtml,
      hasLoadedBody: _hasLoadedBody,
    };
  }, [
    mail?.htmlBody,
    mail?.body,
    mail?.textBody,
    mail?.plainBody,
    mail?.contentType,
    mail?.content_type,
    mail,
  ]);

  const decodedSubject = React.useMemo(
    () => decodeMimeWords(mail?.subject ?? ""),
    [mail?.subject],
  );
  const displayTo = React.useMemo(() => {
    const lists = Array.isArray(mail?.contactLists)
      ? mail.contactLists
      : Array.isArray(mail?.contact_lists)
        ? mail.contact_lists
        : [];
    return [mail?.to, ...lists.map((list) => list.name)]
      .filter(Boolean)
      .join(", ");
  }, [mail?.contactLists, mail?.contact_lists, mail?.to]);
  const mailDate = React.useMemo(
    () => parseEmailDate(mail?.receivedDate ?? mail?.date),
    [mail?.date, mail?.receivedDate],
  );
  const contentBodySurfaceClass = "pm-email-content-surface";
  // Plain-text emails carry no inherent colors, so they may adapt to the UI
  // light/dark theme (R1). HTML content stays on the fixed-light sandbox.
  const textBodySurfaceClass = "pm-email-text-surface";
  const handleAutoTag = React.useCallback(async () => {
    if (!mail || accountId === null) return;

    let result;
    try {
      result = await classifyEmails(accountId, [
        {
          uid: resolveMessageUid(mail),
          folder: mail.folder || "INBOX",
          subject: mail.subject || "",
          from: mail.from || mail.email || "",
          to: mail.to || "",
          date: mail.receivedDate ?? mail.date ?? "",
          body: getAutoTagBody(mail, body),
        },
      ]);
    } catch (error) {
      if (isApiAuthError(error)) {
        return;
      }
      throw error;
    }

    if (result.status !== "success") {
      return;
    }

    const returnedTags = result.results?.flatMap((item) => item.tags) ?? [];
    if (returnedTags.length === 0) {
      return;
    }

    const nextTags = mergeAiReturnedTags(
      messageTagSelection,
      returnedTags,
      tags,
    );
    if (nextTags.length === messageTagSelection.length) {
      return;
    }

    setMessageTagSelection(nextTags);
    setMessageTagsLoaded(true);
    getInboxService().updateMessage(resolveLocalMessageId(mail), {
      tags: nextTags,
    });
  }, [accountId, body, classifyEmails, mail, messageTagSelection, tags]);

  if (!mail) {
    return (
      <div
        className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center"
        data-test="message-detail-empty">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
          <Mail className="h-6 w-6 text-muted-foreground" />
        </div>
        <div className="space-y-1">
          <h3 className="font-medium text-sm">
            {__("No message selected", "pressedmail")}
          </h3>
          <p className="text-xs text-muted-foreground">
            {__("Select an email from the list to read it here", "pressedmail")}
          </p>
        </div>
      </div>
    );
  }

  const attachments = (mail.attachments ?? []) as AttachmentLike[];
  const effectiveShowImages = canShowExternalImages && showImages;
  const headers = mail.headers as Record<string, string> | undefined;
  const replyTo =
    (mail.replyTo as string | undefined) ||
    (mail.reply_to as string | undefined) ||
    getHeaderValue(headers, ["Reply-To"]);
  const messageId =
    mail.messageId || getHeaderValue(headers, ["Message-ID", "Message-Id"]);
  const authentication = summarizeAuthentication(
    getHeaderValue(headers, ["Authentication-Results"]),
  );

  const isBodyLoading = !hasLoadedBody && isMessageDetailLoading;
  // The body is still being assembled server-side (or the fetch hit its budget): show a
  // "taking longer" retry affordance instead of a false "No content". Only reachable when the
  // body has not loaded and we are not already showing the loading skeleton.
  const isBodyPending = !hasLoadedBody && !isBodyLoading && detailBodyPending;
  // The detail fetch hard-failed (e.g. a config_error/auth_failed account whose body fetch always
  // errors): show a distinct "couldn't load this message" error branch with Retry instead of a
  // false "No content". Only reachable once loading and pending have both been ruled out.
  const isBodyError =
    !hasLoadedBody && !isBodyLoading && !isBodyPending && detailBodyError;
  const isMobileLayout = layout === "mobile";

  return (
    <div
      className={cn(
        "flex flex-col bg-card",
        isMobileLayout ? "" : "h-full overflow-hidden",
      )}
      ref={messagesRef}
      data-test="message-detail">
      {__ENABLE_PHISHING_DETECTION__ ? (
        <MessagePhishingAutoScanGate mail={mail} accountId={accountId} />
      ) : null}

      {/* Sender info + email body */}
      <div
        data-test="message-detail-content"
        className={cn(
          "flex flex-col gap-4 p-4",
          isMobileLayout ? "" : "min-h-0 flex-1 overflow-auto",
        )}>
        {mail?.itip ? (
          <ITipBanner
            event={mail.itip}
            onAddToCalendar={
              buildCalendarAttachmentRef(mail.itip.attachmentPart)
                ? () => openCalendarAttachment(mail.itip?.attachmentPart)
                : undefined
            }
          />
        ) : null}
        {/* Sender Info */}
        <div
          className="flex items-start gap-3 text-sm shrink-0"
          data-test="message-detail-header-layout">
          <div className="flex-1 min-w-0">
            <div
              className="flex items-center justify-between gap-2"
              data-test="message-detail-sender-row">
              <div className="flex min-w-0 items-center gap-2">
                {!actionsInToolbar && contactsAvailable && senderEmail ? (
                  existingContact ? (
                    <PressedTooltip
                      content={__("Remove sender from contacts", "pressedmail")}
                      side="bottom">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setConfirmRemoveOpen(true)}
                        disabled={contactMutationPending}
                        data-test="sender-contact-toggle"
                        aria-label={__(
                          "Remove sender from contacts",
                          "pressedmail",
                        )}
                        className="h-7 w-7 shrink-0 p-0 text-primary">
                        <RemoveSenderContactIcon className="h-5 w-5" />
                      </Button>
                    </PressedTooltip>
                  ) : (
                    <PressedTooltip
                      content={
                        // Pro-only copy; see EmailActionBar. The Free bundle
                        // folds this away with the string.
                        !__IS_FREE__ && !canCreateContact
                          ? __(
                              "Contact limit reached for your plan",
                              "pressedmail",
                            )
                          : __("Add sender to contacts", "pressedmail")
                      }
                      side="bottom">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleAddSenderToContacts}
                        disabled={contactMutationPending || !canCreateContact}
                        data-test="sender-contact-toggle"
                        aria-label={__("Add sender to contacts", "pressedmail")}
                        className="h-7 w-7 shrink-0 p-0 text-foreground">
                        <AddSenderContactIcon className="h-5 w-5" />
                      </Button>
                    </PressedTooltip>
                  )
                ) : null}
                <span
                  className="text-sm font-semibold truncate"
                  data-test="message-detail-sender-name">
                  {senderName}
                </span>
                {/*
                  State, not an action. The add/remove control moved into the
                  action row, which left no way to tell a known sender from an
                  unknown one without opening Contacts. Rendered in every
                  layout, including the ones that keep the inline toggle.
                */}
                {existingContact ? (
                  <PressedTooltip
                    content={__("Already in your contacts", "pressedmail")}
                    side="bottom">
                    <span
                      data-test="sender-contact-indicator"
                      className="inline-flex shrink-0 items-center rounded-full border border-primary/25 bg-primary/10 p-1 text-primary">
                      <UserRoundCheck className="h-3 w-3" aria-hidden="true" />
                      <span className="sr-only">
                        {__("Sender is in your contacts", "pressedmail")}
                      </span>
                    </span>
                  </PressedTooltip>
                ) : null}
                <span className="text-xs text-muted-foreground truncate">
                  &lt;{senderEmail}&gt;
                </span>
              </div>
              {onToggleStar ? (
                <PressedTooltip
                  content={
                    mail.starred
                      ? __("Remove star", "pressedmail")
                      : __("Star message", "pressedmail")
                  }
                  side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onToggleStar}
                    data-test="message-detail-star-toggle"
                    aria-label={
                      mail.starred
                        ? __("Remove star", "pressedmail")
                        : __("Star message", "pressedmail")
                    }
                    className={cn(
                      "h-7 w-7 shrink-0 p-0",
                      mail.starred
                        ? "bg-primary/10 text-primary hover:bg-primary/15 hover:text-primary"
                        : "text-muted-foreground hover:text-primary",
                    )}>
                    <Star
                      className={cn("h-4 w-4", mail.starred && "fill-current")}
                    />
                  </Button>
                </PressedTooltip>
              ) : null}
            </div>
            <div
              className="flex items-center justify-between gap-2 text-xs text-muted-foreground"
              data-test="message-detail-date-row">
              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <PressedTooltip
                  content={
                    showHeaderDetails
                      ? __("Hide message details", "pressedmail")
                      : __("Show message details", "pressedmail")
                  }
                  side="bottom">
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setShowHeaderDetails((value) => !value)}
                    aria-expanded={showHeaderDetails}
                    aria-label={
                      showHeaderDetails
                        ? __("Hide message details", "pressedmail")
                        : __("Show message details", "pressedmail")
                    }
                    className={cn(
                      "h-8 w-8 shrink-0 p-0",
                      showHeaderDetails
                        ? "text-foreground"
                        : "text-muted-foreground",
                    )}>
                    <DetailsBlockIcon className="h-5 w-5" />
                  </Button>
                </PressedTooltip>
                {mailDate ? (
                  <span
                    className="min-w-0 truncate"
                    data-test="message-detail-date">
                    {format(mailDate, "PPpp")}
                  </span>
                ) : null}
              </div>
              <div className="flex min-w-0 flex-[0_1_55%] flex-wrap items-center justify-end gap-1.5">
                {messageTagSelection.length > 0 || tagsEnabled ? (
                  <div
                    className="flex min-w-0 max-w-full flex-wrap items-center justify-end gap-1.5"
                    data-test="message-detail-tags-row">
                    {messageTagSelection.length > 0 ? (
                      <EmailTagBadges
                        tags={messageTagSelection}
                        wrap
                        className="justify-end"
                        onTagClick={filterByTag}
                        onTagRemove={handleTagRemove}
                      />
                    ) : null}
                    {tagsEnabled ? (
                      <MailTagActionDropdown
                        availableTags={tags}
                        selectedTagIds={selectedTagIds}
                        onApplyTags={handleApplyMessageTags}
                        onAutoTag={handleAutoTag}
                        onOpenChange={handleTagDropdownOpenChange}
                        aiEnabled={showAutoTagAction}
                        disabled={false}
                        align="end"
                        trigger={
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6 shrink-0 p-0 text-muted-foreground hover:text-foreground"
                            data-test="message-detail-tag-action"
                            aria-label={__("Edit message tags", "pressedmail")}>
                            <Tags className="h-4 w-4" />
                          </Button>
                        }
                      />
                    ) : null}
                  </div>
                ) : null}
                {__ENABLE_PHISHING_DETECTION__ ? (
                  <PhishingResultBadge
                    messageId={mailId}
                    className="h-5 shrink-0"
                  />
                ) : null}
              </div>
            </div>
            {showHeaderDetails ? (
              <div
                className="mt-2 grid gap-1.5 rounded-md border bg-muted/30 p-2 text-xs"
                data-test="message-header-details">
                <HeaderDetailRow
                  label={__("From", "pressedmail")}
                  value={senderEmail}
                />
                {replyTo ? (
                  <HeaderDetailRow
                    label={__("Reply-To", "pressedmail")}
                    value={replyTo}
                  />
                ) : null}
                {displayTo ? (
                  <HeaderDetailRow
                    label={__("To", "pressedmail")}
                    value={displayTo}
                  />
                ) : null}
                {mail.cc ? (
                  <HeaderDetailRow
                    label={__("Cc", "pressedmail")}
                    value={mail.cc}
                  />
                ) : null}
                {mailDate ? (
                  <HeaderDetailRow
                    label={__("Date", "pressedmail")}
                    value={format(mailDate, "PPpp")}
                  />
                ) : null}
                {messageId ? (
                  <HeaderDetailRow
                    label={__("Message-ID", "pressedmail")}
                    value={messageId}
                  />
                ) : null}
                {authentication.length > 0 ? (
                  <div className="grid grid-cols-[88px_minmax(0,1fr)] gap-2">
                    <span className="font-medium text-muted-foreground">
                      {__("Authentication", "pressedmail")}
                    </span>
                    <span className="flex flex-wrap gap-2">
                      {authentication.map((item) => {
                        const passed = item.toLowerCase().includes("pass");
                        const Icon = passed ? ShieldCheck : ShieldAlert;
                        return (
                          <span
                            key={item}
                            className={cn(
                              "inline-flex items-center gap-1",
                              passed ? "text-success" : "text-warning",
                            )}>
                            <Icon className="h-3 w-3" />
                            {item}
                          </span>
                        );
                      })}
                    </span>
                  </div>
                ) : null}
              </div>
            ) : null}
            <div
              aria-hidden="true"
              data-test="message-detail-subject-divider"
              className="my-2 h-px w-full bg-border/40"
            />
            <div
              className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-2 text-sm"
              data-test="message-detail-subject">
              <div
                className="flex min-w-0 flex-1 basis-64 items-center gap-1.5"
                data-test="message-detail-subject-line">
                {!actionsInToolbar && aiSummariesAvailable ? (
                  <div
                    className="flex shrink-0 items-center gap-0.5"
                    data-test="message-ai-summary-actions">
                    {hasCachedAISummary ? (
                      <PressedTooltip
                        content={
                          showAISummary
                            ? __("Hide email summary", "pressedmail")
                            : __("Show email summary", "pressedmail")
                        }
                        side="bottom">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setShowAISummary((value) => !value)}
                          aria-expanded={showAISummary}
                          aria-label={
                            showAISummary
                              ? __("Hide email summary", "pressedmail")
                              : __("Show email summary", "pressedmail")
                          }
                          data-test="message-ai-summary-display"
                          className="h-8 w-8 shrink-0 p-0 text-primary">
                          <AiFileIcon filled className="h-5 w-5 text-primary" />
                        </Button>
                      </PressedTooltip>
                    ) : null}
                    <PressedTooltip
                      content={__("Summarize email", "pressedmail")}
                      side="bottom">
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={handleSummarizeClick}
                        aria-label={__("Summarize email", "pressedmail")}
                        data-test="message-ai-summary-generate"
                        disabled={isSummarizing || summaryMutationPending}
                        className="h-8 w-8 shrink-0 p-0 text-muted-foreground hover:text-primary">
                        <AiFileIcon className="h-5 w-5" />
                      </Button>
                    </PressedTooltip>
                  </div>
                ) : null}
                <div className="min-w-0 truncate">
                  <span
                    className="font-semibold mr-1"
                    data-test="message-detail-subject-label">
                    {__("Subject:", "pressedmail")}
                  </span>
                  <span
                    className="font-normal"
                    data-test="message-detail-subject-value">
                    {decodedSubject || __("No Subject", "pressedmail")}
                  </span>
                </div>
              </div>
              {attachments.length > 0 ? (
                <HeaderAttachmentList
                  attachments={attachments}
                  canDownload={canDownloadAttachments}
                  downloadContext={{
                    accountId,
                    uid: (mail.uid ?? null) as string | number | null,
                    msgNo: (mail.msg_no ?? mail.id ?? null) as
                      | string
                      | number
                      | null,
                    folder: (mail.folder ?? "INBOX") as string,
                  }}
                  onAddToCalendar={
                    canReferenceCalendarMessage
                      ? (index) =>
                          openCalendarAttachment(attachments[index]?.part)
                      : undefined
                  }
                />
              ) : null}
            </div>
            {/*
              An accented card, not another grey inset. This used to carry the
              exact classes as the header-details panel above it, so generated
              output and raw headers read as the same kind of thing.
            */}
            {aiSummariesAvailable && showAISummary ? (
              <SectionCard
                tone="primary"
                size="sm"
                className="mt-2"
                icon={<AiFileIcon className="h-4 w-4 text-primary" />}
                title={__("Email summary", "pressedmail")}
                actions={
                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    onClick={() => setShowAISummary(false)}
                    data-test="message-ai-summary-hide"
                    className="text-muted-foreground hover:text-foreground">
                    {__("Hide", "pressedmail")}
                  </Button>
                }
                data-test="message-ai-summary"
                data-testid="message-ai-summary">
                {summaryRecord?.status === "success" &&
                summaryRecord.summary ? (
                  <EmailSummaryMarkdown
                    markdown={summaryRecord.summary}
                    className="text-xs leading-5 [&_ol]:leading-5 [&_p]:leading-5 [&_ul]:leading-5"
                  />
                ) : summaryRecord?.status === "error" ? (
                  <p className="text-xs text-destructive">
                    {summaryRecord.error ||
                      __("Could not summarize this email.", "pressedmail")}
                  </p>
                ) : (
                  <span className="inline-flex items-center gap-2 text-xs text-muted-foreground">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {__("Summarizing…", "pressedmail")}
                  </span>
                )}
              </SectionCard>
            ) : null}
          </div>
        </div>
        {afterMetadata}
        <Separator className="shrink-0" />
        {isBodyLoading ? (
          <MailDetailSkeleton />
        ) : isBodyPending ? (
          <div
            className={cn("email-html-container", contentBodySurfaceClass)}
            data-test="message-detail-body-pending">
            <div className="flex flex-col items-start gap-3 p-4">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {__(
                  "This message is taking longer than usual to load.",
                  "pressedmail",
                )}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMessageDetail()}
                data-test="message-detail-body-retry">
                {__("Retry", "pressedmail")}
              </Button>
            </div>
          </div>
        ) : isBodyError ? (
          <div
            className={cn("email-html-container", contentBodySurfaceClass)}
            data-test="message-detail-body-error">
            <div className="flex flex-col items-start gap-3 p-4">
              <div className="inline-flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4 text-destructive" />
                {__("Couldn't load this message.", "pressedmail")}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => retryMessageDetail()}
                data-test="message-detail-body-error-retry">
                {__("Retry", "pressedmail")}
              </Button>
            </div>
          </div>
        ) : isHtml ? (
          <EmailSandbox
            accountId={accountId}
            uid={(mail.uid ?? mail.msg_no ?? mail.id) as string | number | null}
            folder={(mail.folder ?? "INBOX") as string}
            html={body}
            className="email-html-container pm-email-sandbox-frame"
            showExternalImages={effectiveShowImages}
            onBlockedImageCount={onBlockedImageCount}
          />
        ) : (
          <div className={cn("email-html-container", textBodySurfaceClass)}>
            <div className="email-html-content min-w-0 max-w-full overflow-x-hidden whitespace-pre-wrap break-words [overflow-wrap:anywhere]">
              {body || __("No content", "pressedmail")}
            </div>
          </div>
        )}
      </div>
      <ConfirmationPanel
        open={confirmRemoveOpen}
        onOpenChange={setConfirmRemoveOpen}
        title={__("Remove", "pressedmail")}
        description={sprintf(
          __(
            "Remove %s from your contacts? This cannot be undone.",
            "pressedmail",
          ),
          senderEmail,
        )}
        confirmText={__("Remove", "pressedmail")}
        variant="destructive"
        loading={contactMutationPending}
        onConfirm={handleRemoveSenderFromContacts}
      />
      <AlertDialog open={manageSummaryOpen} onOpenChange={setManageSummaryOpen}>
        <AlertDialogContent
          role="dialog"
          aria-label={__("Manage AI summary", "pressedmail")}
          className="max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow>
                <Sparkles />
                <span>{__("Manage AI summary", "pressedmail")}</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "This email already has an AI summary. Choose how to handle the current summary.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={summaryMutationPending}>
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                void handleDeleteSummary();
              }}
              disabled={summaryMutationPending}>
              {__("Delete", "pressedmail")}
            </Button>
            <Button
              type="button"
              onClick={() => {
                void handleOverwriteSummary();
              }}
              disabled={summaryMutationPending}>
              {summaryMutationPending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {__("Overwrite", "pressedmail")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportIcsPreview
        source={calendarImportSource}
        onClose={() => setCalendarImportSource(null)}
        onImported={async () => {
          await refreshVisibleLocalEvents();
        }}
      />
    </div>
  );
}

interface AttachmentDownloadContext {
  accountId: number | null;
  uid: string | number | null;
  msgNo: string | number | null;
  folder: string;
}

export function buildAttachmentDownloadUrl(
  ctx: AttachmentDownloadContext,
  index: number,
): string {
  const base = getPluginRestBase();
  const nonce = getRuntimeWpNonce();
  const params = new URLSearchParams({
    index: String(index),
    folder: ctx.folder || "INBOX",
    _wpnonce: nonce,
  });
  if (ctx.uid != null && String(ctx.uid) !== "") {
    params.set("uid", String(ctx.uid));
  }
  if (ctx.msgNo != null && String(ctx.msgNo) !== "") {
    params.set("msg_no", String(ctx.msgNo));
  }
  return `${base}messages/attachment/${ctx.accountId}?${params.toString()}`;
}

function downloadAttachment(
  att: AttachmentLike,
  ctx: AttachmentDownloadContext | null,
  index: number,
) {
  const filename = att.filename || "attachment";

  if (ctx && ctx.accountId != null) {
    // Stream from the server endpoint, safer headers + no base64 round-trip.
    const url = buildAttachmentDownloadUrl(ctx, index);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.rel = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    setTimeout(() => {
      document.body.removeChild(link);
    }, 100);
    return;
  }

  // Legacy preview-only fallback (composer attachments still in memory).
  const mimeType = att.mimeType || att.mime || "application/octet-stream";
  const fromBase64 = (b64: string) => {
    const normalized = b64.replace(/^data:.*;base64,/, "").replace(/\s/g, "");
    const bytes = atob(normalized);
    const buf = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) buf[i] = bytes.charCodeAt(i);
    return URL.createObjectURL(new Blob([buf], { type: mimeType }));
  };

  let objectUrl: string | null = null;
  if (typeof att.data === "string") objectUrl = fromBase64(att.data);
  else if (att.data instanceof ArrayBuffer)
    objectUrl = URL.createObjectURL(new Blob([att.data], { type: mimeType }));
  else if (typeof att.content === "string") objectUrl = fromBase64(att.content);

  if (!objectUrl) {
    alert(__("Unable to download attachment.", "pressedmail"));
    return;
  }
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    document.body.removeChild(link);
    URL.revokeObjectURL(objectUrl!);
  }, 100);
}

function HeaderAttachmentList({
  attachments,
  canDownload,
  downloadContext,
  onAddToCalendar,
}: {
  attachments: AttachmentLike[];
  canDownload: boolean;
  downloadContext: AttachmentDownloadContext;
  onAddToCalendar?: (index: number) => void;
}) {
  const adminNotice = !canDownload ? (
    <p className="basis-full text-xs text-muted-foreground">
      {__(
        "Attachment downloads have been disabled by your administrator.",
        "pressedmail",
      )}
    </p>
  ) : null;

  return (
    <div
      data-test="message-detail-attachments"
      className="flex min-w-0 flex-1 basis-72 flex-wrap items-center gap-1.5 text-xs">
      {adminNotice}
      {attachments.map((att, idx) => (
        <HeaderAttachmentChip
          key={idx}
          attachment={att}
          index={idx}
          canDownload={canDownload}
          downloadContext={downloadContext}
          onAddToCalendar={onAddToCalendar}
        />
      ))}
    </div>
  );
}

function HeaderAttachmentChip({
  attachment,
  index,
  canDownload,
  downloadContext,
  onAddToCalendar,
}: {
  attachment: AttachmentLike;
  index: number;
  canDownload: boolean;
  downloadContext: AttachmentDownloadContext;
  onAddToCalendar?: (index: number) => void;
}) {
  const filename =
    attachment.filename ||
    sprintf(__("Attachment %d", "pressedmail"), index + 1);
  const sizeLabel = attachment.size > 0 ? formatFileSize(attachment.size) : "";
  const downloadLabel = sprintf(
    __("Download attachment %s", "pressedmail"),
    filename,
  );

  return (
    <div
      className="inline-flex max-w-[min(18rem,100%)] min-w-0 items-center gap-1.5 rounded-md border border-border/60 bg-muted/20 px-2 py-1 text-xs text-muted-foreground"
      data-test="message-detail-attachment-chip">
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      <span
        className="min-w-0 truncate text-xs font-medium text-foreground/90"
        title={filename}
        data-test="message-detail-attachment-name">
        {filename}
      </span>
      {sizeLabel && (
        <span className="shrink-0 text-[11px] text-muted-foreground">
          {sizeLabel}
        </span>
      )}
      {onAddToCalendar &&
      isExactMimePart(attachment.part) &&
      isCalendarAttachment(attachment) ? (
        <Button
          type="button"
          size="icon"
          variant="ghost"
          className="h-5 w-5 shrink-0 p-0 text-muted-foreground"
          onClick={() => onAddToCalendar(index)}
          aria-label={sprintf(
            __("Add %s to calendar", "pressedmail"),
            filename,
          )}
          title={__("Add to calendar", "pressedmail")}
          data-test="message-detail-attachment-add-to-calendar">
          <CalendarPlus className="h-3.5 w-3.5" />
        </Button>
      ) : null}
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-5 w-5 shrink-0 p-0 text-muted-foreground"
        onClick={() => downloadAttachment(attachment, downloadContext, index)}
        disabled={!canDownload}
        aria-label={downloadLabel}
        title={
          canDownload
            ? downloadLabel
            : __("Downloads disabled by administrator", "pressedmail")
        }>
        <Download className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

function isCalendarAttachment(attachment: AttachmentLike): boolean {
  const mime = (attachment.mimeType || attachment.mime || "")
    .toLowerCase()
    .split(";", 1)[0]
    ?.trim();
  const filename = (attachment.filename || "").toLowerCase();
  return (
    mime === "text/calendar" ||
    mime === "application/ics" ||
    filename.endsWith(".ics")
  );
}

function isExactMimePart(part: unknown): part is string {
  return typeof part === "string" && /^[1-9]\d*(?:\.[1-9]\d*)*$/.test(part);
}
