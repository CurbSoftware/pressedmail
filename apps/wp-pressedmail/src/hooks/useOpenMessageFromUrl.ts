"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { useSearchParams } from "react-router-dom";
import { toast } from "@kit/ui/plugin";

import {
  useFolderOperations,
  useInbox,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { appMessage } from "@/context/toast";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { useOpenFromSearchParam } from "@/hooks/useOpenFromSearchParam";
import {
  getAccountQualifiedMessageToken,
  getMessageIdentityKey,
} from "@/lib/message-identity";
import {
  findOpenedMessage,
  focusLanding,
  takeLandingFocus,
} from "@/lib/notification-landing";
import type { EmailMessage } from "@/types";

interface MessageLink {
  /** The IMAP UID, which is what the message list carries as its `id`. */
  uid: number;
  accountId: number | null;
  folder: string;
  uidValidity: number | null;
}

/** The one slot a "still opening" toast uses, so a result can replace it. */
const OPENING_TOAST = "open-message-from-link";
/** A read that comes back sooner than this shows nothing at all. */
const SLOW_READ_MS = 600;
/**
 * How long a link may stay unresolved: the mailbox switch, the folder and the
 * list all have to arrive first. Past this the link is dropped with a message,
 * rather than steering the inbox from the address bar for as long as the page
 * stays open.
 */
const GIVE_UP_MS = 15_000;
/**
 * An empty list that stays empty this long, with the right mailbox and folder
 * selected, has finished loading: a folder that loaded before this page mounted
 * shows no loading state to wait for.
 */
const EMPTY_LIST_SETTLED_MS = 1500;
/** What the reader does with their hands, as opposed to what the page does to itself. */
const READER_EVENTS = ["pointerdown", "keydown"] as const;
/** The parameters a link carries, all removed together. */
const LINK_PARAMS = ["openMessageId", "accountId", "folder", "uidValidity"];

/** What a link says when its message is not there to open. Said once, for every way it can be missing. */
const goneMessage = () =>
  __("That message may have been moved or deleted.", "pressedmail");

const BODY_KEYS = [
  "htmlBody",
  "bodyHtml",
  "html_body",
  "body_html",
  "plainBody",
  "plain_body",
  "textBody",
  "text_body",
  "body",
  "text",
] as const;

const isBlank = (value: unknown): boolean =>
  typeof value !== "string" || value.trim() === "";

/**
 * Whether a detail that came back says nothing at all: no subject, no sender, no
 * recipients and no body.
 *
 * The detail route answers 200 with exactly this for a UID it has no message
 * for, which is what a link to a message that was since moved, archived or
 * deleted asks about. Shown as a message it is a blank reading pane over a real
 * sender of "Unknown sender" and a subject of "No subject", and it marks a UID
 * read that nothing holds. A message with content, or only a body still loading,
 * never matches: a real message always has a sender.
 */
export function isEmptyShell(detail: EmailMessage): boolean {
  return (
    isBlank(detail.subject) &&
    isBlank(detail.from) &&
    isBlank(detail.name) &&
    isBlank(detail.email) &&
    isBlank(detail.to) &&
    BODY_KEYS.every((key) => isBlank(detail[key]))
  );
}

const toPositiveInteger = (value: string | null): number | null => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
};

/** Whether a row is in the mailbox and folder the link names. */
function isInLinkedFolder(
  message: EmailMessage,
  link: MessageLink,
  listAccountId: string | number | null,
): boolean {
  const account = message.accountId ?? listAccountId;
  if (
    link.accountId !== null &&
    account !== null &&
    account !== undefined &&
    String(account) !== String(link.accountId)
  ) {
    return false;
  }
  return !(
    link.folder &&
    message.folder &&
    message.folder.toLowerCase() !== link.folder.toLowerCase()
  );
}

/** A row is the linked message when account, folder, generation and UID all agree. */
function isLinkedMessage(
  message: EmailMessage,
  link: MessageLink,
  listAccountId: string | number | null,
): boolean {
  if (String(message.uid ?? message.id) !== String(link.uid)) return false;
  if (!isInLinkedFolder(message, link, listAccountId)) return false;
  const generation = message.uidValidity ?? message.uid_validity;
  return !(
    link.uidValidity !== null &&
    generation !== undefined &&
    generation !== null &&
    String(generation) !== String(link.uidValidity)
  );
}

