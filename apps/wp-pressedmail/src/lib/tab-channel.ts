/**
 * Lets open PressedMail tabs share one set of background polls.
 *
 * The tab holding the sync-driver Web Lock (see `useSyncDriver`) is the leader. It keeps
 * polling and tells the other tabs what it saw over a BroadcastChannel. A follower whose
 * view the leader covers skips its own idle polls and refreshes only when told mail
 * changed. The channel is keyed per site and per WordPress user, so a principal switch in
 * one browser never mixes two people's tabs.
 *
 * Without BroadcastChannel or Web Locks nothing here changes behaviour: the channel stays
 * closed and every tab keeps polling on its own as before. Web Locks need a secure
 * context, so a plain-HTTP admin has BroadcastChannel but no locks. Every tab leads
 * there, and a live channel would only make each tab refresh on the others' changes on
 * top of its own polling.
 */

import {
  captureRequestPrincipal,
  type StoragePrincipal,
} from "./principal-storage";

/** Account ids a message is about. `all` means every account of this user. */
export type TabAccounts = number[] | "all";

export interface TabNotificationFeed {
  /** The newest page of the feed. Older pages are never relayed. */
  items: Record<string, unknown>[];
  unreadCount: number;
  inboxUnreadCount: number;
  /** Whether older rows sit behind the page, so a follower can offer them. */
  hasMore?: boolean;
  /** When the leader sent the GET behind this feed (ms since epoch). */
  requestedAt?: number;
}

export type TabMessage =
  | { type: "leader"; accounts: TabAccounts; folder: string | null }
  | { type: "resign" }
  | { type: "hello" }
  /**
   * `action` marks a user's own change, as opposed to one a poll found.
   * `relayed` marks one sent beside a `folders` message, for tabs on an older
   * build that cannot read `folders`; current tabs ignore it.
   */
  | {
      type: "mail-changed";
      accounts: TabAccounts;
      action?: true;
      relayed?: true;
    }
  | { type: "notifications"; feed: TabNotificationFeed }
  /**
   * A few flat preference values the user just saved in another tab. The store
   * in this tab loads preferences once, so without this a pause set in one tab
   * would not reach a second tab until it reloaded.
   */
  | { type: "preferences"; values: Record<string, boolean | number> }
  /**
   * The folder list the leader just loaded for its view: one account id, or the
   * account ids of a combined view. `folders` is what FolderService stores,
   * `virtualCounts` its per-account Important/Starred counts, and `loadedFrom`
   * when the leader's request for them started.
   */
  | {
      type: "folders";
      scope: number | number[];
      folders: object[];
      virtualCounts: Record<string, unknown>;
      loadedFrom: number;
    }
  /**
   * The process-queue store state the leader's poller just fetched, and when that
   * request started. The queue is per user, so it covers every tab on the channel.
   */
  | {
      type: "queue";
      state: {
        tasks: object[];
        loading: boolean;
        error: string | null;
      };
      requestedAt: number;
    }
  | {
      type: "nonce";
      nonce: string;
      principal: { site: string; userId: number };
    };

/**
 * A leader announcement older than this no longer counts. The leader re-announces on
 * every sync tick (45 s at most when idle), so this only expires when a leader vanished
 * without the lock passing to this tab.
 */
export const LEADER_FRESH_MS = 120_000;
/** A feed page is 100 rows at most; anything larger is not a feed. */
const MAX_FEED_ITEMS = 100;
/** A relay carries the handful of values one save changed, never a whole profile. */
const MAX_PREFERENCE_VALUES = 8;
const MAX_ACCOUNTS = 1000;
const MAX_FOLDER_LENGTH = 1000;
/** A folder list bigger than this is not relayed; followers then refresh on their own. */
const MAX_FOLDERS_BYTES = 512_000;
const MAX_FOLDER_NODES = 5000;
const MAX_FOLDER_DEPTH = 32;
/** A queue bigger than this is not relayed; followers then poll on their own. */
const MAX_QUEUE_TASKS = 2000;
const MAX_QUEUE_BYTES = 512_000;

const tabId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

