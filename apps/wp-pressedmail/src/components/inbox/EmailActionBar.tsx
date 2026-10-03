"use client";

/**
 * Email Action Bar Component
 *
 * Provides action buttons for email operations: Reply, Reply All, Forward,
 * Archive, Trash, Mark Unread, Image/content toggles, and Phishing Scan.
 *
 * @since 1.6.0
 */

import { useProFeatureAvailable, useProFeatureEnabled } from "@/context/features/pro-feature.active";
import { __, _x, sprintf } from "@wordpress/i18n";
import {
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import { isApiAuthError } from "@/lib/api-auth-errors";
import { parseSenderEmail, parseSenderName } from "@/lib/mail-utils";
import { useSenderContact } from "@/hooks/useSenderContact";
import {
  Clock,
  ImageOff,
  Image as ImageIcon,
  FolderInput,
  Tags,
  FileText,
} from "lucide-react";
import {
  folderMutationTarget,
  folderTargetKey,
  type MutationTarget,
} from "@/lib/folder-target";
import type { FolderTarget } from "@/services/interfaces";
import { SnoozePopover } from "@/components/snooze/snooze-popover";
import {
  AddSenderContactIcon,
  EmailArchiveIcon,
  AiFileIcon,
  RemoveSenderContactIcon,
  EmailForwardIcon,
  EmailMarkUnreadIcon,
  EmailMoreActionsIcon,
  EmailOpenLargerViewIcon,
  EmailReplyAllIcon,
  EmailReplyIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";

import {
  Button,
  Dialog,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  toast,
} from "@kit/ui/plugin";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
} from "@/components/ui/pressed-overlay";
import { cn } from "@/lib/utils";
import {
  useInbox,
  useMessageOperations,
  useFolderOperations,
} from "@/context/InboxContext";
import { useActionBarAutoTag } from "@/components/inbox/message-auto-tag.active";
import {
  useOptionalEmailSummaries,
  useOptionalSnooze,
} from "@/hooks/useOptionalProContexts";
import {
  useFeatureAvailable,
  useFeatureEnabled,
} from "@/context/features/FeaturesContext";
import { useTags } from "@/context/tags";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useSelectedMessagePhishingScan } from "@/hooks/useSelectedMessagePhishingScan";
import { PhishingSafetyButton } from "@/components/phishing/PhishingSafetyButton";
import { SpamProtectActions } from "@/components/spam";
import { useSecurity } from "@/context/security";
import { PhishingRodIcon } from "@/components/icons/PhishingIcons";
import { getCacheService, getInboxService } from "@/services/implementations";
import {
  getMessageIdentityKey,
  getMessageIdentityRef,
} from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
  type StoragePrincipal,
} from "@/lib/principal-storage";
import {
  MailTagActionPopover,
  type MailTagChange,
} from "./MailTagActionPopover";
import { useSharedMailboxRole } from "@/components/sharing";
import {
  PRESSED_OUT_RIBBON_ICON_CLASS,
  PressedOutRibbonButton,
} from "@/components/inbox/ribbon/RibbonButton";
import { ReadingPaneMoreMenu } from "./ReadingPaneMoreMenu";
import { MAIL_ACTION_ICON_CLASS } from "./reading-pane-action-icons";
import { VerticalRibbonAction } from "./VerticalRibbonAction";
import {
  printEmailContent,
  type PrintEmailContentOptions,
} from "@/lib/print-email-content";
import {
  buildMessageReference,
  buildReconstructedHeaders,
  downloadEmlFile,
} from "@/lib/message-source";
import { isAiSummarizeBuildEnabled } from "@/lib/build-variant";
import type { EmailMessage, EmailMessageTag } from "@/types";
import type { Tag } from "@/types/tags";
import { resolveEmailBody } from "@/lib/email-content-normalization";
import { applyMessageTagSteps } from "@/lib/message-tag-apply";

/**
 * Build a readable move-target label. Nested folders are shown with their
 * parent path ("Clients / Acme") so subfolders that share a leaf name with a
 * sibling elsewhere in the tree stay distinguishable; a leading INBOX root is
 * dropped for brevity. Top-level folders keep their plain display name.
 */
function formatMoveTargetLabel(folder: {
  name: string;
  path?: string;
}): string {
  const path = folder.path ?? "";
  if (path.includes("/")) {
    const parts = path.split("/").filter(Boolean);
    const trimmed =
      parts[0]?.toUpperCase() === "INBOX" ? parts.slice(1) : parts;
    if (trimmed.length > 1) return trimmed.join(" / ");
  }
  return folder.name;
}

function toEmailMessageTag(tag: Tag | EmailMessageTag): EmailMessageTag {
  return {
    id: tag.id,
    name: tag.name,
    color: tag.color,
    icon: tag.icon ?? null,
  };
}

export interface EmailActionBarProps {
  message: EmailMessage;
  onReply: () => void;
  onReplyAll: () => void;
  onForward: () => void;
  onArchive?: () => void;
  onTrash: () => void;
  onMarkUnread?: () => void;
  folderRecoveryAction?: "restore" | "not-spam";
  onFolderRecovery?: () => void;
  /**
   * Toolbar orientation. `"horizontal"` (default) is the compact inline bar
   * shared by the default/pressedg layouts. `"vertical"` renders the older
   * stacked ribbon. `"pressedout-command"` renders compact buttons for the
   * full-width PressedOut command bar.
   * @default "horizontal"
   */
  orientation?: "horizontal" | "vertical" | "pressedout-command";
  /**
   * Hide current-message organize actions when a bulk selection owns those
   * commands in the PressedOut command bar.
   * @default true
   */
  showOrganizeActions?: boolean;
  /**
   * Expand the message into a large in-app modal (pop out the reading pane).
   * When omitted, the "Open in larger view" action is hidden.
   */
  onExpand?: () => void;
  /** Whether actions are currently loading */
  isLoading?: boolean;
  /** Number of blocked external images in the email */
  blockedCount?: number;
  /** Whether external images are currently shown */
  showImages?: boolean;
  /** Called to show blocked external images */
  onToggleImages?: () => void;
}

function getFolderRecoveryDescriptor(
  folderRecoveryAction: EmailActionBarProps["folderRecoveryAction"],
) {
  return folderRecoveryAction === "restore"
    ? {
        label: __("Restore", "pressedmail"),
        ariaLabel: __("Restore message", "pressedmail"),
        tooltip: __("Restore", "pressedmail"),
      }
    : folderRecoveryAction === "not-spam"
      ? {
          label: __("Not Spam", "pressedmail"),
          ariaLabel: __("Mark as not spam", "pressedmail"),
          tooltip: __("Not spam", "pressedmail"),
        }
      : null;
}

