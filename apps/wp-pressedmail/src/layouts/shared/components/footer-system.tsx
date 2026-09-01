"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  Activity,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
} from "lucide-react";

import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
import { useWhitelabelTheme } from "@/layouts/shared/hooks/useWhitelabelTheme";
import { LogoFullLaunchSvg } from "@/components/Icons/brand-logos";
import { BrandedProductMark } from "@/components/branding/BrandedProductMark";

export type AppStatusBarConnectionStatus =
  | "connected"
  | "offline"
  | "connecting"
  | "error";

export type AppStatusBarSyncStatus = "idle" | "syncing" | "error" | "success";

export interface PaneFooterProps {
  left?: React.ReactNode;
  center?: React.ReactNode;
  right?: React.ReactNode;
  className?: string;
  testId?: string;
}

function hasContent(value: React.ReactNode): boolean {
  return value !== null && value !== undefined && value !== false;
}

export function PaneFooter({
  left,
  center,
  right,
  className,
  testId = "pane-footer",
}: PaneFooterProps) {
  if (!hasContent(left) && !hasContent(center) && !hasContent(right)) {
    return null;
  }

  return (
    <div
      className={cn(
        "flex h-[var(--pm-footer-height-pane)] shrink-0 items-center gap-3 overflow-hidden border-t border-border/60 bg-card px-[var(--pm-footer-padding-x)] text-xs text-muted-foreground",
        className,
      )}
      data-pm-footer="pane"
      data-test={testId}
      data-testid={testId}>
      <div className="min-w-0 flex-1 truncate">{left}</div>
      {hasContent(center) && (
        <div className="hidden min-w-0 shrink justify-center truncate md:flex">
          {center}
        </div>
      )}
      <div className="flex shrink-0 items-center justify-end gap-1.5">
        {right}
      </div>
    </div>
  );
}

export interface AppStatusBarProps {
  itemCount?: number;
  unreadCount?: number;
  syncStatus?: AppStatusBarSyncStatus;
  connectionStatus?: AppStatusBarConnectionStatus;
  hasAccount?: boolean;
  className?: string;
  /** Total folders tracked across the active mailbox(es). */
  totalFolders?: number;
  /** Folders not doing initial/bootstrap work. */
  syncedFolders?: number;
  /** Total server emails across all tracked folders. */
  totalEmails?: number;
  /** Emails already mirrored locally. */
  syncedEmails?: number;
  /** Whether any folder is doing active initial/bootstrap work. */
  isSyncing?: boolean;
  /**
   * Whether at least one folder is in its first-ever bootstrap fetch (e.g. a
   * brand-new account). Prefixed in the footer as "Syncing new account".
   */
  isInitialSync?: boolean;
  /**
   * Whether any tracked folder is in a degraded/error mirror state. Footer
   * surfaces "Sync issue · mailbox needs attention".
   */
  hasSyncError?: boolean;
  /** Admin disabled recurring automatic background sync (manual refresh still works). */
  autoSyncDisabled?: boolean;
  /**
   * 1-based position of the frontier (the folder currently spinning) among all
   * still-syncing folders. Drives the "syncing folders N of M" lead.
   */
  frontierIndex?: number;
  /** Count of still-syncing folders. 0 hides the "syncing folders N of M" lead. */
  frontierTotal?: number;
  /**
   * Label of the active process-queue task, appended as a trailing fragment
   * (e.g. "· Sweeping account1 inbox 1-50") while work is in flight.
   */
  processTaskLabel?: string | null;
  /**
   * Toggles the activity/process panel. When provided, an "Activity" toggle button
   * is shown at the right of the status bar (with an active-task count badge).
   */
  onToggleActivity?: () => void;
  /** Number of active (queued/running) background tasks: badge on the toggle. */
  activeTaskCount?: number;
  /** Whether the activity panel is currently open (drives aria-pressed). */
  activityOpen?: boolean;
}

function formatCount(count: number, singular: string, plural: string) {
  return count === 1 ? `1 ${singular}` : `${count.toLocaleString()} ${plural}`;
}