/**
 * Opens the message a link names: `?openMessageId=<uid>&accountId=&folder=&uidValidity=`.
 *
 * The bell, a desktop pop-up and the header search all link this way. The link
 * first brings the inbox to the account and folder it names, and waits for the
 * list of that folder, since the previous folder's rows stay on screen until it
 * arrives. Then it finds the message in the list. A message older than the
 * loaded page is not in the list, so it is read by its full identity from the
 * message detail endpoint, the same read the reading pane uses.
 *
 * That read can take seconds for a message the site has not stored. A toast
 * says so if it does, and a body the server is still assembling opens as the
 * message with its headers, so the reading pane's own waiting and Retry apply.
 * The result is only used if the reader has not chosen something else since:
 * another message, folder or mailbox, picked by hand, retires the read. A
 * selection the page makes by itself does not (the PressedOut layout opens the
 * first row of a list as soon as it loads), so the tell is the reader's own
 * pointer or key, not the selection alone.
 *
 * A message that is gone says so with a toast, rather than leaving the address
 * as it was and doing nothing. That covers a message the mirror no longer holds,
 * a generation that moved, and a UID the server has no message for, which it
 * answers with an empty shell rather than an error (`isEmptyShell`). A link that
 * cannot settle, or that the reader walks away from, is dropped, so it never
 * keeps steering the inbox.
 *
 * `openReader` is for an inbox that is a list leading to a reader screen, the
 * phone shell: selecting a message there does not show it, so the link goes on to
 * that screen once the message is selected.
 */
