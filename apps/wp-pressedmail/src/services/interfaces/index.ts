/**
 * Service Interfaces
 *
 * Central export point for all inbox service interfaces.
 * These interfaces define the contracts for the refactored inbox architecture.
 *
 * @since 2.0.0
 */

// ============== Inbox Operations ==============
export type {
  IInboxOperations,
  LoadMessagesOptions,
  LoadMessagesResult,
  RefreshOptions,
  MessageFilters,
  MessageListSort,
} from "./inbox.interface";

// ============== Message Operations ==============
export type {
  IMessageOperations,
  GetMessageOptions,
  OperationResult,
  BatchOperationResult,
  MessageFlag,
  MessageIdentifierMode,
  MessageMutationOptions,
  BatchMessageMutationOptions,
  MoveOptions,
} from "./message.interface";

// ============== Folder Operations ==============
export type {
  IFolderOperations,
  FolderTarget,
  ImapFolder,
  SystemFolderType,
  SyncPhase,
  FolderResult,
  FolderListResult,
  CreateFolderOptions,
  VirtualFlagCount,
  VirtualFolderCounts,
} from "./folder.interface";

// ============== Cache Service ==============
export type {
  ICacheService,
  CacheKey,
  CacheKeyPattern,
  CachedMessageList,
  CacheStats,
  StaleWhileRevalidateResult,
} from "./cache.interface";

export { DEFAULT_CACHE_TTL } from "./cache.interface";

// ============== Threading Service ==============
export type {
  IThreadingService,
  ThreadGroupingOptions,
  ThreadExpansionResult,
  ThreadNode,
} from "./threading.interface";

// ============== Sync Service ==============
export type {
  ISyncService,
  SyncStrategy,
  SyncOptions,
  SyncResult,
  MailboxBootstrapAccountResult,
  MailboxBootstrapResult,
  FolderSyncState,
  SyncStatus,
  SyncTokenPayload,
  MessageSyncUpdate,
  MessageSyncDelta,
} from "./sync.interface";

// ============== Prefetch Service ==============
export type { IPrefetchService, FetchPriority } from "./prefetch.interface";

// ============== Search Service ==============
export type {
  ISearchService,
  SearchResult,
  SearchOptions,
  ServerSearchRequest,
} from "./search.interface";

// ============== Connection State Service ==============
export type {
  IConnectionStateService,
  ConnectionHealth,
} from "./connection-state.interface";
export {
  CircuitBreakerError,
  AUTH_ERROR_STATUSES,
  AUTH_ERROR_PATTERNS,
} from "./connection-state.interface";