function getSyncLabel(status: AppStatusBarSyncStatus) {
  switch (status) {
    case "syncing":
      return __("Syncing", "pressedmail");
    case "error":
      return __("Sync issue", "pressedmail");
    case "success":
    case "idle":
    default:
      return __("Synced", "pressedmail");
  }
}

function getConnectionLabel(status: AppStatusBarConnectionStatus) {
  switch (status) {
    case "offline":
      return __("Offline", "pressedmail");
    case "connecting":
      return __("Connecting", "pressedmail");
    case "error":
      return __("Connection issue", "pressedmail");
    case "connected":
    default:
      return __("Connected", "pressedmail");
  }
}

/**
 * Build the mailbox sync-progress fragment shown on the right of the status bar:
 * a live "syncing folders 1 of 3 · 3/10 folders · X/Y emails" while mirroring,
 * or a settled "M folders · Y emails" once done. The "syncing folders N of M"
 * lead (when `frontierTotal > 0`) names how far through the still-syncing folders
 * the frontier is, so the footer fills visibly one folder at a time. Returns ""
 * when no folder totals are known.
 */
function getSyncProgressSummary(
  totalFolders: number | undefined,
  syncedFolders: number | undefined,
  totalEmails: number | undefined,
  syncedEmails: number | undefined,
  isSyncing: boolean,
  frontierIndex: number | undefined,
  frontierTotal: number | undefined,
): string {
  // Sync active but folder discovery itself has not produced a count yet,
  // surface this so the footer does not look broken on a brand-new account.
  if (isSyncing && (!totalFolders || totalFolders <= 0)) {
    return __("discovering folders and message counts…", "pressedmail");
  }

  if (!totalFolders || totalFolders <= 0) {
    return "";
  }

  const folderWord =
    totalFolders === 1
      ? __("folder", "pressedmail")
      : __("folders", "pressedmail");
  const emailWord = __("emails", "pressedmail");

  if (isSyncing) {
    const frontier =
      frontierTotal && frontierTotal > 0
        ? sprintf(
            /* translators: %1$d: current syncing folder, %2$d: folders left to sync. */
            __("syncing folders %1$d of %2$d", "pressedmail"),
            frontierIndex ?? 1,
            frontierTotal,
          )
        : "";
    const folders = `${(syncedFolders ?? 0).toLocaleString()}/${totalFolders.toLocaleString()} ${folderWord}`;
    const emails =
      totalEmails && totalEmails > 0
        ? ` · ${(syncedEmails ?? 0).toLocaleString()}/${totalEmails.toLocaleString()} ${emailWord}`
        : "";
    return [frontier, `${folders}${emails}`].filter(Boolean).join(" · ");
  }

  const folders = `${totalFolders.toLocaleString()} ${folderWord}`;
  const emails =
    totalEmails && totalEmails > 0
      ? ` · ${totalEmails.toLocaleString()} ${emailWord}`
      : "";
  return `${folders}${emails}`;
}

