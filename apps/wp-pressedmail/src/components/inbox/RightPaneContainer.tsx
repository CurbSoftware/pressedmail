"use client";

import { removePrincipalStorageItem } from "@/lib/principal-storage";

import { __ } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";

/**
 * Right Pane Container Component
 *
 * Mode switcher for the right pane: reading view (default) or compose view.
 * Handles transitions between reading and compose modes.
 *
 * @since 1.6.0
 */

import * as React from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { EmailComposeNewIcon } from "@/components/icons/MailActionIcons";

import { cn } from "@/lib/utils";
import { useAppContext } from "@/context/AppProvider";
import {
  useInbox,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useComposer, usePaneCompose } from "@/context/composer";
import {
  getPersistedPaneState,
  savePaneMode,
} from "@/lib/open-pane-persistence";
import { getFolderRole } from "@/lib/bulk-mail-actions";
import {
  draftComposeIdentitiesMatch,
  getDraftComposeData,
  getDraftComposeIdentity,
  getDraftComposeSignature,
  hasDraftComposeDetail,
  getScheduledEmailId,
  getScheduledEmailDraftIdentity,
  isDraftMessage,
  isScheduledMessage,
} from "@/lib/draft-compose";

import {
  EmailActionBar,
  PressedOutDisabledMessageActions,
} from "./EmailActionBar";
import { MailDisplay } from "./mail-display";
import {
  useInternalReadingPaneState,
  useReadingPaneStateContext,
} from "./reading-pane-state";
import {
  ComposePane,
  formatQuotedText,
  formatForwardedText,
  formatQuotedHtml,
  formatForwardedHtml,
  type ComposeMode,
} from "./compose/ComposePane";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";

import type { ComposeData, EmailMessage } from "@/types";
import {
  getMessageIdentityKey,
  getMessageIdentityRef,
} from "@/lib/message-identity";
import { ScheduledEmailReadingPane } from "@/components/scheduled/ScheduledEmailReadingPane";
import { buildReplyRecipients } from "./reply-recipients";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  TooltipProvider,
} from "@kit/ui/plugin";
import {
  getScheduledComposeData,
  parseScheduledDraftHandoff,
  type ScheduledDraftHandoff,
  type ScheduledEmail,
} from "@/types/scheduled-emails";
import { useOptionalScheduledEmails } from "@/context/scheduled/ScheduledEmailsContext";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { nextVisibleMessageAfterRemoval } from "@/lib/preference-behavior";
import { appMessage } from "@/context/toast";

type PaneMode = "reading" | "compose";
interface PaneSelectionSnapshot {
  identity: string;
  scope: string;
  nextId: string;
}
interface PendingDelete {
  selection: PaneSelectionSnapshot;
  permanent: boolean;
  afterAction: "message_list" | "next_message";
}

export interface RightPaneContainerProps {
  /** Currently selected message */
  selectedMessage: EmailMessage | null;
  /** Optional class name */
  className?: string;
  /**
   * Whether to render the in-pane EmailActionBar above the reading view.
   * Set to `false` only when a layout intentionally owns message actions.
   * @default true
   */
  showActionBar?: boolean;
  /**
   * Optional external container for the docked action bar. `undefined` keeps
   * the inline pane header, `null` suppresses it until a target mounts, and an
   * element receives the existing action bar through a React portal.
   */
  actionBarContainer?: HTMLElement | null;
  /**
   * Orientation of the in-pane action bar. Forwarded to EmailActionBar.
   * @default "horizontal"
   */
  actionBarOrientation?: "horizontal" | "vertical" | "pressedout-command";
  /** Whether current-message organize actions should be shown. */
  showOrganizeActions?: boolean;
  /** Keep the external PressedOut message actions disabled. */
  forceDisabledActionBar?: boolean;
  /** Notify parent layouts when this pane switches between reading and compose. */
  onPaneModeChange?: (mode: "reading" | "compose") => void;
  scheduledEmail?: ScheduledEmail | null;
  onScheduledEmailChanged?: () => void;
  onScheduledEmailCleared?: () => void;
}

