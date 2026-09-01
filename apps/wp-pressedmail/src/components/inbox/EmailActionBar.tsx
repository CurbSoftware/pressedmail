"use client";

/**
 * Email Action Bar Component
 *
 * Provides action buttons for email operations: Reply, Reply All, Forward,
 * Archive, Trash, Mark Unread, Image/content toggles, and Phishing Scan.
 *
 * @since 1.6.0
 */

import { __, sprintf } from "@wordpress/i18n";
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
  Maximize2,
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
  EmailReplyAllIcon,
  EmailReplyIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  Separator,
  toast,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/AppProvider";
import {
  useInbox,
  useMessageOperations,
  useFolderOperations,
} from "@/context/InboxContext";
import {
  useAutoTagger,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import { useEmailSummaries } from "@/context/email-summary";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import { useTags } from "@/context/tags";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useSelectedMessagePhishingScan } from "@/hooks/useSelectedMessagePhishingScan";
import { PhishingSafetyButton } from "@/components/phishing/PhishingSafetyButton";
import { PhishingRodIcon } from "@/components/icons/PhishingIcons";
import { getInboxService } from "@/services/implementations";
import { MailTagActionDropdown } from "./MailTagActionDropdown";
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
}: Pick<EmailActionBarProps, "showOrganizeActions" | "folderRecoveryAction">) {
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
              ariaLabel={__("Add tag", "pressedmail")}
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
                  label={__("Archive", "pressedmail")}
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
                  disabled
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

export function EmailActionBar({
  message,
  onReply,
  onReplyAll,
  onForward,
  onArchive,
  onTrash,
  onMarkUnread,
  folderRecoveryAction,
  onFolderRecovery,
  orientation = "horizontal",
  showOrganizeActions = true,
  onExpand,
  isLoading = false,
  blockedCount = 0,
  showImages = false,
  onToggleImages,
}: EmailActionBarProps) {
  const [isClassifying, setIsClassifying] = useState(false);
  const {
    phishingEnabled,
    isScanning,
    phishingStatus,
    analysisResult,
    runScan,
  } = useSelectedMessagePhishingScan(message);
  const senderName = parseSenderName(message);
  // Bare address, not the raw From header: the contact lookup, the create
  // call and the remove-confirmation text all want an address alone.
  const senderEmail = parseSenderEmail(message);
  const senderContact = useSenderContact(senderEmail, senderName);
  const { classifyEmails } = useAutoTagger();
  const autoTaggerAvailable = useAutoTaggerToolAvailable();
  const { summarizeMessages, isSummarizing } = useEmailSummaries();
  const aiSummarizeAvailable = useFeatureAvailable("ai_summarize");
  const { tags, assignTag, removeTag, getMessageTags } = useTags();
  const { accounts, selectedAccount } = useAppContext();
  const { folders } = useInbox();
  const { moveMessage, getRawHeaders } = useMessageOperations();
  const { getMoveTargetFolders } = useFolderOperations();
  const [headersOpen, setHeadersOpen] = useState(false);
  const [headersText, setHeadersText] = useState<string | null>(null);
  const [headersLoading, setHeadersLoading] = useState(false);
  const [messageTagSelection, setMessageTagSelection] = useState<
    EmailMessageTag[]
  >(() => (message.tags ?? []).map(toEmailMessageTag));
  const [messageTagsLoaded, setMessageTagsLoaded] = useState(
    Boolean(message.tags),
  );
  const messageTagSyncKey = `${String(message.id ?? "")}:${String(
    message.uid ?? "",
  )}:${(message.tags ?? []).map((tag) => tag.id).join(",")}`;
  const messageTagSyncKeyRef = useRef(messageTagSyncKey);

  const messageId = message.uid ?? message.msg_no ?? message.id;
  // Store mutations (star / move / mark-spam) must use the canonical message
  // id, the same identity the working list path passes, NOT the raw IMAP
  // uid. In unified/consolidated inbox mode uids are per-folder and collide
  // across accounts, so resolving by uid can target the wrong account's
  // message (the toggle silently lands elsewhere → "nothing happens").
  const operationId = message.id;
  const resolvedAccount = accounts.find((acc) => acc.email === selectedAccount);
  const accountId =
    message.accountId ??
    (resolvedAccount?.id != null ? Number(resolvedAccount.id) : undefined);
  const tagFolder = message.folder ?? "INBOX";
  const selectedTagIds = messageTagSelection.map((tag) => Number(tag.id));

  useEffect(() => {
    if (messageTagSyncKeyRef.current === messageTagSyncKey) return;
    messageTagSyncKeyRef.current = messageTagSyncKey;
    setMessageTagSelection((message.tags ?? []).map(toEmailMessageTag));
    setMessageTagsLoaded(Boolean(message.tags));
  }, [message.tags, messageTagSyncKey]);

  const handleAutoClassify = useCallback(async () => {
    if (!message) return;

    const account = accounts.find((acc) => acc.email === selectedAccount);
    const accountId = account?.id ? Number(account.id) : null;
    if (!accountId) return;

    setIsClassifying(true);

    try {
      const result = await classifyEmails(accountId, [
        {
          uid: message.uid || message.id,
          folder: message.folder || "INBOX",
          subject: message.subject || "",
          from: message.from || message.email || "",
          to: message.to || "",
          date: message.receivedDate ?? message.date ?? "",
          body: message.htmlBody || message.body || "",
        },
      ]);

      if (result.status === "success" && result.results?.[0]?.tags?.length) {
        const tagNames = result.results[0].tags
          .map((t) => `${t.name} (${Math.round(t.confidence * 100)}%)`)
          .join(", ");
        toast.success(
          sprintf(__("Tags applied: %s", "pressedmail"), tagNames),
          { duration: 5000 },
        );
      } else if (result.status === "success") {
        toast.info(__("No tags matched this email.", "pressedmail"));
      } else {
        toast.error(
          result.message || __("Classification failed", "pressedmail"),
        );
      }
    } catch (error) {
      if (isApiAuthError(error)) {
        return;
      }
      console.error("Auto-classify error:", error);
      toast.error(__("Classification failed", "pressedmail"));
    } finally {
      setIsClassifying(false);
    }
  }, [message, classifyEmails, accounts, selectedAccount]);

  const handlePrint = useCallback(() => {
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
  }, [message, showImages]);

  const handleMove = useCallback(
    (targetFolder: MutationTarget) => {
      if (operationId == null) return;
      void moveMessage(operationId, targetFolder);
    },
    [operationId, moveMessage],
  );

  const handleTagDropdownOpenChange = useCallback(
    async (open: boolean) => {
      if (!open || accountId == null || messageTagsLoaded) return;

      try {
        const loadedTags = await getMessageTags(
          accountId,
          String(messageId),
          tagFolder,
        );
        setMessageTagSelection(loadedTags.map(toEmailMessageTag));
        setMessageTagsLoaded(true);
      } catch (error) {
        console.error("Failed to load message tags:", error);
      }
    },
    [accountId, getMessageTags, messageId, messageTagsLoaded, tagFolder],
  );

  const handleApplyMessageTags = useCallback(
    async (nextTagIds: number[]) => {
      if (accountId == null) return;

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
      getInboxService().updateMessage(messageId, { tags: nextTags });

      try {
        await Promise.all([
          ...addedTagIds.map((tagId) =>
            assignTag(tagId, accountId, String(messageId), tagFolder),
          ),
          ...removedTagIds.map((tagId) =>
            removeTag(tagId, accountId, String(messageId), tagFolder),
          ),
        ]);
        setMessageTagsLoaded(true);
      } catch (error) {
        setMessageTagSelection(previousTags);
        getInboxService().updateMessage(messageId, { tags: previousTags });
        console.error("Failed to update message tags:", error);
      }
    },
    [
      accountId,
      assignTag,
      messageId,
      messageTagSelection,
      removeTag,
      tagFolder,
      tags,
    ],
  );

  const handleCopyReference = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildMessageReference(message));
      toast.success(__("Message reference copied", "pressedmail"));
    } catch {
      toast.error(__("Failed to copy reference", "pressedmail"));
    }
  }, [message]);

  const handleDownloadEml = useCallback(() => {
    downloadEmlFile(message);
  }, [message]);

  const handleSummarize = useCallback(async () => {
    try {
      const result = await summarizeMessages([message]);
      if (result.successCount === 0 && result.failedCount > 0) {
        toast.error(__("Failed to summarize email", "pressedmail"));
      }
    } catch (error) {
      if (isApiAuthError(error)) {
        return;
      }
      console.error("Failed to summarize email:", error);
      toast.error(__("Failed to summarize email", "pressedmail"));
    }
  }, [message, summarizeMessages]);

  // Fetch the full raw RFC822 headers (incl. the Received server chain) when the
  // "View headers" dialog opens. Falls back to the client-side reconstruction
  // when the fetch fails so the dialog always shows something useful.
  useEffect(() => {
    if (!headersOpen) {
      return;
    }
    let cancelled = false;
    setHeadersLoading(true);
    setHeadersText(null);
    void (async () => {
      const fallback = buildReconstructedHeaders(message);
      try {
        const result = await getRawHeaders(operationId);
        if (cancelled) return;
        setHeadersText(
          result.success && result.headers ? result.headers : fallback,
        );
      } catch {
        if (!cancelled) setHeadersText(fallback);
      } finally {
        if (!cancelled) setHeadersLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [headersOpen, getRawHeaders, operationId, message]);

  const moveTargets = getMoveTargetFolders();
  const tagsEnabled = __ENABLE_TAGS__ && accountId != null;

  type ActionTriggerStyle = "horizontal" | "vertical" | "pressedout-command";
  const isCommandTrigger = (triggerStyle: ActionTriggerStyle) =>
    triggerStyle === "pressedout-command";
  const isVerticalTrigger = (triggerStyle: ActionTriggerStyle) =>
    triggerStyle === "vertical";
  const moreMenu = (triggerStyle: ActionTriggerStyle, children?: ReactNode) => (
    <ReadingPaneMoreMenu
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
          icon={<Maximize2 className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
        />
      );
    }

    return isVerticalTrigger(triggerStyle) ? (
      <VerticalRibbonAction
        icon={<Maximize2 />}
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
          <Maximize2 className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      </PressedTooltip>
    );
  };

  const moveAction = (triggerStyle: ActionTriggerStyle) => (
    // Non-modal so the dropdown doesn't lock body pointer events / steal focus
    // (which flash-closes it); mirrors the working Popover-based controls.
    <DropdownMenu modal={false}>
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
              onSelect={() => handleMove(folderMutationTarget(folder))}>
              {formatMoveTargetLabel(folder)}
            </DropdownMenuItem>
          ))
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  const snoozeAction = (triggerStyle: ActionTriggerStyle) => {
    if (accountId == null) return null;

    return (
      <SnoozePopover
        accountId={accountId}
        messageUid={message.uid != null ? String(message.uid) : undefined}
        folder={message.folder}
        sourceUidValidity={message.uidValidity ?? message.uid_validity}
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
    if (!tagsEnabled) {
      // Tags unavailable (build flag off or account unresolved): keep a
      // disabled placeholder so the toolbar layout is stable.
      if (isCommandTrigger(triggerStyle)) {
        return (
          <PressedOutRibbonButton
            label={__("Tag", "pressedmail")}
            disabled
            ariaLabel={__("Add tag", "pressedmail")}
            dataTest="reading-pane-action-tag"
            icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        );
      }
      return isVerticalTrigger(triggerStyle) ? (
        <VerticalRibbonAction
          icon={<Tags />}
          label={__("Tag", "pressedmail")}
          ariaLabel={__("Add tag", "pressedmail")}
          disabled
          dataTest="reading-pane-action-tag"
        />
      ) : (
        <Button
          variant="ghost"
          size="icon"
          disabled
          aria-label={__("Add tag", "pressedmail")}
          className="h-7 w-7">
          <Tags className={MAIL_ACTION_ICON_CLASS} />
        </Button>
      );
    }
    return (
      <MailTagActionDropdown
        availableTags={tags}
        selectedTagIds={selectedTagIds}
        onAutoTag={handleAutoClassify}
        onApplyTags={handleApplyMessageTags}
        onOpenChange={handleTagDropdownOpenChange}
        disabled={isLoading}
        aiEnabled={showAiClassify}
        aiDisabled={isClassifying || isLoading}
        isAutoTagging={isClassifying}
        align="end"
        trigger={
          isCommandTrigger(triggerStyle) ? (
            <PressedOutRibbonButton
              label={__("Tag", "pressedmail")}
              ariaLabel={__("Add tag", "pressedmail")}
              dataTest="reading-pane-action-tag"
              onClick={(event) => event.stopPropagation()}
              icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
          ) : isVerticalTrigger(triggerStyle) ? (
            <VerticalRibbonAction
              icon={<Tags />}
              label={__("Tag", "pressedmail")}
              ariaLabel={__("Add tag", "pressedmail")}
              dataTest="reading-pane-action-tag"
              onClick={(event) => event.stopPropagation()}
            />
          ) : (
            <Button
              variant="ghost"
              size="icon"
              aria-label={__("Add tag", "pressedmail")}
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
    senderContact.available && Boolean(senderEmail);
  const isSenderContact = senderContact.existingContact !== null;
  const senderContactLabel = isSenderContact
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
    if (!hasSenderContactAction) return null;

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
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            <DialogTitleRow>
              <FileText />
              <span>{__("Message headers", "pressedmail")}</span>
            </DialogTitleRow>
          </DialogTitle>
          <DialogDescription className="sr-only">
            {__("Full raw headers for the selected message.", "pressedmail")}
          </DialogDescription>
        </DialogHeader>
        <pre
          data-test="reading-pane-headers"
          className="max-h-[60vh] overflow-auto whitespace-pre-wrap break-words rounded-md bg-muted/40 p-3 text-xs text-foreground">
          {headersLoading && headersText === null
            ? __("Loading headers…", "pressedmail")
            : (headersText ?? buildReconstructedHeaders(message))}
        </pre>
      </DialogContent>
    </Dialog>
  );

  const showLoadImages =
    blockedCount > 0 && !showImages && Boolean(onToggleImages);
  const showImagesShownIndicator = showImages && blockedCount > 0;
  const showAiClassify =
    !__IS_FREE__ &&
    __ENABLE_AUTO_TAGGER__ &&
    __ENABLE_AI_AUTO_TAGGER__ &&
    autoTaggerAvailable;
  const showPhishing =
    !__IS_FREE__ && __ENABLE_PHISHING_DETECTION__ && phishingEnabled;
  // Read the define directly: esbuild can only fold a bare identifier, so behind
  // isAiSummarizeBuildEnabled() this whole control stayed compiled into the Free
  // bundle and was merely hidden at runtime.
  const showSummarize = __ENABLE_AI_SUMMARIZE__ && aiSummarizeAvailable;
  const recoveryAction = getFolderRecoveryDescriptor(folderRecoveryAction);

  if (orientation === "pressedout-command") {
    const pressedOutTrigger = orientation;
    return (
      <>
        <div
          className="flex min-w-0 items-center gap-1"
          data-test={`reading-pane-actions-${orientation}`}>
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
                <EmailReplyAllIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
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
                        label={__("Archive", "pressedmail")}
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

          {showPhishing && (
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
                    <Maximize2 className="mr-2 size-4" />
                    {__("Open in larger view", "pressedmail")}
                  </DropdownMenuItem>
                )}
              </>,
            )}
          </div>
        </div>
        {headersDialog}
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
      </>
    );
  }

  if (orientation === "vertical") {
    return (
      <div
        className="flex w-full flex-wrap items-center gap-1"
        data-test="reading-pane-actions-vertical">
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

        <Separator orientation="vertical" className="mx-1 h-12 self-center" />

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
                label={__("Archive", "pressedmail")}
                tooltip={__("Archive", "pressedmail")}
                onClick={onArchive}
                disabled={isLoading}
                dataTest="reading-pane-action-archive"
              />
            )}
            {snoozeAction("vertical")}
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
          </>
        )}
        {showPhishing && (
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
          </>
        )}

        <span className="sr-only">{__("Inspect", "pressedmail")}</span>
        {senderContactAction("vertical")}
        {summarizeAction("vertical")}
        {expandAction("vertical")}
        {moreMenu("vertical")}
        {headersDialog}
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
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
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
            <span className="text-xs">{__("Reply All", "pressedmail")}</span>
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
                  content={__("Archive", "pressedmail")}
                  side="top">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={onArchive}
                    disabled={isLoading}
                    aria-label={__("Archive", "pressedmail")}
                    className="h-7 w-7">
                    <EmailArchiveIcon className={MAIL_ACTION_ICON_CLASS} />
                  </Button>
                </PressedTooltip>
              )}

              {snoozeAction("horizontal")}

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
            </>
          )}
        </div>

        {showPhishing && (
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
    </>
  );
}

export default EmailActionBar;
