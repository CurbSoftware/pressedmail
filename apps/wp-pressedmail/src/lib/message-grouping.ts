/**
 * Inbox message-grouping adapter.
 *
 * Pure, no-mutation transform shared by all three inbox list renderers
 * (default/PressedM, PressedG, PressedOut). Given the messages currently loaded
 * and the user's `email_list_grouping` preference, it returns either the flat
 * list (identity passthrough) or an expanded conversation list whose related
 * rows remain adjacent.
 *
 * Rows are the ORIGINAL message references (never copies), so selection / star
 * / move keep resolving to the same logical message. The badge count is a
 * view-only concern looked up by `getMessageIdentityKey`.
 */

import type { EmailMessage, EmailThreadGroupMap } from "@/types";
import { getMessageIdentityKey } from "@/lib/message-identity";
import { getThreadingService } from "@/services/implementations/threading.service";

export type EmailListGroupingMode = "list" | "threads";

export interface ThreadMeta {
  /** Total messages in the thread (including the representative). */
  count: number;
  /** Unread messages in the thread. */
  unreadCount: number;
  /** Ids of every message in the thread. */
  messageIds: Array<string | number>;
  /** The grouping thread id. */
  threadId: string;
  /** Whether this row belongs to a conversation with multiple messages. */
  isThreaded: boolean;
  /** Whether this row is the newest message and should display the count. */
  isNewest: boolean;
}

export interface GroupedMessages {
  /** Rows to render: original message refs ordered for the selected mode. */
  items: EmailMessage[];
  /** Per-thread metadata keyed by each row's `getMessageIdentityKey`. */
  meta: Map<string, ThreadMeta>;
}

function hasServerThreadMetadata(message: EmailMessage): boolean {
  return (
    typeof message.threadId === "string" &&
    message.threadId.length > 0 &&
    typeof message.threadCount === "number" &&
    message.threadCount > 0
  );
}

function getMessageTime(message: EmailMessage): number {
  const timestamp = Date.parse(message.receivedDate ?? message.date ?? "");
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMessageIds(messages: EmailMessage[]): Array<string | number> {
  return messages.map((message) => message.id);
}

function sortNewestFirst(messages: EmailMessage[]): EmailMessage[] {
  return [...messages].sort((a, b) => getMessageTime(b) - getMessageTime(a));
}

function dedupeThreadMessages(
  messages: EmailMessage[],
  representative: EmailMessage,
): EmailMessage[] {
  const byIdentity = new Map<string, EmailMessage>();

  for (const message of messages) {
    byIdentity.set(getMessageIdentityKey(message), message);
  }

  byIdentity.set(getMessageIdentityKey(representative), representative);

  return sortNewestFirst([...byIdentity.values()]);
}

function buildThreadMeta(
  threadMessages: EmailMessage[],
  threadId: string,
  representative?: EmailMessage,
): Omit<ThreadMeta, "isThreaded" | "isNewest"> {
  const count =
    typeof representative?.threadCount === "number" &&
    representative.threadCount > 0
      ? representative.threadCount
      : threadMessages.length;
  const unreadCount =
    typeof representative?.threadUnreadCount === "number"
      ? representative.threadUnreadCount
      : threadMessages.filter((message) => !message.read).length;
  const messageIds = Array.isArray(representative?.threadMessageIds)
    ? representative.threadMessageIds
    : getMessageIds(threadMessages);

  return {
    count,
    unreadCount,
    messageIds,
    threadId,
  };
}

/**
 * The full actionable candidate set for a view: the loaded messages PLUS the
 * thread-child rows served via threadGroups. Thread children are RENDERED
 * (each with its own checkbox) but live only in the group map, selection and
 * bulk pipelines that filtered the loaded list alone silently dropped them
 * from every operation.
 */
export function mergeThreadCandidates(
  messages: EmailMessage[],
  threadGroups?: EmailThreadGroupMap,
): EmailMessage[] {
  if (!threadGroups) return messages;
  const groupRows = Object.values(threadGroups).flat();
  if (groupRows.length === 0) return messages;

  const seen = new Set(
    messages.map((message) => String(getMessageIdentityKey(message))),
  );
  const extras: EmailMessage[] = [];
  for (const row of groupRows) {
    const key = String(getMessageIdentityKey(row));
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    extras.push(row);
  }

  return extras.length > 0 ? [...messages, ...extras] : messages;
}

/**
 * Group the loaded messages for display according to the grouping mode.
 */
export function groupMessagesForDisplay(
  messages: EmailMessage[] | null | undefined,
  mode: EmailListGroupingMode,
  threadGroups?: EmailThreadGroupMap,
): GroupedMessages {
  const safeMessages = messages ?? [];

  if (mode !== "threads" || safeMessages.length === 0) {
    return { items: safeMessages, meta: new Map() };
  }

  if (safeMessages.some(hasServerThreadMetadata)) {
    const items: EmailMessage[] = [];
    const meta = new Map<string, ThreadMeta>();
    const renderedThreadIds = new Set<string>();

    for (const message of safeMessages) {
      const threadId =
        typeof message.threadId === "string" && message.threadId.length > 0
          ? message.threadId
          : "";

      if (!threadId || renderedThreadIds.has(threadId)) {
        if (!threadId) {
          items.push(message);
          meta.set(getMessageIdentityKey(message), {
            ...buildThreadMeta([message], getMessageIdentityKey(message)),
            isThreaded: false,
            isNewest: true,
          });
        }
        continue;
      }

      renderedThreadIds.add(threadId);

      const threadMessages = dedupeThreadMessages(
        threadGroups?.[threadId] ?? [message],
        message,
      );

      const threadMeta = buildThreadMeta(threadMessages, threadId, message);
      const isThreaded = threadMeta.count > 1;

      threadMessages.forEach((threadMessage, index) => {
        items.push(threadMessage);
        meta.set(getMessageIdentityKey(threadMessage), {
          ...threadMeta,
          isThreaded,
          isNewest: index === 0,
        });
      });
    }

    // Safety net: a loaded message whose thread was rendered from a
    // threadGroups payload that does NOT include it would vanish from the
    // list while remaining selectable, append it instead of dropping it.
    for (const message of safeMessages) {
      const key = getMessageIdentityKey(message);
      if (!meta.has(key)) {
        items.push(message);
        meta.set(key, {
          ...buildThreadMeta([message], key),
          isThreaded: false,
          isNewest: true,
        });
      }
    }

    return { items, meta };
  }

  const threads = getThreadingService().groupByThread(safeMessages, {
    sortOrder: "newest-first",
  });

  const items: EmailMessage[] = [];
  const meta = new Map<string, ThreadMeta>();

  for (const thread of threads) {
    const threadMessages = sortNewestFirst(thread.messages);
    if (threadMessages.length === 0) {
      continue;
    }

    const threadMeta = {
      count: thread.messageCount,
      unreadCount: thread.unreadCount,
      messageIds: thread.messages.map((m) => m.id),
      threadId: thread.id,
      isThreaded: thread.messageCount > 1,
    };

    threadMessages.forEach((threadMessage, index) => {
      items.push(threadMessage);
      meta.set(getMessageIdentityKey(threadMessage), {
        ...threadMeta,
        isNewest: index === 0,
      });
    });
  }

  return { items, meta };
}