export function AppStatusBar({
  itemCount = 0,
  unreadCount = 0,
  syncStatus = "idle",
  connectionStatus = "connected",
  hasAccount = true,
  className,
  totalFolders,
  syncedFolders,
  totalEmails,
  syncedEmails,
  isSyncing = false,
  isInitialSync = false,
  hasSyncError = false,
  autoSyncDisabled = false,
  frontierIndex,
  frontierTotal,
  processTaskLabel,
  onToggleActivity,
  activeTaskCount = 0,
  activityOpen = false,
}: AppStatusBarProps) {
  const { isWhitelabelEnabled, hidePoweredBy, supportUrl, documentationUrl } =
    useWhitelabelTheme();
  const showPressedMailAttribution = !isWhitelabelEnabled || !hidePoweredBy;

  const left = hasAccount
    ? `${formatCount(itemCount, "item", "items")} · ${formatCount(
        unreadCount,
        "unread",
        "unread",
      )}`
    : __("No account connected", "pressedmail");

  // Lead label precedence:
  //   sync error  >  initial sync ("Syncing new account")
  //                >  active sync ("Syncing")
  //                >  manual-only  >  settled ("Synced")
  const syncLabel = hasSyncError
    ? __("Sync issue", "pressedmail")
    : isSyncing
      ? isInitialSync
        ? __("Syncing new account", "pressedmail")
        : getSyncLabel("syncing")
      : autoSyncDisabled
        ? __("Manual sync only", "pressedmail")
        : getSyncLabel(syncStatus);
  const progressSummary = hasAccount
    ? getSyncProgressSummary(
        totalFolders,
        syncedFolders,
        totalEmails,
        syncedEmails,
        isSyncing,
        frontierIndex,
        frontierTotal,
      )
    : "";
  const errorSuffix = hasSyncError
    ? __("mailbox needs attention", "pressedmail")
    : "";
  // The active process-queue task (e.g. an in-flight sweep) trails the rest of
  // the status so a long-running background operation stays visible.
  const taskFragment = processTaskLabel?.trim() ? processTaskLabel.trim() : "";
  const right = [
    syncLabel,
    errorSuffix,
    progressSummary,
    taskFragment,
    getConnectionLabel(connectionStatus),
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div
      className={cn(
        "flex h-[var(--pm-footer-height-status)] shrink-0 items-center gap-3 overflow-hidden border-t border-border/60 bg-muted/30 px-[var(--pm-footer-padding-x)] text-xs text-muted-foreground",
        className,
      )}
      data-pm-footer="global-status"
      data-test="app-status-bar"
      data-testid="app-status-bar">
      <span className="min-w-0 flex-1 truncate">{left}</span>
      <div className="flex shrink-0 items-center gap-2">
        {isWhitelabelEnabled ? (
          <BrandedProductMark
            testId="footer-branded-product-mark"
            imageClassName="h-3.5 w-auto max-w-24"
            nameClassName="text-xs"
          />
        ) : null}
        {supportUrl ? (
          <a
            href={supportUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground">
            {__("Support", "pressedmail")}
          </a>
        ) : null}
        {documentationUrl ? (
          <a
            href={documentationUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-foreground">
            {__("Documentation", "pressedmail")}
          </a>
        ) : null}
        {showPressedMailAttribution ? (
          <div className="flex items-center gap-1.5">
            {isWhitelabelEnabled ? (
              <span>{__("Powered by", "pressedmail")}</span>
            ) : null}
            <LogoFullLaunchSvg
              role="img"
              aria-label="PressedMail"
              data-test="status-bar-brand"
              data-testid="status-bar-brand"
              className="h-3.5 w-auto"
            />
            {typeof window !== "undefined" &&
              window.pressedmailPlugin?.version && (
                <span
                  className="text-xs text-muted-foreground"
                  data-test="status-bar-version"
                  data-testid="status-bar-version">
                  v{window.pressedmailPlugin.version}
                </span>
              )}
          </div>
        ) : null}
      </div>
      <span className="min-w-0 flex-1 truncate text-right">{right}</span>
      {onToggleActivity && (
        <Button
          variant="ghost"
          size="sm"
          type="button"
          onClick={onToggleActivity}
          aria-label={__("Toggle activity panel", "pressedmail")}
          aria-pressed={activityOpen}
          data-test="activity-status-toggle"
          data-testid="activity-status-toggle"
          className="h-6 shrink-0 gap-1 rounded-md px-1.5 text-xs text-muted-foreground hover:text-foreground">
          <Activity className="h-3.5 w-3.5" aria-hidden="true" />
          <span className="hidden sm:inline">
            {__("Activity", "pressedmail")}
          </span>
          {activeTaskCount > 0 && (
            <span
              data-test="activity-toggle-count"
              data-testid="activity-toggle-count"
              className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] font-medium tabular-nums text-primary-foreground">
              {activeTaskCount}
            </span>
          )}
        </Button>
      )}
    </div>
  );
}

export interface PaginationFooterProps {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  serverTotalItems?: number;
  hasMore?: boolean;
  unreadCount?: number;
  className?: string;
}

export function PaginationFooter({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
  serverTotalItems,
  hasMore,
  className,
}: PaginationFooterProps) {
  const effectiveTotal =
    typeof serverTotalItems === "number" && serverTotalItems > totalItems
      ? serverTotalItems
      : totalItems;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const pages = React.useMemo(
    () => Array.from({ length: totalPages }, (_, index) => index + 1),
    [totalPages],
  );

  const canGoPrev = currentPage > 1;
  const canGoNext = currentPage < totalPages || !!hasMore;
  const canGoLast = currentPage < totalPages;
  const startIdx = effectiveTotal === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endIdx = Math.min(currentPage * pageSize, effectiveTotal);
  const statusText =
    effectiveTotal === 0
      ? __("No messages", "pressedmail")
      : `${sprintf(
          __("Showing %1$d-%2$d of %3$d", "pressedmail"),
          startIdx,
          endIdx,
          effectiveTotal,
        )} · ${sprintf(
          __("Page %1$d of %2$d", "pressedmail"),
          currentPage,
          totalPages,
        )}`;

  const controls = (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-7 w-7 after:absolute after:-inset-2 after:content-['']"
        disabled={!canGoPrev}
        onClick={() => onPageChange(1)}
        aria-label={__("First page", "pressedmail")}>
        <ChevronsLeft className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-7 w-7 after:absolute after:-inset-2 after:content-['']"
        disabled={!canGoPrev}
        onClick={() => onPageChange(currentPage - 1)}
        aria-label={__("Previous page", "pressedmail")}>
        <ChevronLeft className="h-3.5 w-3.5" />
      </Button>

      {totalPages > 1 && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="relative h-7 min-w-24 gap-1 px-2 text-xs font-medium text-foreground after:absolute after:-inset-2 after:content-[''] hover:bg-accent hover:text-accent-foreground"
              aria-label={__("Choose page", "pressedmail")}>
              <span className="tabular-nums">
                {sprintf(
                  __("Page %1$d / %2$d", "pressedmail"),
                  currentPage,
                  totalPages,
                )}
              </span>
              <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align="end"
            sideOffset={6}
            data-test="pagination-page-menu"
            className="max-h-[17.5rem] min-w-32 overflow-y-auto border-border bg-popover p-1 text-popover-foreground shadow-md">
            {pages.map((page) => {
              const isActive = page === currentPage;
              return (
                <DropdownMenuItem
                  key={page}
                  data-test={`pagination-page-${page}`}
                  onSelect={() => onPageChange(page)}
                  className={cn(
                    "flex h-7 cursor-pointer items-center justify-between rounded-sm px-2 text-xs tabular-nums outline-none hover:bg-accent hover:text-accent-foreground",
                    isActive && "bg-primary text-primary-foreground",
                  )}
                  aria-label={sprintf(
                    __("Go to page %d", "pressedmail"),
                    page,
                  )}>
                  <span>{page}</span>
                  {isActive && (
                    <span className="text-[10px] font-medium">
                      {__("Current", "pressedmail")}
                    </span>
                  )}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>
      )}

      <Button
        variant="ghost"
        size="icon"
        className="relative h-7 w-7 after:absolute after:-inset-2 after:content-['']"
        disabled={!canGoNext}
        onClick={() => onPageChange(currentPage + 1)}
        aria-label={__("Next page", "pressedmail")}>
        <ChevronRight className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="relative h-7 w-7 after:absolute after:-inset-2 after:content-['']"
        disabled={!canGoLast}
        onClick={() => onPageChange(totalPages)}
        aria-label={__("Last page", "pressedmail")}>
        <ChevronsRight className="h-3.5 w-3.5" />
      </Button>
    </>
  );

  return (
    <PaneFooter
      className={className}
      testId="pagination-footer"
      left={
        <span
          data-test="pagination-status"
          data-testid="pagination-status"
          className="truncate">
          {statusText}
        </span>
      }
      right={controls}
    />
  );
}
