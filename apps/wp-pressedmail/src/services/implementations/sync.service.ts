import {
  getPrincipalStorageItem,
  removePrincipalStorageItem,
  setPrincipalStorageItem,
} from "@/lib/principal-storage";
/**
 * Sync Service Implementation
 *
 * Coordinates inbox delta polling between client and server.
 *
 * @since 2.0.0
 */

import type {
  ISyncService,
  SyncStrategy,
  SyncOptions,
  SyncResult,
  SyncStatus,
  FolderSyncState,
  MailboxBootstrapAccountResult,
  MailboxBootstrapResult,
  SyncTokenPayload,
  MessageSyncDelta,
} from "../interfaces";
import {
  buildApiUrl,
  messagesConsolidatedDiffRouteApi,
  messagesDiffRouteApi,
  syncBootstrapRouteApi,
} from "@/context/Strings";
import { getMailboxSourceRequestParams } from "@/lib/mailbox-source";
import { serializeConsolidatedAccountIds } from "@/lib/consolidated-account-scope";
import { serializeConsolidatedFolderMap } from "@/lib/consolidated-folder-map";
import { apiFetch, SessionExpiredError, isAbortError } from "@/lib/api-client";
import { parseConsolidatedAccountReadiness } from "@/lib/consolidated-account-readiness";
import type { EmailMessage } from "@/types";
import {
  getMessageIdentityKey,
  parseAccountQualifiedToken,
} from "@/lib/message-identity";
import { getConnectionStateService } from "./connection-state.service";

const SYNC_TOKENS_KEY = "pressedmail-sync-tokens";
const SYNC_STATE_KEY = "pressedmail-sync-state";
const DEFAULT_SYNC_INTERVAL = 60 * 1000;
const REQUEST_TIMEOUT_MS = 20_000;
const BOOTSTRAP_TIMEOUT_MS = 60_000;
/** Consecutive diff failures for one account before surfacing via connection-state. */
const DIFF_FAILURE_SURFACE_THRESHOLD = 3;

async function buildHttpError(response: Response): Promise<Error> {
  let message = "";
  try {
    const payload = (await response.json()) as Record<string, unknown>;
    if (typeof payload.message === "string") {
      message = payload.message;
    } else if (
      payload.data &&
      typeof payload.data === "object" &&
      typeof (payload.data as Record<string, unknown>).message === "string"
    ) {
      message = String((payload.data as Record<string, unknown>).message);
    }
  } catch {
    // Ignore JSON parse issues and fall back to status only.
  }

  return new Error(
    `HTTP error: ${response.status}${message ? ` - ${message}` : ""}`,
  );
}

function normalizeUpdatedItem(item: Record<string, unknown>) {
  const explicitId = item.localId ?? item.local_id;
  const explicit =
    typeof explicitId === "string"
      ? parseAccountQualifiedToken(explicitId)
      : null;
  const messageKey = getMessageIdentityKey(item as unknown as EmailMessage);
  const explicitKey =
    explicit?.kind === "message" ? getMessageIdentityKey(explicit) : "";
  // Invalid updates remain visible to InboxService's full-refresh guard.
  const localId =
    explicitId != null
      ? explicitKey && (!messageKey || explicitKey === messageKey)
        ? explicitKey
        : ""
      : messageKey;
  const changes =
    item.changes && typeof item.changes === "object"
      ? (item.changes as Record<string, unknown>)
      : Object.fromEntries(
          Object.entries(item).filter(
            ([key]) =>
              ![
                "localId",
                "local_id",
                "consolidatedUid",
                "uid",
                "id",
                "messageId",
              ].includes(key),
          ),
        );

  return {
    localId: String(localId ?? ""),
    changes,
  };
}

function normalizeDelta(
  payload: Record<string, unknown>,
  fallbackFolder: string,
  fallbackToken: string,
): MessageSyncDelta {
  const rawAdded = Array.isArray(payload.added) ? payload.added : [];
  const rawUpdated = Array.isArray(payload.updated) ? payload.updated : [];
  const rawDeleted = Array.isArray(payload.deleted) ? payload.deleted : [];

  return {
    added: rawAdded.filter(
      (item): item is Record<string, unknown> =>
        Boolean(item) && typeof item === "object",
    ),
    updated: rawUpdated
      .filter(
        (item): item is Record<string, unknown> =>
          Boolean(item) && typeof item === "object",
      )
      .map(normalizeUpdatedItem),
    deleted: rawDeleted.map((item) => String(item)),
    total: Number(payload.total ?? payload.num_messages ?? 0),
    unread: Number(payload.unread ?? 0),
    folder: String(payload.folder ?? fallbackFolder),
    syncToken: String(
      payload.syncToken ?? payload.sync_token ?? fallbackToken ?? "",
    ),
    // Combined diffs carry per-account readiness (undefined for single-account),
    // so applyDiff can refresh the readiness chips between full page loads.
    consolidatedAccountReadiness:
      payload.accounts !== undefined
        ? parseConsolidatedAccountReadiness(payload.accounts)
        : undefined,
  };
}