/** undefined: not tried yet (or no principal yet). null: unavailable for this page. */
let channel: BroadcastChannel | null | undefined;
let channelPrincipal: StoragePrincipal | null = null;
const handlers = new Set<(message: TabMessage) => void>();

function hasWebLocks(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.locks);
}

let leader = !hasWebLocks();
const leadershipListeners = new Set<() => void>();
let view: { accounts: number[]; folder: string } | null = null;
let lastLeader: {
  accounts: TabAccounts;
  folder: string | null;
  at: number;
} | null = null;

function isAccountId(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0;
}

function parseAccounts(value: unknown): TabAccounts | null {
  if (value === "all") return "all";
  if (
    Array.isArray(value) &&
    value.length <= MAX_ACCOUNTS &&
    value.every(isAccountId)
  ) {
    return value as number[];
  }
  return null;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isFeedItem(value: unknown): value is Record<string, unknown> {
  return (
    isPlainObject(value) &&
    typeof value.id === "number" &&
    typeof value.type === "string" &&
    typeof value.title === "string" &&
    typeof value.summary === "string" &&
    typeof value.targetKind === "string" &&
    typeof value.createdAt === "string" &&
    (value.readAt === null || typeof value.readAt === "string") &&
    // PHP encodes empty metadata as [], so any object shape passes here.
    typeof value.targetMetadata === "object" &&
    value.targetMetadata !== null
  );
}

/** Every node names a path; counts and children, when present, have their types. */
function isFolderTree(value: unknown): value is Record<string, unknown>[] {
  let nodes = 0;
  const walk = (list: unknown, depth: number): boolean =>
    Array.isArray(list) &&
    depth <= MAX_FOLDER_DEPTH &&
    list.every(
      (folder) =>
        ++nodes <= MAX_FOLDER_NODES &&
        isPlainObject(folder) &&
        typeof folder.path === "string" &&
        typeof folder.name === "string" &&
        (folder.count === undefined || typeof folder.count === "number") &&
        (folder.unseen === undefined || typeof folder.unseen === "number") &&
        (folder.children === undefined || walk(folder.children, depth + 1)),
    );
  return walk(value, 0);
}

function isQueueTask(value: unknown): value is Record<string, unknown> {
  return (
    isPlainObject(value) &&
    isAccountId(value.id) &&
    typeof value.kind === "string" &&
    typeof value.status === "string" &&
    typeof value.progress_current === "number" &&
    typeof value.progress_total === "number" &&
    typeof value.cancel_requested === "boolean" &&
    (value.label === null || typeof value.label === "string")
  );
}

function jsonSize(value: unknown): number {
  try {
    return JSON.stringify(value).length;
  } catch {
    return Infinity;
  }
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/** Shape-check everything that arrives; anything malformed is dropped. */
export function parseTabMessage(raw: unknown): TabMessage | null {
  if (!isPlainObject(raw)) return null;
  switch (raw.type) {
    case "hello":
    case "resign":
      return { type: raw.type };
    case "leader": {
      const accounts = parseAccounts(raw.accounts);
      // A leader without a folder (an older tab) still counts as a leader for the
      // feed and heartbeat, but covers no folder view.
      const folder =
        typeof raw.folder === "string" &&
        raw.folder.length > 0 &&
        raw.folder.length <= MAX_FOLDER_LENGTH
          ? raw.folder
          : null;
      return accounts ? { type: "leader", accounts, folder } : null;
    }
    case "mail-changed": {
      const accounts = parseAccounts(raw.accounts);
      if (!accounts) return null;
      return {
        type: raw.type,
        accounts,
        ...(raw.action === true ? { action: true as const } : {}),
        ...(raw.relayed === true ? { relayed: true as const } : {}),
      };
    }
    case "notifications": {
      const feed = raw.feed;
      if (
        !isPlainObject(feed) ||
        !Array.isArray(feed.items) ||
        feed.items.length > MAX_FEED_ITEMS ||
        !feed.items.every(isFeedItem) ||
        !isCount(feed.unreadCount) ||
        !isCount(feed.inboxUnreadCount)
      ) {
        return null;
      }
      return {
        type: "notifications",
        feed: {
          items: feed.items,
          unreadCount: feed.unreadCount,
          inboxUnreadCount: feed.inboxUnreadCount,
          ...(feed.hasMore === true ? { hasMore: true } : {}),
          ...(typeof feed.requestedAt === "number" &&
          Number.isFinite(feed.requestedAt)
            ? { requestedAt: feed.requestedAt }
            : {}),
        },
      };
    }
    case "preferences": {
      const entries = isPlainObject(raw.values) ? Object.entries(raw.values) : [];
      if (
        entries.length === 0 ||
        entries.length > MAX_PREFERENCE_VALUES ||
        !entries.every(
          ([key, value]) =>
            key.length <= 64 &&
            (typeof value === "boolean" ||
              (typeof value === "number" && Number.isSafeInteger(value))),
        )
      ) {
        return null;
      }
      return {
        type: "preferences",
        values: Object.fromEntries(entries) as Record<string, boolean | number>,
      };
    }
    case "folders": {
      const { scope, folders, virtualCounts, loadedFrom } = raw;
      const validScope = isAccountId(scope)
        ? scope
        : Array.isArray(scope) && scope.length > 0
          ? parseAccounts(scope)
          : null;
      if (
        validScope === null ||
        validScope === "all" ||
        !isFolderTree(folders) ||
        !isPlainObject(virtualCounts) ||
        !isCount(loadedFrom) ||
        jsonSize(folders) + jsonSize(virtualCounts) > MAX_FOLDERS_BYTES
      ) {
        return null;
      }
      return {
        type: "folders",
        scope: validScope,
        folders,
        virtualCounts,
        loadedFrom,
      };
    }
    case "queue": {
      const { state, requestedAt } = raw;
      if (
        !isPlainObject(state) ||
        !Array.isArray(state.tasks) ||
        state.tasks.length > MAX_QUEUE_TASKS ||
        !state.tasks.every(isQueueTask) ||
        typeof state.loading !== "boolean" ||
        !(state.error === null || typeof state.error === "string") ||
        !isCount(requestedAt) ||
        jsonSize(state) > MAX_QUEUE_BYTES
      ) {
        return null;
      }
      return {
        type: "queue",
        state: {
          tasks: state.tasks,
          loading: state.loading,
          error: state.error,
        },
        requestedAt,
      };
    }
    case "nonce": {
      const { nonce, principal } = raw;
      if (
        typeof nonce !== "string" ||
        nonce.length === 0 ||
        nonce.length > 64 ||
        !isPlainObject(principal) ||
        typeof principal.site !== "string" ||
        typeof principal.userId !== "number"
      ) {
        return null;
      }
      return {
        type: "nonce",
        nonce,
        principal: { site: principal.site, userId: principal.userId },
      };
    }
    default:
      return null;
  }
}

function receive(data: unknown): void {
  if (
    !isPlainObject(data) ||
    typeof data.from !== "string" ||
    data.from === tabId
  ) {
    return;
  }
  // The signed-in user changed under this tab: stop listening to the old channel.
  if (captureRequestPrincipal() !== channelPrincipal) {
    closeChannel();
    return;
  }
  const message = parseTabMessage(data.message);
  if (!message) return;
  if (message.type === "leader") {
    lastLeader = {
      accounts: message.accounts,
      folder: message.folder,
      at: Date.now(),
    };
  }
  if (message.type === "resign") {
    lastLeader = null;
  }
  if (message.type === "hello" && leader) {
    announceLeader();
  }
  handlers.forEach((handler) => handler(message));
}

function closeChannel(): void {
  try {
    channel?.close();
  } catch {
    // Already closed.
  }
  channel = null;
  lastLeader = null;
}

function getChannel(): BroadcastChannel | null {
  if (channel !== undefined) {
    if (channel && captureRequestPrincipal() !== channelPrincipal) {
      closeChannel();
    }
    return channel;
  }
  if (typeof BroadcastChannel !== "function" || !hasWebLocks()) {
    channel = null;
    return null;
  }
  const principal = captureRequestPrincipal();
  if (!principal) return null; // Try again once the bootstrap principal exists.
  try {
    channel = new BroadcastChannel(
      `pressedmail-tabs:${principal.site}:${principal.userId}`,
    );
  } catch {
    channel = null;
    return null;
  }
  channelPrincipal = principal;
  channel.onmessage = (event: MessageEvent) => receive(event.data);
  // Ask a leader, if there is one, to say so now instead of on its next tick.
  post({ type: "hello" });
  return channel;
}

function post(message: TabMessage): void {
  try {
    getChannel()?.postMessage({ from: tabId, message });
  } catch {
    // A closed channel or an uncloneable payload must never break the caller.
  }
}

/** Send a message to the other tabs of this user. No-op without BroadcastChannel. */
export function publishTabMessage(message: TabMessage): void {
  post(message);
}

let localActionAt = 0;

/**
 * Note that the user just started changing mail in this tab. A folder list another
 * tab loaded before this moment predates the change, so this tab ignores it.
 */
export function markLocalAction(): void {
  localActionAt = Date.now();
}

/** When the user last started changing mail in this tab (0 if never). */
export function lastLocalActionAt(): number {
  return localActionAt;
}

/** Listen for validated messages from the other tabs. Returns the unsubscribe. */
export function subscribeTabMessages(
  handler: (message: TabMessage) => void,
): () => void {
  handlers.add(handler);
  getChannel();
  return () => {
    handlers.delete(handler);
  };
}

/** Whether this tab holds the sync-driver lock (every tab does without Web Locks). */
export function isTabLeader(): boolean {
  return leader;
}

export function subscribeLeadership(listener: () => void): () => void {
  leadershipListeners.add(listener);
  return () => {
    leadershipListeners.delete(listener);
  };
}

/** Owned by `useSyncDriver`, which holds the lock. */
export function setTabLeader(next: boolean): void {
  if (leader === next) return;
  leader = next;
  // A new leader announces what it covers. A leader stepping down says so, and
  // followers resume their own polling now instead of after the freshness window.
  post(next ? leaderMessage() : { type: "resign" });
  leadershipListeners.forEach((listener) => listener());
}

function leaderMessage(): TabMessage {
  return {
    type: "leader",
    accounts: view?.accounts ?? [],
    folder: view?.folder ?? null,
  };
}

/** Re-announce while leading; doubles as the leader's keep-alive. */
export function announceLeader(): void {
  if (leader) post(leaderMessage());
}

/**
 * The accounts and the folder this tab's inbox polls, or null accounts when no inbox
 * is mounted. The leader only diffs its own folder, so coverage is per folder too.
 */
export function setTabView(accounts: number[] | null, folder: string): void {
  view =
    accounts && accounts.length > 0
      ? { accounts: [...accounts], folder }
      : null;
  getChannel();
  announceLeader();
}

function leaderIsFresh(): boolean {
  return (
    !leader &&
    lastLeader !== null &&
    Date.now() - lastLeader.at < LEADER_FRESH_MS
  );
}

/** A live leader exists in another tab (account independent: feed, heartbeat). */
export function isFollowingLeader(): boolean {
  return leaderIsFresh();
}

/** A live leader in another tab polls `folder` of every account in `accounts`. */
export function isCoveredByLeader(
  accounts: number[] | null,
  folder: string,
): boolean {
  if (!leaderIsFresh() || !lastLeader || !accounts || accounts.length === 0) {
    return false;
  }
  if (lastLeader.folder !== folder) return false;
  const covered = lastLeader.accounts;
  return covered === "all" || accounts.every((id) => covered.includes(id));
}

/** Whether the leader polls the view this tab last reported through `setTabView`. */
export function isOwnViewCoveredByLeader(): boolean {
  return view !== null && isCoveredByLeader(view.accounts, view.folder);
}

/** Whether a `mail-changed` scope touches any of `accounts`. */
export function touchesAccounts(
  changed: TabAccounts,
  accounts: number[] | null,
): boolean {
  if (!accounts || accounts.length === 0) return false;
  return changed === "all" || accounts.some((id) => changed.includes(id));
}
