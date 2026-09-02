import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useAppContext } from "@/context/AppProvider";
import { useInbox, useFolderOperations } from "@/context/InboxContext";
import { getInboxService, getSyncService } from "@/services/implementations";
import {
  getSelectedFolder,
  saveSelectedFolder,
} from "@/lib/folder-persistence";
import {
  hasCompletedFirstSync,
  markFirstSyncComplete,
} from "@/lib/first-sync-persistence";
import {
  hasCompletedEntryBootstrap,
  markEntryBootstrapComplete,
} from "@/lib/entry-bootstrap-persistence";
import {
  clearPaneSelection,
  getPersistedPaneState,
} from "@/lib/open-pane-persistence";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { useLayout } from "@/components/layouts";
import {
  buildConsolidatedAccountScopeKey,
  getAvailableAccountIds,
  getAccountNumericId,
  getEffectiveConsolidatedAccountIdsForLayout,
} from "@/lib/consolidated-account-scope";
import { getConsolidatedFolderMapForPath } from "@/lib/consolidated-folder-map";
import { getEffectiveEmailListGrouping } from "@/lib/effective-email-list-grouping";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { isMailboxSettlePending } from "@/hooks/useMailboxSyncProgress";
import { useAccountNotifications } from "@/layouts/shared/hooks/useAccountNotifications";
import { useNotificationFeed } from "@/layouts/shared/hooks/useNotificationFeed";
import { dispatchNewMailAlerts } from "@/lib/inbox-alert-dispatch";
import { isProBuild } from "@/lib/build-variant";
import {
  useAutoSyncDisabled,
  useSyncIntervalMinutes,
} from "@/context/admin-settings";

/** Messages whose bodies are warmed on boot; one page of the default list. */
const BOOT_PREFETCH_LIMIT = 25;

const DEFAULT_BOOT_LIMIT = 50;
const DEFAULT_BOOT_TIMEOUT_MS = 30_000;
const DEFAULT_SYNC_INTERVAL_MINUTES = 5;
// While the boot folder's first mirror page is cold (empty + served_partial),
// re-poll with exponential backoff until it becomes serviceable or the boot
// timeout hits. The cadence is deliberately gentle: the message read is an
// "expensive" rate-limited endpoint (RATE_LIMIT_EXPENSIVE=50/min server-side), so
// a tight loop would 429-storm. Backoff + a hard poll cap keep boot to a handful
// of re-checks while the queued background refresh warms the mirror.
const BOOT_READINESS_POLL_BASE_MS = 1_500;
const BOOT_READINESS_POLL_MAX_MS = 8_000;
const BOOT_READINESS_MAX_POLLS = 5;

// Strategic folder-state settling refresh: while the active account still has a
// folder mirroring, gently re-pull the CHEAP DB folder snapshot so the per-folder
// spinner advances folder-by-folder and the footer counters climb, then stop.
// Deliberately gentle + hard-capped + visibility-paused, and run from this single
// boot hook (never the app root) so it can't cause a render storm.
const FOLDER_SETTLE_INTERVAL_MS = 8_000;
const FOLDER_SETTLE_MAX_POLLS = 150;

