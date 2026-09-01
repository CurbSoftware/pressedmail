import type { SyncPhase, SystemFolderType } from "@/services/interfaces";
import { partitionFolders } from "@/layouts/shared/folders/standard-folder-order";

/**
 * Pure mailbox sync-progress helpers (aggregate counts + the single syncing
 * "frontier" folder). These are intentionally side-effect-free: progress must
 * NEVER be computed by a polling hook at the app root, doing so caused a
 * render-storm/freeze. Folder state refreshes are owned by the single boot hook
 * (useInboxSurfaceBoot); these helpers just read whatever folder list is current.
 */

/**
 * Folder shape these helpers need: a subset of NormalizedFolder so callers can
 * pass either NormalizedFolder[] or the raw folder rows.
 */
export interface SyncProgressFolder {
  systemType?: SystemFolderType;
  syncPhase?: SyncPhase;
  /**
   * Account-level connection health projected onto the folder. `auth_error`
   * means the owning account is permanently failed (bad/expired credentials) and
   * the folder cannot sync until it is re-authed, surfaced as a sync error, not
   * a spinner, even while the phase still reads bootstrap.
   */
  healthState?: string;
  /** Authoritative server message total for the folder. */
  messageCount?: number;
  /** Messages already mirrored locally for the folder. */
  mirroredCount?: number;
}

export interface MailboxSyncProgress {
  /** Total folders being tracked. */
  totalFolders: number;
  /** Folders not doing initial/bootstrap work. */
  syncedFolders: number;
  /** Sum of every folder's authoritative server message total. */
  totalEmails: number;
  /** Sum of every folder's locally-mirrored message count. */
  syncedEmails: number;
  /**
   * Whether the mailbox is actively doing initial folder work. Only a folder in
   * its bootstrap (first-ever fetch) phase counts; background backfill/stale are
   * cache maintenance and an auth-failed folder is an error, not "Syncing", so
   * none of those keep the footer saying "Syncing" forever.
   */
  isSyncing: boolean;
  /**
   * Whether at least one folder is still in its bootstrap (first-ever fetch)
   * phase. Used by the footer to distinguish a brand-new account's initial
   * sync from routine background refresh, surfaced as "Syncing new account".
   */
  isInitialSync: boolean;
  /**
   * Whether any tracked folder is in a degraded/error mirror state. Surfaced
   * by the footer as "Sync issue · mailbox needs attention".
   */
  hasSyncError: boolean;
  /**
   * 1-based position of the frontier (the single folder currently spinning, in
   * canonical sidebar order) among all still-syncing tracked folders. 0 when
   * nothing is syncing. Lets the footer say "syncing folders 1 of 3".
   */
  frontierIndex: number;
  /** Count of still-syncing (bootstrap) tracked folders. 0 when settled. */
  frontierTotal: number;
}

/**
 * Phases that mean a folder is still doing its INITIAL fetch and should show a
 * spinner. Only 'bootstrap' (no rows yet) counts: once a folder has its newest
 * page it is usable, so the spinner clears. 'backfill' (silently filling OLDER
 * history) must NOT show a spinner, it can run for many minutes on a large
 * mailbox and made the loader appear to spin forever with nothing happening.
 */
const SYNCING_PHASES = new Set<SyncPhase>(["bootstrap"]);
const SETTLE_PENDING_PHASES = new Set<SyncPhase>([
  "bootstrap",
  "backfill",
  "stale",
  "degraded",
]);
const ERROR_PHASES = new Set<SyncPhase>(["degraded"]);
const LOCAL_WORKFLOW_TYPES = new Set<SystemFolderType>([
  "scheduled",
  "snoozed",
  "important",
  "starred",
  "flagged",
]);

function isMirrorTrackedFolder(
  folder: Pick<SyncProgressFolder, "systemType">,
): boolean {
  return !folder.systemType || !LOCAL_WORKFLOW_TYPES.has(folder.systemType);
}

/**
 * Aggregate per-folder mirror progress into mailbox-wide counters.
 *
 * Pure + side-effect-free so it is trivially testable and can be reused by both
 * the footer counters and any inline progress UI.
 */
