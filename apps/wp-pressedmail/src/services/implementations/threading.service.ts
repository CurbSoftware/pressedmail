/**
 * Threading Service Implementation
 *
 * Email thread grouping and management.
 * Ports logic from PHP ThreadingService with TypeScript improvements.
 *
 * @since 2.0.0
 */

import type { EmailMessage, EmailThread } from "@/types";
import { parseEmailDate } from "@/lib/email-date";
import type {
  IThreadingService,
  ThreadGroupingOptions,
  ThreadExpansionResult,
  ThreadNode,
} from "../interfaces";

/**
 * Default grouping options.
 */
const DEFAULT_GROUPING_OPTIONS: Required<ThreadGroupingOptions> = {
  sortOrder: "oldest-first",
  maxDepth: 50,
  includeSingletons: true,
};

/**
 * Reply/forward prefixes to remove from subjects (case-insensitive).
 * Covers common prefixes in multiple languages.
 */
const SUBJECT_PREFIXES = [
  /^(re|fwd|fw|aw|sv|vs|antw|rif|r|odp|ynt|atb|res|enc):\s*/i,
  /^\[.*?\]\s*/, // [List-Name] prefixes
];

const REPLY_SUBJECT_PREFIX =
  /^(re|fwd|fw|aw|sv|vs|antw|rif|r|odp|ynt|atb|res|enc):\s*/i;
const FALLBACK_THREAD_WINDOW_MS = 90 * 24 * 60 * 60 * 1000;

function getMessageTime(message: EmailMessage): number {
  return parseEmailDate(message.receivedDate ?? message.date)?.getTime() ?? 0;
}

function getMessageDateValue(message: EmailMessage): string {
  return message.receivedDate ?? message.date ?? "";
}

interface FallbackThreadInfo {
  id: string;
  subject: string;
  accountScope: string;
  participants: Set<string>;
  earliest: number;
  latest: number;
  hasReplySubject: boolean;
}

/**
 * Threading Service Implementation
 *
 * Implements IThreadingService for email thread grouping.
 */
export class ThreadingService implements IThreadingService {
  private _expandedThreads = new Set<string>();
  private threadCache = new Map<string, EmailMessage[]>();

  // ============== State Accessors ==============

  get expandedThreads(): Set<string> {
    return this._expandedThreads;
  }

  // ============== Thread Grouping ==============