/** A tombstone can remove only its complete physical message identity. */
function addedRowIdentityKeys(item: Record<string, unknown>): string[] {
  const key = getMessageIdentityKey(item as unknown as EmailMessage);
  return key ? [key] : [];
}

/**
 * Merge a continuation-page delta into the running merged delta.
 *
 * The server bounds added[] and pages the backlog with hasMore; the client drains
 * those pages within one incrementalSync. added/updated/deleted accumulate across
 * pages; the folder-wide total/unread/folder and the sync token always come from
 * the LATEST page (each page reports the current folder head + the token to resume
 * from). applyDiff is idempotent on the client, so any cross-page over-report is
 * harmless.
 */
function mergeDelta(
  base: MessageSyncDelta,
  next: MessageSyncDelta,
): MessageSyncDelta {
  const deleted = [...base.deleted, ...next.deleted];
  const deletedSet = new Set(deleted.map((id) => String(id)));

  // Deletion-wins across pages: a UID added in an EARLIER drained page but
  // tombstoned in a LATER page must not resurrect. The later deletion is
  // chronologically newer, so drop any accumulated added/updated row whose id is
  // in the merged tombstone set (applyDiff applies deletions before adds, so an
  // add merged after a delete would otherwise survive). applyDiff is idempotent,
  // so this only ever removes a row that must not appear.
  const added =
    deletedSet.size === 0
      ? [...base.added, ...next.added]
      : [...base.added, ...next.added].filter(
          (item) =>
            !addedRowIdentityKeys(item).some((key) => deletedSet.has(key)),
        );
  const updated =
    deletedSet.size === 0
      ? [...base.updated, ...next.updated]
      : [...base.updated, ...next.updated].filter(
          (item) => !deletedSet.has(String(item.localId)),
        );

  return {
    added,
    updated,
    deleted,
    total: next.total,
    unread: next.unread,
    folder: next.folder,
    syncToken: next.syncToken,
    // Readiness comes from the LATEST page that reported it.
    consolidatedAccountReadiness:
      next.consolidatedAccountReadiness ?? base.consolidatedAccountReadiness,
  };
}

function normalizeStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item)).filter((item) => item.length > 0)
    : [];
}

function normalizeBootstrapAccount(
  item: Record<string, unknown>,
): MailboxBootstrapAccountResult {
  const accountId = Number(item.account_id ?? item.accountId ?? 0);
  return {
    accountId: Number.isFinite(accountId) ? accountId : 0,
    success: Boolean(item.success),
    foldersSynced: Number(item.folders_synced ?? item.foldersSynced ?? 0),
    foldersWarmed: normalizeStringArray(
      item.folders_warmed ?? item.foldersWarmed,
    ),
    foldersQueued: normalizeStringArray(
      item.folders_queued ?? item.foldersQueued,
    ),
    error:
      typeof item.error === "string" && item.error.length > 0
        ? item.error
        : undefined,
  };
}

export class SyncService implements ISyncService {
  private _isSyncing = false;
  private _lastSyncTime: Date | null = null;
  private _syncError: string | null = null;
  private _syncTokens: Map<string, string> = new Map();
  private _folderStates: Map<string, FolderSyncState> = new Map();
  private _abortControllers: Map<string, AbortController> = new Map();
  // Coalesce concurrent incremental syncs of the SAME (account, folder): the boot
  // settle poll, the visibility catch-up, and the interval can all fire at once,
  // and must share ONE request rather than fan out identical diffs. Keyed by sync
  // key so different folders/accounts still run in parallel.
  private _inFlightSyncs: Map<string, Promise<SyncResult>> = new Map();
  // Consecutive diff-failure streak per account. At >=3 the failure is surfaced
  // through the connection-state service (visible banner) instead of rotting
  // silently in `_syncError`. Reset by any successful diff for that account.
  private _diffFailureStreaks: Map<string, number> = new Map();

  constructor() {
    this.loadStoredState();
  }