export function RightPaneContainer({
  selectedMessage,
  className,
  showActionBar = true,
  actionBarContainer,
  actionBarOrientation = "horizontal",
  showOrganizeActions = true,
  forceDisabledActionBar,
  onPaneModeChange,
  scheduledEmail: scheduledEmailProp = null,
  onScheduledEmailChanged,
  onScheduledEmailCleared,
}: RightPaneContainerProps) {
  const { selectedAccount, accounts } = useAppContext();
  const {
    refreshMessages,
    invalidateFolderMessages,
    clearSelection,
    selectedFolder,
    selectedAccountId,
    folders,
  } = useInbox();
  const { messages } = useInboxState();
  const {
    archiveMessage,
    deleteMessage,
    markAsUnread,
    moveMessage,
    toggleStar,
    selectMessage,
  } = useMessageOperations();
  const composer = useComposer();
  const paneCompose = usePaneCompose();
  const paneComposeRequest = paneCompose?.paneComposeRequest ?? null;
  const resumingComposeRef = React.useRef(false);
  const { preferences } = useUserPreferences();
  const preferredContentType =
    preferences.composer_default_format === "plain_text" ? "plain" : "html";
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pendingDelete, setPendingDelete] =
    React.useState<PendingDelete | null>(null);
  /** Why the last delete attempt failed, shown inside the open dialog. */
  const [deleteError, setDeleteError] = React.useState<string | null>(null);
  const [isScheduledActionLoading, setIsScheduledActionLoading] =
    React.useState(false);
  // Expanded ("pop out") reading view, shows the message in a large in-app modal.
  const [expanded, setExpanded] = React.useState(false);

  // Resolve the scheduled email for the reading-pane preview. Prefer an explicit
  // prop; otherwise look the selected (scheduled) draft up in the shared
  // ScheduledEmails store by its scheduledEmailId (null on Free / no provider).
  const scheduledCtx = useOptionalScheduledEmails();
  const scheduledEmail = React.useMemo<ScheduledEmail | null>(() => {
    if (scheduledEmailProp) return scheduledEmailProp;
    const id = getScheduledEmailId(selectedMessage);
    if (id === null || !scheduledCtx) return null;
    return scheduledCtx.emails.find((e) => e.id === id) ?? null;
  }, [scheduledEmailProp, scheduledCtx, selectedMessage]);
  const scheduledEditSourceRef = React.useRef({
    scheduledEmailId: getScheduledEmailId(selectedMessage),
  });
  scheduledEditSourceRef.current = {
    scheduledEmailId: getScheduledEmailId(selectedMessage),
  };
  const scheduledEmailRef = React.useRef(scheduledEmail);
  scheduledEmailRef.current = scheduledEmail;
  const scheduledEditRequestRef = React.useRef(0);
  React.useEffect(
    () => () => {
      scheduledEditRequestRef.current += 1;
    },
    [],
  );

  // A scheduled email created via the composer (direct POST) isn't in the
  // ScheduledEmails store yet. When a scheduled draft is selected but missing
  // from the store, refresh once so its preview can resolve. Guarded by id so a
  // genuinely-absent row (sent/deleted) can't loop.
  const scheduledRefreshedForRef = React.useRef<number | null>(null);
  React.useEffect(() => {
    const id = getScheduledEmailId(selectedMessage);
    if (id === null || !scheduledCtx) return;
    if (scheduledCtx.emails.some((e) => e.id === id)) return;
    if (scheduledRefreshedForRef.current === id) return;
    scheduledRefreshedForRef.current = id;
    void scheduledCtx.refreshEmails();
  }, [selectedMessage, scheduledCtx]);

  // Pane mode state
  const [paneMode, setPaneMode] = React.useState<PaneMode>("reading");
  const [composeMode, setComposeMode] = React.useState<ComposeMode>("new");

  React.useEffect(() => {
    onPaneModeChange?.(paneMode);
  }, [onPaneModeChange, paneMode]);

  const paneFolder = selectedFolder || selectedMessage?.folder || "INBOX";
  const physicalFolder = React.useMemo(() => {
    const ref = getMessageIdentityRef(selectedMessage);
    if (!ref) return undefined;
    const queue = [...folders];
    for (const folder of queue) {
      if (folder.children) queue.push(...folder.children);
      if (
        folder.sourceFolders?.length
          ? folder.sourceFolders.some(
              (source) =>
                source.accountId === ref.accountId &&
                source.path === ref.folder,
            )
          : folder.accountId === ref.accountId && folder.path === ref.folder
      )
        return folder;
    }
    return undefined;
  }, [folders, selectedMessage]);
  const folderRole = physicalFolder
    ? getFolderRole(physicalFolder)
    : !selectedMessage
      ? getFolderRole({ name: paneFolder, path: paneFolder, count: 0 })
      : null;
  const permanentlyDeletes =
    String(
      physicalFolder?.systemType ?? physicalFolder?.type ?? "",
    ).toLowerCase() === "trash";
  const folderRecoveryAction =
    folderRole === "trash"
      ? "restore"
      : folderRole === "spam" || folderRole === "junk"
        ? "not-spam"
        : undefined;
  const paneScopeKey = selectedAccount
    ? `${selectedAccount}::${paneFolder}`
    : null;
  const restoredScopeKeyRef = React.useRef<string | null>(null);
  const draftComposeSignatureRef = React.useRef<string | null>(null);
  // Tracks the last selected message so we only react to a genuine
  // message-to-message change (the effect also re-fires when openPaneCompose's
  // identity changes, e.g. right after a reply, with the same message).
  const lastSelectedMessageIdRef = React.useRef<string | null>(null);
  // True when the composer was opened by an explicit user action
  // (New/Reply/Forward/draft), false when it was restored from persistence on
  // mount. A persisted (rehydration) compose survives a message populate; an
  // active compose yields to the reading pane when a different message is
  // selected.
  const composeFromUserActionRef = React.useRef(false);

  const selectedIdentity = getMessageIdentityKey(selectedMessage);
  const paneIdentity = scheduledEmail
    ? JSON.stringify([
        "scheduled",
        scheduledEmail.id,
        getScheduledEmailDraftIdentity(scheduledEmail),
      ])
    : selectedIdentity;
  const operationScope = JSON.stringify([
    selectedAccount,
    selectedAccountId,
    selectedFolder,
  ]);
  const livePane = React.useRef({
    identity: paneIdentity,
    scope: operationScope,
    messages,
    refreshMessages,
    clearSelection,
    selectMessage,
  });
  livePane.current = {
    identity: paneIdentity,
    scope: operationScope,
    messages,
    refreshMessages,
    clearSelection,
    selectMessage,
  };
  const mounted = React.useRef(true);
  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  React.useEffect(() => {
    setPendingDelete(null);
    setDeleteError(null);
    setIsDeleting(false);
    setIsScheduledActionLoading(false);
  }, [operationScope, paneIdentity]);
  const captureSelection = React.useCallback((): PaneSelectionSnapshot => {
    const live = livePane.current;
    return {
      identity: live.identity,
      scope: live.scope,
      nextId: getMessageIdentityKey(
        nextVisibleMessageAfterRemoval(
          live.messages.filter(
            (message) => getMessageIdentityKey(message) !== "",
          ),
          [live.identity],
        ),
      ),
    };
  }, []);
  const isCurrentSelection = React.useCallback(
    (snapshot: PaneSelectionSnapshot, allowCleared = true) =>
      mounted.current &&
      livePane.current.scope === snapshot.scope &&
      (livePane.current.identity === snapshot.identity ||
        (allowCleared && livePane.current.identity === "")),
    [],
  );
  const identityFailure = React.useCallback(() => {
    if (!mounted.current) return;
    appMessage(
      __(
        "The message identity is incomplete or has changed. Refresh the mailbox and try again.",
        "pressedmail",
      ),
      "error",
    );
    void livePane.current.refreshMessages().catch(() => {});
  }, []);

  /**
   * Say so when a mailbox operation fails.
   *
   * Archive, delete, mark unread, star and folder recovery all used to throw
   * their result away, so a rate limit, a credentials error or a dropped
   * connection left the message sitting there with no explanation and the user
   * clicking again. A refresh-requiring failure has already reported its own
   * identity conflict, so it stays quiet here.
   */
  const reportOperationFailure = React.useCallback(
    (
      result?: {
        success?: boolean;
        requiresRefresh?: boolean;
        error?: string;
      } | void,
    ) => {
      // An operation that reports nothing at all cannot be called a failure.
      if (!result || !mounted.current) return;
      if (result.success || result.requiresRefresh) return;
      appMessage(
        result.error || __("That did not work. Try again.", "pressedmail"),
        "error",
      );
    },
    [],
  );

  /** Every address that belongs to the account this message arrived on. */
  const ownAddresses = React.useMemo(() => {
    const ref = getMessageIdentityRef(selectedMessage);
    const account = ref
      ? accounts.find(
          (candidate) => String(candidate.id) === String(ref.accountId),
        )
      : undefined;
    return account?.email ? [String(account.email)] : [];
  }, [accounts, selectedMessage]);

  /** The original message's addressing, Reply-To included. */
  const replyHeaders = React.useMemo(() => {
    const headers = selectedMessage?.headers as
      | Record<string, string>
      | undefined;
    const replyToHeader =
      (selectedMessage?.replyTo as string | undefined) ||
      (selectedMessage?.reply_to as string | undefined) ||
      headers?.["Reply-To"] ||
      headers?.["reply-to"];

    return {
      from: selectedMessage?.from || selectedMessage?.email || "",
      replyTo: replyToHeader ?? "",
      to: selectedMessage?.to ?? "",
      cc: selectedMessage?.cc ?? "",
    };
  }, [selectedMessage]);
  const replyContext = React.useCallback(
    (threaded = true): Partial<ComposeData> | null => {
      const ref = getMessageIdentityRef(selectedMessage);
      const account = ref
        ? accounts.find(
            (candidate) => String(candidate.id) === String(ref.accountId),
          )
        : undefined;
      if (!ref || !account?.email) {
        identityFailure();
        return null;
      }
      return {
        fromAccount: account.email,
        inReplyTo: threaded
          ? (selectedMessage?.messageId ?? selectedMessage?.message_id)
          : undefined,
        references: threaded ? selectedMessage?.references : undefined,
        replySource: {
          identity: getMessageIdentityKey(selectedMessage),
          accountId: ref.accountId,
          folder: ref.folder,
          uid: ref.uid,
        },
      };
    },
    [accounts, identityFailure, selectedMessage],
  );

  // Reading-pane state, prefer external provider so layout-owned reading
  // surfaces can share blockedCount / image state.
  // Falls back to internal state for layouts that don't wrap with a provider.
  const internalState = useInternalReadingPaneState(selectedMessage);
  const externalState = useReadingPaneStateContext();
  const state = externalState ?? internalState;

  React.useEffect(() => {
    if (!selectedAccount || !paneScopeKey) {
      restoredScopeKeyRef.current = paneScopeKey;
      setPaneMode("reading");
      return;
    }

    const persistedState = getPersistedPaneState(selectedAccount, paneFolder);
    if (persistedState?.mode === "compose") {
      setComposeMode(persistedState.composeMode ?? "new");
      // Restored from persistence, not an active user compose, this compose
      // survives a message populate during rehydration.
      composeFromUserActionRef.current = false;
      setPaneMode("compose");
      restoredScopeKeyRef.current = paneScopeKey;
      return;
    }

    setPaneMode("reading");
    restoredScopeKeyRef.current = paneScopeKey;
  }, [paneFolder, paneScopeKey, selectedAccount]);

  React.useEffect(() => {
    if (!selectedAccount || !paneScopeKey) {
      return;
    }

    if (restoredScopeKeyRef.current !== paneScopeKey) {
      return;
    }

    savePaneMode(
      selectedAccount,
      paneFolder,
      paneMode,
      paneMode === "compose" ? composeMode : undefined,
    );
  }, [composeMode, paneFolder, paneMode, paneScopeKey, selectedAccount]);

  const openPaneCompose = React.useCallback(
    (nextComposeMode: ComposeMode, draft: Partial<ComposeData>) => {
      resumingComposeRef.current = false;
      composer.setComposeData({
        fromAccount: draft.fromAccount,
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        replySource:
          nextComposeMode === "reply" || nextComposeMode === "reply-all"
            ? draft.replySource
            : undefined,
        to: draft.to ?? "",
        cc: draft.cc ?? "",
        bcc: draft.bcc ?? "",
        contactLists: draft.contactLists ?? [],
        subject: draft.subject ?? "",
        body: draft.body ?? "",
        contentType: draft.contentType ?? preferredContentType,
        mode: nextComposeMode,
        bodyBackgroundColor: draft.bodyBackgroundColor,
        attachments: draft.attachments ?? [],
        draftUid: draft.draftUid,
        draftFolder: draft.draftFolder,
        draftAccountId: draft.draftAccountId,
        draftUidValidity: draft.draftUidValidity,
        draftMessageId: draft.draftMessageId,
        draftAttachmentManifestComplete: draft.draftAttachmentManifestComplete,
        scheduledEmailId: draft.scheduledEmailId,
        scheduledAccountId: draft.scheduledAccountId,
        scheduledAt: draft.scheduledAt,
        is_reply:
          nextComposeMode === "reply" || nextComposeMode === "reply-all",
      });
      setComposeMode(nextComposeMode);
      // Opened by an explicit user action (New/Reply/Forward/draft).
      composeFromUserActionRef.current = true;
      setPaneMode("compose");
    },
    [composer, preferredContentType],
  );

  React.useEffect(() => {
    if (
      paneComposeRequest?.type === "resume" ||
      (resumingComposeRef.current && paneMode === "compose")
    ) {
      // A cached selection can populate before or after the resume request.
      // Keep its details from replacing the already edited shared draft.
      draftComposeSignatureRef.current =
        selectedMessage && isDraftMessage(selectedMessage)
          ? getDraftComposeSignature(
              selectedMessage,
              selectedFolder,
              selectedAccountId,
            )
          : null;
      return;
    }
    if (!selectedMessage) {
      draftComposeSignatureRef.current = null;
      lastSelectedMessageIdRef.current = null;
      return;
    }

    // Detect a genuine message-to-message change. This effect also re-runs when
    // openPaneCompose's identity changes (e.g. right after a reply, which
    // mutates the composer context) with the SAME message still selected; those
    // re-runs must not disturb the composer.
    const selectedMessageId = getMessageIdentityKey(selectedMessage);
    const messageChanged =
      lastSelectedMessageIdRef.current !== selectedMessageId;
    lastSelectedMessageIdRef.current = selectedMessageId;

    // Scheduled emails are previewed read-only (ScheduledEmailReadingPane), not
    // auto-opened in the composer like ordinary drafts.
    if (isScheduledMessage(selectedMessage)) {
      draftComposeSignatureRef.current = null;
      setPaneMode("reading");
      return;
    }

    if (!isDraftMessage(selectedMessage)) {
      draftComposeSignatureRef.current = null;
      // Selecting a DIFFERENT normal message shows it in the reading pane,
      // even when the composer is open from a New/Reply/Forward action. This
      // fixes the case where, after starting a compose, clicking another email
      // left the composer up instead of showing the clicked message. A composer
      // restored from persistence (rehydration, composeFromUserActionRef=false)
      // is preserved while its message populates, and a reply to the
      // still-selected message (messageChanged=false) is not disturbed. Forcing
      // reading while already reading is a harmless no-op.
      if (messageChanged && composeFromUserActionRef.current) {
        composeFromUserActionRef.current = false;
        setPaneMode("reading");
      }
      return;
    }

    const draft = getDraftComposeData(
      selectedMessage,
      selectedFolder,
      selectedAccountId,
    );
    if (!getDraftComposeIdentity(draft)) {
      draftComposeSignatureRef.current = null;
      setPaneMode("reading");
      return;
    }

    const draftSignature = getDraftComposeSignature(
      selectedMessage,
      selectedFolder,
      selectedAccountId,
    );

    if (draftComposeSignatureRef.current === draftSignature) {
      return;
    }

    // The signature covers the body, so a background detail fetch or a list
    // refresh changes it for the draft already open. Re-opening then replaces
    // composeData wholesale, which starts a new compose session and makes any
    // in-flight save, schedule or discard silently no-op against a draft the
    // server has already replaced. Only a genuinely different draft re-opens.
    if (
      paneMode === "compose" &&
      draftComposeIdentitiesMatch(
        getDraftComposeIdentity(draft),
        getDraftComposeIdentity(composer.composeData),
      )
    ) {
      return;
    }

    // A list row can already carry the bound draft identity without its body
    // or MIME attachments. Let the reading pane own loading/error/retry until
    // full detail arrives, then start the editable session exactly once.
    if (!hasDraftComposeDetail(selectedMessage)) {
      draftComposeSignatureRef.current = null;
      setPaneMode("reading");
      return;
    }

    draftComposeSignatureRef.current = draftSignature;
    openPaneCompose("new", draft);
  }, [
    composer.composeData,
    openPaneCompose,
    paneComposeRequest,
    paneMode,
    selectedAccountId,
    selectedFolder,
    selectedMessage,
  ]);

  // Handle Reply All
  const handleReplyAll = React.useCallback(() => {
    if (!selectedMessage) return;
    const source = replyContext();
    if (!source) return;

    const subject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject || ""}`;
    // Reply All answers the whole conversation: the reply target plus everyone
    // on the original To, with the original Cc kept as Cc, minus this account.
    const recipients = buildReplyRecipients(replyHeaders, {
      replyAll: true,
      ownAddresses,
    });

    openPaneCompose("reply-all", {
      ...source,
      to: recipients.to,
      cc: recipients.cc,
      subject,
      body:
        preferredContentType === "plain"
          ? formatQuotedText(selectedMessage)
          : formatQuotedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [
    openPaneCompose,
    ownAddresses,
    preferredContentType,
    replyHeaders,
    selectedMessage,
    replyContext,
  ]);

  // Handle Reply
  const handleReply = React.useCallback(() => {
    if (!selectedMessage) return;
    const source = replyContext();
    if (!source) return;

    if (preferences.default_reply_action === "reply_all") {
      handleReplyAll();
      return;
    }

    const subject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject || ""}`;
    // Reply-To exists so a sender can redirect replies: mailing lists, support
    // desks and no-reply senders all set it, and it used to be ignored.
    const recipients = buildReplyRecipients(replyHeaders, {
      replyAll: false,
      ownAddresses,
    });

    openPaneCompose("reply", {
      ...source,
      to: recipients.to,
      subject,
      body:
        preferredContentType === "plain"
          ? formatQuotedText(selectedMessage)
          : formatQuotedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [
    replyContext,
    handleReplyAll,
    openPaneCompose,
    ownAddresses,
    preferredContentType,
    preferences.default_reply_action,
    replyHeaders,
    selectedMessage,
  ]);

  // Handle Forward
  const handleForward = React.useCallback(() => {
    if (!selectedMessage) return;
    const source = replyContext(false);
    if (!source) return;

    const subject = selectedMessage.subject?.startsWith("Fwd:")
      ? selectedMessage.subject
      : `Fwd: ${selectedMessage.subject || ""}`;

    openPaneCompose("forward", {
      ...source,
      subject,
      body:
        preferredContentType === "plain"
          ? formatForwardedText(selectedMessage)
          : formatForwardedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [openPaneCompose, preferredContentType, selectedMessage, replyContext]);

  // Handle New Message
  const handleNewMessage = React.useCallback(() => {
    openPaneCompose("new", {
      to: "",
      cc: "",
      bcc: "",
      subject: "",
      body: "",
      contentType: preferredContentType,
    });
  }, [openPaneCompose, preferredContentType]);

  // Subscribe to pane compose requests from GlobalNavBar (null when outside PaneComposeProvider)
  React.useEffect(() => {
    if (!paneComposeRequest || !paneCompose) return;

    switch (paneComposeRequest.type) {
      case "resume":
        resumingComposeRef.current = true;
        setComposeMode(
          composer.composeData.mode ??
            (composer.composeData.is_reply ? "reply" : "new"),
        );
        composeFromUserActionRef.current = false;
        setPaneMode("compose");
        break;
      case "new":
        handleNewMessage();
        break;
      case "prefill":
        openPaneCompose("new", paneComposeRequest.data);
        break;
      case "reply":
        handleReply();
        break;
      case "reply-all":
        handleReplyAll();
        break;
      case "forward":
        handleForward();
        break;
    }
    paneCompose.clearPaneComposeRequest();
  }, [
    paneComposeRequest,
    composer.composeData.mode,
    composer.composeData.is_reply,
    handleNewMessage,
    handleReply,
    handleReplyAll,
    handleForward,
    openPaneCompose,
    paneCompose,
  ]);

  /**
   * Put focus back in the message list.
   *
   * Deleting, archiving or moving the open message unmounts the action bar the
   * user just pressed, and focus fell to the document body: a keyboard user
   * started again from the WordPress admin bar and a screen reader said
   * nothing. Land them on the row that holds the list's tab stop instead.
   */
  const focusMessageList = React.useCallback(() => {
    if (typeof document === "undefined") return;
    const grid = document.querySelector<HTMLElement>('[role="grid"]');
    const row =
      grid?.querySelector<HTMLElement>(
        '[data-message-row="true"][tabindex="0"]',
      ) ?? grid?.querySelector<HTMLElement>('[data-message-row="true"]');
    row?.focus();
  }, []);

  const finishAfterRemoval = React.useCallback(
    (
      action: "message_list" | "next_message",
      source: PaneSelectionSnapshot,
    ) => {
      if (!isCurrentSelection(source)) return;
      const live = livePane.current;
      if (action === "next_message" && source.nextId) {
        const next = live.messages.find(
          (message) => getMessageIdentityKey(message) === source.nextId,
        );
        if (next) {
          void live.selectMessage(next);
          focusMessageList();
          return;
        }
      }
      live.clearSelection();
      focusMessageList();
    },
    [focusMessageList, isCurrentSelection],
  );

  const handleArchive = React.useCallback(() => {
    if (!selectedIdentity) {
      identityFailure();
      return;
    }
    const source = captureSelection();
    // Promise.resolve, not a bare .then: these operations are promise-returning
    // by contract, and a handler that explodes on a contract slip is a worse
    // failure than the one it was added to report.
    void Promise.resolve(archiveMessage(selectedIdentity)).then((result) => {
      if (result?.success && !result.requiresRefresh) {
        finishAfterRemoval(preferences.after_archive_action, source);
        return;
      }
      reportOperationFailure(result);
    });
  }, [
    selectedIdentity,
    identityFailure,
    captureSelection,
    archiveMessage,
    finishAfterRemoval,
    reportOperationFailure,
    preferences.after_archive_action,
  ]);

  const handleTrash = React.useCallback(() => {
    if (!selectedIdentity) {
      identityFailure();
      return;
    }
    const source = captureSelection();
    if (permanentlyDeletes || preferences.confirm_delete) {
      setDeleteError(null);
      setPendingDelete({
        selection: source,
        permanent: permanentlyDeletes,
        afterAction: preferences.after_delete_action,
      });
      return;
    }
    void Promise.resolve(deleteMessage(selectedIdentity, false)).then(
      (result) => {
        if (result?.success && !result.requiresRefresh) {
          finishAfterRemoval(preferences.after_delete_action, source);
          return;
        }
        reportOperationFailure(result);
      },
    );
  }, [
    selectedIdentity,
    identityFailure,
    captureSelection,
    permanentlyDeletes,
    preferences.confirm_delete,
    preferences.after_delete_action,
    deleteMessage,
    finishAfterRemoval,
    reportOperationFailure,
  ]);

  const handleConfirmTrash = React.useCallback(async () => {
    const pending = pendingDelete;
    if (!pending) return;
    if (!isCurrentSelection(pending.selection, false)) {
      setPendingDelete(null);
      identityFailure();
      return;
    }
    setIsDeleting(true);
    setDeleteError(null);
    try {
      const result = await deleteMessage(
        pending.selection.identity,
        pending.permanent,
      );
      if (
        result.success &&
        !result.requiresRefresh &&
        isCurrentSelection(pending.selection)
      ) {
        setPendingDelete(null);
        finishAfterRemoval(pending.afterAction, pending.selection);
        return;
      }
      // A failed delete used to close nothing and say nothing: the dialog sat
      // there and the message stayed put. Keep it open and say why.
      if (
        !result.success &&
        !result.requiresRefresh &&
        isCurrentSelection(pending.selection, false)
      ) {
        setDeleteError(
          result.error || __("That did not work. Try again.", "pressedmail"),
        );
      }
    } finally {
      if (isCurrentSelection(pending.selection)) setIsDeleting(false);
    }
  }, [
    pendingDelete,
    isCurrentSelection,
    identityFailure,
    deleteMessage,
    finishAfterRemoval,
  ]);

  const handleMarkUnread = React.useCallback(() => {
    if (!selectedIdentity) {
      identityFailure();
      return;
    }
    void Promise.resolve(markAsUnread(selectedIdentity)).then(
      reportOperationFailure,
    );
  }, [selectedIdentity, identityFailure, markAsUnread, reportOperationFailure]);

  const handleToggleStar = React.useCallback(() => {
    if (!selectedIdentity) {
      identityFailure();
      return;
    }
    void Promise.resolve(toggleStar(selectedIdentity)).then(
      reportOperationFailure,
    );
  }, [selectedIdentity, identityFailure, toggleStar, reportOperationFailure]);

  const handleFolderRecovery = React.useCallback(() => {
    if (!selectedIdentity) {
      identityFailure();
      return;
    }
    const source = captureSelection();
    void (async () => {
      setIsDeleting(true);
      try {
        const result = await moveMessage(selectedIdentity, "INBOX");
        if (
          result.success &&
          !result.requiresRefresh &&
          isCurrentSelection(source)
        ) {
          finishAfterRemoval("message_list", source);
          await livePane.current.refreshMessages();
        } else {
          reportOperationFailure(result);
        }
      } finally {
        if (isCurrentSelection(source)) setIsDeleting(false);
      }
    })();
  }, [
    selectedIdentity,
    identityFailure,
    captureSelection,
    moveMessage,
    isCurrentSelection,
    finishAfterRemoval,
    reportOperationFailure,
  ]);

  // Close compose and return to reading. Also clear the shared composer state
  // and any cached draft so a subsequent email selection is not treated as a
  // still-dirty compose by the navigation guard (which would auto-save + toast
  // on every following click).
  const handleCloseCompose = React.useCallback(() => {
    resumingComposeRef.current = false;
    setPaneMode("reading");
    composer.resetComposeData();
    try {
      removePrincipalStorageItem("local", "pressedmail-compose-draft");
      removePrincipalStorageItem("local", "compose-draft");
    } catch {
      // Ignore storage access errors.
    }
  }, [composer]);

  // Close the pop-out. When closing mid-compose, exit compose back to reading
  // (without discarding) so no stranded ComposePane opens in the main pane; the
  // draft survives via the composer's existing autosave semantics.
  const handleClosePopout = React.useCallback(() => {
    setExpanded(false);
    setPaneMode((mode) => (mode === "compose" ? "reading" : mode));
  }, []);

  // The send callback retains the composed reply source even if selection changed.
  const replySource = composer.composeData.replySource;
  const handleSendSuccess = React.useCallback(() => {
    if (!mounted.current) return;
    void livePane.current.refreshMessages();
    if (
      preferences.auto_archive &&
      (composeMode === "reply" || composeMode === "reply-all")
    ) {
      if (!replySource?.identity) {
        identityFailure();
        return;
      }
      void Promise.resolve(
        archiveMessage(replySource.identity, replySource),
      ).then(reportOperationFailure);
    }
  }, [
    archiveMessage,
    composeMode,
    identityFailure,
    preferences.auto_archive,
    replySource,
    reportOperationFailure,
  ]);

  // After a manual draft save: drop the Drafts folder's cached pages so opening
  // Drafts (even later, from another folder) refetches and shows the new draft,
  // and refresh the active list so it appears immediately when Drafts is open.
  const handleDraftSaved = React.useCallback(
    (draftFolder?: string) => {
      if (draftFolder) {
        invalidateFolderMessages?.(draftFolder);
      }
      refreshMessages?.();
    },
    [invalidateFolderMessages, refreshMessages],
  );

  const handleDraftDiscarded = React.useCallback(() => {
    setPaneMode("reading");
    clearSelection();
  }, [clearSelection]);

  // The composer posts scheduled-email changes straight to the REST routes, so
  // the store does not learn about them on its own. Refresh it here rather than
  // leaving the Scheduled view to the one-shot recovery pass above.
  const handleScheduledChanged = React.useCallback(() => {
    void scheduledCtx?.refreshEmails();
    void refreshMessages?.();
    onScheduledEmailChanged?.();
  }, [onScheduledEmailChanged, refreshMessages, scheduledCtx]);

  const openScheduledCompose = React.useCallback(
    (email: ScheduledEmail, draft: ScheduledDraftHandoff) => {
      openPaneCompose("new", getScheduledComposeData(email, draft));
    },
    [openPaneCompose],
  );

  const runScheduledAction = React.useCallback(
    async (action: "cancel" | "send-now") => {
      if (!scheduledEmail || !scheduledCtx) return;

      const source = captureSelection();
      setIsScheduledActionLoading(true);
      try {
        const result = await (action === "cancel"
          ? scheduledCtx.cancelEmail(scheduledEmail.id)
          : scheduledCtx.sendNow(scheduledEmail.id));

        if (result.status === "success") {
          if (!isCurrentSelection(source)) return;
          clearSelection();
          void refreshMessages?.();
          onScheduledEmailCleared?.();
          onScheduledEmailChanged?.();
        } else {
          appMessage(
            result.message ||
              __("We could not update this scheduled email.", "pressedmail"),
            "error",
          );
        }
      } finally {
        if (isCurrentSelection(source)) setIsScheduledActionLoading(false);
      }
    },
    [
      captureSelection,
      isCurrentSelection,
      clearSelection,
      onScheduledEmailChanged,
      onScheduledEmailCleared,
      refreshMessages,
      scheduledCtx,
      scheduledEmail,
    ],
  );

  const handleScheduledEdit = React.useCallback(async () => {
    const scheduledEmailId = scheduledEmail?.id ?? null;
    const sourceIdentity = getScheduledEmailDraftIdentity(scheduledEmail);
    if (
      !scheduledEmail ||
      scheduledEmailId === null ||
      getScheduledEmailId(selectedMessage) !== scheduledEmailId ||
      !sourceIdentity
    ) {
      appMessage(
        __(
          "We could not open this scheduled email for editing. Try again.",
          "pressedmail",
        ),
        "error",
      );
      return;
    }

    const composeSessionVersion = composer.getComposeSessionVersion();
    const requestId = ++scheduledEditRequestRef.current;
    const capturedEmail = scheduledEmail;

    setIsScheduledActionLoading(true);
    try {
      // Editing keeps the send armed. The row stays pending at its current time
      // and only leaves Scheduled when the user sends it, removes the schedule
      // or deletes it, so closing the composer can no longer drop the schedule.
      const apiUrl = window.pressedmailPlugin?.apiUrl || "";
      const response = await apiFetch(
        `${apiUrl}${getRuntimeRestNamespace()}/scheduled-emails/edit/${scheduledEmail.id}`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            prior_draft_uid: sourceIdentity.uid,
            prior_draft_folder: sourceIdentity.folder,
            prior_draft_account_id: sourceIdentity.accountId,
            prior_draft_uidvalidity: sourceIdentity.uidValidity,
            prior_draft_message_id: sourceIdentity.messageId,
          }),
        },
      );
      const draft = parseScheduledDraftHandoff(await response.json());
      if (!draft) {
        throw new Error("Scheduled draft handoff was incomplete");
      }
      void scheduledCtx?.refreshEmails();
      void refreshMessages?.();
      onScheduledEmailChanged?.();
      const currentSource = scheduledEditSourceRef.current;
      if (
        scheduledEditRequestRef.current !== requestId ||
        composer.getComposeSessionVersion() !== composeSessionVersion ||
        scheduledEmailRef.current?.id !== scheduledEmailId ||
        currentSource.scheduledEmailId !== scheduledEmailId ||
        !draftComposeIdentitiesMatch(
          getScheduledEmailDraftIdentity(scheduledEmailRef.current),
          sourceIdentity,
        )
      ) {
        return;
      }

      clearSelection();
      openScheduledCompose(capturedEmail, draft);
    } catch {
      appMessage(
        __(
          "We could not open this scheduled email for editing. Try again.",
          "pressedmail",
        ),
        "error",
      );
    } finally {
      if (scheduledEditRequestRef.current === requestId) {
        setIsScheduledActionLoading(false);
      }
    }
  }, [
    composer,
    clearSelection,
    onScheduledEmailChanged,
    openScheduledCompose,
    refreshMessages,
    scheduledEmail,
    scheduledCtx,
    selectedMessage,
  ]);

  // Change send time in place, reschedules the same row without opening the
  // composer or unscheduling. Re-arms a failed email back to pending (server
  // update_scheduled_email allows cancelled/failed -> pending with a new time).
  const handleChangeTime = React.useCallback(
    async (date: Date) => {
      if (!scheduledEmail || !scheduledCtx) return;
      const sourceIdentity = getScheduledEmailDraftIdentity(scheduledEmail);
      if (!sourceIdentity) {
        appMessage(
          __(
            "We could not update this scheduled email. Try again.",
            "pressedmail",
          ),
          "error",
        );
        return;
      }
      const source = captureSelection();
      setIsScheduledActionLoading(true);
      try {
        const result = await scheduledCtx.updateEmail(scheduledEmail.id, {
          scheduled_at: date.toISOString(),
          prior_draft_uid: sourceIdentity.uid,
          prior_draft_folder: sourceIdentity.folder,
          prior_draft_account_id: sourceIdentity.accountId,
          prior_draft_uidvalidity: sourceIdentity.uidValidity,
          prior_draft_message_id: sourceIdentity.messageId,
        });
        if (result.status !== "success") {
          appMessage(
            result.message ||
              __("We could not update this scheduled email.", "pressedmail"),
            "error",
          );
          return;
        }
        if (isCurrentSelection(source)) onScheduledEmailChanged?.();
      } finally {
        if (isCurrentSelection(source)) setIsScheduledActionLoading(false);
      }
    },
    [
      onScheduledEmailChanged,
      scheduledCtx,
      scheduledEmail,
      captureSelection,
      isCurrentSelection,
    ],
  );

  const handleScheduledDelete = React.useCallback(async () => {
    if (!scheduledEmail || !scheduledCtx) return;
    const source = captureSelection();
    setIsScheduledActionLoading(true);
    try {
      const result = await scheduledCtx.deleteEmail(scheduledEmail.id);
      if (result.status !== "success") {
        appMessage(
          result.message ||
            __("We could not delete this scheduled email.", "pressedmail"),
          "error",
        );
        return;
      }
      if (!isCurrentSelection(source)) return;
      clearSelection();
      void refreshMessages?.();
      onScheduledEmailCleared?.();
      onScheduledEmailChanged?.();
    } finally {
      if (isCurrentSelection(source)) setIsScheduledActionLoading(false);
    }
  }, [
    captureSelection,
    isCurrentSelection,
    clearSelection,
    onScheduledEmailChanged,
    onScheduledEmailCleared,
    refreshMessages,
    scheduledCtx,
    scheduledEmail,
  ]);

  const disabledPressedOutActionBar =
    showActionBar &&
    actionBarOrientation === "pressedout-command" &&
    actionBarContainer &&
    (forceDisabledActionBar ||
      !selectedMessage ||
      paneMode === "compose" ||
      isScheduledMessage(selectedMessage) ||
      scheduledEmail !== null)
      ? createPortal(
          <PressedOutDisabledMessageActions
            showOrganizeActions={showOrganizeActions}
            folderRecoveryAction={folderRecoveryAction}
          />,
          actionBarContainer,
        )
      : null;

  if (scheduledEmail && paneMode === "reading") {
    return (
      <TooltipProvider delayDuration={0}>
        {disabledPressedOutActionBar}
        <ScheduledEmailReadingPane
          email={scheduledEmail}
          isActionLoading={isScheduledActionLoading}
          onEdit={() => void handleScheduledEdit()}
          onChangeTime={(date) => void handleChangeTime(date)}
          onSendNow={() => void runScheduledAction("send-now")}
          onRemoveSchedule={() => void runScheduledAction("cancel")}
          onDelete={() => void handleScheduledDelete()}
        />
      </TooltipProvider>
    );
  }

  // Empty state - no message selected
  if (!selectedMessage && paneMode === "reading") {
    return (
      <div
        className={cn(
          "flex h-full flex-col items-center justify-center gap-4 bg-card p-8 text-center",
          className,
        )}>
        {disabledPressedOutActionBar}
        <div className="text-center">
          <p className="text-sm text-muted-foreground">
            {__("No message selected", "pressedmail")}
          </p>
          <p className="text-sm text-muted-foreground/70">
            {__(
              "Select an email to read or compose a new message",
              "pressedmail",
            )}
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleNewMessage}
            className="gap-2 text-base font-extrabold">
            <EmailComposeNewIcon className="h-4 w-4" />
            {__("Compose", "pressedmail")}
          </Button>
        </div>
      </div>
    );
  }

  // Compose mode (docked, main pane). When the reading view is popped out,
  // compose renders INSIDE the Dialog below instead, so reply/forward/reply-all
  // triggered from the pop-out stay in the pop-out.
  if (paneMode === "compose" && !expanded) {
    return (
      <TooltipProvider delayDuration={0}>
        {disabledPressedOutActionBar}
        <ComposePane
          composeMode={composeMode}
          onClose={handleCloseCompose}
          onSendSuccess={handleSendSuccess}
          onDraftSaved={handleDraftSaved}
          onDraftDiscarded={handleDraftDiscarded}
          onScheduledChanged={handleScheduledChanged}
          className={className}
        />
      </TooltipProvider>
    );
  }

  if (!selectedMessage) {
    return null;
  }

  const readingPaneContent = (
    <MailDisplay
      mail={selectedMessage}
      showImages={state.effectiveShowImages}
      onBlockedImageCount={state.setBlockedCount}
      onToggleStar={handleToggleStar}
      // Summarize and the sender-contact toggle live in EmailActionBar on this
      // surface, so the pane must not draw its own copies. Mobile mounts
      // MailDisplay without an action bar and keeps them inline.
      actionsInToolbar={showActionBar}
    />
  );

  const dockedActionBar = (
    <EmailActionBar
      message={selectedMessage}
      orientation={actionBarOrientation}
      showOrganizeActions={showOrganizeActions}
      onReply={handleReply}
      onReplyAll={handleReplyAll}
      onForward={handleForward}
      onArchive={handleArchive}
      onTrash={handleTrash}
      onMarkUnread={handleMarkUnread}
      folderRecoveryAction={folderRecoveryAction}
      onFolderRecovery={handleFolderRecovery}
      onExpand={() => setExpanded(true)}
      isLoading={isDeleting}
      blockedCount={state.blockedCount}
      showImages={state.effectiveShowImages}
      onToggleImages={
        state.canShowExternalImages ? state.handleShowImages : undefined
      }
    />
  );

  const renderedDockedActionBar =
    disabledPressedOutActionBar || forceDisabledActionBar ? (
      disabledPressedOutActionBar
    ) : !showActionBar ? null : actionBarContainer === undefined ? (
      <div className="shrink-0 border-b bg-card px-3 py-2">
        {dockedActionBar}
      </div>
    ) : actionBarContainer ? (
      createPortal(dockedActionBar, actionBarContainer)
    ) : null;

  // Reading mode
  return (
    <TooltipProvider delayDuration={0}>
      <div className={cn("flex h-full flex-col bg-card", className)}>
        {renderedDockedActionBar}
        {state.blockedCount > 0 && !state.canShowExternalImages && (
          <div className="shrink-0 border-b bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
            {__(
              "Remote images are disabled by your administrator.",
              "pressedmail",
            )}
          </div>
        )}
        {/* Email Content */}
        <div className="min-h-0 flex-1 overflow-hidden">
          {readingPaneContent}
        </div>
      </div>
      <ConfirmationPanel
        open={pendingDelete != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(null);
          }
        }}
        title={
          pendingDelete?.permanent
            ? __("Delete email permanently?", "pressedmail")
            : __("Delete email?", "pressedmail")
        }
        description={
          <>
            {pendingDelete?.permanent
              ? __("This cannot be undone.", "pressedmail")
              : __("This email will be moved to Trash.", "pressedmail")}
            {deleteError ? (
              <span
                role="alert"
                data-test="reading-pane-delete-error"
                data-testid="reading-pane-delete-error"
                className="mt-2 block text-destructive">
                {deleteError}
              </span>
            ) : null}
          </>
        }
        confirmText={__("Delete", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={isDeleting}
        onConfirm={handleConfirmTrash}
      />

      {/* Pop-out: the reading pane expanded into a large in-app modal. */}
      <Dialog
        open={expanded}
        onOpenChange={(open) =>
          open ? setExpanded(true) : handleClosePopout()
        }>
        <DialogContent
          showCloseButton={false}
          className="flex h-[90vh] w-[92vw] max-w-5xl flex-col gap-0 p-0">
          <DialogTitle className="sr-only">
            {__("Expanded reading view", "pressedmail")}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {__("Expanded reading view", "pressedmail")}
          </DialogDescription>
          <div
            className="flex shrink-0 items-center gap-2 border-b bg-card px-3 py-2"
            data-test="reading-pane-popout-action-row"
            data-testid="reading-pane-popout-action-row">
            {showActionBar && paneMode !== "compose" && (
              <div className="min-w-0 flex-1">
                <EmailActionBar
                  message={selectedMessage}
                  orientation={actionBarOrientation}
                  showOrganizeActions={showOrganizeActions}
                  onReply={handleReply}
                  onReplyAll={handleReplyAll}
                  onForward={handleForward}
                  onArchive={handleArchive}
                  onTrash={handleTrash}
                  onMarkUnread={handleMarkUnread}
                  isLoading={isDeleting}
                  blockedCount={state.blockedCount}
                  showImages={state.effectiveShowImages}
                  onToggleImages={
                    state.canShowExternalImages
                      ? state.handleShowImages
                      : undefined
                  }
                />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="ml-auto h-8 w-8 shrink-0"
              onClick={handleClosePopout}
              aria-label={__("Close expanded reading view", "pressedmail")}
              data-test="reading-pane-popout-close"
              data-testid="reading-pane-popout-close">
              <X className="h-4 w-4" />
            </Button>
          </div>
          <div className="min-h-0 flex-1 overflow-hidden">
            {paneMode === "compose" ? (
              <ComposePane
                composeMode={composeMode}
                onClose={handleCloseCompose}
                onSendSuccess={handleSendSuccess}
                onDraftSaved={handleDraftSaved}
                onDraftDiscarded={handleDraftDiscarded}
                onScheduledChanged={handleScheduledChanged}
              />
            ) : (
              readingPaneContent
            )}
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}

export default RightPaneContainer;
