"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { toast } from "@kit/ui/plugin";
import { apiFetch } from "@/lib/api-client";
import {
  buildApiUrl,
  notificationClearRouteApi,
  notificationDismissRouteApi,
  notificationReadAllRouteApi,
  notificationReadRouteApi,
  notificationsRouteApi,
} from "@/context/Strings";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useInboxState } from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { applyNotificationPreview } from "@/lib/inbox-alert-dispatch";
import {
  resolveNotificationBadgeCount,
  shouldShowInboxAlert,
} from "@/lib/preference-behavior";
import type { EmailMessage } from "@/types";
import {
  isFollowingLeader,
  isTabLeader,
  publishTabMessage,
  subscribeTabMessages,
  type TabMessage,
  type TabNotificationFeed,
} from "@/lib/tab-channel";

export type NotificationTargetKind =
  | "inbox_message"
  | "snoozed_message"
  | "scheduled"
  | "sent"
  | "email_rules"
  | "wp_mail_settings"
  | "security_settings"
  | "calendar_event"
  | "plugin_integrity";

export interface PressedMailNotification {
  id: number;
  accountId: number | null;
  type: string;
  title: string;
  summary: string;
  /**
   * "problem" for a row that reports something that did not work: a failed send,
   * a failed rule, a warning that stays until it is fixed. The panel sets these
   * apart from good news. Absent on a row from a server that does not say.
   */
  severity?: "problem" | "info";
  targetKind: NotificationTargetKind;
  targetMetadata: Record<string, unknown>;
  /**
   * False for sticky notifications (e.g. modified plugin files) that only
   * their producer may retire. Defaults to true when the server omits it.
   */
  dismissable: boolean;
  readAt: string | null;
  createdAt: string;
  /**
   * The address of the mailbox the row belongs to. Set by the hook, never by the
   * server, and only while more than one mailbox is connected: with one there is
   * nothing to tell apart.
   */
  accountLabel?: string;
}

/**
 * Rows in one page of the feed. The server sends 50 when asked for no size; the
 * older pages ask for the same, so every page is the size the first one was.
 */
const NOTIFICATION_PAGE_SIZE = 50;

/**
 * How long a dismissed row can be taken back. The server empties a dismissed row
 * for good and keeps only a tombstone, so it has nothing to put back. The row is
 * held here instead, out of the list, and the server is told once this has passed
 * (or the page is closing).
 */
export const DISMISS_UNDO_MS = 8_000;

