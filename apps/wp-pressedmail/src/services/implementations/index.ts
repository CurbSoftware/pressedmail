/**
 * Service Implementations
 *
 * Central export point for all inbox service implementations.
 *
 * @since 2.0.0
 */

// ============== Cache Service ==============
export {
  CacheService,
  getCacheService,
  resetCacheService,
} from "./cache.service";

// ============== Threading Service ==============
export {
  ThreadingService,
  getThreadingService,
  resetThreadingService,
} from "./threading.service";

// ============== Message Service ==============
export {
  MessageService,
  getMessageService,
  resetMessageService,
} from "./message.service";

// ============== Folder Service ==============
export {
  FolderService,
  getFolderService,
  resetFolderService,
} from "./folder.service";

// ============== Inbox Service ==============
export {
  InboxService,
  getInboxService,
  resetInboxService,
} from "./inbox.service";

// ============== Search Service ==============
export {
  SearchService,
  getSearchService,
  resetSearchService,
} from "./search.service";

// ============== Prefetch Service ==============
export {
  PrefetchService,
  getPrefetchService,
  resetPrefetchService,
} from "./prefetch.service";

// ============== Sync Service ==============
export { SyncService, getSyncService, resetSyncService } from "./sync.service";

// ============== Connection State Service ==============
export {
  ConnectionStateService,
  getConnectionStateService,
  resetConnectionStateService,
  isAuthError,
  isAuthStatus,
} from "./connection-state.service";