export function useOpenMessageFromUrl(
  openReader?: (message: EmailMessage) => void,
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const { messages, isLoading, selectedAccountId, selectedMessage } =
    useInboxState();
  const { prefetch } = useInbox();
  const { selectMessage } = useMessageOperations();
  const { selectedFolder, selectFolder } = useFolderOperations();
  const { accounts, selectedAccount, setSelectedAccount } = useAppContext();
  // Names the read still on its way. Anything that makes its result stale, a
  // newer link, the reader choosing something else, or leaving the page, moves it on.
  const readTicket = React.useRef(0);
  const slowTimer = React.useRef<number | null>(null);
  // The list is empty before its first load starts as well as after a load that
  // found nothing, so an empty list only counts as loaded once a load was seen,
  // or has stayed empty for a moment.
  const sawLoading = React.useRef(false);
  const [emptyListSettled, setEmptyListSettled] = React.useState(false);
  // True once the reader has pressed a key or a pointer since the link arrived.
  // A selection, folder or mailbox that moves after that was theirs.
  const readerActed = React.useRef(false);
  const stopWatching = React.useRef<(() => void) | null>(null);
  // The message a keyboard open is waiting to put focus on, by identity, until the
  // inbox has selected it.
  const awaitedLanding = React.useRef<string | null>(null);
  const setSearchParamsRef = React.useRef(setSearchParams);
  setSearchParamsRef.current = setSearchParams;
  const openReaderRef = React.useRef(openReader);
  openReaderRef.current = openReader;
  // The whole link, not just its UID: a UID is only unique inside one folder of
  // one mailbox, and a second link to the same number is another message.
  const linked = searchParams.get("openMessageId")
    ? LINK_PARAMS.map((key) => searchParams.get(key) ?? "").join("|")
    : "";

  React.useEffect(() => {
    if (isLoading) sawLoading.current = true;
  }, [isLoading]);

  const watchReader = React.useCallback(() => {
    if (stopWatching.current) return;
    // A key held down since before the link arrived repeats, and repeating is
    // not the reader doing something new.
    const acted = (event: Event) => {
      if (event instanceof KeyboardEvent && event.repeat) return;
      readerActed.current = true;
    };
    for (const event of READER_EVENTS) {
      document.addEventListener(event, acted, { capture: true, passive: true });
    }
    stopWatching.current = () => {
      for (const event of READER_EVENTS) {
        document.removeEventListener(event, acted, { capture: true });
      }
      stopWatching.current = null;
    };
  }, []);

  /** The link is done with, however it ended: no read to wait on, nobody to watch. */
  const retireRead = React.useCallback(() => {
    readTicket.current += 1;
    if (slowTimer.current !== null) {
      window.clearTimeout(slowTimer.current);
      slowTimer.current = null;
    }
    stopWatching.current?.();
    toast.dismiss(OPENING_TOAST);
  }, []);

  // A link is watched from the moment it arrives, and given up on if it cannot
  // settle. Its parameters go when it is consumed, which also ends the timer.
  React.useEffect(() => {
    if (!linked) return;
    readerActed.current = false;
    watchReader();
    const timer = window.setTimeout(() => {
      retireRead();
      setSearchParamsRef.current(
        (current) => {
          const next = new URLSearchParams(current);
          for (const key of LINK_PARAMS) next.delete(key);
          return next;
        },
        { replace: true },
      );
      appMessage(
        __("Could not open that message. Please try again.", "pressedmail"),
        "error",
      );
    }, GIVE_UP_MS);
    return () => window.clearTimeout(timer);
  }, [linked, retireRead, watchReader]);

  // A list that loaded before this page mounted shows no loading state, so an
  // empty one is taken as loaded once it has stayed empty for a moment.
  const listIsEmpty = messages.length === 0;
  React.useEffect(() => {
    if (!linked || isLoading || !listIsEmpty) {
      setEmptyListSettled(false);
      return;
    }
    const timer = window.setTimeout(
      () => setEmptyListSettled(true),
      EMPTY_LIST_SETTLED_MS,
    );
    return () => window.clearTimeout(timer);
  }, [linked, isLoading, listIsEmpty, selectedFolder, selectedAccountId]);

  // Leaving the page ends any read still on its way.
  React.useEffect(() => retireRead, [retireRead]);

  // The reader picking another message, folder or mailbox ends it too. The
  // cleanup is the point: it runs on the change, and by then the reader's pointer
  // or key has been seen. Without them the page moved the selection itself.
  const selectedIdentity = getMessageIdentityKey(selectedMessage ?? null);
  const selectedIdentityRef = React.useRef(selectedIdentity);
  selectedIdentityRef.current = selectedIdentity;
  React.useEffect(
    () => () => {
      if (readerActed.current) retireRead();
    },
    [retireRead, selectedFolder, selectedAccountId, selectedIdentity],
  );

  // The message a keyboard open asked for is the selected one now: its row exists
  // and is drawn as selected, so focus can follow it there.
  React.useEffect(() => {
    if (awaitedLanding.current === null) return;
    if (awaitedLanding.current !== selectedIdentity) return;
    awaitedLanding.current = null;
    focusLanding(findOpenedMessage);
  }, [selectedIdentity]);

  /**
   * Show the message the link named: select it, and where the inbox is a list
   * that leads to a reader screen (the phone shell), go to that screen too.
   */
  const showMessage = React.useCallback(
    (message: EmailMessage) => {
      // A link opened from the keyboard (Enter on a notification) asked for focus
      // to follow it. Where the inbox shows the message beside the list, that is
      // the message's row, once the list has drawn it as selected: see the effect
      // on `selectedIdentity`. A reader screen takes its own focus.
      const reader = openReaderRef.current;
      if (takeLandingFocus() && !reader) {
        const identity = getMessageIdentityKey(message);
        // Already the selected one, so nothing will change to wait for.
        if (identity === selectedIdentityRef.current) {
          focusLanding(findOpenedMessage);
        } else {
          awaitedLanding.current = identity;
        }
      }
      void selectMessage(message);
      // The link's own parameters are taken off the address by a navigation that
      // runs as this returns. A reader opened in the same breath is the one that
      // would be dropped, so it waits a turn.
      if (reader) window.setTimeout(() => reader(message), 0);
    },
    [selectMessage],
  );

  const open = React.useCallback(
    (uid: number) => {
      // The reader took over before the link could settle. Returning true
      // consumes it, so it stops steering.
      if (readerActed.current) {
        retireRead();
        return true;
      }

      const link: MessageLink = {
        uid,
        accountId: toPositiveInteger(searchParams.get("accountId")),
        folder: searchParams.get("folder")?.trim() ?? "",
        uidValidity: toPositiveInteger(searchParams.get("uidValidity")),
      };

      if (link.accountId !== null) {
        if (accounts.length === 0) return false;
        const account = accounts.find(
          (candidate) => Number(candidate.id) === link.accountId,
        );
        const email = account?.email?.toString() ?? "";
        if (!email) {
          retireRead();
          appMessage(
            __("That mailbox is no longer connected.", "pressedmail"),
            "info",
          );
          return true;
        }
        // From All inboxes, a message that is already in the combined list opens
        // where it is, instead of switching to its mailbox and leaving the reader
        // there.
        if (selectedAccount === CONSOLIDATED_INBOX_VALUE && !isLoading) {
          const inCombinedList = messages.find(
            (message) =>
              message.accountId !== undefined &&
              isLinkedMessage(message, link, null),
          );
          if (inCombinedList) {
            retireRead();
            showMessage(inCombinedList);
            return true;
          }
        }
        if (email !== selectedAccount) {
          setSelectedAccount(email);
          return false;
        }
        if (String(selectedAccountId) !== String(link.accountId)) return false;
      }

      if (
        link.folder &&
        link.folder.toLowerCase() !== selectedFolder.toLowerCase()
      ) {
        void selectFolder(link.folder);
        return false;
      }

      // Selecting a folder or mailbox only names it. The list still holds the
      // previous one's rows until the new list loads, and looking for the
      // message among those would say it is missing when it is not.
      if (
        isLoading ||
        (messages.length === 0 && !sawLoading.current && !emptyListSettled) ||
        !messages.every((message) =>
          isInLinkedFolder(message, link, selectedAccountId),
        )
      ) {
        return false;
      }

      const loaded = messages.find((message) =>
        isLinkedMessage(message, link, selectedAccountId),
      );
      if (loaded) {
        retireRead();
        showMessage(loaded);
        return true;
      }

      // Reading a message by identity needs all four parts. A row written before
      // the generation was stored, and whose message the mirror no longer
      // holds, has none, and guessing one could open a different message.
      const token =
        link.accountId !== null && link.folder && link.uidValidity !== null
          ? getAccountQualifiedMessageToken({
              accountId: link.accountId,
              folder: link.folder,
              uidValidity: String(link.uidValidity),
              uid: String(link.uid),
            })
          : "";
      if (!token) {
        retireRead();
        // Nothing says it is gone: a link with no generation is also a header
        // search hit for mail outside the loaded page, which still exists.
        appMessage(__("Could not find that message.", "pressedmail"), "info");
        return true;
      }

      // Restart the count and the watch: this read is the one the link is for.
      retireRead();
      watchReader();
      const ticket = readTicket.current;
      slowTimer.current = window.setTimeout(() => {
        slowTimer.current = null;
        toast.loading(__("Opening message…", "pressedmail"), {
          id: OPENING_TOAST,
        });
      }, SLOW_READ_MS);

      void prefetch
        .fetchDetail(
          String(link.accountId),
          link.folder,
          token,
          "user-selected",
        )
        .catch(() => null)
        .then((outcome) => {
          if (ticket !== readTicket.current) return;
          retireRead();
          if (outcome && "detail" in outcome) {
            // A message that is gone is answered with an empty shell, not with
            // an error, so it is told apart here. Selecting it would open a
            // blank pane and mark a UID nothing holds as read.
            if (isEmptyShell(outcome.detail)) {
              appMessage(goneMessage(), "info");
            } else {
              showMessage(outcome.detail);
            }
          } else if (outcome && "pending" in outcome && outcome.stub) {
            // The body is still on its way. The server sent the headers, so the
            // message opens now and the pane waits for the body itself.
            showMessage(outcome.stub);
          } else if (outcome && "pending" in outcome) {
            appMessage(
              __(
                "That message is slow to load. Try opening it again in a moment.",
                "pressedmail",
              ),
              "info",
            );
          } else if (
            outcome &&
            "failed" in outcome &&
            outcome.requiresRefresh
          ) {
            appMessage(goneMessage(), "info");
          } else {
            appMessage(
              __(
                "Could not open that message. Please try again.",
                "pressedmail",
              ),
              "error",
            );
          }
        });
      return true;
    },
    [
      accounts,
      emptyListSettled,
      isLoading,
      messages,
      prefetch,
      retireRead,
      searchParams,
      selectFolder,
      selectedAccount,
      selectedAccountId,
      selectedFolder,
      setSelectedAccount,
      showMessage,
      watchReader,
    ],
  );

  useOpenFromSearchParam("openMessageId", open, [
    "accountId",
    "folder",
    "uidValidity",
  ]);
}