export interface NotificationFeedState {
  /**
   * What the panel lists: the newest page and every older page loaded since,
   * minus the mail the alert settings hide, unless `showAll` is on.
   */
  items: PressedMailNotification[];
  /**
   * The newest page, unfiltered. It is the only feed new-mail alerts are raised
   * from, so appending history never replays a sound or a desktop alert.
   */
  rawItems: PressedMailNotification[];
  /** The badge number, which follows the user's badge count setting. */
  unreadCount: number;
  /** Every unread stored row, whatever the badge shows and the page holds. */
  totalUnreadCount: number;
  /** Loaded rows the alert settings keep out of `items`. */
  hiddenCount: number;
  /**
   * How many of those are read mail that only "Unread only" holds back. When it
   * is all of them, the panel can name the one setting to change.
   */
  hiddenReadCount: number;
  /** True while the panel lists hidden rows too. */
  showAll: boolean;
  setShowAll: (showAll: boolean) => void;
  /** Whether stored rows older than the last one loaded exist. */
  hasMore: boolean;
  isLoading: boolean;
  isLoadingMore: boolean;
  error: string | null;
  loadMoreError: string | null;
  /** Pass `true` when new data is expected, to skip the shared request. */
  refresh: (force?: boolean) => Promise<void>;
  /**
   * Refresh, and forget the older pages that were loaded. Rows on those pages can
   * be read, dismissed or pruned from another tab or device, and only the newest
   * page is ever re-read, so the panel starts from it whenever it opens.
   */
  startOver: () => Promise<void>;
  /** Append the next page of older rows. A call while one is running does nothing. */
  loadMore: () => Promise<void>;
  markRead: (id: number, read: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  /**
   * Put back what the last `markAllRead` marked, unread rows on pages that were
   * never loaded included. Does nothing when there is nothing to undo.
   */
  undoMarkAllRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  /**
   * Take a row out of the list at once and tell the server after
   * `DISMISS_UNDO_MS`, unless `undoDismiss` is called first. A failed write puts
   * the row back and says so.
   */
  dismissWithUndo: (id: number) => Promise<void>;
  /** Put back a row `dismissWithUndo` took out. False when its time was up. */
  undoDismiss: (id: number) => boolean;
  clearAll: () => Promise<void>;
}

interface ParsedFeed {
  items: PressedMailNotification[];
  unreadCount: number;
  inboxUnreadCount: number;
  hasMore: boolean;
}

/** The feed's order: newest first by time, and by id within the same second. */
function isOlderThan(
  item: PressedMailNotification,
  other: PressedMailNotification,
): boolean {
  return (
    item.createdAt < other.createdAt ||
    (item.createdAt === other.createdAt && item.id < other.id)
  );
}

function countOrFallback(value: unknown, fallback: number): number {
  const count = Number(value);
  return Number.isFinite(count) && count >= 0 ? Math.floor(count) : fallback;
}

/** One feed response, whether it is the newest page or an older one. */
function parseFeed(payload: unknown): ParsedFeed {
  const typed = payload as {
    data?: Record<string, unknown>;
  } & Record<string, unknown>;
  const feed = typed.data ?? typed;
  // Older servers omit `dismissable`; default true so everything stays
  // dismissable until the backend says otherwise.
  const items = (
    Array.isArray(feed.items) ? (feed.items as PressedMailNotification[]) : []
  ).map((item) => ({ ...item, dismissable: item.dismissable !== false }));
  const unread = items.filter((item) => !item.readAt);
  return {
    items,
    unreadCount: countOrFallback(feed.unreadCount, unread.length),
    inboxUnreadCount: countOrFallback(
      feed.inboxUnreadCount,
      unread.filter((item) => item.targetKind === "inbox_message").length,
    ),
    hasMore: feed.hasMore === true,
  };
}

function isPriorityInboxNotification(
  notification: PressedMailNotification,
  messages: EmailMessage[],
  singleAccountId: string | number | null,
): boolean {
  const metadata = notification.targetMetadata ?? {};
  if (typeof metadata.priority === "boolean") {
    return metadata.priority;
  }
  const uid = metadata.uid;
  const accountId = metadata.accountId ?? notification.accountId;
  const folder =
    typeof metadata.folder === "string" ? metadata.folder.trim() : "";
  if (
    uid === null ||
    uid === undefined ||
    uid === "" ||
    accountId === null ||
    accountId === undefined ||
    !folder
  ) {
    return false;
  }

  return messages.some((message) => {
    const messageAccountId = message.accountId ?? singleAccountId;
    return (
      String(message.uid) === String(uid) &&
      messageAccountId !== null &&
      String(messageAccountId) === String(accountId) &&
      message.folder?.toLowerCase() === folder.toLowerCase() &&
      (message.important === true || message.is_important === true)
    );
  });
}

/** What names one message in the inbox list and in a notification: mailbox, folder and UID. */
function messageKey(
  accountId: unknown,
  folder: unknown,
  uid: unknown,
): string | null {
  const name = typeof folder === "string" ? folder.trim().toLowerCase() : "";
  if (!name || accountId == null || accountId === "" || uid == null || uid === "") {
    return null;
  }
  return `${accountId}:${name}:${uid}`;
}

/**
 * How long the inbox must show a message as read before the feed is asked again.
 * Reads come in bursts (a bulk mark, a run of messages opened in turn), and this
 * is the same pause the folder counts wait before they refresh.
 */
const READ_SETTLE_MS = 600;

export function getNotificationTargetPath(
  notification: PressedMailNotification,
): string | null {
  const metadata = notification.targetMetadata ?? {};
  const toInteger = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };
  // A message is named by its mailbox identity: account, folder, generation and
  // UID. The inbox list matches on the UID, so that is what `openMessageId`
  // carries. The mirror row id in `messageId` is the row's own key and only ever
  // equals a UID by accident, so it is never used here. The server fills in the
  // generation of a row that lacks one while the mirror still holds its message,
  // so a row without one is for a message that is gone, and it can only open
  // one that is already on screen.
  const addMessageContext = (params: URLSearchParams) => {
    const uid = toInteger(metadata.uid);
    const uidValidity = toInteger(metadata.uidValidity);
    const accountId = toInteger(metadata.accountId ?? notification.accountId);
    const folder =
      typeof metadata.folder === "string" ? metadata.folder.trim() : "";
    if (uid) params.set("openMessageId", String(uid));
    if (accountId) params.set("accountId", String(accountId));
    if (folder) params.set("folder", folder);
    if (uid && uidValidity) params.set("uidValidity", String(uidValidity));
  };

  // Snoozed, scheduled and sent-on-schedule targets are Pro feed items. The
  // define keeps their routes out of Free, where such a row opens nothing.
  if (
    notification.targetKind === "inbox_message" ||
    (!__IS_FREE__ && notification.targetKind === "snoozed_message")
  ) {
    const params = new URLSearchParams();
    addMessageContext(params);
    return params.size > 0 ? `/inbox?${params.toString()}` : "/inbox";
  }