  get isSyncing(): boolean {
    return this._isSyncing;
  }

  get lastSyncTime(): Date | null {
    return this._lastSyncTime;
  }

  get syncError(): string | null {
    return this._syncError;
  }

  async sync(
    accountId: string | number,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const folder = options?.folder ?? "INBOX";
    const strategy = this.determineStrategy(accountId, folder, options?.force);

    if (strategy === "cache-only") {
      return {
        success: true,
        newMessages: 0,
        updatedMessages: 0,
        deletedMessages: 0,
        strategy,
      };
    }

    if (strategy === "incremental") {
      const token = this.getSyncToken(accountId, folder);
      if (token) {
        return this.incrementalSync(accountId, folder, token, options);
      }
    }

    return this.fullSync(accountId, options);
  }

  async incrementalSync(
    accountId: string | number,
    folder: string,
    syncToken: string,
    options?: SyncOptions & { consolidated?: boolean },
  ): Promise<SyncResult> {
    // Coalesce concurrent syncs of the same (account, folder) so overlapping
    // triggers share ONE underlying request. Different scopes lock on distinct
    // keys and run in parallel.
    const inFlightKey = this.getSyncKey(accountId, folder);
    const existing = this._inFlightSyncs.get(inFlightKey);
    if (existing) {
      return existing;
    }

    const run = this.runIncrementalSync(accountId, folder, syncToken, options);
    this._inFlightSyncs.set(inFlightKey, run);
    try {
      return await run;
    } finally {
      this._inFlightSyncs.delete(inFlightKey);
    }
  }

