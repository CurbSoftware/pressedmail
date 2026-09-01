"use client";

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
import { ScheduledEmailReadingPane } from "@/components/scheduled/ScheduledEmailReadingPane";

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
  const { selectedAccount } = useAppContext();
  const {
    refreshMessages,
    invalidateFolderMessages,
    clearSelection,
    selectedFolder,
    selectedAccountId,
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
  const { preferences } = useUserPreferences();
  const preferredContentType =
    preferences.composer_default_format === "plain_text" ? "plain" : "html";
  const [isDeleting, setIsDeleting] = React.useState(false);
  const [pendingDeleteMessageId, setPendingDeleteMessageId] = React.useState<
    string | number | null
  >(null);
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
  const folderRole = getFolderRole({
    name: paneFolder,
    path: paneFolder,
    count: 0,
  });
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
      composer.setComposeData({
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
    if (!selectedMessage) {
      draftComposeSignatureRef.current = null;
      lastSelectedMessageIdRef.current = null;
      return;
    }

    // Detect a genuine message-to-message change. This effect also re-runs when
    // openPaneCompose's identity changes (e.g. right after a reply, which
    // mutates the composer context) with the SAME message still selected; those
    // re-runs must not disturb the composer.
    const rawSelectedMessageId = selectedMessage.uid || selectedMessage.id;
    const selectedMessageId =
      rawSelectedMessageId == null ? null : String(rawSelectedMessageId);
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

    draftComposeSignatureRef.current = draftSignature;

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

    openPaneCompose("new", draft);
  }, [
    composer.composeData,
    openPaneCompose,
    paneMode,
    selectedAccountId,
    selectedFolder,
    selectedMessage,
  ]);

  // Handle Reply All
  const handleReplyAll = React.useCallback(() => {
    if (!selectedMessage) return;

    const replyTo = selectedMessage.email || selectedMessage.from || "";
    const subject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject || ""}`;

    openPaneCompose("reply-all", {
      to: replyTo,
      cc: selectedMessage.cc ?? "",
      subject,
      body:
        preferredContentType === "plain"
          ? formatQuotedText(selectedMessage)
          : formatQuotedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [openPaneCompose, preferredContentType, selectedMessage]);

  // Handle Reply
  const handleReply = React.useCallback(() => {
    if (!selectedMessage) return;

    if (preferences.default_reply_action === "reply_all") {
      handleReplyAll();
      return;
    }

    const replyTo = selectedMessage.email || selectedMessage.from || "";
    const subject = selectedMessage.subject?.startsWith("Re:")
      ? selectedMessage.subject
      : `Re: ${selectedMessage.subject || ""}`;

    openPaneCompose("reply", {
      to: replyTo,
      subject,
      body:
        preferredContentType === "plain"
          ? formatQuotedText(selectedMessage)
          : formatQuotedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [
    handleReplyAll,
    openPaneCompose,
    preferredContentType,
    preferences.default_reply_action,
    selectedMessage,
  ]);

  // Handle Forward
  const handleForward = React.useCallback(() => {
    if (!selectedMessage) return;

    const subject = selectedMessage.subject?.startsWith("Fwd:")
      ? selectedMessage.subject
      : `Fwd: ${selectedMessage.subject || ""}`;

    openPaneCompose("forward", {
      subject,
      body:
        preferredContentType === "plain"
          ? formatForwardedText(selectedMessage)
          : formatForwardedHtml(selectedMessage),
      contentType: preferredContentType,
    });
  }, [openPaneCompose, preferredContentType, selectedMessage]);

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
  const paneCompose = usePaneCompose();
  const paneComposeRequest = paneCompose?.paneComposeRequest ?? null;
  React.useEffect(() => {
    if (!paneComposeRequest || !paneCompose) return;

    switch (paneComposeRequest.type) {
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
    handleNewMessage,
    handleReply,
    handleReplyAll,
    handleForward,
    openPaneCompose,
    paneCompose,
  ]);

  const finishAfterRemoval = React.useCallback(
    (action: "message_list" | "next_message", removedId: string | number) => {
      if (action === "next_message") {
        const next = nextVisibleMessageAfterRemoval(messages, [
          String(removedId),
        ]);
        if (next) {
          void selectMessage(next);
          return;
        }
      }
      clearSelection();
    },
    [clearSelection, messages, selectMessage],
  );

  // Handle Archive (move to archive folder)
  const handleArchive = React.useCallback(() => {
    if (!selectedMessage) return;

    const messageId =
      selectedMessage.uid ?? selectedMessage.msg_no ?? selectedMessage.id;
    if (!messageId) return;

    void archiveMessage(messageId).then((result) => {
      if (result?.success !== false) {
        finishAfterRemoval(preferences.after_archive_action, messageId);
      }
    });
  }, [
    selectedMessage,
    archiveMessage,
    finishAfterRemoval,
    preferences.after_archive_action,
  ]);

  // Handle Trash
  const handleTrash = React.useCallback(() => {
    if (!selectedMessage) return;

    const messageId =
      selectedMessage.uid ?? selectedMessage.msg_no ?? selectedMessage.id;
    if (!messageId) return;

    if (preferences.confirm_delete) {
      setPendingDeleteMessageId(messageId);
      return;
    }

    void deleteMessage(messageId).then((result) => {
      if (result?.success) {
        finishAfterRemoval(preferences.after_delete_action, messageId);
      }
    });
  }, [
    selectedMessage,
    preferences.confirm_delete,
    preferences.after_delete_action,
    deleteMessage,
    finishAfterRemoval,
  ]);

  const handleConfirmTrash = React.useCallback(async () => {
    if (pendingDeleteMessageId == null) return;

    setIsDeleting(true);
    try {
      const result = await deleteMessage(pendingDeleteMessageId);
      if (result.success) {
        const removedId = pendingDeleteMessageId;
        setPendingDeleteMessageId(null);
        finishAfterRemoval(preferences.after_delete_action, removedId);
      }
    } finally {
      setIsDeleting(false);
    }
  }, [
    deleteMessage,
    finishAfterRemoval,
    pendingDeleteMessageId,
    preferences.after_delete_action,
  ]);

  // Handle Mark Unread
  const handleMarkUnread = React.useCallback(() => {
    if (!selectedMessage) return;

    const messageId =
      selectedMessage.uid ?? selectedMessage.msg_no ?? selectedMessage.id;
    if (!messageId) return;

    void markAsUnread(messageId);
  }, [selectedMessage, markAsUnread]);

  const handleToggleStar = React.useCallback(() => {
    const messageId = selectedMessage?.id;
    if (messageId == null) return;

    void toggleStar(messageId);
  }, [selectedMessage?.id, toggleStar]);

  const handleFolderRecovery = React.useCallback(() => {
    if (!selectedMessage) return;

    const messageId =
      selectedMessage.uid ?? selectedMessage.msg_no ?? selectedMessage.id;
    if (!messageId) return;

    void (async () => {
      setIsDeleting(true);
      try {
        const result = await moveMessage(messageId, "INBOX");
        if (result.success) {
          clearSelection();
          await refreshMessages?.();
        }
      } finally {
        setIsDeleting(false);
      }
    })();
  }, [selectedMessage, moveMessage, clearSelection, refreshMessages]);

  // Close compose and return to reading. Also clear the shared composer state
  // and any cached draft so a subsequent email selection is not treated as a
  // still-dirty compose by the navigation guard (which would auto-save + toast
  // on every following click).
  const handleCloseCompose = React.useCallback(() => {
    setPaneMode("reading");
    composer.resetComposeData();
    try {
      localStorage.removeItem("pressedmail-compose-draft");
      localStorage.removeItem("compose-draft");
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

  // Handle send success
  const handleSendSuccess = React.useCallback(() => {
    refreshMessages?.();
    if (
      preferences.auto_archive &&
      selectedMessage &&
      (composeMode === "reply" || composeMode === "reply-all")
    ) {
      const messageId =
        selectedMessage.uid ?? selectedMessage.msg_no ?? selectedMessage.id;
      if (messageId) {
        void archiveMessage(messageId);
      }
    }
  }, [
    archiveMessage,
    composeMode,
    preferences.auto_archive,
    refreshMessages,
    selectedMessage,
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

      setIsScheduledActionLoading(true);
      try {
        const result = await (action === "cancel"
          ? scheduledCtx.cancelEmail(scheduledEmail.id)
          : scheduledCtx.sendNow(scheduledEmail.id));

        if (result.status === "success") {
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
        setIsScheduledActionLoading(false);
      }
    },
    [
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
        onScheduledEmailChanged?.();
      } finally {
        setIsScheduledActionLoading(false);
      }
    },
    [onScheduledEmailChanged, scheduledCtx, scheduledEmail],
  );

  const handleScheduledDelete = React.useCallback(async () => {
    if (!scheduledEmail || !scheduledCtx) return;
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
      clearSelection();
      void refreshMessages?.();
      onScheduledEmailCleared?.();
      onScheduledEmailChanged?.();
    } finally {
      setIsScheduledActionLoading(false);
    }
  }, [
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
        open={pendingDeleteMessageId != null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDeleteMessageId(null);
          }
        }}
        title={__("Delete email?", "pressedmail")}
        description={__("This email will be moved to Trash.", "pressedmail")}
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