  groupByThread(
    messages: EmailMessage[],
    options?: ThreadGroupingOptions,
  ): EmailThread[] {
    if (!messages.length) {
      return [];
    }

    const opts = { ...DEFAULT_GROUPING_OPTIONS, ...options };

    // Index messages by ACCOUNT-SCOPED Message-ID: in the combined inbox the
    // same Message-ID legitimately exists once per receiving account (a mail
    // delivered to two of the user's addresses). An unscoped index dropped the
    // second account's copy entirely and merged unrelated accounts' threads.
    const messageIndex = new Map<string, EmailMessage>();
    for (const msg of messages) {
      const messageId = this.normalizeMessageId(msg.messageId);
      if (messageId) {
        messageIndex.set(this.accountScopedThreadKey(msg, messageId), msg);
      }
    }

    // Build thread groupings
    const threads = new Map<string, EmailThread>();
    const processedIds = new Set<string>();

    for (const msg of messages) {
      const messageId = this.normalizeMessageId(msg.messageId);
      const scopedId = messageId
        ? this.accountScopedThreadKey(msg, messageId)
        : null;

      // Skip if already processed
      if (scopedId && processedIds.has(scopedId)) {
        continue;
      }

      const storedThreadId =
        typeof msg.threadId === "string" && msg.threadId.trim()
          ? msg.threadId.trim()
          : null;

      // Find the thread root for this message
      const threadRoot = this.findThreadRoot(msg, messageIndex, opts.maxDepth);
      const threadId = storedThreadId ?? threadRoot ?? this.generateThreadId(msg);

      // Create thread if it doesn't exist
      if (!threads.has(threadId)) {
        threads.set(threadId, {
          id: threadId,
          subject: this.normalizeSubject(msg.subject ?? ""),
          participants: [],
          messages: [],
          latestDate: "",
          earliestDate: "",
          unreadCount: 0,
          hasAttachments: false,
          labels: [],
          messageCount: 0,
          preview: "",
          latestSender: "",
        });
      }

      const thread = threads.get(threadId)!;

      // Add message to thread
      thread.messages.push(msg);

      // Update thread metadata
      const msgDate = getMessageTime(msg);
      const latestDate = thread.latestDate
        ? (parseEmailDate(thread.latestDate)?.getTime() ?? 0)
        : 0;
      const earliestDate = thread.earliestDate
        ? (parseEmailDate(thread.earliestDate)?.getTime() ?? Infinity)
        : Infinity;

      if (!thread.latestDate || msgDate > latestDate) {
        thread.latestDate = getMessageDateValue(msg);
      }
      if (!thread.earliestDate || msgDate < earliestDate) {
        thread.earliestDate = getMessageDateValue(msg);
      }

      // Track participants
      const from = msg.from ?? msg.email ?? "";
      if (from && !thread.participants.includes(from)) {
        thread.participants.push(from);
      }

      // Track unread count
      if (!msg.read) {
        thread.unreadCount++;
      }

      // Track attachments
      if (msg.hasAttachments || msg.attachments?.length) {
        thread.hasAttachments = true;
      }

      // Merge labels
      if (Array.isArray(msg.labels)) {
        for (const label of msg.labels) {
          if (!thread.labels.includes(label)) {
            thread.labels.push(label);
          }
        }
      }

      // Mark as processed
      if (scopedId) {
        processedIds.add(scopedId);
      }
    }

    const mergedThreads = this.mergeFallbackThreads(threads);

    // Process each thread
    const result: EmailThread[] = [];

    for (const thread of mergedThreads.values()) {
      // Filter out singletons if configured
      if (!opts.includeSingletons && thread.messages.length === 1) {
        continue;
      }

      this.refreshThreadMetadata(thread);

      // Sort messages within thread
      thread.messages.sort((a, b) => {
        const dateA = getMessageTime(a);
        const dateB = getMessageTime(b);
        return opts.sortOrder === "oldest-first"
          ? dateA - dateB
          : dateB - dateA;
      });

      // Set message count
      thread.messageCount = thread.messages.length;

      // Get the latest message for preview
      const latestMsg =
        opts.sortOrder === "oldest-first"
          ? thread.messages[thread.messages.length - 1]
          : thread.messages[0];

      thread.preview = latestMsg?.snippet ?? latestMsg?.preview ?? "";
      thread.latestSender = latestMsg?.from ?? latestMsg?.name ?? "";

      // Cache thread messages for later retrieval
      this.threadCache.set(thread.id, [...thread.messages]);

      result.push(thread);
    }

    // Sort threads by latest date (newest first)
    result.sort((a, b) => {
      const dateA = parseEmailDate(a.latestDate)?.getTime() ?? 0;
      const dateB = parseEmailDate(b.latestDate)?.getTime() ?? 0;
      return dateB - dateA;
    });

    return result;
  }

  buildThreadTree(messages: EmailMessage[]): ThreadNode {
    if (!messages.length) {
      throw new Error("Cannot build thread tree from empty messages array");
    }

    // Index messages by Message-ID
    const messageIndex = new Map<string, EmailMessage>();
    for (const msg of messages) {
      const messageId = this.normalizeMessageId(msg.messageId);
      if (messageId) {
        messageIndex.set(messageId, msg);
      }
    }

    // Find parent-child relationships
    const childrenMap = new Map<string, EmailMessage[]>();
    const roots: EmailMessage[] = [];

    for (const msg of messages) {
      const inReplyTo = this.normalizeMessageId(msg.inReplyTo);

      if (inReplyTo && messageIndex.has(inReplyTo)) {
        // This message is a reply to another in the thread
        if (!childrenMap.has(inReplyTo)) {
          childrenMap.set(inReplyTo, []);
        }
        childrenMap.get(inReplyTo)!.push(msg);
      } else {
        // This is a root message (no parent in this set)
        roots.push(msg);
      }
    }

    // Build tree recursively
    const buildNode = (msg: EmailMessage, depth: number): ThreadNode => {
      const messageId = this.normalizeMessageId(msg.messageId);
      const children = messageId ? (childrenMap.get(messageId) ?? []) : [];

      // Sort children by date
      children.sort((a, b) => getMessageTime(a) - getMessageTime(b));

      return {
        message: msg,
        children: children.map((child) => buildNode(child, depth + 1)),
        depth,
        collapsed: false,
      };
    };

    // Sort roots by date
    roots.sort((a, b) => getMessageTime(a) - getMessageTime(b));

    // Ensure we have at least one root
    const firstRoot = roots[0];
    if (!firstRoot) {
      // This should not happen if messages is non-empty, but handle it
      throw new Error("Cannot build thread tree: no root messages found");
    }

    // Return the earliest root as the main root
    return buildNode(firstRoot, 0);
  }