  private async runIncrementalSync(
    accountId: string | number,
    folder: string,
    syncToken: string,
    options?: SyncOptions & { consolidated?: boolean },
  ): Promise<SyncResult> {
    this._isSyncing = true;
    this._syncError = null;

    const syncKey = this.getSyncKey(accountId, folder);
    const abortController = new AbortController();
    this._abortControllers.set(syncKey, abortController);

    const onSourceAbort = () => abortController.abort();
    if (options?.signal) {
      if (options.signal.aborted) {
        abortController.abort();
      } else {
        options.signal.addEventListener("abort", onSourceAbort, {
          once: true,
        });
      }
    }

    try {
      this.updateFolderState(accountId, folder, { isSyncing: true });

      // The server bounds the diff's added[] and pages the backlog with hasMore
      // (e.g. a fresh backfill that jumped the head thousands of UIDs). Drain those
      // pages within this single incrementalSync, re-issuing the diff with each
      // continuation token and merging, so an open tab catches up in one settle
      // instead of one page per poll interval. Capped so a misbehaving server that
      // always reports hasMore can never spin the client forever.
      const MAX_HASMORE_ITERATIONS = 10;
      let currentToken = syncToken;
      let merged: MessageSyncDelta | null = null;

      for (
        let iteration = 0;
        iteration < MAX_HASMORE_ITERATIONS;
        iteration += 1
      ) {
        const apiUrl = options?.consolidated
          ? buildApiUrl(messagesConsolidatedDiffRouteApi, {
              folder,
              sync_token: currentToken,
              account_ids: serializeConsolidatedAccountIds(options.accountIds),
              folder_map: serializeConsolidatedFolderMap(options.folderMap),
              ...getMailboxSourceRequestParams(),
            })
          : buildApiUrl(`${messagesDiffRouteApi}${accountId}`, {
              folder,
              sync_token: currentToken,
              ...getMailboxSourceRequestParams(),
            });

        const response = await apiFetch(
          apiUrl,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
            signal: abortController.signal,
          },
          { timeoutMs: REQUEST_TIMEOUT_MS },
        );

        if (!response.ok) {
          throw await buildHttpError(response);
        }

        const data = (await response.json()) as Record<string, unknown>;
        if (String(data.status ?? "success") === "error") {
          throw new Error(
            String(data.message ?? "Incremental sync request failed"),
          );
        }

        const payload =
          data.data && typeof data.data === "object"
            ? (data.data as Record<string, unknown>)
            : data;

        const requiresFullSync = Boolean(
          payload.requiresFullSync ?? payload.requires_full_sync,
        );
        const nextToken = String(
          payload.syncToken ?? payload.sync_token ?? currentToken,
        );

        if (requiresFullSync) {
          // A requiresFullSync at any page (e.g. tombstone-buffer rotation mid
          // pagination) abandons the partial merge: the client must full-reload.
          this._diffFailureStreaks.delete(String(accountId));
          this.setSyncToken(accountId, folder, nextToken);
          this.updateFolderState(accountId, folder, {
            isSyncing: false,
            lastSync: new Date(),
            lastError: undefined,
          });

          return {
            success: false,
            newMessages: 0,
            updatedMessages: 0,
            deletedMessages: 0,
            strategy: "incremental",
            requiresFullSync: true,
            syncToken: nextToken,
          };
        }

        const delta = normalizeDelta(payload, folder, nextToken);
        merged = merged ? mergeDelta(merged, delta) : delta;

        const hasMore = Boolean(payload.hasMore ?? payload.has_more);
        if (!hasMore) {
          break;
        }
        currentToken = delta.syncToken;
      }

      // The loop always runs at least once, so merged is non-null here.
      const finalDelta = merged as MessageSyncDelta;
      const now = new Date();
      this._lastSyncTime = now;
      this._diffFailureStreaks.delete(String(accountId));
      this.setSyncToken(accountId, finalDelta.folder, finalDelta.syncToken);
      this.updateFolderState(accountId, finalDelta.folder, {
        isSyncing: false,
        lastSync: now,
        lastError: undefined,
        messageCount: finalDelta.total,
      });

      return {
        success: true,
        newMessages: finalDelta.added.length,
        updatedMessages: finalDelta.updated.length,
        deletedMessages: finalDelta.deleted.length,
        syncToken: finalDelta.syncToken,
        strategy: "incremental",
        delta: finalDelta,
      };
    } catch (error) {
      this._syncError =
        error instanceof Error ? error.message : "Incremental sync failed";

      this.updateFolderState(accountId, folder, {
        isSyncing: false,
        lastError: this._syncError,
      });

      this.trackDiffFailure(accountId, error, this._syncError);

      return {
        success: false,
        newMessages: 0,
        updatedMessages: 0,
        deletedMessages: 0,
        strategy: "incremental",
        error: this._syncError,
      };
    } finally {
      this._isSyncing = false;
      this._abortControllers.delete(syncKey);
      if (options?.signal) {
        options.signal.removeEventListener("abort", onSourceAbort);
      }
    }
  }

  async fullSync(
    accountId: string | number,
    options?: SyncOptions,
  ): Promise<SyncResult> {
    const folder = options?.folder ?? "INBOX";
    const now = new Date();
    this._lastSyncTime = now;
    this._syncError = null;
    this.updateFolderState(accountId, folder, {
      isSyncing: false,
      lastSync: now,
      lastError: undefined,
    });

    return {
      success: true,
      newMessages: 0,
      updatedMessages: 0,
      deletedMessages: 0,
      strategy: "full",
      syncToken: this.getSyncToken(accountId, folder) ?? undefined,
    };
  }

  async bootstrapMailboxes(options?: {
    signal?: AbortSignal;
    primaryAccountId?: number;
  }): Promise<MailboxBootstrapResult> {
    this._isSyncing = true;
    this._syncError = null;

    try {
      // The active/primary account is bootstrapped synchronously server-side so
      // the loading gate dismisses as soon as it is ready; other accounts sync in
      // the background.
      const primaryAccountId =
        typeof options?.primaryAccountId === "number" &&
        Number.isFinite(options.primaryAccountId) &&
        options.primaryAccountId > 0
          ? Math.trunc(options.primaryAccountId)
          : 0;

      const response = await apiFetch(
        syncBootstrapRouteApi,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ primary_account_id: primaryAccountId }),
          signal: options?.signal,
        },
        { timeoutMs: BOOTSTRAP_TIMEOUT_MS },
      );

      if (!response.ok) {
        throw await buildHttpError(response);
      }

      const data = (await response.json()) as Record<string, unknown>;
      const payload =
        data.data && typeof data.data === "object"
          ? (data.data as Record<string, unknown>)
          : data;
      const rawAccounts = Array.isArray(payload.accounts)
        ? payload.accounts
        : [];
      const accounts = rawAccounts
        .filter(
          (item): item is Record<string, unknown> =>
            Boolean(item) && typeof item === "object",
        )
        .map(normalizeBootstrapAccount)
        .filter((item) => item.accountId > 0);
      const status = String(data.status ?? "success").toLowerCase();
      const success =
        status === "success" && accounts.every((account) => account.success);
      const message =
        typeof data.message === "string" && data.message.length > 0
          ? data.message
          : undefined;

      const now = new Date();
      this._lastSyncTime = now;
      for (const account of accounts) {
        for (const folder of account.foldersWarmed) {
          this.updateFolderState(account.accountId, folder, {
            isSyncing: false,
            lastSync: now,
            lastError: account.success ? undefined : account.error,
          });
        }
      }

      return {
        success,
        accounts,
        error: success ? undefined : (message ?? "Mailbox bootstrap failed"),
      };
    } catch (error) {
      this._syncError =
        error instanceof Error ? error.message : "Mailbox bootstrap failed";

      return {
        success: false,
        accounts: [],
        error: this._syncError,
      };
    } finally {
      this._isSyncing = false;
    }
  }

  getSyncStatus(accountId: string | number): SyncStatus {
    const folderStates: Record<string, FolderSyncState> = {};
    let lastSync: Date | null = null;
    let isSyncing = false;

    for (const [key, state] of this._folderStates.entries()) {
      if (!key.startsWith(`${accountId}:`)) {
        continue;
      }

      const folder = key.split(":").slice(1).join(":") || "INBOX";
      folderStates[folder] = state;
      if (state.isSyncing) {
        isSyncing = true;
      }
      if (state.lastSync && (!lastSync || state.lastSync > lastSync)) {
        lastSync = state.lastSync;
      }
    }

    return {
      lastSync,
      isSyncing,
      folderStates,
      error: this._syncError ?? undefined,
    };
  }

  getFolderSyncState(
    accountId: string | number,
    folder: string,
  ): FolderSyncState | undefined {
    return this._folderStates.get(this.getSyncKey(accountId, folder));
  }

  needsSync(accountId: string | number, folder: string): boolean {
    const state = this.getFolderSyncState(accountId, folder);
    if (!state?.lastSync) {
      return true;
    }

    if (state.lastError) {
      return true;
    }

    return Date.now() - state.lastSync.getTime() > DEFAULT_SYNC_INTERVAL;
  }

  generateSyncToken(
    accountId: string | number,
    folder: string,
    lastUid: number,
    uidValidity: number,
  ): string {
    const payload: SyncTokenPayload = {
      accountId,
      folder,
      lastUid,
      uidValidity,
      timestamp: Date.now(),
    };

    try {
      return btoa(JSON.stringify(payload));
    } catch {
      return "";
    }
  }

  decodeSyncToken(token: string): SyncTokenPayload | null {
    if (!token) return null;

    try {
      const payload = JSON.parse(atob(token)) as SyncTokenPayload;
      if (
        payload.accountId === undefined ||
        !payload.folder ||
        payload.lastUid === undefined ||
        payload.uidValidity === undefined ||
        !payload.timestamp
      ) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  validateSyncToken(token: string, currentUidValidity: number): boolean {
    const payload = this.decodeSyncToken(token);
    if (!payload) return false;
    if (payload.uidValidity !== currentUidValidity) return false;
    return Date.now() - payload.timestamp <= 24 * 60 * 60 * 1000;
  }

  getSyncToken(accountId: string | number, folder: string): string | null {
    return this._syncTokens.get(this.getSyncKey(accountId, folder)) ?? null;
  }

  setSyncToken(
    accountId: string | number,
    folder: string,
    token: string,
  ): void {
    this._syncTokens.set(this.getSyncKey(accountId, folder), token);
    this.saveStoredState();
  }

  cancelSync(accountId?: string | number): void {
    if (accountId === undefined) {
      for (const controller of this._abortControllers.values()) {
        controller.abort();
      }
      this._abortControllers.clear();
      this._isSyncing = false;
      return;
    }

    for (const [key, controller] of this._abortControllers.entries()) {
      if (key.startsWith(`${accountId}:`)) {
        controller.abort();
        this._abortControllers.delete(key);
      }
    }

    this._isSyncing = false;
  }

  resetSyncState(accountId: string | number): void {
    for (const key of this._syncTokens.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this._syncTokens.delete(key);
      }
    }

    for (const key of this._folderStates.keys()) {
      if (key.startsWith(`${accountId}:`)) {
        this._folderStates.delete(key);
      }
    }

    this.cancelSync(accountId);
    this.saveStoredState();
  }

  /**
   * Make repeated diff failures VISIBLE instead of rotting in `_syncError`:
   * - `SessionExpiredError` (login cookie gone, heal impossible) surfaces immediately
   *   as a session-wide error, a "session expired" banner, never silent.
   * - Other failures surface through the per-account circuit breaker once the streak
   *   reaches {@link DIFF_FAILURE_SURFACE_THRESHOLD} consecutive misses.
   * - Aborts (folder switch, unmount, timeout-cancelled caller) don't count.
   */
  private trackDiffFailure(
    accountId: string | number,
    error: unknown,
    reason: string,
  ): void {
    if (isAbortError(error)) {
      return;
    }

    const connectionState = getConnectionStateService();

    if (error instanceof SessionExpiredError) {
      connectionState.markSessionError(reason);
      return;
    }

    const key = String(accountId);
    const streak = (this._diffFailureStreaks.get(key) ?? 0) + 1;
    this._diffFailureStreaks.set(key, streak);
    if (streak >= DIFF_FAILURE_SURFACE_THRESHOLD) {
      connectionState.markUnhealthyTransient(key, reason);
    }
  }

  private getSyncKey(accountId: string | number, folder: string): string {
    return `${accountId}:${folder}`;
  }

  private determineStrategy(
    accountId: string | number,
    folder: string,
    force?: boolean,
  ): SyncStrategy {
    if (force) {
      return "full";
    }

    if (this.getSyncToken(accountId, folder)) {
      return "incremental";
    }

    const state = this.getFolderSyncState(accountId, folder);
    if (
      state?.lastSync &&
      Date.now() - state.lastSync.getTime() < DEFAULT_SYNC_INTERVAL / 2
    ) {
      return "cache-only";
    }

    return "full";
  }

  private updateFolderState(
    accountId: string | number,
    folder: string,
    updates: Partial<FolderSyncState>,
  ): void {
    const key = this.getSyncKey(accountId, folder);
    const existing = this._folderStates.get(key) ?? {
      lastSync: null,
      uidValidity: 0,
      uidNext: 0,
      lastUid: 0,
      messageCount: 0,
      isSyncing: false,
    };

    this._folderStates.set(key, {
      ...existing,
      ...updates,
    });

    this.saveStoredState();
  }

  private loadStoredState(): void {
    if (typeof window === "undefined") return;

    try {
      const tokensData = getPrincipalStorageItem("session", SYNC_TOKENS_KEY);
      if (tokensData) {
        const tokens = JSON.parse(tokensData) as Record<string, string>;
        for (const [key, value] of Object.entries(tokens)) {
          this._syncTokens.set(key, value);
        }
      }

      const statesData = getPrincipalStorageItem("session", SYNC_STATE_KEY);
      if (statesData) {
        const states = JSON.parse(statesData) as Record<
          string,
          FolderSyncState
        >;
        for (const [key, value] of Object.entries(states)) {
          if (value.lastSync) {
            value.lastSync = new Date(value.lastSync);
          }
          this._folderStates.set(key, value);
        }
      }
    } catch (error) {
      console.warn("[SyncService] Failed to load stored state:", error);
    }
  }

  private saveStoredState(): void {
    if (typeof window === "undefined") return;

    try {
      setPrincipalStorageItem(
        "session",
        SYNC_TOKENS_KEY,
        JSON.stringify(Object.fromEntries(this._syncTokens.entries())),
      );
      setPrincipalStorageItem(
        "session",
        SYNC_STATE_KEY,
        JSON.stringify(Object.fromEntries(this._folderStates.entries())),
      );
    } catch (error) {
      console.warn("[SyncService] Failed to save stored state:", error);
    }
  }

  /**
   * Full reset: clears all state including sync tokens.
   * Used when all sync state must be discarded (e.g., logout).
   */
  reset(): void {
    this.cancelSync();
    this._syncTokens.clear();
    this._folderStates.clear();
    this._isSyncing = false;
    this._lastSyncTime = null;
    this._syncError = null;

    if (typeof window !== "undefined") {
      removePrincipalStorageItem("session", SYNC_TOKENS_KEY);
      removePrincipalStorageItem("session", SYNC_STATE_KEY);
    }
  }

  /**
   * Soft reset: cancels in-flight syncs but preserves sync tokens.
   * Used on account switch so tokens survive for stale-while-revalidate
   * background diffs when the user returns to a previously visited folder.
   */
  softReset(): void {
    this.cancelSync();
    this._isSyncing = false;
    this._lastSyncTime = null;
    this._syncError = null;
  }
}

let syncServiceInstance: SyncService | null = null;

export function getSyncService(): SyncService {
  if (!syncServiceInstance) {
    syncServiceInstance = new SyncService();
  }
  return syncServiceInstance;
}

export function resetSyncService(): void {
  if (syncServiceInstance) {
    syncServiceInstance.reset();
  }
  syncServiceInstance = null;
}