  if (
    !__IS_FREE__ &&
    (notification.targetKind === "scheduled" ||
      notification.targetKind === "sent")
  ) {
    const params = new URLSearchParams();
    const folder =
      notification.targetKind === "scheduled" ? "Scheduled" : "Sent";
    params.set("folder", folder);
    addMessageContext(params);
    return `/inbox?${params.toString()}`;
  }

  if (notification.targetKind === "email_rules") {
    return "/settings?tab=email-rules";
  }

  if (notification.targetKind === "security_settings") {
    return "/settings?tab=security";
  }

  if (notification.targetKind === "wp_mail_settings") {
    return "/settings?tab=admin-wp-mail";
  }

  // Integrity reports and the licence settings tab are Pro-only surfaces.
  // Guarding on the build constant keeps the route literal out of Free.
  if (!__IS_FREE__ && notification.targetKind === "plugin_integrity") {
    return "/settings?tab=admin-license";
  }

  // The calendar is a Pro feature, so only that build has a route to open and
  // only that build names the query parameter.
  if (__ENABLE_CALENDAR__ && notification.targetKind === "calendar_event") {
    const eventId = toInteger(metadata.eventId);
    const date = typeof metadata.date === "string" ? metadata.date.trim() : "";
    if (!eventId) return "/calendar";
    const params = new URLSearchParams({ openEventId: String(eventId) });
    // A reminder is for one occurrence of a series, and it says which by its day.
    // `exact` tells the calendar that day is the answer, not a place to start from.
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      params.set("date", date);
      params.set("exact", "1");
    }
    return `/calendar?${params.toString()}`;
  }

  return null;
}

/**
 * One GET for every mount. The bell and the inbox both mount this hook, and each ran
 * its own 60 s poll plus focus and visibility refetches, so every return to the tab cost
 * four requests. Mounts that ask within a few seconds of each other share one request.
 */
const FEED_SHARE_WINDOW_MS = 5000;
let sharedFeed: { at: number; promise: Promise<unknown | null> } | null = null;
/** When a mount last asked the feed again because the inbox showed mail read. */
let lastReadSettledAt = 0;

/** Forget the shared request (tests, and anything that must see the next GET). */
export function resetNotificationFeedCache(): void {
  sharedFeed = null;
  lastReadSettledAt = 0;
}

/**
 * Other tabs: the leader tab sends each feed it loads, and a follower that has heard one
 * recently skips its own 60 s poll. Only the newest page is relayed. A tab that opens the
 * older pages asks for them itself. Focus and visibility refetches stay, since the user
 * asked for those. The relay window is two polls long, so a follower whose leader stops
 * sending goes back to polling by itself.
 */
const FEED_RELAY_FRESH_MS = 150_000;
let lastRelayAt = 0;
let lastLeaderFeed: TabNotificationFeed | null = null;
/**
 * When this tab's last notification mutation (read, dismiss, clear) came back. A relayed
 * feed whose GET went out before then predates the change, so applying it would bring a
 * dismissed or read row back and drop the tab's own post-mutation refetch.
 */
let lastMutationAt = 0;
const mountedRefreshers = new Set<() => void>();
let unsubscribeRelay: (() => void) | null = null;

function toRelayFeed(
  payload: unknown,
  requestedAt: number,
): TabNotificationFeed | null {
  if (!payload || typeof payload !== "object") return null;
  const typed = payload as { data?: unknown } & Record<string, unknown>;
  const feed = (
    typed.data && typeof typed.data === "object" ? typed.data : typed
  ) as Record<string, unknown>;
  if (!Array.isArray(feed.items)) return null;
  const items = feed.items as PressedMailNotification[];
  const count = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isSafeInteger(n) && n >= 0 ? n : fallback;
  };
  const unread = items.filter((item) => !item.readAt);
  return {
    items: items as unknown as Record<string, unknown>[],
    unreadCount: count(feed.unreadCount, unread.length),
    inboxUnreadCount: count(
      feed.inboxUnreadCount,
      unread.filter((item) => item.targetKind === "inbox_message").length,
    ),
    hasMore: feed.hasMore === true,
    requestedAt,
  };
}

function onRelayMessage(message: TabMessage): void {
  if (message.type === "hello" && isTabLeader() && lastLeaderFeed) {
    publishTabMessage({ type: "notifications", feed: lastLeaderFeed });
    return;
  }
  if (message.type !== "notifications" || isTabLeader()) return;
  // An older tab sends no timestamp; treat its feed as older than any mutation.
  if ((message.feed.requestedAt ?? 0) < lastMutationAt) return;
  lastRelayAt = Date.now();
  // Seed the shared request so every mount reads this payload without a GET.
  sharedFeed = { at: Date.now(), promise: Promise.resolve(message.feed) };
  mountedRefreshers.forEach((refresh) => refresh());
}

