"use client";

import * as React from "react";
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
import { MailDisplay } from "@/components/inbox/mail-display";
import {
  formatForwardedText,
  formatForwardedHtml,
  formatQuotedText,
  formatQuotedHtml,
} from "@/components/inbox/compose/compose-utils";
import { useComposer } from "@/context/composer";
import {
  useFolderOperations,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { matchesMessageById } from "@/lib/consolidated-message-match";
import {
  getAccountQualifiedMessageToken,
  getMessageIdentityKey,
} from "@/lib/message-identity";
import { getFolderRole } from "@/lib/bulk-mail-actions";
import { nextVisibleMessageAfterRemoval } from "@/lib/preference-behavior";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { useUserPreferences } from "@/hooks/useUserPreferences";

function prefixedSubject(prefix: "Re" | "Fwd", subject?: string): string {
  const value = subject || "";
  return value.toLowerCase().startsWith(`${prefix.toLowerCase()}:`)
    ? value
    : `${prefix}: ${value}`;
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
  const routeId = params.id ? decodeURIComponent(params.id) : null;
  const { selectedAccountId, selectedMessage, messages, isLoading } =
    useInboxState();
  const { folders, selectedFolder } = useFolderOperations();
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
  const { selectedAccount } = useAppContext();
  const { preferences } = useUserPreferences();
  const isConsolidatedMode = selectedAccount === CONSOLIDATED_INBOX_VALUE;
  const preferredContentType =
    preferences.composer_default_format === "plain_text" ? "plain" : "html";
  const preferredReplyMode: "reply" | "reply-all" =
    preferences.default_reply_action === "reply_all" ? "reply-all" : "reply";
  const alternateReplyMode: "reply" | "reply-all" =
    preferredReplyMode === "reply-all" ? "reply" : "reply-all";
  const [actionSheetOpen, setActionSheetOpen] = React.useState(false);

  // Trash is the one folder where delete is permanent rather than a move.
  const isTrashFolder = React.useMemo(() => {
    const target = String(selectedFolder ?? "")
      .trim()
      .toLowerCase();
    if (!target) return false;
    const matched = folders.find(
      (folder) =>
        String(folder.path ?? "")
          .trim()
          .toLowerCase() === target ||
        String(folder.name ?? "")
          .trim()
          .toLowerCase() === target,
    );
    return (
      getFolderRole(
        matched ?? { name: target, path: target, count: 0 },
      ) === "trash"
    );
  }, [folders, selectedFolder]);

  const routeMessage = React.useMemo(() => {
    if (!routeId) return null;
    return (
      messages.find((message) => matchesMessageById(message, routeId)) ?? null
    );
  }, [messages, routeId]);

  const displayMessage = selectedMessage ?? routeMessage;

  React.useEffect(() => {
    if (!selectedMessage && routeMessage) {
      void selectMessage(routeMessage);
    }
  }, [routeMessage, selectMessage, selectedMessage]);

  React.useEffect(() => {
    return () => {
      clearSelection();
    };
  }, [clearSelection]);

  const subject = displayMessage?.subject || "(No subject)";
  const starred = !!displayMessage?.starred;

  const handleStar = React.useCallback(() => {
    if (!displayMessage) return;
    toggleStar(displayMessage.id);
  }, [displayMessage, toggleStar]);

  const openCompose = React.useCallback(
    (mode: "reply" | "reply-all" | "forward") => {
      if (!displayMessage) return;
      const parsedAccountId = Number(
        displayMessage.accountId ?? selectedAccountId ?? 0,
      );
      const replyAccountId =
        Number.isInteger(parsedAccountId) && parsedAccountId > 0
          ? parsedAccountId
          : undefined;
      if (mode === "forward") {
        setComposeData({
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
          replySource: {
            identity: getAccountQualifiedMessageToken(
              displayMessage,
              replyAccountId,
            ),
            accountId: replyAccountId,
            folder: displayMessage.folder,
            uid: displayMessage.uid,
            msgNo: displayMessage.msg_no,
          },
        });
      }
      navigate("/compose");
    },
    [
      displayMessage,
      navigate,
      preferredContentType,
      selectedAccountId,
      setComposeData,
    ],
  );

  const finishAfterRemoval = React.useCallback(
    (action: "message_list" | "next_message", removedId: string | number) => {
      if (action === "next_message") {
        const next = nextVisibleMessageAfterRemoval(messages, [
          String(removedId),
        ]);
        if (next) {
          void selectMessage(next);
          const nextId = isConsolidatedMode
            ? getAccountQualifiedMessageToken(next)
            : getMessageIdentityKey(next);
          navigate(`/inbox/m/${encodeURIComponent(nextId)}`);
          return;
        }
      }
      navigate("/inbox");
    },
    [isConsolidatedMode, messages, navigate, selectMessage],
  );

  const handleArchive = React.useCallback(() => {
    if (!displayMessage) return;
    const messageId = isConsolidatedMode
      ? getAccountQualifiedMessageToken(displayMessage)
      : (displayMessage.uid ?? displayMessage.msg_no ?? displayMessage.id);
    void archiveMessage(messageId).then((result) => {
      if (result.success !== false) {
        finishAfterRemoval(preferences.after_archive_action, messageId);
      }
    });
  }, [
    archiveMessage,
    displayMessage,
    finishAfterRemoval,
    isConsolidatedMode,
    preferences.after_archive_action,
  ]);

  const handleDelete = React.useCallback(() => {
    if (!displayMessage) return;
    // Deleting from Trash expunges the message on the server, so it always
    // asks first, whatever the confirm-delete preference says.
    if (isTrashFolder) {
      if (
        !window.confirm(
          "Delete this email permanently? This cannot be undone.",
        )
      ) {
        return;
      }
    } else if (
      preferences.confirm_delete &&
      !window.confirm("Delete this email?")
    ) {
      return;
    }
    const messageId = isConsolidatedMode
      ? getAccountQualifiedMessageToken(displayMessage)
      : (displayMessage.uid ?? displayMessage.msg_no ?? displayMessage.id);
    void deleteMessage(messageId).then((result) => {
      if (result.success !== false) {
        finishAfterRemoval(preferences.after_delete_action, messageId);
      }
    });
  }, [
    deleteMessage,
    displayMessage,
    finishAfterRemoval,
    isConsolidatedMode,
    isTrashFolder,
    preferences.after_delete_action,
    preferences.confirm_delete,
  ]);

  const handleToggleRead = React.useCallback(() => {
    if (!displayMessage) return;
    if (displayMessage.read) {
      void markAsUnread(displayMessage.id);
    } else {
      void markAsRead(displayMessage.id);
    }
  }, [displayMessage, markAsRead, markAsUnread]);

  const messageActions = displayMessage
    ? [
        {
          id: "mark-read",
          label: displayMessage.read ? "Mark as unread" : "Mark as read",
          icon: displayMessage.read ? EmailMarkUnreadIcon : EmailMarkReadIcon,
          onAction: handleToggleRead,
        },
        {
          id: "archive",
          label: "Archive",
          icon: EmailArchiveIcon,
          onAction: handleArchive,
        },
        {
          id: "delete",
          label: "Delete",
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
            ? "Reply to all recipients"
            : "Reply to sender"
        }
        onClick={() => openCompose(preferredReplyMode)}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        {preferredReplyMode === "reply-all" ? (
          <EmailReplyAllIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <EmailReplyIcon className="h-4 w-4" aria-hidden="true" />
        )}
        {preferredReplyMode === "reply-all" ? "Reply All" : "Reply"}
      </button>
      <button
        type="button"
        aria-label={
          alternateReplyMode === "reply-all"
            ? "Reply to all recipients"
            : "Reply to sender"
        }
        onClick={() => openCompose(alternateReplyMode)}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        {alternateReplyMode === "reply-all" ? (
          <EmailReplyAllIcon className="h-4 w-4" aria-hidden="true" />
        ) : (
          <EmailReplyIcon className="h-4 w-4" aria-hidden="true" />
        )}
        {alternateReplyMode === "reply-all" ? "Reply All" : "Reply"}
      </button>
      <button
        type="button"
        aria-label="Forward message"
        onClick={() => openCompose("forward")}
        className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center gap-1 rounded-full text-xs font-medium text-foreground active:bg-muted">
        <EmailForwardIcon className="h-4 w-4" aria-hidden="true" />
        Forward
      </button>
      <button
        type="button"
        aria-label="More actions"
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
                aria-label={starred ? "Unstar" : "Star"}
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
          {isLoading ? "Loading…" : "Message not available"}
        </p>
      ) : null}
      <MailDisplay
        mail={displayMessage}
        layout="mobile"
        afterMetadata={primaryActionBar}
      />
      <MobileActionSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        title="Message actions"
        actions={messageActions}
      />
    </MobileScreen>
  );
}

export default MobileMailReaderScreen;