const delay = (ms: number) =>
  new Promise<void>((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Whether the just-loaded folder set indicates a permanently auth-blocked
 * account (bad/expired credentials, broken config). The backend projects that
 * account-level state onto every folder as `healthState: "auth_error"`. Such an
 * account can never "finish syncing" without re-authenticating, so the boot must
 * NOT hold the first-sync gate or keep re-firing the warm polls for it.
 */
export function foldersIndicateAuthBlocked(
  folders: readonly { healthState?: string }[],
): boolean {
  return folders.some((folder) => folder?.healthState === "auth_error");
}

/**
 * Whether the boot's first mirror page can be treated as serviceable (gate can
 * dismiss). Normally a cold, empty, `served_partial` page is NOT serviceable,
 * we keep gating while it warms. But an auth-blocked account can never warm, so
 * it is always serviceable: render whatever the mirror already has plus the
 * inline auth banner instead of an endless "Syncing…" overlay.
 */
export function isBootServiceable(opts: {
  messagesLength: number;
  servedPartial?: boolean;
  authBlocked: boolean;
}): boolean {
  if (opts.authBlocked) {
    return true;
  }
  return opts.messagesLength > 0 || opts.servedPartial !== true;
}

/**
 * Whether the cold-mirror boot-readiness re-poll should continue. The re-poll
 * re-triggers the (ungated) server-side foreground warm, so it MUST stop early
 * for an auth-blocked account, otherwise it hammers IMAP with credentials the
 * server already knows are bad.
 */
export function shouldContinueBootReadinessPoll(opts: {
  messagesLength: number;
  servedPartial?: boolean;
  authBlocked: boolean;
}): boolean {
  return (
    !opts.authBlocked &&
    opts.messagesLength === 0 &&
    opts.servedPartial === true
  );
}

interface UseInboxSurfaceBootOptions {
  enabled?: boolean;
  initialFolder?: string;
  limit?: number;
}

export type AccountImportState =
  | "validating"
  | "connected"
  | "syncing_initial"
  | "ready"
  | "sync_error"
  | "auth_error";

function isRestorableMessage(
  message: ReturnType<typeof getPersistedPaneState> extends {
    selectedMessage?: infer T;
  }
    ? T
    : unknown,
): message is NonNullable<
  ReturnType<typeof getPersistedPaneState>
>["selectedMessage"] {
  if (!message || typeof message !== "object") {
    return false;
  }

  const candidate = message as {
    id?: string | number;
    uid?: string | number;
    date?: string;
  };

  return (
    Boolean(candidate.id ?? candidate.uid) && typeof candidate.date === "string"
  );
}

function resolveBootFolder(
  folders: ReturnType<typeof useFolderOperations>["folders"],
  preferredFolder?: string | null,
): string {
  if (!preferredFolder) {
    return "INBOX";
  }

  const match = folders.find(
    (folder) =>
      folder.path.toLowerCase() === preferredFolder.toLowerCase() ||
      folder.name.toLowerCase() === preferredFolder.toLowerCase(),
  );

  if (!match) {
    return "INBOX";
  }

  if (match.selectable === false) {
    return "INBOX";
  }

  return match.path;
}

export function useInboxSurfaceBoot({
  enabled = true,
  initialFolder,
  limit = DEFAULT_BOOT_LIMIT,
}: UseInboxSurfaceBootOptions = {}) {
  const {
    accounts,
    selectedAccount,
    selectedConsolidatedAccountIds,
    defaultAccountId,
    setNumberOfMessages,
  } = useAppContext();
  const { currentLayout } = useLayout();
  const inbox = useInbox();
  const { folders, selectFolder, loadFolders, loadConsolidatedFolders } =
    useFolderOperations();
  const loadMessages = inbox.loadMessages;
  const selectInboxMessage = inbox.selectMessage;
  const prefetchBatch = inbox.prefetch.prefetchBatch;
  const { preferences } = useUserPreferences();
  const {
    markAllSeen,
    totalNewCount,
    hasPriorityNewMail,
    priorityNewMailResolved,
    refreshCounts,
  } = useAccountNotifications();
  const {
    rawItems: notificationItems,
    isLoading: notificationFeedLoading,
    error: notificationFeedError,
    refresh: refreshNotificationFeed,
  } = useNotificationFeed();
  const refreshCountsRef = useRef(refreshCounts);
  refreshCountsRef.current = refreshCounts;
  const refreshNotificationFeedRef = useRef(refreshNotificationFeed);
  refreshNotificationFeedRef.current = refreshNotificationFeed;
  const syncIntervalMinutes = useSyncIntervalMinutes();
  const autoSyncDisabled = useAutoSyncDisabled();
  const automaticSyncIntervalMs = useMemo(() => {
    const minutes = Number.isFinite(syncIntervalMinutes)
      ? syncIntervalMinutes
      : DEFAULT_SYNC_INTERVAL_MINUTES;
    return Math.max(0, Math.floor(minutes)) * 60_000;
  }, [syncIntervalMinutes]);
  const grouping = getEffectiveEmailListGrouping(
    preferences.email_list_grouping ?? "list",
  );
  const sort = preferences.email_list_default_sort ?? "newest";

  const inboxService = useMemo(() => getInboxService(), []);
  const syncService = useMemo(() => getSyncService(), []);
  const [activeFolder, setActiveFolder] = useState<string>("INBOX");
  const activeFolderRef = useRef("INBOX");
  const bootKeyRef = useRef<string | null>(null);
  const entryBootstrapKeyRef = useRef<string | null>(null);
  const mountedRef = useRef(false);
  const bootFolderLoadedAtRef = useRef(0);
  // First-ever-sync gate: tracks which persistence keys have completed their
  // initial load this session (the ref drives synchronous reads; the tick state
  // forces a re-render when a key completes). Persisted in localStorage so
  // returning visits skip the full-screen "Syncing…" screen entirely.
  const firstSyncCompletedRef = useRef<Set<string>>(new Set());
  const syncAbortRef = useRef<AbortController | null>(null);
  const [firstSyncTick, setFirstSyncTick] = useState(0);
  const [isEntrySyncPending, setIsEntrySyncPending] = useState(false);
  const [entrySyncError, setEntrySyncError] = useState<string | null>(null);
  const previousNewCountRef = useRef(0);
  const seenNotificationIdsRef = useRef<Set<number> | null>(null);

  useEffect(() => {
    if (notificationFeedLoading || notificationFeedError) {
      return;
    }

    const incomingItems = notificationItems.filter(
      (item) =>
        item.type === "email_received" && item.targetKind === "inbox_message",
    );
    const seenIds = seenNotificationIdsRef.current;
    if (seenIds === null) {
      seenNotificationIdsRef.current = new Set(
        incomingItems.map((item) => item.id),
      );
      return;
    }

    const freshItems = incomingItems.filter((item) => !seenIds.has(item.id));
    for (const item of incomingItems) {
      seenIds.add(item.id);
    }

    if (!isProBuild() || preferences.notification_scope !== "all") {
      return;
    }

    for (const item of freshItems.reverse()) {
      if (item.readAt) continue;
      const folder =
        typeof item.targetMetadata.folder === "string"
          ? item.targetMetadata.folder
          : "INBOX";
      dispatchNewMailAlerts({
        preferences,
        previousCount: 0,
        nextCount: 1,
        folder,
        unread: true,
        previewTitle: item.title,
        previewBody: item.summary,
      });
    }
  }, [
    notificationFeedError,
    notificationFeedLoading,
    notificationItems,
    preferences,
  ]);

  useEffect(() => {
    if (preferences.notification_scope === "all") {
      previousNewCountRef.current = totalNewCount;
      return;
    }
    if (
      isProBuild() &&
      preferences.notification_scope === "priority" &&
      totalNewCount > previousNewCountRef.current &&
      !priorityNewMailResolved
    ) {
      return;
    }
    if (isProBuild()) {
      dispatchNewMailAlerts({
        preferences,
        previousCount: previousNewCountRef.current,
        nextCount: totalNewCount,
        folder: "INBOX",
        unread: true,
        priority: hasPriorityNewMail,
      });
    }
    previousNewCountRef.current = totalNewCount;
  }, [hasPriorityNewMail, preferences, priorityNewMailResolved, totalNewCount]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const accountContext = useMemo(() => {
    if (!enabled || !selectedAccount || accounts.length === 0) {
      return null;
    }

    const consolidated = selectedAccount === CONSOLIDATED_INBOX_VALUE;
    if (consolidated) {
      const accountIds = getEffectiveConsolidatedAccountIdsForLayout(
        accounts,
        selectedConsolidatedAccountIds,
        defaultAccountId,
        currentLayout,
      );
      const primaryId = accountIds[0];
      const primaryAccount = accounts.find(
        (item) => getAccountNumericId(item) === primaryId,
      );

      if (!primaryAccount || !primaryId) {
        return null;
      }

      const scopeKey = buildConsolidatedAccountScopeKey(accountIds);

      return {
        accountId: scopeKey,
        primaryAccountId: primaryId,
        accountIds,
        consolidated,
        accountEmail: primaryAccount.email,
        persistenceKey: scopeKey,
      };
    }

    const account = accounts.find(
      (item) => item.email?.toString() === selectedAccount,
    );

    if (!account?.id) {
      return null;
    }

    const accountId = Number(account.id);
    if (!Number.isFinite(accountId)) {
      return null;
    }

    return {
      accountId,
      primaryAccountId: accountId,
      accountIds: undefined,
      consolidated,
      accountEmail: account.email,
      persistenceKey: account.email,
    };
  }, [
    accounts,
    currentLayout,
    defaultAccountId,
    enabled,
    selectedAccount,
    selectedConsolidatedAccountIds,
  ]);
  const accountIdsKey = accountContext?.accountIds?.join(",") ?? "";
  const entryBootstrapKey = useMemo(
    () =>
      getAvailableAccountIds(accounts)
        .sort((left, right) => left - right)
        .join(","),
    [accounts],
  );

  useEffect(() => {
    if (!accountContext) {
      return;
    }

    // Account, folder, grouping, and sort all define the server page. Changing
    // any one must re-boot even if folders have not loaded again.
    const bootKey = `${accountContext.accountId}:${initialFolder ?? "persisted"}:${grouping}:${sort}`;
    if (bootKeyRef.current === bootKey) {
      return;
    }

    bootKeyRef.current = bootKey;
    const isCurrentBoot = () =>
      mountedRef.current && bootKeyRef.current === bootKey;

    // Mark this account/scope's first-ever sync done once the boot reaches a
    // terminal state (initial load resolved, controller handed off, or folders
    // failed). Guarded by isCurrentBoot so a superseded boot never dismisses the
    // gate for the boot that replaced it.
    const completeFirstSync = () => {
      if (!isCurrentBoot()) {
        return;
      }
      const key = accountContext.persistenceKey;
      if (firstSyncCompletedRef.current.has(key)) {
        return;
      }
      firstSyncCompletedRef.current.add(key);
      markFirstSyncComplete(key);
      setFirstSyncTick((tick) => tick + 1);
    };

    const invalidateBootstrapCaches = (accountIds: number[]) => {
      for (const accountId of accountIds) {
        inbox.cache?.invalidateFolders(String(accountId));
        inbox.cache?.invalidateMessages({ accountId: String(accountId) });
      }

      if (accountContext.consolidated) {
        inbox.cache?.invalidateFolders(String(accountContext.accountId));
        inbox.cache?.invalidateMessages({
          accountId: String(accountContext.accountId),
        });
      }
    };

    const runEntryBootstrap = async () => {
      if (
        !entryBootstrapKey ||
        entryBootstrapKeyRef.current === entryBootstrapKey ||
        hasCompletedEntryBootstrap(entryBootstrapKey) ||
        typeof syncService.bootstrapMailboxes !== "function"
      ) {
        // Already warmed this account-set this session (the watermark survives
        // the Inbox route's remount); skip the re-warm and the full-screen gate.
        return;
      }

      entryBootstrapKeyRef.current = entryBootstrapKey;
      setEntrySyncError(null);
      setIsEntrySyncPending(true);

      try {
        // Bootstrap the active account synchronously (gate waits on it); other
        // accounts sync in the background.
        const result = await syncService.bootstrapMailboxes({
          primaryAccountId: accountContext.primaryAccountId,
        });
        if (!isCurrentBoot()) {
          return;
        }

        // The bootstrap resolved (success or partial); persist the watermark so a
        // later Inbox remount neither re-gates nor re-warms. A thrown error skips
        // this, leaving the account-set eligible to retry on the next mount.
        markEntryBootstrapComplete(entryBootstrapKey);

        const resultAccountIds = result.accounts
          .map((account) => account.accountId)
          .filter((accountId) => Number.isInteger(accountId) && accountId > 0);
        const fallbackAccountIds = entryBootstrapKey
          .split(",")
          .map((accountId) => Number(accountId))
          .filter((accountId) => Number.isInteger(accountId) && accountId > 0);

        invalidateBootstrapCaches(
          resultAccountIds.length > 0 ? resultAccountIds : fallbackAccountIds,
        );

        if (!result.success) {
          setEntrySyncError(
            result.error ?? "Some mailboxes could not be synced.",
          );
        }
      } catch (error) {
        if (!isCurrentBoot()) {
          return;
        }
        setEntrySyncError(
          error instanceof Error ? error.message : "Mailbox bootstrap failed.",
        );
      }
      // Note: the entry-sync gate is intentionally NOT dismissed here. It is held
      // through bootInitialSurface until the first mirror page is serviceable (or
      // the boot timeout) so the gate never clears onto a cold/blank inbox. The
      // dismissal happens in boot()'s finally.
    };

    const boot = async () => {
      let bootResult: { serviceable: boolean } = { serviceable: false };
      try {
        // Run the entry bootstrap CONCURRENTLY with the first surface load instead of
        // blocking the surface on it. The surface read serves the DB mirror immediately
        // and its folder-settle / servedPartial backoff polls fill it as the (now
        // bounded, ~fast) active-account warm + background sweep complete, so a slow or
        // throttled mailbox no longer delays the first message list. runEntryBootstrap
        // persists its own watermark/error; bootInitialSurface drives the serviceable
        // result the gate waits on.
        const [, surfaceResult] = await Promise.all([
          runEntryBootstrap(),
          bootInitialSurface(),
        ]);
        bootResult = surfaceResult;
      } finally {
        if (isCurrentBoot()) {
          setIsEntrySyncPending(false);
        }
        // First-ever-sync completion is recorded only once the first page is
        // serviceable. A cold/partial mirror should keep the account in import
        // state instead of making later visits look "ready" while empty.
        if (bootResult.serviceable) {
          completeFirstSync();
        }
      }
    };

    const bootInitialSurface = async (): Promise<{ serviceable: boolean }> => {
      let resolvedFolders = folders;
      if (accountContext.consolidated) {
        const folderResult = await loadConsolidatedFolders(
          accountContext.accountIds ?? [],
          false,
        );
        if (!isCurrentBoot() || !folderResult.success) {
          return { serviceable: false };
        }
        resolvedFolders = folderResult.folders;
        bootFolderLoadedAtRef.current = Date.now();
      } else {
        // Always refetch folders on boot. The entry bootstrap just invalidated
        // the folder cache, and switching accounts leaves a stale in-memory list
        // for the previous account, so the freshly-synced roles/counts must
        // replace whatever is currently held instead of being skipped when the
        // list is non-empty.
        const folderResult = await loadFolders(
          accountContext.primaryAccountId,
          false,
        );
        if (!isCurrentBoot()) {
          return { serviceable: false };
        }
        if (folderResult.success) {
          resolvedFolders = folderResult.folders;
          bootFolderLoadedAtRef.current = Date.now();
        }
      }

      // A permanently auth-blocked account (bad/expired credentials) can never
      // finish syncing, so the gate must complete on whatever the mirror already
      // holds and the readiness re-poll must not keep re-firing the warm path.
      const authBlocked = foldersIndicateAuthBlocked(
        resolvedFolders as readonly { healthState?: string }[],
      );

      const bootFolder = resolveBootFolder(
        resolvedFolders,
        initialFolder ?? getSelectedFolder(accountContext.persistenceKey),
      );

      await selectFolder(bootFolder);
      if (!isCurrentBoot()) {
        return { serviceable: false };
      }

      activeFolderRef.current = bootFolder;
      setActiveFolder(bootFolder);
      saveSelectedFolder(accountContext.persistenceKey, bootFolder);

      const loadBootPage = (silent: boolean) =>
        loadMessages({
          accountId: accountContext.accountId,
          folder: bootFolder,
          consolidated: accountContext.consolidated,
          accountIds: accountContext.consolidated
            ? accountContext.accountIds
            : undefined,
          limit,
          timeoutMs: DEFAULT_BOOT_TIMEOUT_MS,
          grouping,
          sort,
          silent,
        });

      let result = await loadBootPage(false);

      if (!isCurrentBoot() || !result.success) {
        return { serviceable: false };
      }

      // Cold mirror: an empty page flagged served_partial means the server
      // queued a background refresh. Hold the gate and re-poll (silently, so any
      // partial list stays visible) until a serviceable page is served or the
      // boot timeout elapses, the gate must never clear onto a blank inbox. The
      // re-poll uses exponential backoff and a hard cap so it can't 429-storm the
      // rate-limited read endpoint; any failure (incl. 429) ends the loop via the
      // `result.success` guard, dismissing the gate to the inline state.
      const readinessDeadline = Date.now() + DEFAULT_BOOT_TIMEOUT_MS;
      let readinessPolls = 0;
      while (
        isCurrentBoot() &&
        result.success &&
        shouldContinueBootReadinessPoll({
          messagesLength: result.messages.length,
          servedPartial: result.servedPartial,
          authBlocked,
        }) &&
        readinessPolls < BOOT_READINESS_MAX_POLLS &&
        Date.now() < readinessDeadline
      ) {
        const backoff = Math.min(
          BOOT_READINESS_POLL_BASE_MS * 2 ** readinessPolls,
          BOOT_READINESS_POLL_MAX_MS,
        );
        await delay(backoff);
        if (!isCurrentBoot()) {
          return { serviceable: false };
        }
        readinessPolls += 1;
        result = await loadBootPage(true);
      }

      if (!isCurrentBoot() || !result.success) {
        return { serviceable: false };
      }

      const serviceable = isBootServiceable({
        messagesLength: result.messages.length,
        servedPartial: result.servedPartial,
        authBlocked,
      });

      setNumberOfMessages(result.total);

      if (serviceable) {
        void markAllSeen();
      }

      const persistedPaneState = getPersistedPaneState(
        accountContext.persistenceKey,
        bootFolder,
      );

      if (persistedPaneState?.selectedMessage) {
        if (!isRestorableMessage(persistedPaneState.selectedMessage)) {
          clearPaneSelection(accountContext.persistenceKey, bootFolder);
        } else {
          await selectInboxMessage({
            ...persistedPaneState.selectedMessage,
            accountEmail:
              persistedPaneState.selectedMessage.accountEmail ??
              accountContext.accountEmail,
            accountId:
              persistedPaneState.selectedMessage.accountId ??
              accountContext.primaryAccountId,
            folder: persistedPaneState.selectedMessage.folder ?? bootFolder,
          });
        }
      }

      // Warm the bodies of the first page. The batch endpoint takes fifteen
      // messages per request against a 50/min budget, so a whole page costs one
      // or two requests rather than one per message: the old cap of five was
      // priced against the single-message endpoint, not this one. Anything
      // beyond the first page is warmed by useVisibleBodyPrefetch as the reader
      // moves, and only while the sync driver is idle.
      const prefetchMessages = result.messages.slice(0, BOOT_PREFETCH_LIMIT);
      if (prefetchMessages.length === 0) {
        return { serviceable };
      }

      const fallbackAccountId = accountContext.consolidated
        ? accountContext.primaryAccountId
        : accountContext.accountId;
      const byMailbox = new Map<
        string,
        { accountId: string; folder: string; ids: Array<string | number> }
      >();

      for (const message of prefetchMessages) {
        const messageId = message.uid ?? message.id;
        if (!messageId) {
          continue;
        }

        const accountId = String(message.accountId ?? fallbackAccountId);
        const folder = message.folder || activeFolderRef.current;
        const key = `${accountId}::${folder}`;
        let bucket = byMailbox.get(key);
        if (!bucket) {
          bucket = {
            accountId,
            folder,
            ids: [],
          };
          byMailbox.set(key, bucket);
        }
        bucket.ids.push(messageId);
      }

      for (const { accountId, folder, ids } of byMailbox.values()) {
        if (ids.length > 0) {
          prefetchBatch(accountId, folder, ids);
        }
      }

      return { serviceable };
    };

    void boot();
  }, [
    accountContext?.accountEmail,
    accountContext?.accountId,
    accountContext?.consolidated,
    accountContext?.persistenceKey,
    accountContext?.primaryAccountId,
    accountIdsKey,
    entryBootstrapKey,
    initialFolder,
    inbox.cache,
    limit,
    loadMessages,
    grouping,
    sort,
    loadConsolidatedFolders,
    loadFolders,
    markAllSeen,
    prefetchBatch,
    selectFolder,
    selectInboxMessage,
    setNumberOfMessages,
    syncService,
  ]);

  const syncNow = useCallback(async () => {
    // Cancel any previous in-flight sync so stale results don't overwrite the
    // current folder's state after a folder/account switch.
    syncAbortRef.current?.abort();
    const controller = new AbortController();
    syncAbortRef.current = controller;
    const isAborted = () => controller.signal.aborted;

    if (!accountContext) {
      return;
    }

    if (typeof document !== "undefined" && document.hidden) {
      return;
    }

    // After a background message sync, mark the cached folder snapshot stale so
    // the footer/pagination counts recompute on the next folder read instead of
    // showing the pre-sync totals.
    const refreshScopeFolders = () => {
      if (accountContext.consolidated) {
        for (const accountId of accountContext.accountIds ?? []) {
          inbox.cache?.invalidateFolders(String(accountId));
        }
        inbox.cache?.invalidateFolders(String(accountContext.accountId));
      } else {
        inbox.cache?.invalidateFolders(String(accountContext.accountId));
      }
    };
    const completeSuccessfulSync = async (total: number) => {
      setNumberOfMessages(total);
      refreshScopeFolders();
      await Promise.all([
        refreshCountsRef.current(),
        refreshNotificationFeedRef.current(),
      ]);
    };

    const folder = activeFolderRef.current;
    const folderMap = accountContext.consolidated
      ? getConsolidatedFolderMapForPath(folders, folder)
      : undefined;

    // On a deep page (offset > 0), the background poll must refresh THAT page,
    // not reset to page 1, otherwise the visible deep page gets silently
    // overwritten with page-1 emails a minute later.
    const currentOffset = inboxService.getCurrentOffsetStart();
    if (currentOffset > 0) {
      const reloadResult = await inbox.loadMessages({
        accountId: accountContext.accountId,
        folder,
        consolidated: accountContext.consolidated,
        accountIds: accountContext.consolidated
          ? accountContext.accountIds
          : undefined,
        folderMap,
        offset: currentOffset,
        limit,
        forceRefresh: false,
        silent: true,
        grouping,
        sort,
      });
      if (!isAborted() && reloadResult.success) {
        await completeSuccessfulSync(reloadResult.total);
      }
      return;
    }

    if (grouping === "threads") {
      const reloadResult = await inbox.loadMessages({
        accountId: accountContext.accountId,
        folder,
        consolidated: accountContext.consolidated,
        accountIds: accountContext.consolidated
          ? accountContext.accountIds
          : undefined,
        folderMap,
        limit,
        forceRefresh: false,
        silent: true,
        grouping,
        sort,
      });

      if (!isAborted() && reloadResult.success) {
        await completeSuccessfulSync(reloadResult.total);
      }
      return;
    }

    const syncToken =
      inboxService.getCurrentSyncToken() ??
      syncService.getSyncToken(accountContext.accountId, folder);

    if (!syncToken) {
      const reloadResult = await inbox.loadMessages({
        accountId: accountContext.accountId,
        folder,
        consolidated: accountContext.consolidated,
        accountIds: accountContext.consolidated
          ? accountContext.accountIds
          : undefined,
        folderMap,
        limit,
        forceRefresh: false,
        silent: true,
        grouping,
        sort,
      });

      if (!isAborted() && reloadResult.success) {
        await completeSuccessfulSync(reloadResult.total);
      }
      return;
    }

    const generation = inboxService.getRequestGeneration();
    // Capture the consolidated account IDs at the moment the request is fired.
    // After the await, the user may have changed the consolidated selection, so
    // we tag the returned delta with the IDs that were in scope at call time.
    // applyDiff uses these to reject the delta if the scope has since changed.
    const syncRequestAccountIds = accountContext.consolidated
      ? accountContext.accountIds
      : undefined;

    const syncResult = await syncService.incrementalSync(
      accountContext.accountId,
      folder,
      syncToken,
      {
        folder,
        consolidated: accountContext.consolidated,
        accountIds: accountContext.consolidated
          ? accountContext.accountIds
          : undefined,
        folderMap,
      },
    );

    if (!isAborted() && syncResult.success && syncResult.delta) {
      const delta = syncRequestAccountIds
        ? { ...syncResult.delta, consolidatedAccountIds: syncRequestAccountIds }
        : syncResult.delta;
      inboxService.applyDiff(delta, generation);
      await completeSuccessfulSync(syncResult.delta.total);
      return;
    }

    if (!isAborted() && syncResult.requiresFullSync) {
      const reloadResult = await inbox.loadMessages({
        accountId: accountContext.accountId,
        folder,
        consolidated: accountContext.consolidated,
        accountIds: accountContext.consolidated
          ? accountContext.accountIds
          : undefined,
        folderMap,
        limit,
        forceRefresh: false,
        silent: true,
        grouping,
        sort,
      });

      if (!isAborted() && reloadResult.success) {
        await completeSuccessfulSync(reloadResult.total);
      }
    }
  }, [
    accountContext,
    inbox,
    inboxService,
    folders,
    grouping,
    sort,
    limit,
    setNumberOfMessages,
    syncService,
  ]);

  useEffect(() => {
    if (!accountContext || autoSyncDisabled || automaticSyncIntervalMs <= 0) {
      return;
    }

    // No DOM (SSR/tests without document): fall back to a plain interval.
    if (typeof document === "undefined") {
      const intervalId = window.setInterval(
        () => void syncNow(),
        automaticSyncIntervalMs,
      );
      return () => window.clearInterval(intervalId);
    }

    // Only poll while the tab is visible. A hidden tab schedules no timer (so a
    // backgrounded mailbox never wakes to hit IMAP); becoming visible runs one
    // immediate catch-up sync and resumes polling.
    let intervalId: number | null = null;

    const startPolling = () => {
      if (intervalId !== null) {
        return;
      }
      intervalId = window.setInterval(
        () => void syncNow(),
        automaticSyncIntervalMs,
      );
    };

    const stopPolling = () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
        intervalId = null;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        void syncNow();
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      stopPolling();
      syncAbortRef.current?.abort();
    };
  }, [accountContext, autoSyncDisabled, automaticSyncIntervalMs, syncNow]);

  // Keep the latest folders + load callbacks in a ref so the settling interval
  // reads current values WITHOUT being in its dependency array (which would make
  // it tear down + re-subscribe on every folder refresh, the exact pattern that
  // caused the earlier render storm).
  const settleRef = useRef({
    folders,
    loadFolders,
    loadConsolidatedFolders,
    accountContext,
  });
  settleRef.current = {
    folders,
    loadFolders,
    loadConsolidatedFolders,
    accountContext,
  };

  useEffect(() => {
    // Manual-sync-only (admin interval 0) disables ALL background polling,
    // including this folder-settle poll, otherwise it would keep hitting the
    // server every 8s despite auto sync being off.
    if (!accountContext || autoSyncDisabled) {
      return;
    }
    let cancelled = false;
    let polls = 0;

    const intervalId = window.setInterval(() => {
      if (cancelled) {
        return;
      }
      if (typeof document !== "undefined" && document.hidden) {
        return;
      }
      // Skip if boot folder load just happened (within 1 settle interval)
      if (
        Date.now() - bootFolderLoadedAtRef.current <
        FOLDER_SETTLE_INTERVAL_MS
      ) {
        return;
      }
      const {
        folders: currentFolders,
        loadFolders: load,
        loadConsolidatedFolders: loadConsolidated,
        accountContext: ctx,
      } = settleRef.current;
      if (!ctx) {
        return;
      }
      // Gate on the metadata-settle predicate, not the foreground spinner
      // predicate. Backfill/stale/degraded should not keep the footer saying
      // "Syncing", but they still need cheap folder snapshot refreshes so counts
      // and phases catch up while the mirror settles.
      const stillMirroring = isMailboxSettlePending(currentFolders ?? []);
      // Settled (or nothing to sync) → no network; just a cheap O(folders) check.
      if (!stillMirroring || polls >= FOLDER_SETTLE_MAX_POLLS) {
        return;
      }
      polls += 1;
      // Invalidate the cached folder snapshot BEFORE reloading so the read hits
      // the freshly-warmed mirror rather than the stale cache. This is what lets
      // the footer/pagination counts actually climb as the mirror fills.
      if (ctx.consolidated) {
        for (const accountId of ctx.accountIds ?? []) {
          inbox.cache?.invalidateFolders(String(accountId));
        }
        inbox.cache?.invalidateFolders(String(ctx.accountId));
        void loadConsolidated(ctx.accountIds ?? [], false).catch(() => {});
      } else {
        inbox.cache?.invalidateFolders(String(ctx.primaryAccountId));
        void load(ctx.primaryAccountId, false).catch(() => {});
      }
    }, FOLDER_SETTLE_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
    // Re-subscribe (and reset the poll budget) only when the active scope or the
    // auto-sync enablement changes.
  }, [accountContext?.accountId, autoSyncDisabled]);

  // True only on the FIRST-EVER visit to an account/scope, until its initial
  // load resolves. Read synchronously (ref + localStorage) so a returning user
  // never flashes the gate. `firstSyncTick` re-triggers the memo on completion.
  const isFirstSyncPending = useMemo(() => {
    if (!accountContext) {
      return false;
    }
    const key = accountContext.persistenceKey;
    if (firstSyncCompletedRef.current.has(key)) {
      return false;
    }
    return !hasCompletedFirstSync(key);
  }, [accountContext, firstSyncTick]);
  const shouldGateEntryBootstrap =
    Boolean(accountContext) &&
    entryBootstrapKey.length > 0 &&
    entryBootstrapKeyRef.current !== entryBootstrapKey &&
    !hasCompletedEntryBootstrap(entryBootstrapKey) &&
    typeof syncService.bootstrapMailboxes === "function";
  const accountImportState: AccountImportState = useMemo(() => {
    if (!accountContext) {
      return "connected";
    }

    if (entrySyncError) {
      return /auth|credential|password|login/i.test(entrySyncError)
        ? "auth_error"
        : "sync_error";
    }

    if (isFirstSyncPending || isEntrySyncPending || shouldGateEntryBootstrap) {
      return "syncing_initial";
    }

    return "ready";
  }, [
    accountContext,
    entrySyncError,
    isFirstSyncPending,
    isEntrySyncPending,
    shouldGateEntryBootstrap,
  ]);

  return {
    accountId: accountContext?.accountId ?? null,
    accountImportState,
    activeFolder,
    entrySyncError,
    isEntrySyncPending: isEntrySyncPending || shouldGateEntryBootstrap,
    isFirstSyncPending,
    // The full-screen "Syncing your mailbox…" notice is driven ONLY by a genuine
    // first-ever sync of the active account (localStorage-backed, so a returning
    // user never sees it). The entry bootstrap that warms ALL accounts is a
    // background concern and must NEVER block the inbox, gating on it re-fired
    // the notice on every Inbox remount whenever its session watermark was missing
    // (slow/failed primary bootstrap on a heavy account).
    shouldShowSetupNotice: isFirstSyncPending,
    syncNow,
    autoSyncDisabled,
  };
}

export default useInboxSurfaceBoot;