function addRefresher(refresh: () => void): () => void {
  mountedRefreshers.add(refresh);
  unsubscribeRelay ??= subscribeTabMessages(onRelayMessage);
  return () => {
    mountedRefreshers.delete(refresh);
    if (mountedRefreshers.size === 0) {
      unsubscribeRelay?.();
      unsubscribeRelay = null;
    }
  };
}

function followerFeedIsFresh(): boolean {
  return isFollowingLeader() && Date.now() - lastRelayAt < FEED_RELAY_FRESH_MS;
}

function loadFeed(force: boolean): Promise<unknown | null> {
  if (!force && sharedFeed && Date.now() - sharedFeed.at < FEED_SHARE_WINDOW_MS) {
    return sharedFeed.promise;
  }
  const requestedAt = Date.now();
  const promise = apiFetch(notificationsRouteApi, {
    method: "GET",
    credentials: "same-origin",
  })
    .then((response) => (response.ok ? response.json() : null))
    .catch(() => null)
    .then((payload) => {
      // Never share a failure: the next caller should retry, not reuse the error.
      if (payload === null && sharedFeed?.promise === promise) sharedFeed = null;
      if (payload !== null && isTabLeader()) {
        lastLeaderFeed = toRelayFeed(payload, requestedAt);
        if (lastLeaderFeed) {
          publishTabMessage({ type: "notifications", feed: lastLeaderFeed });
        }
      }
      return payload;
    });
  sharedFeed = { at: Date.now(), promise };
  return promise;
}