export function PressedOutDisabledMessageActions({
  showOrganizeActions = true,
  folderRecoveryAction,
  onDelete,
}: Pick<EmailActionBarProps, "showOrganizeActions" | "folderRecoveryAction"> & {
  /** Enables Delete while a draft is open in the pane composer. */
  onDelete?: () => void;
}) {
  const { phishingEnabled } = useSelectedMessagePhishingScan(null);
  const recoveryAction = getFolderRecoveryDescriptor(folderRecoveryAction);

  return (
    <div
      className="flex min-w-0 items-center gap-1"
      data-test="pressedout-disabled-message-actions"
      data-testid="pressedout-disabled-message-actions">
      <div
        role="group"
        aria-label={__("Respond", "pressedmail")}
        className="flex items-center gap-1">
        <PressedOutRibbonButton
          label={__("Reply", "pressedmail")}
          disabled
          ariaLabel={__("Reply to sender", "pressedmail")}
          dataTest="reading-pane-action-reply"
          icon={<EmailReplyIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
        <PressedOutRibbonButton
          label={__("Reply All", "pressedmail")}
          disabled
          ariaLabel={__("Reply to all recipients", "pressedmail")}
          dataTest="reading-pane-action-reply-all"
          icon={<EmailReplyAllIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
        <PressedOutRibbonButton
          label={__("Forward", "pressedmail")}
          disabled
          ariaLabel={__("Forward message", "pressedmail")}
          dataTest="reading-pane-action-forward"
          icon={<EmailForwardIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
      </div>

      {showOrganizeActions && (
        <>
          <Separator orientation="vertical" className="mx-1 h-9" />
          <div
            role="group"
            aria-label={__("Organize", "pressedmail")}
            className="flex items-center gap-1">
            <PressedOutRibbonButton
              label={__("Move", "pressedmail")}
              disabled
              ariaLabel={__("Move to folder", "pressedmail")}
              dataTest="reading-pane-action-move"
              icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
            <PressedOutRibbonButton
              label={__("Tag", "pressedmail")}
              disabled
              ariaLabel={__("Edit tags", "pressedmail")}
              dataTest="reading-pane-action-tag"
              icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
            {recoveryAction ? (
              <PressedOutRibbonButton
                label={recoveryAction.label}
                disabled
                ariaLabel={recoveryAction.ariaLabel}
                dataTest="reading-pane-action-recover"
                icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
              />
            ) : (
              <>
                <PressedOutRibbonButton
                  label={_x("Archive", "verb", "pressedmail")}
                  disabled
                  dataTest="reading-pane-action-archive"
                  icon={
                    <EmailArchiveIcon
                      className={PRESSED_OUT_RIBBON_ICON_CLASS}
                    />
                  }
                />
                <PressedOutRibbonButton
                  label={__("Snooze", "pressedmail")}
                  disabled
                  ariaLabel={__("Snooze email", "pressedmail")}
                  dataTest="reading-pane-action-snooze"
                  icon={<Clock className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
                />
                <PressedOutRibbonButton
                  label={__("Delete", "pressedmail")}
                  disabled={!onDelete}
                  onClick={onDelete}
                  ariaLabel={__("Move to trash", "pressedmail")}
                  dataTest="reading-pane-action-trash"
                  icon={
                    <EmailTrashIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                  }
                />
              </>
            )}
          </div>
        </>
      )}

      {!__IS_FREE__ && __ENABLE_PHISHING_DETECTION__ && phishingEnabled && (
        <>
          <Separator orientation="vertical" className="mx-1 h-9" />
          <div
            role="group"
            aria-label={__("Protect", "pressedmail")}
            className="flex items-center gap-1">
            <PressedOutRibbonButton
              label={__("Phishing", "pressedmail")}
              disabled
              ariaLabel={__("Check for phishing", "pressedmail")}
              dataTest="reading-pane-action-phishing"
              icon={
                <PhishingRodIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
              }
            />
          </div>
        </>
      )}

      <Separator orientation="vertical" className="mx-1 h-9" />
      <div
        role="group"
        aria-label={__("More message actions", "pressedmail")}
        className="flex items-center gap-1">
        <PressedOutRibbonButton
          label={__("More", "pressedmail")}
          disabled
          ariaLabel={__("More message actions", "pressedmail")}
          dataTest="reading-pane-action-more"
          icon={
            <EmailMoreActionsIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
          }
        />
      </div>
    </div>
  );
}

// Read behind the define so the Free build names no snooze feature.
const useSnoozeEnabled: () => boolean = __IS_FREE__
  ? () => false
  : () => useProFeatureEnabled("snooze");

export function EmailActionBar({
  message,
  onReply,
  onReplyAll,
  onForward,
  onArchive: onArchiveProp,
  onTrash,
  onMarkUnread: onMarkUnreadProp,
  folderRecoveryAction,
  onFolderRecovery: onFolderRecoveryProp,
  orientation = "horizontal",
  showOrganizeActions: showOrganizeActionsProp = true,
  onExpand,
  isLoading = false,
  blockedCount = 0,
  showImages = false,
  onToggleImages,
}: EmailActionBarProps) {
  // On a mailbox shared with this user, a Viewer gets no respond or organize
  // actions, and tags and snooze stay with the owner.
  const mailboxRole = useSharedMailboxRole(
    getMessageIdentityRef(message)?.accountId,
  );
  const canWrite = mailboxRole.canWrite;
  const onArchive = canWrite ? onArchiveProp : undefined;
  const onMarkUnread = canWrite ? onMarkUnreadProp : undefined;
  const onFolderRecovery = canWrite ? onFolderRecoveryProp : undefined;
  const showOrganizeActions = canWrite && showOrganizeActionsProp;
  const snooze = useOptionalSnooze();
  const snoozeEnabled = useSnoozeEnabled();
  // Local rows carry their durable owner. Original UIDs collide across folders
  // and can change during the parking move, so never resolve a snooze by UID.
  // The Free build has no local rows, so it reads none of these fields.
  const snoozeId =
    !__IS_FREE__ &&
    message.snoozed === true &&
    Number.isSafeInteger(message.snooze_id) &&
    Number(message.snooze_id) > 0 &&
    String(message.id) === `snoozed-${message.snooze_id}` &&
    Number.isSafeInteger(message.accountId) &&
    Number(message.accountId) > 0
      ? message.snooze_id!
      : null;
  const {
    phishingEnabled,
    isScanning,
    phishingStatus,
    analysisResult,
    runScan,
  } = useSelectedMessagePhishingScan(message);
  const { spamEnabled } = useSecurity();
  const senderName = parseSenderName(message);
  // Bare address, not the raw From header: the contact lookup, the create
  // call and the remove-confirmation text all want an address alone.
  const senderEmail = parseSenderEmail(message);
  const senderContact = useSenderContact(senderEmail, senderName);
  const summaries = useOptionalEmailSummaries();
  const isSummarizing =
    __ENABLE_AI_SUMMARIZE__ && summaries ? summaries.isSummarizing : false;
  const aiSummarizeAvailable = useProFeatureAvailable("ai_summarize");
  const { tags, assignTag, removeTag, getMessageTags } = useTags();
  const { folders } = useInbox();
  const { moveMessage, getRawHeaders } = useMessageOperations();
  const { getMoveTargetFolders } = useFolderOperations();
  const [headersText, setHeadersText] = useState<string | null>(null);
  const [headersLoading, setHeadersLoading] = useState(false);
  const tagIdentity = getMessageIdentityRef(message);
  const tagIdentityKey = getMessageIdentityKey(tagIdentity);
  // Local snooze rows are identified by their durable row ID. Incomplete
  // physical rows must never borrow identity from the currently selected account.
  const scopeKey = JSON.stringify([
    tagIdentityKey,
    message.id,
    snoozeId,
    message.accountId,
    message.folder,
    message.uid,
    message.uidValidity,
    message.uid_validity,
  ]);
  const tagScopeRef = useRef({ key: scopeKey });
  if (tagScopeRef.current.key !== scopeKey) {
    tagScopeRef.current = { key: scopeKey };
  }
  const tagScope = tagScopeRef.current;
  const [headersScope, setHeadersScope] = useState<typeof tagScope | null>(
    null,
  );
  const headersOpen = headersScope === tagScope;
  const [returnEarlyScope, setReturnEarlyScope] = useState<
    typeof tagScope | null
  >(null);
  const returnEarlyPending = useRef<object | null>(null);
  // The single-flight lock covers this mounted action bar until IMAP settles.
  const isReturningEarly = returnEarlyScope !== null;
  const tagMounted = useRef(true);
  const tagMutation = useRef<typeof tagScope | null>(null);
  const tagLookup = useRef<typeof tagScope | null>(null);
  const tagReadVersion = useRef(0);
  const tagSource = useRef({ scope: tagScope, tags: message.tags });
  const [pendingTagScope, setPendingTagScope] = useState<
    typeof tagScope | null
  >(null);
  const [messageTagState, setMessageTagState] = useState(() => ({
    scope: tagScope,
    tags: (message.tags ?? []).map(toEmailMessageTag),
    loaded: Boolean(tagIdentity && message.tags),
  }));
  const messageTagSelection =
    messageTagState.scope === tagScope
      ? messageTagState.tags
      : (message.tags ?? []).map(toEmailMessageTag);
  const messageTagsLoaded =
    messageTagState.scope === tagScope
      ? messageTagState.loaded
      : Boolean(tagIdentity && message.tags);
  const isTagApplying = pendingTagScope === tagScope;

  useEffect(() => {
    tagMounted.current = true;
    return () => {
      tagMounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (
      tagSource.current.scope === tagScope &&
      tagSource.current.tags === message.tags
    )
      return;
    tagSource.current = { scope: tagScope, tags: message.tags };
    tagReadVersion.current++;
    setMessageTagState({
      scope: tagScope,
      tags: (message.tags ?? []).map(toEmailMessageTag),
      loaded: Boolean(tagIdentityKey && message.tags),
    });
  }, [tagScope, message.tags, tagIdentityKey]);

  const isCurrentTagScope = useCallback(
    (scope: typeof tagScope, principal: StoragePrincipal | null) =>
      tagMounted.current &&
      tagScopeRef.current === scope &&
      isRequestPrincipalCurrent(principal),
    [],
  );

  const invalidateTagCaches = useCallback(
    (principal: StoragePrincipal | null) => {
      if (!tagIdentity || !isRequestPrincipalCurrent(principal)) return;
      const cache = getCacheService();
      // Combined-account and filtered lists can contain this physical message.
      cache.invalidateMessages({});
      if (!isRequestPrincipalCurrent(principal)) return;
      cache.invalidateMessageDetail(
        String(tagIdentity.accountId),
        tagIdentity.folder,
        tagIdentityKey,
      );
    },
    [tagIdentity, tagIdentityKey],
  );

  const reloadMessageTags = useCallback(
    async (principal: StoragePrincipal | null) => {
      if (!tagIdentity || !isCurrentTagScope(tagScope, principal)) return;
      const readVersion = ++tagReadVersion.current;
      const loadedTags = await getMessageTags(
        tagIdentity.accountId,
        tagIdentity.uid,
        tagIdentity.folder,
        tagIdentity.uidValidity,
      );
      if (
        !isCurrentTagScope(tagScope, principal) ||
        readVersion !== tagReadVersion.current
      )
        return;
      const nextTags = loadedTags.map(toEmailMessageTag);
      setMessageTagState({ scope: tagScope, tags: nextTags, loaded: true });
      getInboxService().updateMessage(tagIdentityKey, { tags: nextTags });
    },
    [tagIdentity, tagIdentityKey, tagScope, getMessageTags, isCurrentTagScope],
  );

  const operationId = tagIdentityKey;
  const requireMessageIdentity = useCallback(
    (principal: StoragePrincipal | null) => {
      if (!isCurrentTagScope(tagScope, principal)) return false;
      if (tagIdentityKey) return true;
      toast.error(
        __(
          "This message changed or is incomplete. Reload and try again.",
          "pressedmail",
        ),
      );
      void getInboxService()
        .refresh()
        .catch(() => {});
      return false;
    },
    [tagIdentityKey, tagScope, isCurrentTagScope],
  );

  const selectedTagIds = messageTagSelection.map((tag) => Number(tag.id));

  const autoTag = useActionBarAutoTag(message, {
    tagIdentity,
    tagScope,
    tagMutation,
    tagReadVersion,
    setPendingTagScope,
    isCurrentTagScope,
    invalidateTagCaches,
    reloadMessageTags,
  });

  const handlePrint = useCallback(() => {
    if (!isCurrentTagScope(tagScope, captureRequestPrincipal())) return;
    const resolvedBody = resolveEmailBody(message);
    const printOptions: PrintEmailContentOptions = {
      date: message.receivedDate ?? message.date ?? "",
      from: message.from || message.email || "",
      mode: "message",
      showExternalImages: showImages,
      subject: message.subject || "",
      to: message.to || "",
    };

    if (resolvedBody.kind === "html") {
      printOptions.html = resolvedBody.content;
    } else if (resolvedBody.content) {
      printOptions.text = resolvedBody.content;
    }

    printEmailContent(printOptions);
  }, [message, showImages, tagScope, isCurrentTagScope]);

  const handleMove = useCallback(
    async (targetFolder: MutationTarget) => {
      const principal = captureRequestPrincipal();
      if (!requireMessageIdentity(principal)) return;
      try {
        const result = await moveMessage(operationId, targetFolder);
        if (!isCurrentTagScope(tagScope, principal)) return;
        if (!result.success && !result.requiresRefresh)
          toast.error(
            result.error ||
              __("Could not move this message. Try again.", "pressedmail"),
          );
        if (result.warning) toast.warning(result.warning);
      } catch (error) {
        if (isCurrentTagScope(tagScope, principal) && !isApiAuthError(error))
          toast.error(
            __("Could not move this message. Try again.", "pressedmail"),
          );
      }
    },
    [
      operationId,
      moveMessage,
      requireMessageIdentity,
      tagScope,
      isCurrentTagScope,
    ],
  );

  const handleTagDropdownOpenChange = useCallback(
    async (open: boolean) => {
      const principal = captureRequestPrincipal();
      if (
        !open ||
        !tagIdentity ||
        messageTagsLoaded ||
        tagLookup.current === tagScope ||
        !isCurrentTagScope(tagScope, principal)
      )
        return;
      tagLookup.current = tagScope;
      try {
        await reloadMessageTags(principal);
      } catch (error) {
        if (isCurrentTagScope(tagScope, principal))
          console.error("Failed to load message tags:", error);
      } finally {
        if (tagLookup.current === tagScope) tagLookup.current = null;
      }
    },
    [
      tagIdentity,
      messageTagsLoaded,
      tagScope,
      isCurrentTagScope,
      reloadMessageTags,
    ],
  );

  const handleApplyMessageTags = useCallback(
    async ({ add, remove }: MailTagChange) => {
      const principal = captureRequestPrincipal();
      if (
        !tagIdentity ||
        tagMutation.current === tagScope ||
        !isCurrentTagScope(tagScope, principal)
      )
        return;
      // A tag diff cannot be computed from an unknown starting selection.
      if (!messageTagsLoaded) {
        await handleTagDropdownOpenChange(true);
        throw new Error(
          __(
            "The tags were still loading. Check them and apply again.",
            "pressedmail",
          ),
        );
      }
      const previousTagIds = new Set(
        messageTagSelection.map((tag) => Number(tag.id)),
      );
      const addedTagIds = add.filter((id) => !previousTagIds.has(id));
      const removedTagIds = remove.filter((id) => previousTagIds.has(id));
      if (addedTagIds.length === 0 && removedTagIds.length === 0) return;

      tagMutation.current = tagScope;
      tagReadVersion.current++;
      setPendingTagScope(tagScope);
      const isCurrent = () => isCurrentTagScope(tagScope, principal);
      const { accountId, uid, folder, uidValidity } = tagIdentity;
      try {
        await applyMessageTagSteps({
          writes: [
            ...addedTagIds.map(
              (tagId) => () =>
                assignTag(tagId, accountId, uid, folder, uidValidity),
            ),
            ...removedTagIds.map(
              (tagId) => () =>
                removeTag(tagId, accountId, uid, folder, uidValidity),
            ),
          ],
          isCurrent,
          reload: () => reloadMessageTags(principal),
          onWriteFailed: () => {
            invalidateTagCaches(principal);
            setMessageTagState((current) => ({ ...current, loaded: false }));
          },
          onReloadFailed: () => {
            invalidateTagCaches(principal);
            void getInboxService()
              .refresh()
              .catch((refreshError) => {
                if (isCurrent())
                  console.error(
                    "Failed to refresh message tags:",
                    refreshError,
                  );
              });
          },
        });
      } finally {
        if (tagMutation.current === tagScope) tagMutation.current = null;
        if (isCurrentTagScope(tagScope, principal)) setPendingTagScope(null);
        else invalidateTagCaches(principal);
      }
    },
    [
      tagIdentity,
      tagScope,
      messageTagsLoaded,
      messageTagSelection,
      assignTag,
      removeTag,
      isCurrentTagScope,
      invalidateTagCaches,
      reloadMessageTags,
      handleTagDropdownOpenChange,
    ],
  );

  const handleCopyReference = useCallback(async () => {
    const principal = captureRequestPrincipal();
    if (!isCurrentTagScope(tagScope, principal)) return;
    try {
      await navigator.clipboard.writeText(buildMessageReference(message));
      if (isCurrentTagScope(tagScope, principal))
        toast.success(__("Message reference copied", "pressedmail"));
    } catch {
      if (isCurrentTagScope(tagScope, principal))
        toast.error(__("Failed to copy reference", "pressedmail"));
    }
  }, [message, tagScope, isCurrentTagScope]);

  const handleDownloadEml = useCallback(async () => {
    const principal = captureRequestPrincipal();
    if (!requireMessageIdentity(principal)) return;
    try {
      await downloadEmlFile(message, document, () =>
        isCurrentTagScope(tagScope, principal),
      );
    } catch {
      if (!isCurrentTagScope(tagScope, principal)) return;
      toast.error(
        __(
          "Could not download the complete message. Please try again.",
          "pressedmail",
        ),
      );
    }
  }, [message, requireMessageIdentity, tagScope, isCurrentTagScope]);

  const handleSummarize = useCallback(async () => {
    // AI summaries are Pro: the Free build compiles none of this.
    if (!__ENABLE_AI_SUMMARIZE__ || !summaries) return;
    const principal = captureRequestPrincipal();
    if (!requireMessageIdentity(principal)) return;
    try {
      const result = await summaries.summarizeMessages([message]);
      if (!isCurrentTagScope(tagScope, principal)) return;
      if (result.successCount === 0 && result.failedCount > 0) {
        toast.error(__("Failed to summarize email", "pressedmail"));
      }
    } catch (error) {
      if (!isCurrentTagScope(tagScope, principal) || isApiAuthError(error))
        return;
      console.error("Failed to summarize email:", error);
      toast.error(__("Failed to summarize email", "pressedmail"));
    }
  }, [
    message,
    summaries,
    requireMessageIdentity,
    tagScope,
    isCurrentTagScope,
  ]);

  // Fetch the full raw RFC822 headers (incl. the Received server chain) when the
  // "View headers" dialog opens. Falls back to the client-side reconstruction
  // when the fetch fails so the dialog always shows something useful.
  useEffect(() => {
    if (!headersOpen) {
      return;
    }
    const principal = captureRequestPrincipal();
    if (!requireMessageIdentity(principal)) return;
    let cancelled = false;
    const current = () => !cancelled && isCurrentTagScope(tagScope, principal);
    setHeadersLoading(true);
    setHeadersText(null);
    void (async () => {
      const fallback = buildReconstructedHeaders(message);
      try {
        const result = await getRawHeaders(operationId);
        if (!current()) return;
        if (result.requiresRefresh) {
          setHeadersScope(null);
          return;
        }
        setHeadersText(
          result.success && result.headers ? result.headers : fallback,
        );
      } catch {
        if (current()) setHeadersText(fallback);
      } finally {
        if (current()) setHeadersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [
    headersOpen,
    getRawHeaders,
    operationId,
    message,
    requireMessageIdentity,
    tagScope,
    isCurrentTagScope,
  ]);

  const setHeadersOpen = (open: boolean) => {
    if (!open) {
      setHeadersScope(null);
      return;
    }
    if (!requireMessageIdentity(captureRequestPrincipal())) return;
    setHeadersText(null);
    setHeadersLoading(true);
    setHeadersScope(tagScope);
  };

  const moveTargets = getMoveTargetFolders();
  const tagsEnabled = __ENABLE_TAGS__ && tagIdentity !== null;

  type ActionTriggerStyle = "horizontal" | "vertical" | "pressedout-command";
  // PressedOut is Pro: Free folds every command-bar branch away.
  const isCommandTrigger = (triggerStyle: ActionTriggerStyle) =>
    !__IS_FREE__ && triggerStyle === "pressedout-command";
  const isVerticalTrigger = (triggerStyle: ActionTriggerStyle) =>
    triggerStyle === "vertical";
  const moreMenu = (triggerStyle: ActionTriggerStyle, children?: ReactNode) => (
    <ReadingPaneMoreMenu
      key={`more:${tagScope.key}`}
      disabled={isLoading}
      orientation={triggerStyle}
      onPrint={handlePrint}
      onViewHeaders={() => setHeadersOpen(true)}
      onDownloadEml={handleDownloadEml}
      onCopyReference={handleCopyReference}>
      {children}
    </ReadingPaneMoreMenu>
  );

  const expandAction = (triggerStyle: ActionTriggerStyle) => {
    if (!onExpand) return null;

    const label = __("Open in larger view", "pressedmail");

    if (isCommandTrigger(triggerStyle)) {
      return (
        <PressedOutRibbonButton
          label={__("Open", "pressedmail")}
          onClick={onExpand}
          disabled={isLoading}
          ariaLabel={label}
          dataTest="reading-pane-action-expand"
          icon={
            <EmailOpenLargerViewIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
          }
        />
      );
    }

    return isVerticalTrigger(triggerStyle) ? (
      <VerticalRibbonAction
        icon={<EmailOpenLargerViewIcon />}
        label={__("Open", "pressedmail")}
        ariaLabel={label}
        tooltip={label}
        onClick={onExpand}
        disabled={isLoading}
        dataTest="reading-pane-action-expand"
      />
    ) : (
      <PressedTooltip content={label} side="top">
        <Button
          variant="ghost"
          size="icon"
          onClick={onExpand}
          disabled={isLoading}
          aria-label={label}
          data-test="reading-pane-action-expand"
          className="h-7 w-7">
          <EmailOpenLargerViewIcon className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      </PressedTooltip>
    );
  };

  const moveAction = (triggerStyle: ActionTriggerStyle) =>
    canWrite && (
      // Non-modal so the dropdown doesn't lock body pointer events / steal focus
      // (which flash-closes it); mirrors the working Popover-based controls.
      <DropdownMenu key={`move:${tagScope.key}`} modal={false}>
        <DropdownMenuTrigger asChild>
          {isCommandTrigger(triggerStyle) ? (
            <PressedOutRibbonButton
              label={__("Move", "pressedmail")}
              disabled={isLoading}
              ariaLabel={__("Move to folder", "pressedmail")}
              dataTest="reading-pane-action-move"
              onClick={(event) => event.stopPropagation()}
              icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
          ) : isVerticalTrigger(triggerStyle) ? (
            <VerticalRibbonAction
              icon={<FolderInput />}
              label={__("Move", "pressedmail")}
              ariaLabel={__("Move to folder", "pressedmail")}
              disabled={isLoading}
              dataTest="reading-pane-action-move"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              disabled={isLoading}
              aria-label={__("Move to folder", "pressedmail")}
              className="h-7 w-7"
              onClick={(event) => event.stopPropagation()}>
              <FolderInput className={MAIL_ACTION_ICON_CLASS} />
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="max-h-72 overflow-y-auto">
          {moveTargets.length === 0 ? (
            <DropdownMenuItem disabled>
              {__("No folders available", "pressedmail")}
            </DropdownMenuItem>
          ) : (
            moveTargets.map((folder) => (
              <DropdownMenuItem
                key={folderTargetKey(folder)}
                onSelect={() => void handleMove(folderMutationTarget(folder))}>
                {formatMoveTargetLabel(folder)}
              </DropdownMenuItem>
            ))
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    );

  const snoozeAction = (triggerStyle: ActionTriggerStyle) => {
    // Snooze is Pro: the Free build compiles neither the popover nor Return early.
    if (__IS_FREE__ || !mailboxRole.isOwner) return null;
    if (message.snoozed === true && snoozeId === null) return null;

    if (snoozeId !== null) {
      if (!snoozeEnabled) return null;
      const label = __("Return early", "pressedmail");
      const disabled = isLoading || isReturningEarly;
      const returnEarly = async () => {
        const principal = captureRequestPrincipal();
        if (
          disabled ||
          returnEarlyPending.current ||
          !isCurrentTagScope(tagScope, principal)
        )
          return;
        const operation = {};
        returnEarlyPending.current = operation;
        setReturnEarlyScope(tagScope);
        const service = getInboxService();
        const generation = service.getRequestGeneration();
        const rowId = message.id;
        const rowAccount = message.accountId;
        try {
          if (!__ENABLE_SNOOZE__ || !snooze) return;
          const result = await snooze.unsnoozeEmail(snoozeId);
          if (!isRequestPrincipalCurrent(principal)) return;
          if (!result.success) {
            if (!isCurrentTagScope(tagScope, principal)) return;
            toast.error(
              result.error ||
                __("Could not return this message. Try again.", "pressedmail"),
            );
            return;
          }
          // A user may have selected another message/account while IMAP worked.
          // Remove only the captured virtual row in the same loaded snapshot.
          if (
            service.getRequestGeneration() === generation &&
            service.messages.some(
              (row) => row.id === rowId && row.accountId === rowAccount,
            )
          ) {
            service.removeMessage(rowId);
          }
          if (isCurrentTagScope(tagScope, principal))
            toast.success(__("Message returned.", "pressedmail"));
        } catch (error) {
          if (isCurrentTagScope(tagScope, principal) && !isApiAuthError(error))
            toast.error(
              __("Could not return this message. Try again.", "pressedmail"),
            );
        } finally {
          if (returnEarlyPending.current === operation) {
            returnEarlyPending.current = null;
            if (tagMounted.current && isRequestPrincipalCurrent(principal))
              setReturnEarlyScope(null);
          }
        }
      };
      if (isCommandTrigger(triggerStyle))
        return (
          <PressedOutRibbonButton
            label={label}
            disabled={disabled}
            ariaLabel={label}
            dataTest="reading-pane-action-unsnooze"
            onClick={() => void returnEarly()}
            icon={<Clock className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        );
      if (isVerticalTrigger(triggerStyle))
        return (
          <VerticalRibbonAction
            icon={<Clock />}
            label={label}
            ariaLabel={label}
            tooltip={__("Return this message now", "pressedmail")}
            disabled={disabled}
            dataTest="reading-pane-action-unsnooze"
            onClick={() => void returnEarly()}
          />
        );
      return (
        <Button
          variant="ghost"
          size="icon"
          disabled={disabled}
          aria-label={label}
          title={__("Return this message now", "pressedmail")}
          data-test="reading-pane-action-unsnooze"
          className="h-7 w-7"
          onClick={() => void returnEarly()}>
          <Clock className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      );
    }

    if (!tagIdentity) return null;
    return (
      <SnoozePopover
        key={`snooze:${tagScope.key}`}
        accountId={tagIdentity.accountId}
        messageUid={tagIdentity.uid}
        folder={tagIdentity.folder}
        sourceUidValidity={tagIdentity.uidValidity}
        sourceMessageId={message.messageId ?? message.message_id}
        subject={message.subject}
        from={message.from}
        date={message.receivedDate ?? message.date}>
        {isCommandTrigger(triggerStyle) ? (
          <PressedOutRibbonButton
            label={__("Snooze", "pressedmail")}
            disabled={isLoading}
            ariaLabel={__("Snooze email", "pressedmail")}
            dataTest="reading-pane-action-snooze"
            onClick={(event) => event.stopPropagation()}
            icon={<Clock className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        ) : isVerticalTrigger(triggerStyle) ? (
          <VerticalRibbonAction
            icon={<Clock />}
            label={__("Snooze", "pressedmail")}
            ariaLabel={__("Snooze email", "pressedmail")}
            tooltip={__("Snooze", "pressedmail")}
            disabled={isLoading}
            dataTest="reading-pane-action-snooze"
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <Button
            variant="ghost"
            size="icon"
            disabled={isLoading}
            aria-label={__("Snooze email", "pressedmail")}
            title={__("Snooze", "pressedmail")}
            data-test="reading-pane-action-snooze"
            className="h-7 w-7"
            onClick={(event) => event.stopPropagation()}>
            <Clock className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        )}
      </SnoozePopover>
    );
  };

  const tagAction = (triggerStyle: ActionTriggerStyle) => {
    if (!mailboxRole.isOwner) return null;
    if (!tagsEnabled) {
      // Tags unavailable (build flag off or account unresolved): keep a
      // disabled placeholder so the toolbar layout is stable.
      if (isCommandTrigger(triggerStyle)) {
        return (
          <PressedOutRibbonButton
            label={__("Tag", "pressedmail")}
            disabled
            ariaLabel={__("Edit tags", "pressedmail")}
            dataTest="reading-pane-action-tag"
            icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        );
      }
      return isVerticalTrigger(triggerStyle) ? (
        <VerticalRibbonAction
          icon={<Tags />}
          label={__("Tag", "pressedmail")}
          ariaLabel={__("Edit tags", "pressedmail")}
          disabled
          dataTest="reading-pane-action-tag"
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label={__("Edit tags", "pressedmail")}
          className="h-7 w-7">
          <Tags className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      );
    }
    return (
      <MailTagActionPopover
        key={tagIdentityKey}
        availableTags={tags}
        selectedTagIds={selectedTagIds}
        onApplyTags={handleApplyMessageTags}
        onOpenChange={handleTagDropdownOpenChange}
        // The command ribbon shows its label; the icon styles need the name.
        tooltip={
          isCommandTrigger(triggerStyle)
            ? undefined
            : __("Edit tags", "pressedmail")
        }
        disabled={isLoading}
        isApplying={isTagApplying}
        isLoading={!messageTagsLoaded}
        extraAction={
          !__IS_FREE__ && showAiClassify && autoTag.autoTag
            ? {
                run: autoTag.autoTag,
                running: autoTag.isAutoTagging,
                disabled: autoTag.isAutoTagging || isLoading || isTagApplying,
              }
            : undefined
        }
        align="end"
        trigger={
          isCommandTrigger(triggerStyle) ? (
            <PressedOutRibbonButton
              label={__("Tag", "pressedmail")}
              ariaLabel={__("Edit tags", "pressedmail")}
              dataTest="reading-pane-action-tag"
              onClick={(event) => event.stopPropagation()}
              icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
          ) : isVerticalTrigger(triggerStyle) ? (
            <VerticalRibbonAction
              icon={<Tags />}
              label={__("Tag", "pressedmail")}
              ariaLabel={__("Edit tags", "pressedmail")}
              dataTest="reading-pane-action-tag"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={__("Edit tags", "pressedmail")}
              className="h-7 w-7"
              onClick={(event) => event.stopPropagation()}>
              <Tags className={MAIL_ACTION_ICON_CLASS} />
            </Button>
          )
        }
      />
    );
  };

  const imageAction = (triggerStyle: ActionTriggerStyle) => {
    if (showLoadImages) {
      const label = sprintf(
        __("Show %d blocked images", "pressedmail"),
        blockedCount,
      );

      if (isCommandTrigger(triggerStyle)) {
        return (
          <PressedOutRibbonButton
            label={__("Images", "pressedmail")}
            onClick={onToggleImages}
            ariaLabel={label}
            dataTest="reading-pane-action-load-images"
            icon={<ImageOff className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        );
      }

      return isVerticalTrigger(triggerStyle) ? (
        <VerticalRibbonAction
          icon={<ImageOff />}
          label={__("Images", "pressedmail")}
          ariaLabel={label}
          tooltip={label}
          onClick={onToggleImages}
          dataTest="reading-pane-action-load-images"
        />
      ) : (
        <PressedTooltip content={label} side="top">
          <Button
            variant="ghost"
            size="icon"
            onClick={onToggleImages}
            aria-label={label}
            className="h-7 w-7">
            <ImageOff className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        </PressedTooltip>
      );
    }

    if (showImagesShownIndicator) {
      if (isCommandTrigger(triggerStyle)) {
        return (
          <PressedOutRibbonButton
            label={__("Images", "pressedmail")}
            disabled
            ariaLabel={__("External images are visible", "pressedmail")}
            dataTest="reading-pane-action-images-shown"
            className="text-success"
            icon={<ImageIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        );
      }

      return isVerticalTrigger(triggerStyle) ? (
        <VerticalRibbonAction
          icon={<ImageIcon />}
          label={__("Images", "pressedmail")}
          ariaLabel={__("External images are visible", "pressedmail")}
          tooltip={__("External images are visible", "pressedmail")}
          disabled
          dataTest="reading-pane-action-images-shown"
          className="text-success"
        />
      ) : (
        <PressedTooltip
          content={__("External images are visible", "pressedmail")}
          side="top">
          <Button
            variant="ghost"
            size="icon"
            disabled
            aria-label={__("External images are visible", "pressedmail")}
            className="h-7 w-7 text-success">
            <ImageIcon className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        </PressedTooltip>
      );
    }

    return null;
  };

  /**
   * Add or remove the sender as a contact.
   *
   * This used to sit immediately left of the sender's name in the reading
   * pane, where a destructive-ish toggle read as part of the name rather than
   * as an action. It belongs with the other message actions. The behaviour and
   * both icons are unchanged, including the primary tint once the sender is
   * already a contact and the confirm-before-remove step.
   */
  const hasSenderContactAction =
    __ENABLE_CONTACTS__ && senderContact.available && Boolean(senderEmail);
  const isSenderContact = senderContact.existingContact !== null;
  const senderContactLabel = !__ENABLE_CONTACTS__
    ? ""
    : isSenderContact
      ? __("Remove sender from contacts", "pressedmail")
      : // The capped-plan copy is Pro-only. `__IS_FREE__` is a build-time
        // constant, so the Free bundle drops this branch and its string rather
        // than shipping licence wording it can never display.
        !__IS_FREE__ && !senderContact.canCreate
        ? __("Contact limit reached for your plan", "pressedmail")
        : __("Add sender to contacts", "pressedmail");
  const senderContactDisabled =
    senderContact.pending || (!isSenderContact && !senderContact.canCreate);
  const handleSenderContact = () => {
    if (!isCurrentTagScope(tagScope, captureRequestPrincipal())) return;
    if (isSenderContact) {
      senderContact.setConfirmRemoveOpen(true);
      return;
    }
    void senderContact.addSender();
  };
  const SenderContactIcon = isSenderContact
    ? RemoveSenderContactIcon
    : AddSenderContactIcon;

  const senderContactAction = (triggerStyle: ActionTriggerStyle) => {
    if (!__ENABLE_CONTACTS__ || !hasSenderContactAction) return null;

    const shortLabel = __("Contact", "pressedmail");

    if (isCommandTrigger(triggerStyle)) {
      return (
        <PressedOutRibbonButton
          label={shortLabel}
          onClick={handleSenderContact}
          disabled={senderContactDisabled}
          ariaLabel={senderContactLabel}
          dataTest="reading-pane-action-sender-contact"
          icon={<SenderContactIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
      );
    }

    return isVerticalTrigger(triggerStyle) ? (
      <VerticalRibbonAction
        icon={<SenderContactIcon />}
        label={shortLabel}
        ariaLabel={senderContactLabel}
        tooltip={senderContactLabel}
        onClick={handleSenderContact}
        disabled={senderContactDisabled}
        dataTest="reading-pane-action-sender-contact"
      />
    ) : (
      <PressedTooltip content={senderContactLabel} side="top">
        <Button
          variant="ghost"
          size="icon"
          onClick={handleSenderContact}
          disabled={senderContactDisabled}
          aria-label={senderContactLabel}
          data-test="reading-pane-action-sender-contact"
          className={cn("h-7 w-7", isSenderContact && "text-primary")}>
          <SenderContactIcon className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      </PressedTooltip>
    );
  };

  // Contacts are Pro: the Free build compiles no confirmation and no copy.
  const senderContactConfirm = __ENABLE_CONTACTS__ ? (
    <ConfirmationPanel
      open={senderContact.confirmRemoveOpen}
      onOpenChange={senderContact.setConfirmRemoveOpen}
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
      loading={senderContact.pending}
      onConfirm={senderContact.removeSender}
    />
  ) : null;

  const summarizeAction = (triggerStyle: ActionTriggerStyle) => {
    if (!showSummarize) return null;

    const label = __("Summarize email", "pressedmail");
    const disabled = isLoading || isSummarizing;

    if (isCommandTrigger(triggerStyle)) {
      return (
        <PressedOutRibbonButton
          label={__("Summary", "pressedmail")}
          onClick={() => void handleSummarize()}
          disabled={disabled}
          ariaLabel={label}
          dataTest="reading-pane-action-summarize"
          icon={<AiFileIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
      );
    }

    return isVerticalTrigger(triggerStyle) ? (
      <VerticalRibbonAction
        icon={<AiFileIcon />}
        label={__("Summary", "pressedmail")}
        ariaLabel={label}
        tooltip={label}
        onClick={() => void handleSummarize()}
        disabled={disabled}
        dataTest="reading-pane-action-summarize"
      />
    ) : (
      <PressedTooltip content={label} side="top">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => void handleSummarize()}
          disabled={disabled}
          aria-label={label}
          data-test="reading-pane-action-summarize"
          className="h-7 w-7">
          <AiFileIcon className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      </PressedTooltip>
    );
  };

  const headersDialog = (
    <Dialog open={headersOpen} onOpenChange={setHeadersOpen}>
      <PressedDialogContent size="compactForm">
        <PressedDialogHeader
          title={__("Message headers", "pressedmail")}
          icon={FileText}
          description={__(
            "Full raw headers for the selected message.",
            "pressedmail",
          )}
          descriptionMode="sr-only"
        />
        <PressedOverlayBody>
          <pre
            data-test="reading-pane-headers"
            className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs text-foreground">
            {headersLoading && headersText === null
              ? __("Loading headers…", "pressedmail")
              : (headersText ?? buildReconstructedHeaders(message))}
          </pre>
        </PressedOverlayBody>
      </PressedDialogContent>
    </Dialog>
  );

  const showLoadImages =
    blockedCount > 0 && !showImages && Boolean(onToggleImages);
  const showImagesShownIndicator = showImages && blockedCount > 0;
  const showAiClassify =
    !__IS_FREE__ &&
    __ENABLE_AUTO_TAGGER__ &&
    __ENABLE_AI_AUTO_TAGGER__ &&
    autoTag.available;
  const showPhishing =
    !__IS_FREE__ && __ENABLE_PHISHING_DETECTION__ && phishingEnabled;
  // Spam checks are the mailbox owner's: a teammate's request is refused.
  const showSpam =
    !__IS_FREE__ && __ENABLE_SPAM_DETECTION__ && spamEnabled && mailboxRole.isOwner;
  const showProtect = showPhishing || showSpam;
  // Read the define directly: esbuild can only fold a bare identifier, so behind
  // isAiSummarizeBuildEnabled() this whole control stayed compiled into the Free
  // bundle and was merely hidden at runtime.
  const showSummarize = __ENABLE_AI_SUMMARIZE__ && aiSummarizeAvailable;
  const recoveryAction = getFolderRecoveryDescriptor(folderRecoveryAction);

  // PressedOut is a Pro layout: the Free build compiles none of its ribbon.
  if (!__IS_FREE__ && orientation === "pressedout-command") {
    const pressedOutTrigger = orientation;
    return (
      <>
        <div
          className="flex min-w-0 items-center gap-1"
          data-test={`reading-pane-actions-${orientation}`}>
          {canWrite && (
            <div
              role="group"
              aria-label={__("Respond", "pressedmail")}
              className="flex items-center gap-1">
              <PressedOutRibbonButton
                label={__("Reply", "pressedmail")}
                onClick={onReply}
                disabled={isLoading}
                ariaLabel={__("Reply to sender", "pressedmail")}
                dataTest="reading-pane-action-reply"
                icon={
                  <EmailReplyIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                }
              />

              <PressedOutRibbonButton
                label={__("Reply All", "pressedmail")}
                onClick={onReplyAll}
                disabled={isLoading}
                ariaLabel={__("Reply to all recipients", "pressedmail")}
                dataTest="reading-pane-action-reply-all"
                icon={
                  <EmailReplyAllIcon
                    className={PRESSED_OUT_RIBBON_ICON_CLASS}
                  />
                }
              />

              <PressedOutRibbonButton
                label={__("Forward", "pressedmail")}
                onClick={onForward}
                disabled={isLoading}
                ariaLabel={__("Forward message", "pressedmail")}
                dataTest="reading-pane-action-forward"
                icon={
                  <EmailForwardIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                }
              />
            </div>
          )}

          {showOrganizeActions && (
            <>
              <Separator orientation="vertical" className="mx-1 h-9" />
              <div
                role="group"
                aria-label={__("Organize", "pressedmail")}
                className="flex items-center gap-1">
                {moveAction(pressedOutTrigger)}
                {tagAction(pressedOutTrigger)}
                {imageAction(pressedOutTrigger)}

                {recoveryAction && onFolderRecovery ? (
                  <PressedOutRibbonButton
                    label={recoveryAction.label}
                    onClick={onFolderRecovery}
                    disabled={isLoading}
                    ariaLabel={recoveryAction.ariaLabel}
                    dataTest="reading-pane-action-recover"
                    icon={
                      <FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                    }
                  />
                ) : (
                  <>
                    {onArchive && (
                      <PressedOutRibbonButton
                        label={_x("Archive", "verb", "pressedmail")}
                        onClick={onArchive}
                        disabled={isLoading}
                        dataTest="reading-pane-action-archive"
                        icon={
                          <EmailArchiveIcon
                            className={PRESSED_OUT_RIBBON_ICON_CLASS}
                          />
                        }
                      />
                    )}

                    {snoozeAction(pressedOutTrigger)}

                    <PressedOutRibbonButton
                      label={__("Delete", "pressedmail")}
                      onClick={onTrash}
                      disabled={isLoading}
                      ariaLabel={__("Move to trash", "pressedmail")}
                      dataTest="reading-pane-action-trash"
                      className={cn(
                        "hover:bg-destructive/10 hover:text-destructive",
                      )}
                      icon={
                        <EmailTrashIcon
                          className={PRESSED_OUT_RIBBON_ICON_CLASS}
                        />
                      }
                    />
                  </>
                )}
              </div>
            </>
          )}

          {showProtect && (
            <>
              <Separator orientation="vertical" className="mx-1 h-9" />
              <div
                role="group"
                aria-label={__("Protect", "pressedmail")}
                className="flex items-center gap-1">
                <PhishingSafetyButton
                  message={message}
                  enabled={showPhishing}
                  disabled={isLoading}
                  status={phishingStatus}
                  result={analysisResult}
                  onRunScan={runScan}
                  ribbonLabel={__("Phishing", "pressedmail")}
                  className="h-[52px] w-16 gap-0.5 px-1 py-1"
                />
                {showSpam && (
                  <SpamProtectActions
                    message={message}
                    variant="ribbon"
                    disabled={isLoading}
                  />
                )}
              </div>
            </>
          )}

          <Separator orientation="vertical" className="mx-1 h-9" />
          <div
            role="group"
            aria-label={__("More message actions", "pressedmail")}
            className="flex items-center gap-1">
            {moreMenu(
              pressedOutTrigger,
              <>
                {showOrganizeActions && onMarkUnread && (
                  <DropdownMenuItem
                    onSelect={onMarkUnread}
                    disabled={isLoading}
                    aria-label={__("Mark as unread", "pressedmail")}
                    data-test="reading-pane-action-mark-unread"
                    data-testid="reading-pane-action-mark-unread">
                    <EmailMarkUnreadIcon className="mr-2 size-4" />
                    {__("Mark as unread", "pressedmail")}
                  </DropdownMenuItem>
                )}
                {hasSenderContactAction && (
                  <DropdownMenuItem
                    onSelect={handleSenderContact}
                    disabled={senderContactDisabled}
                    aria-label={senderContactLabel}
                    data-test="reading-pane-action-sender-contact"
                    data-testid="reading-pane-action-sender-contact">
                    <SenderContactIcon className="mr-2 size-4" />
                    {__("Contact", "pressedmail")}
                  </DropdownMenuItem>
                )}
                {showSummarize && (
                  <DropdownMenuItem
                    onSelect={() => void handleSummarize()}
                    disabled={isLoading || isSummarizing}
                    aria-label={__("Summarize email", "pressedmail")}
                    data-test="reading-pane-action-summarize"
                    data-testid="reading-pane-action-summarize">
                    <AiFileIcon className="mr-2 size-4" />
                    {__("Summary", "pressedmail")}
                  </DropdownMenuItem>
                )}
                {onExpand && (
                  <DropdownMenuItem
                    onSelect={onExpand}
                    disabled={isLoading}
                    aria-label={__("Open in larger view", "pressedmail")}
                    data-test="reading-pane-action-expand"
                    data-testid="reading-pane-action-expand">
                    <EmailOpenLargerViewIcon className="mr-2 size-4" />
                    {__("Open in larger view", "pressedmail")}
                  </DropdownMenuItem>
                )}
              </>,
            )}
          </div>
        </div>
        {headersDialog}
        {senderContactConfirm}
      </>
    );
  }

  if (orientation === "vertical") {
    return (
      <div
        className="flex w-full flex-wrap items-center gap-1"
        data-test="reading-pane-actions-vertical">
        {canWrite && (
          <>
            <span className="sr-only">{__("Respond", "pressedmail")}</span>
            <VerticalRibbonAction
              icon={<EmailReplyIcon />}
              label={__("Reply", "pressedmail")}
              ariaLabel={__("Reply to sender", "pressedmail")}
              tooltip={__("Reply", "pressedmail")}
              onClick={onReply}
              disabled={isLoading}
              dataTest="reading-pane-action-reply"
            />
            <VerticalRibbonAction
              icon={<EmailReplyAllIcon />}
              label={__("Reply All", "pressedmail")}
              ariaLabel={__("Reply to all recipients", "pressedmail")}
              tooltip={__("Reply All", "pressedmail")}
              onClick={onReplyAll}
              disabled={isLoading}
              dataTest="reading-pane-action-reply-all"
            />
            <VerticalRibbonAction
              icon={<EmailForwardIcon />}
              label={__("Forward", "pressedmail")}
              ariaLabel={__("Forward message", "pressedmail")}
              tooltip={__("Forward", "pressedmail")}
              onClick={onForward}
              disabled={isLoading}
              dataTest="reading-pane-action-forward"
            />

            <Separator
              orientation="vertical"
              className="mx-1 h-12 self-center"
            />
          </>
        )}

        <span className="sr-only">{__("Organize", "pressedmail")}</span>
        {onMarkUnread && (
          <VerticalRibbonAction
            icon={<EmailMarkUnreadIcon />}
            label={__("Mark Unread", "pressedmail")}
            ariaLabel={__("Mark as unread", "pressedmail")}
            tooltip={__("Mark as unread", "pressedmail")}
            onClick={onMarkUnread}
            disabled={isLoading}
            dataTest="reading-pane-action-mark-unread"
          />
        )}
        {moveAction("vertical")}
        {tagAction("vertical")}
        {imageAction("vertical")}
        {recoveryAction && onFolderRecovery ? (
          <VerticalRibbonAction
            icon={<FolderInput />}
            label={recoveryAction.label}
            ariaLabel={recoveryAction.ariaLabel}
            tooltip={recoveryAction.tooltip}
            onClick={onFolderRecovery}
            disabled={isLoading}
            dataTest="reading-pane-action-recover"
          />
        ) : (
          <>
            {onArchive && (
              <VerticalRibbonAction
                icon={<EmailArchiveIcon />}
                label={_x("Archive", "verb", "pressedmail")}
                tooltip={_x("Archive", "verb", "pressedmail")}
                onClick={onArchive}
                disabled={isLoading}
                dataTest="reading-pane-action-archive"
              />
            )}
            {snoozeAction("vertical")}
            {canWrite && (
              <VerticalRibbonAction
                icon={<EmailTrashIcon />}
                label={__("Delete", "pressedmail")}
                ariaLabel={__("Move to trash", "pressedmail")}
                tooltip={__("Move to trash", "pressedmail")}
                onClick={onTrash}
                disabled={isLoading}
                dataTest="reading-pane-action-trash"
                className="hover:bg-destructive/10 hover:[&_svg]:text-destructive"
              />
            )}
          </>
        )}
        {showProtect && (
          <>
            <span className="sr-only">{__("Protect", "pressedmail")}</span>
            {showPhishing && (
              <PhishingSafetyButton
                message={message}
                enabled={showPhishing}
                disabled={isLoading}
                status={phishingStatus}
                result={analysisResult}
                onRunScan={runScan}
                ribbonLabel={__("Phishing", "pressedmail")}
              />
            )}
            {showSpam && (
              <SpamProtectActions
                message={message}
                variant="vertical"
                disabled={isLoading}
              />
            )}
          </>
        )}

        <span className="sr-only">{__("Inspect", "pressedmail")}</span>
        {senderContactAction("vertical")}
        {summarizeAction("vertical")}
        {expandAction("vertical")}
        {moreMenu("vertical")}
        {headersDialog}
        {senderContactConfirm}
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        {canWrite && (
          <>
            <span className="sr-only">{__("Respond", "pressedmail")}</span>
            <div
              className="flex items-center gap-0 rounded-md border border-border/60 px-0.5"
              data-test="reading-pane-respond-group">
              <Button
                variant="ghost"
                size="sm"
                onClick={onReply}
                disabled={isLoading}
                aria-label={__("Reply to sender", "pressedmail")}
                className="h-7 gap-1">
                <EmailReplyIcon className={MAIL_ACTION_ICON_CLASS} />
                <span className="text-xs">{__("Reply", "pressedmail")}</span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onReplyAll}
                disabled={isLoading}
                aria-label={__("Reply to all recipients", "pressedmail")}
                className="h-7 gap-1">
                <EmailReplyAllIcon className={MAIL_ACTION_ICON_CLASS} />
                <span className="text-xs">
                  {__("Reply All", "pressedmail")}
                </span>
              </Button>

              <Button
                variant="ghost"
                size="sm"
                onClick={onForward}
                disabled={isLoading}
                aria-label={__("Forward message", "pressedmail")}
                className="h-7 gap-1">
                <EmailForwardIcon className={MAIL_ACTION_ICON_CLASS} />
                <span className="text-xs">{__("Forward", "pressedmail")}</span>
              </Button>
            </div>

            <Separator orientation="vertical" className="h-5" />
          </>
        )}

        <span className="sr-only">{__("Organize", "pressedmail")}</span>
        <div
          className="flex items-center gap-0.5"
          data-test="reading-pane-organize-group">
          {onMarkUnread && (
            <PressedTooltip
              content={__("Mark as unread", "pressedmail")}
              side="top">
              <Button
                variant="ghost"
                size="icon"
                onClick={onMarkUnread}
                disabled={isLoading}
                aria-label={__("Mark as unread", "pressedmail")}
                className="h-7 w-7">
                <EmailMarkUnreadIcon className={MAIL_ACTION_ICON_CLASS} />
              </Button>
            </PressedTooltip>
          )}
          {moveAction("horizontal")}
          {tagAction("horizontal")}
          {imageAction("horizontal")}

          {recoveryAction && onFolderRecovery ? (
            <PressedTooltip content={recoveryAction.tooltip} side="top">
              <Button
                variant="ghost"
                size="icon"
                onClick={onFolderRecovery}
                disabled={isLoading}
                aria-label={recoveryAction.ariaLabel}
                className="h-7 w-7">
                <FolderInput className={MAIL_ACTION_ICON_CLASS} />
              </Button>
            </PressedTooltip>
          ) : (
            <>
              {onArchive && (
                <PressedTooltip
                  content={_x("Archive", "verb", "pressedmail")}
                  side="top">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onArchive}
                    disabled={isLoading}
                    aria-label={_x("Archive", "verb", "pressedmail")}
                    className="h-7 w-7">
                    <EmailArchiveIcon className={MAIL_ACTION_ICON_CLASS} />
                  </Button>
                </PressedTooltip>
              )}

              {snoozeAction("horizontal")}

              {canWrite && (
                <PressedTooltip
                  content={__("Move to trash", "pressedmail")}
                  side="top">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onTrash}
                    disabled={isLoading}
                    aria-label={__("Move to trash", "pressedmail")}
                    className="h-7 w-7 text-muted-foreground hover:bg-destructive/10 hover:text-destructive">
                    <EmailTrashIcon className={MAIL_ACTION_ICON_CLASS} />
                  </Button>
                </PressedTooltip>
              )}
            </>
          )}
        </div>

        {showProtect && (
          <>
            <Separator orientation="vertical" className="h-5" />

            <span className="sr-only">{__("Protect", "pressedmail")}</span>
            <div
              className="flex items-center gap-0.5"
              data-test="reading-pane-protect-group">
              {showPhishing && (
                <PhishingSafetyButton
                  message={message}
                  enabled={showPhishing}
                  disabled={isLoading}
                  status={phishingStatus}
                  result={analysisResult}
                  onRunScan={runScan}
                  className="h-7 w-7"
                />
              )}
              {showSpam && (
                <SpamProtectActions
                  message={message}
                  variant="icon"
                  disabled={isLoading}
                />
              )}
            </div>
          </>
        )}

        <Separator orientation="vertical" className="h-5" />

        <span className="sr-only">{__("Inspect", "pressedmail")}</span>
        <div
          className="flex items-center gap-0.5"
          data-test="reading-pane-inspect-group">
          {senderContactAction("horizontal")}
          {summarizeAction("horizontal")}
          {expandAction("horizontal")}
          {moreMenu("horizontal")}
        </div>
      </div>
      {headersDialog}
      {senderContactConfirm}
    </>
  );
}

export default EmailActionBar;