  findThreadByMessage(
    messageId: string | number,
    threads: EmailThread[],
  ): EmailThread | undefined {
    for (const thread of threads) {
      for (const msg of thread.messages) {
        const msgId = msg.id ?? msg.uid;
        if (msgId === messageId || String(msgId) === String(messageId)) {
          return thread;
        }
      }
    }
    return undefined;
  }

  getThreadMessages(threadId: string): EmailMessage[] {
    return this.threadCache.get(threadId) ?? [];
  }

  // ============== Thread Expansion ==============

  async expandThread(threadId: string): Promise<ThreadExpansionResult> {
    try {
      this._expandedThreads.add(threadId);
      const messages = this.threadCache.get(threadId) ?? [];

      return {
        success: true,
        messages,
      };
    } catch (error) {
      return {
        success: false,
        messages: [],
        error:
          error instanceof Error ? error.message : "Failed to expand thread",
      };
    }
  }

  collapseThread(threadId: string): void {
    this._expandedThreads.delete(threadId);
  }

  async toggleThreadExpansion(threadId: string): Promise<boolean> {
    if (this._expandedThreads.has(threadId)) {
      this.collapseThread(threadId);
      return false;
    } else {
      await this.expandThread(threadId);
      return true;
    }
  }

  isThreadExpanded(threadId: string): boolean {
    return this._expandedThreads.has(threadId);
  }

  expandAll(): void {
    for (const threadId of this.threadCache.keys()) {
      this._expandedThreads.add(threadId);
    }
  }

  collapseAll(): void {
    this._expandedThreads.clear();
  }

  // ============== Thread Utilities ==============

  normalizeSubject(subject: string): string {
    if (!subject) {
      return "";
    }

    let normalized = subject;
    let prev = "";

    // Keep removing prefixes until no change
    while (normalized !== prev) {
      prev = normalized;
      for (const pattern of SUBJECT_PREFIXES) {
        normalized = normalized.replace(pattern, "");
      }
      normalized = normalized.trim();
    }

    // Normalize whitespace and lowercase
    normalized = normalized.replace(/\s+/g, " ").toLowerCase().trim();

    return normalized;
  }

  parseReferences(references: unknown): string[] {
    if (!references) {
      return [];
    }

    if (Array.isArray(references)) {
      return references.flatMap((reference) => this.parseReferences(reference));
    }

    if (typeof references !== "string") {
      return [];
    }

    // References are space-separated message IDs in angle brackets
    const matches = references.match(/<([^>]+)>/g);
    if (!matches) {
      return [];
    }

    return matches
      .map((match) => this.normalizeMessageId(match))
      .filter((id): id is string => id !== null);
  }

