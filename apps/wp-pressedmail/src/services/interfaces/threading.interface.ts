/**
 * Threading Service Interface
 *
 * Email thread grouping and management contracts.
 * Handles conversation threading based on Message-ID, In-Reply-To, and References headers.
 *
 * @since 2.0.0
 */

import type { EmailMessage, EmailThread } from "@/types";

/**
 * Options for thread grouping.
 */
export interface ThreadGroupingOptions {
  /** Sort messages within threads (default: 'oldest-first') */
  sortOrder?: "oldest-first" | "newest-first";
  /** Maximum thread depth before flattening */
  maxDepth?: number;
  /** Include single-message "threads" */
  includeSingletons?: boolean;
}

/**
 * Result of thread expansion.
 */
export interface ThreadExpansionResult {
  /** Whether expansion succeeded */
  success: boolean;
  /** Messages in the expanded thread */
  messages: EmailMessage[];
  /** Error message if failed */
  error?: string;
}

/**
 * Thread tree node for hierarchical display.
 */
export interface ThreadNode {
  /** The message at this node */
  message: EmailMessage;
  /** Child nodes (replies to this message) */
  children: ThreadNode[];
  /** Nesting depth (0 = root) */
  depth: number;
  /** Whether this node is collapsed in UI */
  collapsed?: boolean;
}

/**
 * IThreadingService Interface
 *
 * Email thread grouping and management.
 * Implements conversation threading based on RFC 2822 headers.
 */
export interface IThreadingService {
  // ============== State Accessors ==============

  /** Set of currently expanded thread IDs */
  readonly expandedThreads: Set<string>;

  // ============== Thread Grouping ==============

  /**
   * Group messages into threads.
   * Uses Message-ID, In-Reply-To, and References headers for grouping.
   *
   * @param messages - Array of messages to group
   * @param options - Grouping options
   * @returns Array of threads, sorted by latest message date
   */
  groupByThread(
    messages: EmailMessage[],
    options?: ThreadGroupingOptions,
  ): EmailThread[];

  /**
   * Build a hierarchical thread tree.
   * Useful for Gmail-style threaded display.
   *
   * @param messages - Messages in a single thread
   * @returns Root node of the thread tree
   */
  buildThreadTree(messages: EmailMessage[]): ThreadNode;

  /**
   * Find the thread containing a specific message.
   *
   * @param messageId - Message identifier
   * @param threads - Array of threads to search
   * @returns The containing thread or undefined
   */
  findThreadByMessage(
    messageId: string | number,
    threads: EmailThread[],
  ): EmailThread | undefined;

  /**
   * Get all messages in a thread by thread ID.
   *
   * @param threadId - Thread identifier
   * @returns Array of messages in the thread
   */
  getThreadMessages(threadId: string): EmailMessage[];

  // ============== Thread Expansion ==============

  /**
   * Expand a collapsed thread (load all messages).
   * May fetch additional messages from server if not cached.
   *
   * @param threadId - Thread identifier
   * @returns Expansion result with messages
   */
  expandThread(threadId: string): Promise<ThreadExpansionResult>;

  /**
   * Collapse an expanded thread.
   *
   * @param threadId - Thread identifier
   */
  collapseThread(threadId: string): void;

  /**
   * Toggle thread expansion state.
   *
   * @param threadId - Thread identifier
   * @returns New expansion state (true = expanded)
   */
  toggleThreadExpansion(threadId: string): Promise<boolean>;

  /**
   * Check if a thread is currently expanded.
   *
   * @param threadId - Thread identifier
   * @returns True if expanded
   */
  isThreadExpanded(threadId: string): boolean;

  /**
   * Expand all threads.
   */
  expandAll(): void;

  /**
   * Collapse all threads.
   */
  collapseAll(): void;

  // ============== Thread Utilities ==============

  /**
   * Normalize a subject line for thread matching.
   * Removes Re:, Fwd:, [tags], etc.
   *
   * @param subject - Original subject line
   * @returns Normalized subject
   */
  normalizeSubject(subject: string): string;

  /**
   * Parse References header into individual message IDs.
   *
   * @param references - Raw References header value
   * @returns Array of message IDs
   */
  parseReferences(references: string): string[];

  /**
   * Generate a thread ID from a message.
   * Uses Message-ID as primary, falls back to generated ID.
   *
   * @param message - Message to generate ID for
   * @returns Thread identifier
   */
  generateThreadId(message: EmailMessage): string;

  /**
   * Calculate thread statistics.
   *
   * @param thread - Thread to analyze
   * @returns Thread statistics
   */
  getThreadStats(thread: EmailThread): {
    messageCount: number;
    unreadCount: number;
    participantCount: number;
    hasAttachments: boolean;
    dateRange: { start: Date; end: Date };
  };
}