export function useNotificationFeed(): NotificationFeedState {
  const { preferences, revalidate } = useUserPreferences();
  // The poll below reads the latest, so its identity never restarts the poll.
  const revalidateRef = React.useRef(revalidate);
  revalidateRef.current = revalidate;
  const { accounts, selectedAccount } = useAppContext();
  const { messages, selectedAccountId } = useInboxState();
  const singleAccountId =
    selectedAccount &&
    selectedAccount !== CONSOLIDATED_INBOX_VALUE &&
    selectedAccountId !== null
      ? selectedAccountId
      : null;
  // The newest page, which every refresh replaces, and the older pages the reader
  // asked for, which a refresh leaves alone. Splitting them is what lets the
  // 60 s poll keep running under a list that has been paged.
  const [latest, setLatest] = React.useState<PressedMailNotification[]>([]);
  const [older, setOlder] = React.useState<PressedMailNotification[]>([]);
  const [latestHasMore, setLatestHasMore] = React.useState(false);
  /** Null until an older page has loaded; then whether that page was the last. */
  const [olderHasMore, setOlderHasMore] = React.useState<boolean | null>(null);
  const [unreadTotals, setUnreadTotals] = React.useState({
    unreadCount: 0,
    inboxUnreadCount: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [loadMoreError, setLoadMoreError] = React.useState<string | null>(null);
  const [showAll, setShowAll] = React.useState(false);

  // The refs are written with every state change, not just on render, so a
  // refetch that starts right after a dismiss reads the rows as they now are.
  const latestRef = React.useRef(latest);
  const olderRef = React.useRef(older);
  const commitLoaded = React.useCallback(
    (nextLatest: PressedMailNotification[], nextOlder: PressedMailNotification[]) => {
      latestRef.current = nextLatest;
      olderRef.current = nextOlder;
      setLatest(nextLatest);
      setOlder(nextOlder);
    },
    [],
  );
  const loadingMoreRef = React.useRef(false);
  // Rows the reader dismissed that the server has not been told about yet, and the
  // timer that tells it. The server still lists them, so every read of the feed
  // leaves them out and takes them off its unread count.
  const pendingDismissals = React.useRef(
    new Map<number, { row: PressedMailNotification; timer: number }>(),
  );
  const withoutPending = React.useCallback(
    (rows: PressedMailNotification[]) =>
      pendingDismissals.current.size === 0
        ? rows
        : rows.filter((row) => !pendingDismissals.current.has(row.id)),
    [],
  );
  /** What the pending rows take off the server's unread counts, which still hold them. */
  const pendingUnread = React.useCallback(() => {
    let all = 0;
    let inbox = 0;
    for (const { row } of pendingDismissals.current.values()) {
      if (row.readAt) continue;
      all += 1;
      if (row.targetKind === "inbox_message") inbox += 1;
    }
    return { all, inbox };
  }, []);
  // Only the newest refresh may write state. A slow GET that went out before a
  // dismiss must not land after the post-dismiss refetch and bring the row back.
  const latestRefresh = React.useRef(0);

  const refresh = React.useCallback(async (force = false) => {
    const call = ++latestRefresh.current;
    try {
      const payload = await loadFeed(force);
      if (call !== latestRefresh.current) return;
      if (payload === null) {
        throw new Error(__("Could not load notifications", "pressedmail"));
      }
      const feed = parseFeed(payload);
      const newestIds = new Set(feed.items.map((item) => item.id));
      const boundary = feed.items[feed.items.length - 1];
      setLatestHasMore(feed.hasMore);
      // Rows already on screen that the newest page no longer holds are either
      // older than it, because newer mail pushed them down, or gone from the
      // server. Nothing newer than its last row can be missing from it, so only
      // the older ones stay. With no page behind it, none of them can. They only
      // join the page without a gap if it reaches down into them: when more
      // mail than a page arrived since the last read, the rows between its last
      // row and the ones on screen were never loaded, so they start over.
      const held = [...latestRef.current, ...olderRef.current];
      const tail =
        feed.hasMore && boundary && held.some((item) => newestIds.has(item.id))
          ? held.filter(
              (item) => !newestIds.has(item.id) && isOlderThan(item, boundary),
            )
          : [];
      commitLoaded(withoutPending(feed.items), tail);
      if (tail.length === 0) setOlderHasMore(null);
      const pending = pendingUnread();
      setUnreadTotals({
        unreadCount: Math.max(0, feed.unreadCount - pending.all),
        inboxUnreadCount: Math.max(0, feed.inboxUnreadCount - pending.inbox),
      });
      setError(null);
    } catch (caught) {
      if (call !== latestRefresh.current) return;
      setError(
        caught instanceof Error
          ? caught.message
          : __("Could not load notifications", "pressedmail"),
      );
    } finally {
      setIsLoading(false);
    }
  }, [commitLoaded, pendingUnread, withoutPending]);

  const startOver = React.useCallback(async () => {
    commitLoaded(latestRef.current, []);
    setOlderHasMore(null);
    await refresh();
  }, [commitLoaded, refresh]);

  const loadMore = React.useCallback(async () => {
    const loaded = [...latestRef.current, ...olderRef.current];
    const cursor = loaded[loaded.length - 1]?.id;
    if (loadingMoreRef.current || cursor === undefined) return;
    loadingMoreRef.current = true;
    setIsLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await apiFetch(
        buildApiUrl(notificationsRouteApi, {
          limit: NOTIFICATION_PAGE_SIZE,
          before: cursor,
        }),
        { method: "GET", credentials: "same-origin" },
      );
      if (!response.ok) throw new Error("older page failed");
      const page = parseFeed(await response.json());
      const held = new Set(
        [...latestRef.current, ...olderRef.current].map((item) => item.id),
      );
      commitLoaded(latestRef.current, [
        ...olderRef.current,
        ...withoutPending(page.items).filter((item) => !held.has(item.id)),
      ]);
      setOlderHasMore(page.hasMore);
      const pending = pendingUnread();
      setUnreadTotals({
        unreadCount: Math.max(0, page.unreadCount - pending.all),
        inboxUnreadCount: Math.max(0, page.inboxUnreadCount - pending.inbox),
      });
    } catch {
      setLoadMoreError(__("Could not load older notifications", "pressedmail"));
    } finally {
      loadingMoreRef.current = false;
      setIsLoadingMore(false);
    }
  }, [commitLoaded, pendingUnread, withoutPending]);

  /**
   * Send one change. Resolves to false when the server no longer has the row,
   * which another tab or device dismissed or retention removed: that is not a
   * failure, the row is just gone. Otherwise it resolves to what the server
   * answered, which is an object even when the answer had no body. A poll
   * already on its way predates the change, so it is discarded before the request
   * goes out and cannot bring the old state back over the optimistic one.
   */
  const postMutation = React.useCallback(
    async (
      url: string,
      body?: Record<string, unknown>,
      message = __("Notification action failed", "pressedmail"),
      // For a write sent as the page closes, which a plain request would lose.
      keepalive = false,
    ): Promise<false | Record<string, unknown>> => {
      latestRefresh.current += 1;
      const response = await apiFetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
        ...(keepalive ? { keepalive: true } : {}),
      });
      if (response.status === 404) return false;
      if (!response.ok) throw new Error(message);
      lastMutationAt = Date.now();
      try {
        const answer: unknown = await response.json();
        return answer && typeof answer === "object"
          ? (answer as Record<string, unknown>)
          : {};
      } catch {
        return {};
      }
    },
    [],
  );

  /** Apply one change to every loaded row, newest page and older pages alike. */
  const mapLoaded = React.useCallback(
    (change: (rows: PressedMailNotification[]) => PressedMailNotification[]) => {
      commitLoaded(change(latestRef.current), change(olderRef.current));
    },
    [commitLoaded],
  );

  const markRead = React.useCallback(
    async (id: number, read: boolean) => {
      // Optimistic, so opening a row never waits on the write. A failed write
      // puts the row and the count back before it reports.
      const row = [...latestRef.current, ...olderRef.current].find(
        (item) => item.id === id,
      );
      const before = row?.readAt ?? null;
      const after = read ? new Date().toISOString() : null;
      const flips = row !== undefined && Boolean(before) !== read;
      const step = read ? -1 : 1;
      const inbox = row?.targetKind === "inbox_message" ? step : 0;
      const setReadAt = (readAt: string | null) =>
        mapLoaded((rows) =>
          rows.map((item) => (item.id === id ? { ...item, readAt } : item)),
        );
      const shiftTotals = (by: number, inboxBy: number) =>
        setUnreadTotals((totals) => ({
          unreadCount: Math.max(0, totals.unreadCount + by),
          inboxUnreadCount: Math.max(0, totals.inboxUnreadCount + inboxBy),
        }));

      setReadAt(after);
      if (flips) shiftTotals(step, inbox);
      try {
        const applied = await postMutation(
          notificationReadRouteApi,
          { id, read },
          __("Could not update notification", "pressedmail"),
        );
        // Gone from the server, so gone from the list; the refetch fixes the totals.
        if (!applied) mapLoaded((rows) => rows.filter((item) => item.id !== id));
        lastReadAll.current?.ids.delete(id);
      } catch (caught) {
        setReadAt(before);
        if (flips) shiftTotals(-step, -inbox);
        throw caught;
      }
      await refresh(true);
    },
    [mapLoaded, postMutation, refresh],
  );

  /**
   * What the last Mark all as read marked, so it can be put back: its unique
   * server batch id, and the ones on screen,
   * which can be put back without waiting for the server to be asked again.
   */
  const lastReadAll = React.useRef<{ batchId: string; ids: Set<number> } | null>(
    null,
  );

  const markAllRead = React.useCallback(async () => {
    const unreadOnScreen = new Set(
      [...latestRef.current, ...olderRef.current]
        .filter((item) => !item.readAt)
        .map((item) => item.id),
    );
    const answer = await postMutation(
      notificationReadAllRouteApi,
      undefined,
      __("Could not mark notifications as read", "pressedmail"),
    );
    const batchId =
      answer && typeof answer.readBatchId === "string" ? answer.readBatchId : "";
    lastReadAll.current = batchId ? { batchId, ids: unreadOnScreen } : null;
    const readAt = new Date().toISOString();
    mapLoaded((rows) => rows.map((item) => item.readAt ? item : { ...item, readAt }));
    await refresh(true);
  }, [mapLoaded, postMutation, refresh]);

  const undoMarkAllRead = React.useCallback(async () => {
    const last = lastReadAll.current;
    if (!last) return;
    await postMutation(
      notificationReadRouteApi,
      { read: false, readBatchId: last.batchId },
      __("Could not undo that", "pressedmail"),
    );
    lastReadAll.current = null;
    mapLoaded((rows) =>
      rows.map((item) =>
        last.ids.has(item.id) ? { ...item, readAt: null } : item,
      ),
    );
    await refresh(true);
  }, [mapLoaded, postMutation, refresh]);

  const dismiss = React.useCallback(
    async (id: number) => {
      await postMutation(
        notificationDismissRouteApi,
        { id },
        __("Could not dismiss notification", "pressedmail"),
      );
      mapLoaded((rows) => rows.filter((item) => item.id !== id));
      await refresh(true);
    },
    [mapLoaded, postMutation, refresh],
  );

  /** Put a row the reader dismissed back where it belongs, and its unread count with it. */
  const restoreRow = React.useCallback(
    (row: PressedMailNotification) => {
      const boundary = latestRef.current[latestRef.current.length - 1];
      const newestFirst = (a: PressedMailNotification, b: PressedMailNotification) =>
        isOlderThan(a, b) ? 1 : isOlderThan(b, a) ? -1 : 0;
      // Older than the newest page ends: it came from one of the pages below.
      const belowNewest = boundary !== undefined && isOlderThan(row, boundary);
      commitLoaded(
        belowNewest ? latestRef.current : [...latestRef.current, row].sort(newestFirst),
        belowNewest ? [...olderRef.current, row].sort(newestFirst) : olderRef.current,
      );
      if (!row.readAt) {
        setUnreadTotals((totals) => ({
          unreadCount: totals.unreadCount + 1,
          inboxUnreadCount:
            totals.inboxUnreadCount + (row.targetKind === "inbox_message" ? 1 : 0),
        }));
      }
    },
    [commitLoaded],
  );

  /** Tell the server about a dismissal that was not taken back. */
  const commitDismissal = React.useCallback(
    async (id: number, keepalive = false) => {
      const entry = pendingDismissals.current.get(id);
      if (!entry) return;
      window.clearTimeout(entry.timer);
      pendingDismissals.current.delete(id);
      try {
        // A row another tab already dismissed is a 404, which is not a failure.
        await postMutation(
          notificationDismissRouteApi,
          { id },
          __("Could not dismiss notification", "pressedmail"),
          keepalive,
        );
        await refresh(true);
      } catch {
        restoreRow(entry.row);
        toast.error(__("Could not dismiss notification", "pressedmail"));
      }
    },
    [postMutation, refresh, restoreRow],
  );

  const dismissWithUndo = React.useCallback(
    async (id: number) => {
      if (pendingDismissals.current.has(id)) return;
      const row = [...latestRef.current, ...olderRef.current].find(
        (item) => item.id === id,
      );
      // A row that is not on screen has nothing to take back.
      if (!row) {
        await dismiss(id);
        return;
      }
      // A poll already on its way predates this, and would bring the row back.
      latestRefresh.current += 1;
      pendingDismissals.current.set(id, {
        row,
        timer: window.setTimeout(
          () => void commitDismissal(id),
          DISMISS_UNDO_MS,
        ),
      });
      mapLoaded((rows) => rows.filter((item) => item.id !== id));
      if (!row.readAt) {
        setUnreadTotals((totals) => ({
          unreadCount: Math.max(0, totals.unreadCount - 1),
          inboxUnreadCount: Math.max(
            0,
            totals.inboxUnreadCount - (row.targetKind === "inbox_message" ? 1 : 0),
          ),
        }));
      }
    },
    [commitDismissal, dismiss, mapLoaded],
  );

  const undoDismiss = React.useCallback(
    (id: number) => {
      const entry = pendingDismissals.current.get(id);
      if (!entry) return false;
      window.clearTimeout(entry.timer);
      pendingDismissals.current.delete(id);
      restoreRow(entry.row);
      return true;
    },
    [restoreRow],
  );

  // A dismissal nobody took back is the reader's decision, so it is sent when the
  // page goes away rather than dropped with it.
  const commitAllRef = React.useRef<(keepalive: boolean) => void>(() => {});
  commitAllRef.current = (keepalive) => {
    for (const id of [...pendingDismissals.current.keys()]) {
      void commitDismissal(id, keepalive);
    }
  };
  React.useEffect(() => {
    const onPageHide = () => commitAllRef.current(true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      commitAllRef.current(false);
    };
  }, []);

  const clearAll = React.useCallback(async () => {
    await postMutation(
      notificationClearRouteApi,
      undefined,
      __("Could not clear notifications", "pressedmail"),
    );
    // Sticky notifications survive Clear all server-side; mirror that in the
    // optimistic update instead of blanking the list and flashing them back.
    // What is left fits the newest page, so paging starts over.
    commitLoaded(
      latestRef.current.filter((item) => !item.dismissable),
      [],
    );
    setOlderHasMore(null);
    await refresh(true);
  }, [commitLoaded, postMutation, refresh]);

  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible" && !followerFeedIsFresh()) {
        void refresh();
        // Pause and mute are set from other devices too, and this poll is the one
        // that runs in a tab that stays in view without being focused. A tab
        // following a leader does not poll, and re-reads them when it is focused.
        void revalidateRef.current();
      }
    }, 60_000);
    const removeRefresher = addRefresher(() => void refresh());
    return () => {
      removeRefresher();
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [refresh]);

  // Quiet hours mute interruptions, not the history panel you opened on purpose.
  // Filtering the stored list by them left the bell showing a count over an empty
  // panel, and kept mail hidden until the next 60s refresh after the window ended.
  // The live gate in inbox-alert-dispatch still honours quiet hours.
  const panelPreferences = React.useMemo(
    () => ({ ...preferences, notification_quiet_hours_enabled: false }),
    [preferences],
  );

  const loaded = React.useMemo(
    () => [...latest, ...older],
    [latest, older],
  );

  const passesAlertSettings = React.useCallback(
    (item: PressedMailNotification) => {
      if (item.targetKind !== "inbox_message") {
        return true;
      }
      const folder =
        typeof item.targetMetadata?.folder === "string"
          ? item.targetMetadata.folder
          : "INBOX";
      return shouldShowInboxAlert({
        preferences: panelPreferences,
        folder,
        unread: !item.readAt,
        priority: isPriorityInboxNotification(item, messages, singleAccountId),
      });
    },
    [messages, panelPreferences, singleAccountId],
  );

  // The alert settings decide what raises an alert, and by default they also
  // decided what the panel lists, so a stored row could be in the badge and
  // nowhere on screen. The panel now says how many it is holding back and lets
  // the reader list them.
  const hiddenCount = React.useMemo(
    () => loaded.filter((item) => !passesAlertSettings(item)).length,
    [loaded, passesAlertSettings],
  );

  // Read mail that nothing but "Unread only" holds back: it would show with that
  // switch off. Naming the switch is what lets the panel say what to change.
  const hiddenReadCount = React.useMemo(() => {
    if (!panelPreferences.notification_unread_only) return 0;
    const withUnreadOnlyOff = { ...panelPreferences, notification_unread_only: false };
    return loaded.filter(
      (item) =>
        item.targetKind === "inbox_message" &&
        Boolean(item.readAt) &&
        shouldShowInboxAlert({
          preferences: withUnreadOnlyOff,
          folder:
            typeof item.targetMetadata?.folder === "string"
              ? item.targetMetadata.folder
              : "INBOX",
          unread: false,
          priority: isPriorityInboxNotification(item, messages, singleAccountId),
        }),
    ).length;
  }, [loaded, messages, panelPreferences, singleAccountId]);

  // With several mailboxes, "New email from Ada" does not say whose inbox it is.
  const accountLabels = React.useMemo(
    () =>
      accounts.length > 1
        ? new Map(
            accounts.map((account) => [
              String(account.id),
              account.email?.toString() ?? "",
            ]),
          )
        : null,
    [accounts],
  );

  const visibleItems = React.useMemo(() => {
    return (showAll ? loaded : loaded.filter(passesAlertSettings)).map((item) => {
      const previewed = applyNotificationPreview(
        item,
        panelPreferences.notification_preview_level,
      );
      const accountLabel =
        item.accountId === null ? undefined : accountLabels?.get(String(item.accountId));
      return accountLabel ? { ...previewed, accountLabel } : previewed;
    });
  }, [accountLabels, loaded, panelPreferences, passesAlertSettings, showAll]);

  // Mail read in the inbox stops being news. The server retires its item in the
  // same request that records the read, wherever the read was made, so the feed
  // only has to be asked again once the inbox shows it. The ids are the key: a
  // reply that still holds them unread leaves it unchanged, and nothing loops.
  const readInInbox = React.useMemo(() => {
    const readMessages = new Set<string>();
    for (const message of messages) {
      const key =
        message.read === true
          ? messageKey(
              message.accountId ?? singleAccountId,
              message.folder,
              message.uid,
            )
          : null;
      if (key) readMessages.add(key);
    }
    if (readMessages.size === 0) return "";
    return loaded
      .filter((item) => {
        if (item.readAt || item.targetKind !== "inbox_message") return false;
        const metadata = item.targetMetadata ?? {};
        const key = messageKey(
          metadata.accountId ?? item.accountId,
          metadata.folder,
          metadata.uid,
        );
        return key !== null && readMessages.has(key);
      })
      .map((item) => item.id)
      .join(",");
  }, [loaded, messages, singleAccountId]);

  React.useEffect(() => {
    if (!readInInbox) return;
    const timer = window.setTimeout(() => {
      // The bell and the inbox both mount this hook and both see the read. One of
      // them asks, and every mount takes the answer.
      if (Date.now() - lastReadSettledAt < READ_SETTLE_MS) return;
      lastReadSettledAt = Date.now();
      void loadFeed(true);
      mountedRefreshers.forEach((refreshMount) => refreshMount());
    }, READ_SETTLE_MS);
    return () => window.clearTimeout(timer);
  }, [readInInbox]);

  const unreadCount = React.useMemo(() => {
    return resolveNotificationBadgeCount({
      mode: preferences.notification_badge_count_mode,
      unreadCount: unreadTotals.unreadCount,
      inboxUnreadCount: unreadTotals.inboxUnreadCount,
    });
  }, [preferences.notification_badge_count_mode, unreadTotals]);

  return {
    items: visibleItems,
    rawItems: latest,
    unreadCount,
    totalUnreadCount: unreadTotals.unreadCount,
    hiddenCount,
    hiddenReadCount,
    showAll,
    setShowAll,
    hasMore: olderHasMore ?? latestHasMore,
    isLoading,
    isLoadingMore,
    error,
    loadMoreError,
    refresh,
    startOver,
    loadMore,
    markRead,
    markAllRead,
    undoMarkAllRead,
    dismiss,
    dismissWithUndo,
    undoDismiss,
    clearAll,
  };
}