export function computeSyncProgress(
  folders: readonly SyncProgressFolder[],
): MailboxSyncProgress {
  let totalFolders = 0;
  let syncedFolders = 0;
  let totalEmails = 0;
  let syncedEmails = 0;
  let activeSyncingFolders = 0;
  let initialSyncFolders = 0;
  let errorFolders = 0;

  for (const folder of folders) {
    if (!isMirrorTrackedFolder(folder)) {
      continue;
    }

    totalFolders += 1;
    const phase: SyncPhase = folder.syncPhase ?? "steady";
    // A permanently auth-failed account cannot sync: it is an error, never a
    // spinner, even if the phase still reads bootstrap.
    const authFailed = folder.healthState === "auth_error";

    if (!authFailed && isFolderSyncing(phase)) {
      activeSyncingFolders += 1;
    } else {
      syncedFolders += 1;
    }

    if (!authFailed && phase === "bootstrap") {
      initialSyncFolders += 1;
    }

    if (authFailed || ERROR_PHASES.has(phase)) {
      errorFolders += 1;
    }

    const total = Math.max(0, Math.floor(folder.messageCount ?? 0));
    const mirroredRaw = Math.max(0, Math.floor(folder.mirroredCount ?? 0));
    // Never report more synced than the known total for a folder.
    const mirrored = total > 0 ? Math.min(mirroredRaw, total) : mirroredRaw;

    totalEmails += total;
    syncedEmails += mirrored;
  }

  const frontier = computeSyncFrontierPosition(folders);

  return {
    totalFolders,
    syncedFolders,
    totalEmails,
    syncedEmails,
    isSyncing: activeSyncingFolders > 0,
    isInitialSync: initialSyncFolders > 0,
    hasSyncError: errorFolders > 0,
    frontierIndex: frontier.index,
    frontierTotal: frontier.total,
  };
}

/**
 * The frontier's 1-based position among still-syncing folders plus the count of
 * `total` is the count of all mirror-tracked folders and `index` is the position
 * of the folder currently being worked, the (settled + 1)th), so the footer
 * advances "syncing folders 1 of 3" → "2 of 3" → "3 of 3" as each folder settles.
 * Both are 0 when nothing is syncing.
 */
export function computeSyncFrontierPosition(
  folders: readonly Pick<FrontierFolder, "systemType" | "syncPhase">[],
): { index: number; total: number } {
  const { standard, custom } = partitionFolders(folders);
  let total = 0;
  let settled = 0;
  let anySyncing = false;

  for (const folder of [...standard, ...custom]) {
    if (!isMirrorTrackedFolder(folder)) {
      continue;
    }
    total += 1;
    if (isFolderSyncing(folder.syncPhase)) {
      anySyncing = true;
    } else {
      settled += 1;
    }
  }

  if (!anySyncing) {
    return { index: 0, total: 0 };
  }

  return { index: Math.min(settled + 1, total), total };
}

/** Whether a folder is, on its own, still doing its initial fetch (bootstrap). */
export function isFolderSyncing(phase?: SyncPhase): boolean {
  return phase !== undefined && SYNCING_PHASES.has(phase);
}

/**
 * Whether the mailbox as a whole has active initial folder work. Only the
 * one-time 'bootstrap' phase counts: until it completes, the DB mirror has no
 * rows yet for that folder, so there is nothing to page through. Background
 * backfill/stale/degraded phases do NOT count. The mirror is the UI's
 * authoritative read/pagination source once bootstrap finishes, and those
 * phases keep running in the background without blocking reads. A missing
 * phase is treated as 'steady'.
 *
 * Mirrors computeSyncProgress().isSyncing.
 */
export function isMailboxStillMirroring(
  folders: readonly SyncProgressFolder[],
): boolean {
  return folders.some(
    (folder) =>
      isMirrorTrackedFolder(folder) && isFolderSyncing(folder.syncPhase),
  );
}

/**
 * Whether folder metadata should keep being refreshed by the boot hook's gentle
 * settle poll. This is intentionally broader than the footer/spinner predicate:
 * backfill/stale/degraded are not foreground syncing states, but their counts
 * and phases still need cheap DB snapshot refreshes until the folder reaches
 * steady.
 */
export function isMailboxSettlePending(
  folders: readonly SyncProgressFolder[],
): boolean {
  return folders.some(
    (folder) =>
      isMirrorTrackedFolder(folder) &&
      folder.syncPhase !== undefined &&
      SETTLE_PENDING_PHASES.has(folder.syncPhase),
  );
}

/** Folder shape needed to compute the sync frontier. */
export interface FrontierFolder {
  path: string;
  systemType?: SystemFolderType;
  syncPhase?: SyncPhase;
}

/**
 * The single "frontier" folder currently being mirrored: the FIRST still-syncing
 * folder in canonical sidebar order (Inbox → Important → … → custom). Only this
 * folder shows a spinner, so the mailbox fills visibly one folder at a time
 * (starting with the inbox) instead of every folder spinning at once. Returns the
 * folder path, or null when nothing is syncing.
 *
 * Virtual views (Important/Starred/Scheduled) are not real mirrored folders and
 * are excluded from `normalizedFolders`, so they never become the frontier.
 */
export function computeSyncFrontier(
  folders: readonly FrontierFolder[],
): string | null {
  const { standard, custom } = partitionFolders(folders);
  for (const folder of [...standard, ...custom]) {
    if (!isMirrorTrackedFolder(folder)) {
      continue;
    }

    if (isFolderSyncing(folder.syncPhase)) {
      return folder.path;
    }
  }
  return null;
}
