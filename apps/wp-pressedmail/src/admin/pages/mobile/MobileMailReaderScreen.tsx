"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { MoreHorizontal, Star } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";
import {
  EmailArchiveIcon,
  EmailForwardIcon,
  EmailMarkReadIcon,
  EmailMarkUnreadIcon,
  EmailReplyAllIcon,
  EmailReplyIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";

import {
  MobileActionSheet,
  MobileScreen,
  MobileScreenHeader,
  useHideTabBar,
} from "@/components/mobile-shell";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { MailDisplay } from "@/components/inbox/mail-display";
import {
  formatForwardedText,
  formatForwardedHtml,
  formatQuotedText,
  formatQuotedHtml,
} from "@/components/inbox/compose/compose-utils";
import { useComposer } from "@/context/composer";
import { useAppContext } from "@/context/AppProvider";
import {
  useFolderOperations,
  useInbox,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import {
  getMessageIdentityRef,
  parseAccountQualifiedToken,
  getMessageIdentityKey,
} from "@/lib/message-identity";
import { nextVisibleMessageAfterRemoval } from "@/lib/preference-behavior";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { appMessage } from "@/context/toast";

function prefixedSubject(prefix: "Re" | "Fwd", subject?: string): string {
  const value = subject || "";
  if (value.toLowerCase().startsWith(`${prefix.toLowerCase()}:`)) return value;
  return prefix === "Re"
    ? sprintf(
        /* translators: %s: the subject of the message being replied to. */
        __("Re: %s", "pressedmail"),
        value,
      )
    : sprintf(
        /* translators: %s: the subject of the message being forwarded. */
        __("Fwd: %s", "pressedmail"),
        value,
      );
}

function replyAddress(message: EmailMessage): string {
  return message.email || message.from || "";
}

/**
 * Phone-shell mail reader. Renders the currently selected message inside a
 * full-screen MobileScreen with a sticky header and the bottom tab bar
 * hidden. Star action lives in the header trailing slot.
 */
export function MobileMailReaderScreen() {
  useHideTabBar(true);
  const navigate = useNavigate();
  const params = useParams();
  const routeId = React.useMemo(() => {
    const ref = params.id ? parseAccountQualifiedToken(params.id) : null;
    return ref?.kind === "message"
      ? JSON.stringify([ref.accountId, ref.folder, ref.uidValidity, ref.uid])
      : null;
  }, [params.id]);
  const { accounts } = useAppContext();
  const inbox = useInbox();
  const { selectedMessage, messages, isLoading } = useInboxState();
  const { folders } = useFolderOperations();
  const {
    selectMessage,
    toggleStar,
    archiveMessage,
    deleteMessage,
    markAsRead,
    markAsUnread,
    clearSelection,
  } = useMessageOperations();
  const { setComposeData } = useComposer();
  const { preferences } = useUserPreferences();
  const preferredContentType =
    preferences.composer_default_format === "plain_text" ? "plain" : "html";
  const preferredReplyMode: "reply" | "reply-all" =
    preferences.default_reply_action === "reply_all" ? "reply-all" : "reply";
  const alternateReplyMode: "reply" | "reply-all" =
    preferredReplyMode === "reply-all" ? "reply" : "reply-all";
  const moreActionsRef = React.useRef<HTMLButtonElement>(null);
  const [actionSheetOpen, setActionSheetOpen] = React.useState(false);
  const [pendingDelete, setPendingDelete] = React.useState<{
    identity: string;
    nextId: string;
    permanent: boolean;
  } | null>(null);
  const [deleting, setDeleting] = React.useState(false);
  const [deleteError, setDeleteError] = React.useState(false);
  React.useEffect(() => {
    setPendingDelete(null);
    setDeleteError(false);
  }, [routeId]);

  const routeMessage = React.useMemo(() => {
    if (!routeId) return null;
    return (
      messages.find((message) => getMessageIdentityKey(message) === routeId) ??
      null
    );
  }, [messages, routeId]);

  const selectedIdentity = getMessageIdentityKey(selectedMessage);
  const displayMessage =
    routeId && selectedIdentity === routeId ? selectedMessage : routeMessage;
  const displayedIdentity = getMessageIdentityKey(displayMessage);
  const liveReader = React.useRef({
    routeId,
    displayedIdentity,
    messages,
    inbox,
  });
  liveReader.current = { routeId, displayedIdentity, messages, inbox };
  const mounted = React.useRef(true);

  // Permanent deletion follows the message's physical mailbox, including
  // consolidated folders with different provider paths.
  const isTrashFolder = React.useMemo(() => {
    const ref = getMessageIdentityRef(displayMessage);
    if (!ref) return false;
    const folder = folders.find((candidate) =>
      candidate.sourceFolders?.length
        ? candidate.sourceFolders.some(
            (source) =>
              source.accountId === ref.accountId && source.path === ref.folder,
          )
        : candidate.accountId === ref.accountId &&
          candidate.path === ref.folder,
    );
    return folder?.systemType === "trash" || folder?.type === "trash";
  }, [displayMessage, folders]);

  const identityFailure = React.useCallback(() => {
    appMessage(
      __(
        "The message identity is incomplete or has changed. Refresh the mailbox and try again.",
        "pressedmail",
      ),
      "error",
    );
    if (mounted.current)
      void liveReader.current.inbox.refreshMessages().catch(() => {});
  }, []);

  React.useEffect(() => {
    if (routeMessage && selectedIdentity !== routeId) {
      void selectMessage(routeMessage);
    }
  }, [routeMessage, routeId, selectMessage, selectedIdentity]);

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      clearSelection();
    };
  }, [clearSelection]);

  const subject = displayMessage?.subject || __("(No subject)", "pressedmail");
  const starred = !!displayMessage?.starred;

  const handleStar = React.useCallback(() => {
    if (!displayMessage) return;
    void toggleStar(getMessageIdentityKey(displayMessage));
  }, [displayMessage, toggleStar]);

  const openCompose = React.useCallback(
    (mode: "reply" | "reply-all" | "forward") => {
      if (!displayMessage) return;
      const ref = getMessageIdentityRef(displayMessage);
      if (!ref) {
        identityFailure();
        return;
      }
      const sourceAccount = accounts.find(
        (account) => String(account.id) === String(ref.accountId),
      );
      if (!sourceAccount?.email) {
        identityFailure();
        return;
      }
      if (mode === "forward") {
        setComposeData({
          fromAccount: sourceAccount.email,
          to: "",
          cc: "",
          bcc: "",
          subject: prefixedSubject("Fwd", displayMessage.subject),
          body:
            preferredContentType === "plain"
              ? formatForwardedText(displayMessage)
              : formatForwardedHtml(displayMessage),
          contentType: preferredContentType,
          attachments: [],
          mode: "forward",
          is_reply: false,
        });
      } else {
        setComposeData({
          fromAccount: sourceAccount.email,
          to: replyAddress(displayMessage),
          cc: mode === "reply-all" ? (displayMessage.cc ?? "") : "",
          bcc: "",
          subject: prefixedSubject("Re", displayMessage.subject),
          body:
            preferredContentType === "plain"
              ? formatQuotedText(displayMessage)
              : formatQuotedHtml(displayMessage),
          contentType: preferredContentType,
          attachments: [],
          mode,
          is_reply: true,
          inReplyTo: displayMessage.messageId ?? displayMessage.message_id,
          references: displayMessage.references,
          replySource: {
            identity: getMessageIdentityKey(displayMessage),
            accountId: ref.accountId,
            folder: ref.folder,
            uid: ref.uid,
          },
        });
      }
      navigate("/compose");
    },
    [
      accounts,
      displayMessage,
      navigate,
      preferredContentType,
      identityFailure,
      setComposeData,
    ],
  );

  const finishAfterRemoval = React.useCallback(
    (
      action: "message_list" | "next_message",
      removedId: string,
      nextId: string,
    ) => {
      const live = liveReader.current;
      if (
        !mounted.current ||
        live.routeId !== removedId ||
        (live.displayedIdentity && live.displayedIdentity !== removedId)
      )
        return;
      if (action === "next_message" && nextId) {
        const next = live.messages.find(
          (message) => getMessageIdentityKey(message) === nextId,
        );
        if (next) {
          void live.inbox.selectMessage(next);
          navigate(`/inbox/m/${encodeURIComponent(nextId)}`);
          return;
        }
      }
      navigate("/inbox");
    },
    [navigate],
  );

  const captureRemoval = React.useCallback(() => {
    const identity = getMessageIdentityKey(displayMessage);
    const next = nextVisibleMessageAfterRemoval(
      messages.filter((message) => getMessageIdentityKey(message) !== ""),
      [identity],
    );
    return { identity, nextId: getMessageIdentityKey(next) };
  }, [displayMessage, messages]);

  const handleArchive = React.useCallback(() => {
    if (!displayMessage) return;
    const { identity: messageId, nextId } = captureRemoval();
    if (!messageId) {
      identityFailure();
      return;
    }
    void archiveMessage(messageId).then((result) => {
      if (result.success && !result.requiresRefresh) {
        finishAfterRemoval(preferences.after_archive_action, messageId, nextId);
      }
    });
  }, [
    archiveMessage,
    displayMessage,
    finishAfterRemoval,
    captureRemoval,
    identityFailure,
    preferences.after_archive_action,
  ]);

  const performDelete = async (request: NonNullable<typeof pendingDelete>) => {
    if (deleting) return;
    if (liveReader.current.displayedIdentity !== request.identity) {
      setPendingDelete(null);
      identityFailure();
      return;
    }
    setDeleting(true);
    setDeleteError(false);
    try {
      const result = await deleteMessage(request.identity, request.permanent);
      if (result.success) {
        setPendingDelete(null);
        if (!result.requiresRefresh) {
          finishAfterRemoval(
            preferences.after_delete_action,
            request.identity,
            request.nextId,
          );
        }
      } else {
        setDeleteError(true);
        appMessage(
          __("Could not delete the message. Try again.", "pressedmail"),
          "error",
        );
      }
    } catch {
      setDeleteError(true);
      appMessage(
        __("Could not delete the message. Try again.", "pressedmail"),
        "error",
      );
    } finally {
      setDeleting(false);
    }
  };

  const handleDelete = () => {
    if (!displayMessage || deleting) return;
    const captured = captureRemoval();
    if (!captured.identity) {
      identityFailure();
      return;
    }
    const request = { ...captured, permanent: isTrashFolder };
    setDeleteError(false);
    // Trash expunges on the server, irrespective of the confirmation preference.
    if (isTrashFolder || preferences.confirm_delete) setPendingDelete(request);
    else void performDelete(request);
  };

  const handleToggleRead = React.useCallback(() => {
    if (!displayMessage) return;
    if (displayMessage.read) {
      void markAsUnread(getMessageIdentityKey(displayMessage));
    } else {
      void markAsRead(getMessageIdentityKey(displayMessage));
    }
  }, [displayMessage, markAsRead, markAsUnread]);

  const messageActions = displayMessage
    ? [
        {
          id: "mark-read",
          label: displayMessage.read
            ? __("Mark as unread", "pressedmail")
            : __("Mark as read", "pressedmail"),
          icon: displayMessage.read ? EmailMarkUnreadIcon : EmailMarkReadIcon,
          onAction: handleToggleRead,
        },
        {
          id: "archive",
          label: __("Archive", "pressedmail"),
          icon: EmailArchiveIcon,
          onAction: handleArchive,
        },
        {
          id: "delete",
          label: __("Delete", "pressedmail"),
          icon: EmailTrashIcon,
          onAction: handleDelete,
          destructive: true,
        },
      ]
    : [];

  const primaryActionBar = displayMessage ? (
    <div className="sticky top-0 z-20 -mx-4 flex items-center gap-1 border-y border-border bg-background/95 px-3 py-2 backdrop-blur">
      <button
        type="button"
        data-test="mobile-default-reply-action"
        data-testid="mobile-default-reply-action"
        aria-label={
          preferredReplyMode === "reply-all"
            ? __("Reply to all recipients", "pressedmail")
            : __("Reply to sender", "pressedmail")
        }
        onClick={() => openCompose(preferredReplyMode)}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        {preferredReplyMode === "reply-all" ? (
          <EmailReplyAllIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <EmailReplyIcon className="h-4 w-4" aria-hidden="true" />
        )}
        {preferredReplyMode === "reply-all"
          ? __("Reply All", "pressedmail")
          : __("Reply", "pressedmail")}
      </button>
      <button
        type="button"
        aria-label={
          alternateReplyMode === "reply-all"
            ? __("Reply to all recipients", "pressedmail")
            : __("Reply to sender", "pressedmail")
        }
        onClick={() => openCompose(alternateReplyMode)}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        {alternateReplyMode === "reply-all" ? (
          <EmailReplyAllIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <EmailReplyIcon className="h-4 w-4" aria-hidden="true" />
        )}
        {alternateReplyMode === "reply-all"
          ? __("Reply All", "pressedmail")
          : __("Reply", "pressedmail")}
      </button>
      <button
        type="button"
        aria-label={__("Forward message", "pressedmail")}
        onClick={() => openCompose("forward")}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        <EmailForwardIcon className="h-4 w-4" aria-hidden="true" />
        {__("Forward", "pressedmail")}
      </button>
      <button
        type="button"
        ref={moreActionsRef}
        aria-label={__("More actions", "pressedmail")}
        onClick={() => setActionSheetOpen(true)}
        className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full px-2 text-foreground active:bg-muted">
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  ) : null;

  return (
    <MobileScreen
      header={
        <MobileScreenHeader
          title={subject}
          trailing={
            displayMessage ? (
              <button
                type="button"
                aria-label={
                  starred
                    ? __("Unstar", "pressedmail")
                    : __("Star", "pressedmail")
                }
                onClick={handleStar}
                className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
                <Star
                  className={cn(
                    "h-5 w-5",
                    starred && "fill-warning text-warning",
                  )}
                  aria-hidden="true"
                />
              </button>
            ) : null
          }
        />
      }>
      {!displayMessage ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          {isLoading
            ? __("Loading...", "pressedmail")
            : __("Message not available", "pressedmail")}
        </p>
      ) : null}
      <MailDisplay
        mail={displayMessage}
        layout="mobile"
        afterMetadata={primaryActionBar}
      />
      <ConfirmationPanel
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          moreActionsRef.current?.focus();
        }}
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDelete(null);
            setDeleteError(false);
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
              <span role="alert" className="mt-2 block text-destructive">
                {__("Could not delete the message. Try again.", "pressedmail")}
              </span>
            ) : null}
          </>
        }
        confirmText={
          pendingDelete?.permanent
            ? __("Delete permanently", "pressedmail")
            : __("Delete", "pressedmail")
        }
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={deleting}
        onConfirm={() =>
          pendingDelete ? performDelete(pendingDelete) : undefined
        }
      />
      <MobileActionSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        title={__("Message actions", "pressedmail")}
        actions={messageActions}
      />
    </MobileScreen>
  );
}

export default MobileMailReaderScreen;