  generateThreadId(message: EmailMessage): string {
    const subject = this.normalizeSubject(message.subject ?? "");
    const from = message.from ?? message.email ?? "";

    // Extract domain from email
    const domainMatch = from.match(/@([^>]+)/);
    const domain = domainMatch?.[1]?.toLowerCase() ?? "";

    // Use date window (year + month) to avoid grouping very old messages
    let dateWindow = "";
    if (message.receivedDate || message.date) {
      const date = parseEmailDate(message.receivedDate ?? message.date);
      if (date) {
        dateWindow = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
    }

    // Create hash for thread ID. The account scope keeps two accounts'
    // copies of the same newsletter from collapsing into one conversation
    // in the combined inbox.
    const accountScope =
      message.accountId !== undefined && message.accountId !== null
        ? String(message.accountId)
        : "";
    const input = `${subject}|${domain}|${dateWindow}|${accountScope}`;
    return `gen_${this.simpleHash(input)}`;
  }

  getThreadStats(thread: EmailThread): {
    messageCount: number;
    unreadCount: number;
    participantCount: number;
    hasAttachments: boolean;
    dateRange: { start: Date; end: Date };
  } {
    return {
      messageCount: thread.messageCount,
      unreadCount: thread.unreadCount,
      participantCount: thread.participants.length,
      hasAttachments: thread.hasAttachments,
      dateRange: {
        start: parseEmailDate(thread.earliestDate) ?? new Date(0),
        end: parseEmailDate(thread.latestDate) ?? new Date(0),
      },
    };
  }

  // ============== Private Helpers ==============

  /**
   * Normalizes a Message-ID by removing angle brackets and whitespace.
   */
  private normalizeMessageId(messageId?: string | null): string | null {
    if (!messageId) {
      return null;
    }

    // Remove angle brackets and trim whitespace
    let normalized = messageId.trim();
    normalized = normalized.replace(/^<|>$/g, "");
    normalized = normalized.trim();

    return normalized || null;
  }

  /**
   * Finds the root message ID for a thread.
   * Walks up the In-Reply-To and References chain to find the original message.
   */
  private findThreadRoot(
    message: EmailMessage,
    messageIndex: Map<string, EmailMessage>,
    maxDepth: number,
  ): string | null {
    const visited = new Set<string>();
    let current = message;
    let depth = 0;

    while (depth < maxDepth) {
      const currentId = this.normalizeMessageId(current.messageId);

      // Prevent infinite loops
      if (currentId && visited.has(currentId)) {
        break;
      }
      if (currentId) {
        visited.add(currentId);
      }

      // Check In-Reply-To first (direct parent). Lookups and returned thread
      // roots are account-scoped: a reply chain never crosses accounts, and an
      // unscoped root merged two accounts' copies of the same conversation.
      const inReplyTo = this.normalizeMessageId(current.inReplyTo);
      if (
        inReplyTo &&
        messageIndex.has(this.accountScopedThreadKey(current, inReplyTo))
      ) {
        current = messageIndex.get(
          this.accountScopedThreadKey(current, inReplyTo),
        )!;
        depth++;
        continue;
      }

      // Check References (list of ancestor message IDs)
      if (current.references) {
        const refIds = this.parseReferences(current.references);
        // The first reference is typically the thread root
        const firstRef = refIds[0];
        if (firstRef) {
          // Even if we don't have the message, use the reference as thread ID.
          return this.accountScopedThreadKey(current, firstRef);
        }
      }

      // No more parents found - this is the root
      break;
    }

    // Return the current message's ID as the thread root
    const rootId = this.normalizeMessageId(current.messageId);
    return rootId ? this.accountScopedThreadKey(current, rootId) : null;
  }

  /** Account-scoped identity for client-side thread keys and indexes. */
  private accountScopedThreadKey(message: EmailMessage, id: string): string {
    const scope =
      message.accountId !== undefined &&
      message.accountId !== null &&
      String(message.accountId) !== ""
        ? String(message.accountId)
        : "";
    return scope ? `${scope}|${id}` : id;
  }

  private mergeFallbackThreads(
    threads: Map<string, EmailThread>,
  ): Map<string, EmailThread> {
    const infos = Array.from(threads.values())
      .map((thread): FallbackThreadInfo | null =>
        this.getFallbackThreadInfo(thread),
      )
      .filter((info): info is FallbackThreadInfo => info !== null);

    if (infos.length < 2) {
      return threads;
    }

    const parent = new Map<string, string>();
    for (const info of infos) {
      parent.set(info.id, info.id);
    }

    const find = (id: string): string => {
      const current = parent.get(id) ?? id;
      if (current === id) {
        return id;
      }
      const root = find(current);
      parent.set(id, root);
      return root;
    };

    const union = (left: string, right: string) => {
      const leftRoot = find(left);
      const rightRoot = find(right);
      if (leftRoot !== rightRoot) {
        parent.set(rightRoot, leftRoot);
      }
    };

    for (let i = 0; i < infos.length; i++) {
      const left = infos[i];
      if (!left) continue;
      for (let j = i + 1; j < infos.length; j++) {
        const right = infos[j];
        if (!right) continue;
        if (this.shouldFallbackMerge(left, right)) {
          union(left.id, right.id);
        }
      }
    }

    const merged = new Map<string, EmailThread>();
    for (const thread of threads.values()) {
      const rootId = parent.has(thread.id) ? find(thread.id) : thread.id;
      const existing = merged.get(rootId);
      if (existing) {
        existing.messages.push(...thread.messages);
        continue;
      }

      merged.set(rootId, {
        ...thread,
        id: rootId,
        messages: [...thread.messages],
      });
    }

    return merged;
  }

  private shouldFallbackMerge(
    left: FallbackThreadInfo,
    right: FallbackThreadInfo,
  ): boolean {
    if (!left.subject || left.subject !== right.subject) {
      return false;
    }

    if (left.accountScope !== right.accountScope) {
      return false;
    }

    if (!left.hasReplySubject && !right.hasReplySubject) {
      return false;
    }

    if (!this.hasParticipantOverlap(left.participants, right.participants)) {
      return false;
    }

    return (
      Math.abs(left.earliest - right.latest) <= FALLBACK_THREAD_WINDOW_MS ||
      Math.abs(right.earliest - left.latest) <= FALLBACK_THREAD_WINDOW_MS
    );
  }

  private getFallbackThreadInfo(
    thread: EmailThread,
  ): FallbackThreadInfo | null {
    const firstMessage = thread.messages[0];
    const subject = this.normalizeSubject(firstMessage?.subject ?? "");
    const participants = new Set<string>();
    let earliest = Infinity;
    let latest = 0;
    let hasReplySubject = false;

    for (const message of thread.messages) {
      for (const participant of this.extractParticipantKeys(message)) {
        participants.add(participant);
      }

      const messageTime = getMessageTime(message);
      if (messageTime > 0) {
        earliest = Math.min(earliest, messageTime);
        latest = Math.max(latest, messageTime);
      }

      hasReplySubject =
        hasReplySubject || REPLY_SUBJECT_PREFIX.test(message.subject ?? "");
    }

    if (!subject || participants.size === 0) {
      return null;
    }

    return {
      id: thread.id,
      subject,
      accountScope: this.getAccountScope(thread.messages),
      participants,
      earliest: Number.isFinite(earliest) ? earliest : 0,
      latest,
      hasReplySubject,
    };
  }

  private getAccountScope(messages: EmailMessage[]): string {
    const scopes = new Set<string>();
    for (const message of messages) {
      const accountId =
        message.accountId ?? message.accountEmail ?? message.accountLabel ?? "";
      if (accountId !== "") {
        scopes.add(String(accountId));
      }
    }

    return Array.from(scopes).sort().join("|");
  }

  private hasParticipantOverlap(
    left: Set<string>,
    right: Set<string>,
  ): boolean {
    for (const participant of left) {
      if (right.has(participant)) {
        return true;
      }
    }
    return false;
  }

  private extractParticipantKeys(message: EmailMessage): string[] {
    return [
      message.from,
      message.email,
      message.to,
      message.cc,
      message.bcc,
    ].flatMap((value) => this.extractEmailKeys(value));
  }

  private extractEmailKeys(value: unknown): string[] {
    if (!value) {
      return [];
    }

    if (Array.isArray(value)) {
      return value.flatMap((item) => this.extractEmailKeys(item));
    }

    const raw = String(value).toLowerCase();
    const matches = raw.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi);
    if (matches && matches.length > 0) {
      return matches.map((match) => match.toLowerCase());
    }

    const fallback = raw.replace(/\s+/g, " ").trim();
    return fallback ? [fallback] : [];
  }

  private refreshThreadMetadata(thread: EmailThread): void {
    thread.subject = this.normalizeSubject(thread.messages[0]?.subject ?? "");
    thread.participants = [];
    thread.latestDate = "";
    thread.earliestDate = "";
    thread.unreadCount = 0;
    thread.hasAttachments = false;
    thread.labels = [];

    for (const msg of thread.messages) {
      const msgDate = getMessageTime(msg);
      const latestDate = thread.latestDate
        ? (parseEmailDate(thread.latestDate)?.getTime() ?? 0)
        : 0;
      const earliestDate = thread.earliestDate
        ? (parseEmailDate(thread.earliestDate)?.getTime() ?? Infinity)
        : Infinity;

      if (!thread.latestDate || msgDate > latestDate) {
        thread.latestDate = getMessageDateValue(msg);
      }
      if (!thread.earliestDate || msgDate < earliestDate) {
        thread.earliestDate = getMessageDateValue(msg);
      }

      const from = msg.from ?? msg.email ?? "";
      if (from && !thread.participants.includes(from)) {
        thread.participants.push(from);
      }

      if (!msg.read) {
        thread.unreadCount++;
      }

      if (msg.hasAttachments || msg.attachments?.length) {
        thread.hasAttachments = true;
      }

      if (Array.isArray(msg.labels)) {
        for (const label of msg.labels) {
          if (!thread.labels.includes(label)) {
            thread.labels.push(label);
          }
        }
      }
    }
  }

  /**
   * Simple string hash function.
   */
  private simpleHash(str: string): string {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString(16).padStart(8, "0");
  }
}

/**
 * Singleton instance for shared threading access.
 */
let threadingServiceInstance: ThreadingService | null = null;

/**
 * Get the shared ThreadingService instance.
 */
export function getThreadingService(): ThreadingService {
  if (!threadingServiceInstance) {
    threadingServiceInstance = new ThreadingService();
  }
  return threadingServiceInstance;
}

/**
 * Reset the threading service (mainly for testing).
 */
export function resetThreadingService(): void {
  threadingServiceInstance = null;
}
