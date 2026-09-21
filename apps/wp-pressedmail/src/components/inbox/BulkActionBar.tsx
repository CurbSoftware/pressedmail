"use client";

/**
 * BulkActionBar Component
 *
 * Appears when emails are selected, providing bulk operations:
 * - Mark read/unread
 * - Archive
 * - Delete
 * - Move to folder
 * - Clear selection
 *
 * @since 3.0.0
 */

import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { __, _x, sprintf } from "@wordpress/i18n";
import {
  ChevronLeft,
  ChevronRight,
  FolderInput,
  ListChecks,
  Loader2,
  Play,
  Tags,
  X,
} from "lucide-react";
import {
  folderMutationTarget,
  folderTargetKey,
  type MutationTarget,
} from "@/lib/folder-target";
import {
  EmailArchiveIcon,
  EmailJunkIcon,
  EmailMarkReadIcon,
  EmailMarkUnreadIcon,
  EmailMoreActionsIcon,
  EmailSweepIcon,
  EmailSummaryIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";
import { cn } from "@/lib/utils";
import { surfaceApiAuthError } from "@/lib/api-auth-errors";
import {
  getMessageIdentityKey,
  getMessageIdentityRef,
} from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";
import { mergeThreadCandidates } from "@/lib/message-grouping";
import {
  buildMessageTagUpdate,
  getFolderRole,
  getBulkMoveTargetFolders,
  getMessageTagList,
  hasMessageTag,
  resolveArchiveMoveTarget,
  resolveJunkMoveTarget,
  resolveTrashMoveTarget,
} from "@/lib/bulk-mail-actions";
import { resolveMessageAccountId } from "@/lib/message-identity";
import { toPhishingEmailData } from "@/lib/phishing-email";
import { usePhishing } from "@/context/phishing/PhishingContext";
import { PhishingRodIcon } from "@/components/icons/PhishingIcons";
import { useEmailSummaries } from "@/context/email-summary";
import {
  useAiBulkLimits,
  useFeatureAvailable,
  useFeatureEnabled,
} from "@/context/features/FeaturesContext";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { getCacheService, getInboxService } from "@/services/implementations";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { getEffectiveConsolidatedAccountIdsForLayout } from "@/lib/consolidated-account-scope";
import { useLayout } from "@/components/layouts";
import { getConsolidatedFolderMapForPath } from "@/lib/consolidated-folder-map";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  AlertDialog,
  AlertDialogCancel,
} from "@kit/ui/plugin";
import { toast } from "@kit/ui/plugin";
import { useEmailSelection } from "@/context/selection";
import { useTags } from "@/context/tags";
import {
  useInboxState,
  useMessageOperations,
  useFolderOperations,
  useFilterOperations,
} from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { useOptionalScheduledEmails } from "@/context/scheduled/ScheduledEmailsContext";
import { EmailSweep, type EmailSweepSelection } from "./EmailSweep";
import {
  useAutoTagger,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import {
  fetchFilterRules,
  previewFilterRuleRun,
  startFilterRuleRun,
} from "@/services/filter-rules.service";
import type { FilterRule } from "@/types/filter-rules";
import { ruleCanRunManually } from "@/types/filter-rules";
import {
  SnoozePopover,
  type SnoozeTarget,
  type SnoozeTargetCandidate,
} from "@/components/snooze/snooze-popover";
import {
  getSnoozeTargetIdentityKey,
  parseSnoozeTarget,
} from "@/components/snooze/snooze-target";
import { SnoozeClockIcon } from "@/components/icons/FolderIcons";
import { MailTagActionDropdown } from "./MailTagActionDropdown";
import {
  PRESSED_OUT_RIBBON_ICON_CLASS,
  PressedOutRibbonButton,
} from "@/components/inbox/ribbon/RibbonButton";
import { MAIL_ACTION_ICON_CLASS } from "./reading-pane-action-icons";
import { useOverflowScroll } from "./useOverflowScroll";
import { useWarnIfBusy } from "@/hooks/useWarnIfBusy";
import { resolveInboxActionVisibility } from "@/lib/inbox-action-visibility";
import {
  type StartOneOffSweepRequest,
  type SweepScope,
} from "@/services/one-off-sweep.service";
import { enqueueSweepQueue } from "@/services/process-queue.service";
import { buildSweepScope } from "@/lib/sweep-scope";
import {
  beginBulkActivity,
  type BulkActivityReporter,
} from "@/lib/bulk-activity";
import { refreshProcessQueue } from "@/hooks/useProcessQueue";
import type { EmailMessage, EmailMessageTag } from "@/types";
import type {
  BatchOperationResult,
  FolderTarget,
  ImapFolder,
} from "@/services/interfaces";

export interface BulkActionBarProps {
  className?: string;
  variant?: "default" | "pressedout-command";
}

type BulkAiOperation = "summary" | "phishing" | "autotag";
// Matches MessageService.BATCH_CHUNK_SIZE so one snapshot page is exactly one
// mutation request, at 50 a sweep issued twice the requests it needed and hit
// the server's per-minute mutation limit twice as fast.
const BULK_CURRENT_VIEW_PAGE_SIZE = 100;

interface PendingBulkAiState {
  op: BulkAiOperation;
  force: boolean;
  longRun: boolean;
  existingCount: number;
}

function getBulkAiMessageBody(message: EmailMessage): string {
  return (
    message.plainBody ||
    message.textBody ||
    message.body ||
    message.htmlBody ||
    message.text ||
    message.snippet ||
    message.preview ||
    ""
  );
}

function normalizeTagName(value: string): string {
  return value.trim().toLowerCase();
}

function mergeAiReturnedTags(
  message: EmailMessage,
  returnedTags: Array<{ id?: number; name?: string }>,
  availableTags: Array<{
    id: number;
    name: string;
    color: string;
    icon?: string | null;
  }>,
): EmailMessageTag[] {
  const next = [...getMessageTagList(message)];
  const seen = new Set(next.map((tag) => Number(tag.id)));

  for (const returned of returnedTags) {
    const matched =
      availableTags.find((tag) => Number(tag.id) === Number(returned.id)) ??
      availableTags.find(
        (tag) =>
          returned.name &&
          normalizeTagName(tag.name) === normalizeTagName(returned.name),
      );

    if (!matched || seen.has(Number(matched.id))) continue;
    seen.add(Number(matched.id));
    next.push({
      id: matched.id,
      name: matched.name,
      color: matched.color,
      icon: matched.icon ?? null,
    });
  }

  return next;
}

function resolveCurrentFolderRole(
  folders: ImapFolder[],
  selectedFolder: string | null | undefined,
): string | null {
  const normalizedSelected = String(selectedFolder ?? "")
    .trim()
    .toLowerCase();
  const matchedFolder = folders.find((folder) => {
    const path = String(folder.path ?? "")
      .trim()
      .toLowerCase();
    const name = String(folder.name ?? "")
      .trim()
      .toLowerCase();
    return (
      normalizedSelected !== "" &&
      (path === normalizedSelected || name === normalizedSelected)
    );
  });

  if (matchedFolder) {
    return getFolderRole(matchedFolder);
  }

  if (!selectedFolder) {
    return null;
  }

  return getFolderRole({
    name: selectedFolder,
    path: selectedFolder,
    count: 0,
  });
}

export function BulkActionBar({
  className,
  variant = "default",
}: BulkActionBarProps) {
  const { hasSelection, clearSelection, getSelectionSnapshot } =
    useEmailSelection();
  const hasBulkSelection = hasSelection();
  const {
    batchMarkRead,
    batchMarkReadMessages,
    batchMarkUnread,
    batchMarkUnreadMessages,
    batchDelete,
    batchDeleteMessages,
    batchMove,
    batchMoveMessages,
  } = useMessageOperations();
  const { messages, threadGroups, loadMessagesSnapshot } = useInboxState();
  const scheduledEmails = useOptionalScheduledEmails();
  const { folders, selectedFolder, getMoveTargetFolders } =
    useFolderOperations();
  const { accounts, selectedAccount, selectedConsolidatedAccountIds } =
    useAppContext();
  const { currentLayout } = useLayout();
  const {
    analyzeEmail,
    getAnalysisResult,
    isEnabled: phishingEnabled,
  } = usePhishing();
  const { summarizeMessages, getSummary, isSummarizing } = useEmailSummaries();
  const aiSummarizeAvailable = useFeatureAvailable("ai_summarize");
  const snoozeEnabled = useFeatureEnabled("snooze");
  const { classifyEmails } = useAutoTagger();
  const autoTaggerAvailable = useAutoTaggerToolAvailable();
  const aiBulkLimits = useAiBulkLimits();
  const { tags, batchAssignTag, batchRemoveTag } = useTags();
  const { activeFilters, applyFilters } = useFilterOperations();
  const [isTagging, setIsTagging] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [sweepOpen, setSweepOpen] = useState(false);
  const [isAutoTagging, setIsAutoTagging] = useState(false);
  const [isMovingJunk, setIsMovingJunk] = useState(false);
  const [isPhishingChecking, setIsPhishingChecking] = useState(false);
  const [bulkAiJob, setBulkAiJob] = useState<BulkAiOperation | null>(null);
  const [bulkAiAbortController, setBulkAiAbortController] =
    useState<AbortController | null>(null);
  const stopAiQueueRequestedRef = useRef(false);
  // Op queued behind the "this may take a while" confirmation; null when no
  // confirmation is pending.
  const [pendingBulkAi, setPendingBulkAi] = useState<PendingBulkAiState | null>(
    null,
  );

  // Warn before refresh/navigation while a bulk AI queue is running. PressedOut
  // stays visible without a selection, so abort its queue when selection clears.
  useWarnIfBusy(bulkAiJob !== null);
  const bulkAiAbortRef = useRef<AbortController | null>(null);
  bulkAiAbortRef.current = bulkAiAbortController;
  useEffect(() => {
    if (variant !== "pressedout-command" || hasBulkSelection) return;
    stopAiQueueRequestedRef.current = true;
    bulkAiAbortRef.current?.abort();
  }, [hasBulkSelection, variant]);
  useEffect(
    () => () => {
      stopAiQueueRequestedRef.current = true;
      bulkAiAbortRef.current?.abort();
    },
    [],
  );
  const [organizeOpen, setOrganizeOpen] = useState(false);
  const [organizeRules, setOrganizeRules] = useState<FilterRule[]>([]);
  const [organizeLoading, setOrganizeLoading] = useState(false);
  const [pendingOrganizeRule, setPendingOrganizeRule] =
    useState<FilterRule | null>(null);
  const [ruleRunLoading, setRuleRunLoading] = useState(false);

  const archiveTarget = useMemo(
    () => resolveArchiveMoveTarget(folders),
    [folders],
  );
  const trashPath = useMemo(() => resolveTrashMoveTarget(folders), [folders]);
  const currentFolderRole = useMemo(() => {
    const folderRole = resolveCurrentFolderRole(folders, selectedFolder);
    const isScheduledView =
      folderRole === "drafts" &&
      messages.length > 0 &&
      messages.every((message) => message.isScheduled === true);
    return isScheduledView ? "scheduled" : folderRole;
  }, [folders, messages, selectedFolder]);
  const isDraftLikeFolder =
    currentFolderRole === "drafts" || currentFolderRole === "scheduled";

  // Inline horizontal slide: when the action row is too wide for the (often
  // narrowed) list panel, chevrons appear to page the single row sideways.
  const {
    ref: actionScrollRef,
    canScrollPrevious,
    canScrollNext,
    isRtl: isActionScrollRtl,
    scrollPrevious: scrollActionsPrevious,
    scrollNext: scrollActionsNext,
    update: updateActionOverflow,
  } = useOverflowScroll<HTMLDivElement>();
  const PreviousActionOverflowIcon = isActionScrollRtl
    ? ChevronRight
    : ChevronLeft;
  const NextActionOverflowIcon = isActionScrollRtl ? ChevronLeft : ChevronRight;

  const selectionSnapshot = getSelectionSnapshot();
  const selectionScopeKey = JSON.stringify([
    selectedAccount,
    currentLayout,
    selectedAccount === CONSOLIDATED_INBOX_VALUE
      ? accounts.map((account) => String(account.id)).sort()
      : [],
    [...selectedConsolidatedAccountIds].sort((a, b) => a - b),
    selectedFolder,
    getMessageFilterSignature(activeFilters),
    selectionSnapshot.mode,
    selectionSnapshot.mode === "explicit"
      ? [...selectionSnapshot.selectedIds].sort()
      : [
          selectionSnapshot.scopeKey,
          selectionSnapshot.totalCount,
          [...selectionSnapshot.excludedIds].sort(),
        ],
  ]);
  // Replace the token at every observed transition, including A -> B -> A.
  const selectionScopeRef = useRef({ key: selectionScopeKey });
  if (selectionScopeRef.current.key !== selectionScopeKey)
    selectionScopeRef.current = { key: selectionScopeKey };
  const selectionScope = selectionScopeRef.current;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const captureBulkScope = useCallback(() => {
    const scope = selectionScopeRef.current;
    const principal = captureRequestPrincipal();
    return {
      isCurrent: () =>
        mountedRef.current &&
        scope === selectionScopeRef.current &&
        isRequestPrincipalCurrent(principal),
      isPrincipalCurrent: () => isRequestPrincipalCurrent(principal),
    };
  }, []);

  const selectedMessages = useMemo(() => {
    // Include rendered thread-child rows (served via threadGroups): a checked
    // thread child was otherwise dropped from every bulk op and sweep seed.
    const candidates = mergeThreadCandidates(messages, threadGroups);
    const snapshot = getSelectionSnapshot();
    if (snapshot.mode === "current-view") {
      return candidates.filter(
        (message) => !snapshot.excludedIds.has(getMessageIdentityKey(message)),
      );
    }

    return candidates.filter((m) =>
      snapshot.selectedIds.has(getMessageIdentityKey(m)),
    );
  }, [messages, threadGroups, getSelectionSnapshot]);

  const validateSelectedMessages = useCallback(() => {
    const snapshot = getSelectionSnapshot();
    const count =
      snapshot.mode === "explicit"
        ? snapshot.selectedIds.size
        : Math.max(0, snapshot.totalCount - snapshot.excludedIds.size);
    if (
      count !== selectedMessages.length ||
      selectedMessages.some((message) => !getMessageIdentityRef(message))
    ) {
      toast.error(
        __(
          "Reload the mailbox before changing selected messages.",
          "pressedmail",
        ),
      );
      return false;
    }
    return count > 0;
  }, [getSelectionSnapshot, selectedMessages]);

  useEffect(() => {
    setPendingBulkAi(null);
    setPendingOrganizeRule(null);
    setOrganizeOpen(false);
    setSweepOpen(false);
    stopAiQueueRequestedRef.current = true;
    bulkAiAbortRef.current?.abort();
  }, [selectionScope]);

  const runCurrentViewMessageBatches = useCallback(
    async (
      snapshot: Extract<
        ReturnType<typeof getSelectionSnapshot>,
        { mode: "current-view" }
      >,
      op: (messages: EmailMessage[]) => Promise<BatchOperationResult>,
      options: { refetchFromStart?: boolean; isCurrent: () => boolean },
    ): Promise<BatchOperationResult> => {
      const targetCount = Math.max(
        0,
        snapshot.totalCount - snapshot.excludedIds.size,
      );
      if (targetCount === 0) {
        return {
          success: true,
          successCount: 0,
          failedIds: [],
          totalCount: 0,
        };
      }

      let offset = 0;
      let attemptedCount = 0;
      let successCount = 0;
      let firstError: string | undefined;
      let firstWarning: string | undefined;
      const failedIds: (string | number)[] = [];
      const processedIds = new Set(snapshot.excludedIds);

      while (attemptedCount < targetCount) {
        if (!options.isCurrent()) break;
        const page = await loadMessagesSnapshot({
          offset,
          limit: BULK_CURRENT_VIEW_PAGE_SIZE,
          forceRefresh: true,
        });
        if (!options.isCurrent()) break;
        if (!page.success) {
          return {
            success: false,
            successCount,
            failedIds,
            totalCount: targetCount,
            error:
              page.error ||
              __("Failed to load selected messages", "pressedmail"),
          };
        }

        if (page.messages.length === 0) break;

        const candidates = page.messages.filter((message) => {
          const id = getMessageIdentityKey(message);
          return id !== "" && !processedIds.has(id);
        });

        if (candidates.length === 0) {
          offset += BULK_CURRENT_VIEW_PAGE_SIZE;
          if (offset >= Math.max(page.total, snapshot.totalCount)) break;
          continue;
        }

        const result = await op(candidates);
        const candidateIds = candidates.map(getMessageIdentityKey);
        candidateIds.forEach((id) => {
          if (id !== "") processedIds.add(id);
        });
        attemptedCount += candidateIds.filter((id) => id !== "").length;
        successCount +=
          result.successCount ?? (result.success ? candidates.length : 0);
        failedIds.push(...(result.failedIds ?? []));
        firstWarning ??= result.warning;
        if (!result.success && !firstError) {
          firstError = result.error;
        }

        if (options.refetchFromStart) {
          offset = 0;
        } else {
          offset += BULK_CURRENT_VIEW_PAGE_SIZE;
        }
      }

      return {
        success: failedIds.length === 0 && !firstError,
        successCount,
        failedIds,
        totalCount: targetCount,
        error: firstError,
        warning: firstWarning,
      };
    },
    [getSelectionSnapshot, loadMessagesSnapshot],
  );

  const handleBatchOp = useCallback(
    async (
      op: (ids: (string | number)[]) => Promise<BatchOperationResult>,
      successMsg: string,
      options: {
        messageOp?: (messages: EmailMessage[]) => Promise<BatchOperationResult>;
        failureMsg?: string;
        refetchFromStart?: boolean;
      } = {},
    ) => {
      const snapshot = getSelectionSnapshot();
      if (snapshot.mode === "explicit" && snapshot.selectedIds.size === 0) {
        return;
      }
      if (
        snapshot.mode === "current-view" &&
        snapshot.totalCount <= snapshot.excludedIds.size
      ) {
        return;
      }

      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;
      setIsLoading(true);
      try {
        const result =
          snapshot.mode === "current-view"
            ? options.messageOp
              ? await runCurrentViewMessageBatches(
                  snapshot,
                  options.messageOp,
                  {
                    refetchFromStart: options.refetchFromStart,
                    isCurrent: captured.isCurrent,
                  },
                )
              : {
                  success: false,
                  error: __(
                    "Operation is not available for all emails",
                    "pressedmail",
                  ),
                  successCount: 0,
                  failedIds: [],
                  totalCount: 0,
                }
            : await op(Array.from(snapshot.selectedIds));
        if (!captured.isCurrent()) return;
        if (result.success) {
          toast.success(successMsg);
          clearSelection();
        } else {
          const failCount =
            "failedIds" in result ? (result.failedIds?.length ?? 0) : 0;
          const errorMessage = "error" in result ? result.error : "";
          toast.error(
            errorMessage ||
              `${failCount} ${failCount === 1 ? "message" : "messages"} failed`,
          );
        }
        if (result.warning) toast.warning(result.warning);
      } catch {
        if (!captured.isCurrent()) return;
        toast.error(
          options.failureMsg || __("Operation failed", "pressedmail"),
        );
      } finally {
        if (mountedRef.current && captured.isPrincipalCurrent())
          setIsLoading(false);
      }
    },
    [
      getSelectionSnapshot,
      runCurrentViewMessageBatches,
      clearSelection,
      captureBulkScope,
    ],
  );

  const handleMarkRead = useCallback(
    () =>
      handleBatchOp(batchMarkRead, __("Marked as read", "pressedmail"), {
        messageOp: batchMarkReadMessages,
        refetchFromStart: Boolean(activeFilters.readStatus),
      }),
    [
      activeFilters.readStatus,
      handleBatchOp,
      batchMarkRead,
      batchMarkReadMessages,
    ],
  );

  const handleMarkUnread = useCallback(
    () =>
      handleBatchOp(batchMarkUnread, __("Marked as unread", "pressedmail"), {
        messageOp: batchMarkUnreadMessages,
        refetchFromStart: Boolean(activeFilters.readStatus),
      }),
    [
      activeFilters.readStatus,
      handleBatchOp,
      batchMarkUnread,
      batchMarkUnreadMessages,
    ],
  );

  const deleteScheduledMessages = useCallback(
    async (sourceMessages: EmailMessage[]): Promise<BatchOperationResult> => {
      const captured = captureBulkScope();
      const failedIds: (string | number)[] = [];
      let successCount = 0;
      let firstError: string | undefined;

      for (const message of sourceMessages) {
        if (!captured.isCurrent()) break;
        const localId = getMessageIdentityKey(message);
        const scheduledId = Number(message.scheduledEmailId);
        if (
          !scheduledEmails ||
          !Number.isInteger(scheduledId) ||
          scheduledId <= 0
        ) {
          failedIds.push(localId);
          firstError ??= __(
            "Scheduled email could not be identified",
            "pressedmail",
          );
          continue;
        }

        const result = await scheduledEmails.deleteEmail(scheduledId);
        if (!captured.isPrincipalCurrent()) break;
        if (result.status === "success") {
          successCount += 1;
          getInboxService().removeMessage(localId);
        } else {
          failedIds.push(localId);
          firstError ??= result.message;
        }
      }

      return {
        success: failedIds.length === 0,
        successCount,
        failedIds,
        totalCount: sourceMessages.length,
        error: firstError,
      };
    },
    [scheduledEmails, captureBulkScope],
  );

  const handleDelete = useCallback(() => {
    if (currentFolderRole === "scheduled") {
      return handleBatchOp(
        (ids) =>
          deleteScheduledMessages(
            selectedMessages.filter((message) =>
              ids.map(String).includes(getMessageIdentityKey(message)),
            ),
          ),
        __("Messages deleted", "pressedmail"),
        {
          messageOp: deleteScheduledMessages,
          refetchFromStart: true,
        },
      );
    }

    if (currentFolderRole === "drafts") {
      return handleBatchOp(batchDelete, __("Messages deleted", "pressedmail"), {
        messageOp: batchDeleteMessages,
        refetchFromStart: true,
      });
    }

    return handleBatchOp(
      (ids) => batchMove(ids, trashPath),
      __("Messages deleted", "pressedmail"),
      {
        messageOp: (selectedMessages) =>
          batchMoveMessages(selectedMessages, trashPath),
        refetchFromStart: true,
      },
    );
  }, [
    batchDelete,
    batchDeleteMessages,
    batchMove,
    batchMoveMessages,
    currentFolderRole,
    deleteScheduledMessages,
    handleBatchOp,
    selectedMessages,
    trashPath,
  ]);

  const handleArchive = useCallback(async () => {
    await handleBatchOp(
      (ids) => batchMove(ids, archiveTarget),
      __("Messages archived", "pressedmail"),
      {
        messageOp: (selectedMessages) =>
          batchMoveMessages(selectedMessages, archiveTarget),
        failureMsg: __("Archive failed", "pressedmail"),
        refetchFromStart: true,
      },
    );
  }, [archiveTarget, batchMove, batchMoveMessages, handleBatchOp]);

  const handleMove = useCallback(
    async (targetFolder: MutationTarget) => {
      await handleBatchOp(
        (selectedIds) => batchMove(selectedIds, targetFolder),
        __("Messages moved", "pressedmail"),
        {
          messageOp: (selectedMessages) =>
            batchMoveMessages(selectedMessages, targetFolder),
          failureMsg: __("Move failed", "pressedmail"),
          refetchFromStart: true,
        },
      );
    },
    [batchMove, batchMoveMessages, handleBatchOp],
  );

  const accountIdForCreate = useMemo(() => {
    const acc = accounts.find((a) => a.email === selectedAccount);
    return acc?.id ? Number(acc.id) : null;
  }, [accounts, selectedAccount]);
  const isConsolidatedRuleScope = selectedAccount === CONSOLIDATED_INBOX_VALUE;
  const consolidatedRuleAccountIds = useMemo(
    () =>
      isConsolidatedRuleScope
        ? getEffectiveConsolidatedAccountIdsForLayout(
            accounts,
            selectedConsolidatedAccountIds,
            undefined,
            currentLayout,
          )
        : [],
    [
      accounts,
      currentLayout,
      isConsolidatedRuleScope,
      selectedConsolidatedAccountIds,
    ],
  );
  const consolidatedRuleFolderMap = useMemo(
    () =>
      isConsolidatedRuleScope
        ? getConsolidatedFolderMapForPath(folders, selectedFolder || "INBOX")
        : undefined,
    [folders, isConsolidatedRuleScope, selectedFolder],
  );

  const sweepScope = useMemo<SweepScope | null>(
    () =>
      buildSweepScope({
        accounts,
        selectedAccount,
        selectedConsolidatedAccountIds,
        selectedFolder,
        currentFolderRole,
        folders,
        layoutId: currentLayout,
      }),
    [
      accounts,
      currentLayout,
      currentFolderRole,
      folders,
      selectedAccount,
      selectedConsolidatedAccountIds,
      selectedFolder,
    ],
  );
  // Snapshot the live selection for the sweep dialog: the count drives the
  // default scope choice (selected-only vs entire view); a select-all snapshot
  // contributes its exclusions to the entire-view scope.
  const sweepSelection: EmailSweepSelection =
    selectionSnapshot.mode === "current-view"
      ? {
          selectedCount: Math.max(
            selectionSnapshot.totalCount - selectionSnapshot.excludedIds.size,
            0,
          ),
          excludedIds: Array.from(selectionSnapshot.excludedIds),
          totalCount: selectionSnapshot.totalCount,
        }
      : { selectedCount: selectionSnapshot.selectedIds.size };

  const handleOneOffSweepRun = useCallback(
    async (request: StartOneOffSweepRequest) => {
      const captured = captureBulkScope();
      if (!captured.isCurrent())
        throw new Error("The selection changed. Reopen Sweep and retry.");
      // Route the sweep through the process / activity queue so the work shows
      // up in the activity panel + footer and drains in the background.
      const result = await enqueueSweepQueue({
        selected_message_ids: request.selected_message_ids,
        scope: request.scope,
        action: request.action,
        sweep_scope_mode: request.sweep_scope_mode,
        destination: request.destination,
        destination_folder_target: request.destination_folder_target ?? null,
        destination_folder_role: request.destination_folder_role,
        match: request.match,
        create_rule: request.create_rule ?? false,
        excluded_message_ids: request.excluded_message_ids,
      });
      if (!captured.isCurrent()) return result;
      toast.success(
        result.deduplicated
          ? __("That sweep is already running", "pressedmail")
          : __("Added to the activity queue", "pressedmail"),
      );
      refreshProcessQueue();
      clearSelection();
      return result;
    },
    [clearSelection, captureBulkScope],
  );
  const isTrashFolder = currentFolderRole === "trash";
  const isJunkFolder =
    currentFolderRole === "spam" || currentFolderRole === "junk";

  // Organize: load saved rules for the active account when the menu opens,
  // then start a server-side rule run against either the explicit selection or
  // the whole current view. Whole-view runs sync the mailbox mirror first.
  const loadOrganizeRules = useCallback(async () => {
    const captured = captureBulkScope();
    if (!captured.isCurrent()) return;
    setOrganizeLoading(true);
    try {
      // Combined view: account-scoped rules live under each account id, so a
      // single account-0 fetch hid every per-account rule from the menu.
      const accountIds = isConsolidatedRuleScope
        ? [0, ...consolidatedRuleAccountIds]
        : [accountIdForCreate ?? 0];
      const lists = await Promise.all(
        accountIds.map((accountId) =>
          fetchFilterRules(accountId).catch(() => [] as FilterRule[]),
        ),
      );
      if (!captured.isCurrent()) return;
      const byId = new Map<string | number, FilterRule>();
      for (const rule of lists.flat()) {
        if (rule.enabled && ruleCanRunManually(rule)) {
          byId.set(rule.id, rule);
        }
      }
      setOrganizeRules([...byId.values()]);
    } catch {
      if (captured.isCurrent()) setOrganizeRules([]);
    } finally {
      if (mountedRef.current && captured.isPrincipalCurrent())
        setOrganizeLoading(false);
    }
  }, [
    accountIdForCreate,
    consolidatedRuleAccountIds,
    isConsolidatedRuleScope,
    captureBulkScope,
  ]);

  const handleOrganizeOpenChange = useCallback(
    (open: boolean) => {
      setOrganizeOpen(open);
      if (open) void loadOrganizeRules();
    },
    [loadOrganizeRules],
  );

  const selectedRuleRefs = useMemo(
    () =>
      selectedMessages.map((message) => {
        const accountId =
          resolveMessageAccountId(message, accounts, selectedAccount) ??
          accountIdForCreate ??
          0;
        return {
          accountId,
          uid: message.uid == null ? "" : String(message.uid),
          uidValidity: String(
            message.uidValidity ?? message.uid_validity ?? "",
          ),
          folder: typeof message.folder === "string" ? message.folder : "",
        };
      }),
    [
      selectedMessages,
      accounts,
      selectedAccount,
      accountIdForCreate,
      selectedFolder,
    ],
  );

  const handleRunRule = useCallback((rule: FilterRule) => {
    setPendingOrganizeRule(rule);
    setOrganizeOpen(false);
  }, []);

  const runPendingRule = useCallback(
    async (mode: "selection" | "view") => {
      if (!pendingOrganizeRule) return;
      if (mode === "selection" && !validateSelectedMessages()) return;
      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;

      if (mode === "selection" && selectedRuleRefs.length === 0) {
        toast.info(__("No selected emails can be organized", "pressedmail"));
        setPendingOrganizeRule(null);
        return;
      }

      const request = {
        ruleIds: [pendingOrganizeRule.id],
        scope: {
          mode,
          accountId: accountIdForCreate ?? 0,
          accountIds:
            mode === "view" && isConsolidatedRuleScope
              ? consolidatedRuleAccountIds
              : [],
          folder: selectedFolder || "INBOX",
          folderMap:
            mode === "view" && consolidatedRuleFolderMap
              ? consolidatedRuleFolderMap
              : {},
          filters: mode === "view" ? activeFilters : {},
          syncFirst: mode === "view",
          refs: mode === "selection" ? selectedRuleRefs : [],
        },
      };

      setRuleRunLoading(true);
      try {
        if (mode === "view") {
          const preview = await previewFilterRuleRun(request);
          if (!captured.isCurrent()) return;
          if (preview.supportedRuleIds.length === 0) {
            toast.info(
              __(
                "That rule cannot run over the current mailbox view",
                "pressedmail",
              ),
            );
            return;
          }
          if (preview.candidateCount === 0) {
            toast.info(__("No emails matched the current view", "pressedmail"));
            return;
          }
        }

        if (!captured.isCurrent()) return;
        await startFilterRuleRun(request);
        if (!captured.isCurrent()) return;
        toast.success(
          mode === "view"
            ? __("Rule run started for the current view", "pressedmail")
            : __("Rule run started for selected emails", "pressedmail"),
        );
        clearSelection();
        setPendingOrganizeRule(null);
      } catch (err) {
        if (!captured.isCurrent()) return;
        toast.error(
          err instanceof Error
            ? err.message
            : __("Could not start the rule run", "pressedmail"),
        );
      } finally {
        if (mountedRef.current && captured.isPrincipalCurrent())
          setRuleRunLoading(false);
      }
    },
    [
      pendingOrganizeRule,
      captureBulkScope,
      validateSelectedMessages,
      selectedRuleRefs,
      accountIdForCreate,
      isConsolidatedRuleScope,
      consolidatedRuleAccountIds,
      consolidatedRuleFolderMap,
      selectedFolder,
      activeFilters,
      clearSelection,
    ],
  );

  // Snooze: park every selected message in the server Snooze folder until the
  // chosen time. The popover owns the time picker + the free-tier upsell gate.
  // Each target carries ITS OWN folder + account: in the combined inbox (and
  // in threaded rows from other folders) the view's folder/account is the
  // wrong mailbox for most of the selection.
  const snoozeTargets = useMemo<SnoozeTargetCandidate[]>(
    () =>
      selectedMessages.map((msg) => ({
        accountId:
          typeof msg.accountId === "number"
            ? msg.accountId
            : (accountIdForCreate ?? 0),
        messageUid: msg.uid != null ? String(msg.uid) : "",
        folder: typeof msg.folder === "string" ? msg.folder : "",
        sourceUidValidity: msg.uidValidity ?? msg.uid_validity ?? "",
        sourceMessageId: msg.messageId ?? msg.message_id ?? "",
        subject: msg.subject ?? undefined,
        from: msg.from ?? undefined,
        date: msg.date ?? undefined,
      })),
    [selectedMessages, accountIdForCreate],
  );

  const handleSnoozed = useCallback(
    (succeeded: SnoozeTarget[]) => {
      const principal = captureRequestPrincipal();
      if (!isRequestPrincipalCurrent(principal)) return;
      // Remove ONLY the rows whose snooze actually succeeded.
      const okKeys = new Set(succeeded.map(getSnoozeTargetIdentityKey));
      const inboxService = getInboxService();
      let removed = 0;
      selectedMessages.forEach((message, index) => {
        const target = parseSnoozeTarget(snoozeTargets[index] ?? {});
        if (target && okKeys.has(getSnoozeTargetIdentityKey(target))) {
          inboxService.removeMessage(getMessageIdentityKey(message));
          removed++;
        }
      });
      if (!mountedRef.current || selectionScope !== selectionScopeRef.current)
        return;
      toast.success(
        sprintf(
          /* translators: %d: number of emails snoozed. */
          __("Snoozed %d emails", "pressedmail"),
          removed || succeeded.length,
        ),
      );
      if (succeeded.length === snoozeTargets.length) {
        clearSelection();
      }
    },
    [selectedMessages, snoozeTargets, clearSelection, selectionScope],
  );

  const handleMoveToJunk = useCallback(async () => {
    const target = resolveJunkMoveTarget(folders);

    setIsMovingJunk(true);
    try {
      await handleBatchOp(
        (ids) => batchMove(ids, target),
        __("Messages moved to junk", "pressedmail"),
        {
          messageOp: (selectedMessages) =>
            batchMoveMessages(selectedMessages, target),
          failureMsg: __("Failed to move messages to junk", "pressedmail"),
          refetchFromStart: true,
        },
      );
    } catch {
      toast.error(__("Failed to move messages to junk", "pressedmail"));
    } finally {
      setIsMovingJunk(false);
    }
  }, [batchMove, batchMoveMessages, folders, handleBatchOp]);

  const handleMoveSelectionToInbox = useCallback(
    async (successMessage: string, failureMessage: string) => {
      await handleBatchOp((ids) => batchMove(ids, "INBOX"), successMessage, {
        messageOp: (selectedMessages) =>
          batchMoveMessages(selectedMessages, "INBOX"),
        failureMsg: failureMessage,
        refetchFromStart: true,
      });
    },
    [batchMove, batchMoveMessages, handleBatchOp],
  );

  const handleRestoreToInbox = useCallback(
    () =>
      handleMoveSelectionToInbox(
        __("Messages restored", "pressedmail"),
        __("Failed to restore messages", "pressedmail"),
      ),
    [handleMoveSelectionToInbox],
  );

  const handleMarkNotSpam = useCallback(
    () =>
      handleMoveSelectionToInbox(
        __("Messages moved to inbox", "pressedmail"),
        __("Failed to move messages to inbox", "pressedmail"),
      ),
    [handleMoveSelectionToInbox],
  );

  const handleStopAiQueue = useCallback(() => {
    stopAiQueueRequestedRef.current = true;
    bulkAiAbortController?.abort();
    toast.info(__("Stopping AI queue", "pressedmail"));
  }, [bulkAiAbortController]);

  // After a bulk AI op waited behind a sweep, the captured selection can be
  // stale, some emails may have been swept to another folder. Re-fetch the view
  // and keep only the selected emails that are still present, so the AI op never
  // processes mail that just left this folder. Best-effort: on fetch failure the
  // captured selection is used unchanged.
  const revalidateSelectionAfterWait = useCallback(
    async (captured: EmailMessage[]): Promise<EmailMessage[]> => {
      try {
        const page = await loadMessagesSnapshot({
          offset: 0,
          limit: Math.max(100, captured.length + 50),
          forceRefresh: true,
        });
        if (!page?.success || !Array.isArray(page.messages)) {
          return captured;
        }
        const liveIds = new Set(
          page.messages.map((message) => getMessageIdentityKey(message)),
        );
        return captured.filter((message) =>
          liveIds.has(getMessageIdentityKey(message)),
        );
      } catch {
        return captured;
      }
    },
    [loadMessagesSnapshot],
  );

  // Gate a bulk AI op behind the process queue: wait for the queued client_op to
  // be promoted, then re-validate the selection if the op actually waited.
  // Returns null when the op should not run (cancelled, or nothing left to do).
  const awaitBulkAiTurn = useCallback(
    async (
      activity: BulkActivityReporter,
      controller: AbortController,
      captured: EmailMessage[],
      isCurrent: () => boolean,
    ): Promise<EmailMessage[] | null> => {
      if (!isCurrent()) return null;
      const gate = await activity.waitUntilRunning(controller.signal);
      if (!isCurrent()) return null;
      if (gate === "cancelled") {
        stopAiQueueRequestedRef.current = true;
        return null;
      }
      if (!activity.wasQueued()) {
        return captured;
      }

      const targets = await revalidateSelectionAfterWait(captured);
      if (!isCurrent()) return null;
      if (targets.length === 0) {
        toast.info(
          __("Selected emails were moved by the sweep", "pressedmail"),
        );
        return null;
      }
      if (targets.length !== captured.length) {
        void activity.setTotal(targets.length);
      }
      return targets;
    },
    [revalidateSelectionAfterWait],
  );

  // Bulk phishing: process selected emails one at a time so long LLM work can
  // be stopped from the toolbar and each returned result updates its row icon.
  const handleBulkPhishingCheck = useCallback(
    async (force = false) => {
      if (bulkAiJob || !validateSelectedMessages()) return;
      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;

      const controller = new AbortController();
      stopAiQueueRequestedRef.current = false;
      setBulkAiJob("phishing");
      setBulkAiAbortController(controller);

      setIsPhishingChecking(true);
      let analyzed = 0;
      let suspicious = 0;
      let activity: BulkActivityReporter | null = null;
      let activityError: string | undefined;
      try {
        activity = await beginBulkActivity({
          label: sprintf(
            /* translators: %d: number of emails. */
            __("Phishing check · %d emails", "pressedmail"),
            selectedMessages.length,
          ),
          total: selectedMessages.length,
          action: "phishing",
          waitForQueue: true,
          controller,
        });
        const targets = await awaitBulkAiTurn(
          activity,
          controller,
          selectedMessages,
          captured.isCurrent,
        );
        if (!captured.isCurrent() || !targets) {
          return;
        }
        for (const msg of targets) {
          if (!captured.isCurrent()) return;
          if (
            stopAiQueueRequestedRef.current ||
            controller.signal.aborted ||
            activity.cancelled()
          ) {
            if (activity.cancelled()) stopAiQueueRequestedRef.current = true;
            break;
          }

          const accountId = resolveMessageAccountId(
            msg,
            accounts,
            selectedAccount,
          );
          if (!accountId || !Number.isFinite(accountId)) {
            throw new Error(
              __(
                "Could not resolve the email account for a selected message",
                "pressedmail",
              ),
            );
          }

          const result = await analyzeEmail(
            accountId,
            toPhishingEmailData(msg),
            msg.folder || selectedFolder || "INBOX",
            { signal: controller.signal, force },
          );

          if (!captured.isCurrent()) return;
          if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
            break;
          }

          if (!result) {
            throw new Error(
              __("Phishing analysis returned no result", "pressedmail"),
            );
          }

          analyzed += 1;
          if (result.is_suspicious) suspicious += 1;
          void activity.advance(analyzed);
        }

        if (!captured.isCurrent()) return;
        if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
          toast.info(
            sprintf(
              /* translators: %d: emails checked before stopping. */
              __("Stopped AI queue after %d emails", "pressedmail"),
              analyzed,
            ),
          );
          return;
        }

        toast.success(
          sprintf(
            /* translators: %1$d: emails checked, %2$d: suspicious count. */
            __("Checked %1$d emails (%2$d suspicious)", "pressedmail"),
            analyzed,
            suspicious,
          ),
        );
        clearSelection();
      } catch (err) {
        if (!captured.isCurrent()) return;
        if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
          return;
        }
        if (surfaceApiAuthError(err)) {
          activityError = err.message;
          return;
        }
        activityError =
          err instanceof Error
            ? err.message
            : __("Phishing check failed", "pressedmail");
        toast.error(activityError);
      } finally {
        if (captured.isPrincipalCurrent())
          await activity?.finish(
            activityError
              ? "failed"
              : stopAiQueueRequestedRef.current || controller.signal.aborted
                ? "cancelled"
                : "done",
            activityError,
          );
        if (mountedRef.current && captured.isPrincipalCurrent()) {
          setIsPhishingChecking(false);
          setBulkAiJob(null);
          setBulkAiAbortController(null);
          stopAiQueueRequestedRef.current = false;
        }
      }
    },
    [
      selectedMessages,
      validateSelectedMessages,
      captureBulkScope,
      accounts,
      selectedAccount,
      selectedFolder,
      analyzeEmail,
      awaitBulkAiTurn,
      bulkAiJob,
      clearSelection,
    ],
  );

  // Bulk summarize: summarize one email per request, keeping the queue
  // interruptible while persisted results light up each card as they return.
  const handleBulkSummarize = useCallback(
    async (force = false) => {
      if (bulkAiJob || !validateSelectedMessages()) return;
      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;

      const controller = new AbortController();
      stopAiQueueRequestedRef.current = false;
      setBulkAiJob("summary");
      setBulkAiAbortController(controller);

      let successCount = 0;
      let failedCount = 0;
      let activity: BulkActivityReporter | null = null;
      let activityError: string | undefined;
      try {
        activity = await beginBulkActivity({
          label: sprintf(
            /* translators: %d: number of emails. */
            __("Summarizing %d emails", "pressedmail"),
            selectedMessages.length,
          ),
          total: selectedMessages.length,
          action: "summarize",
          waitForQueue: true,
          controller,
        });
        const targets = await awaitBulkAiTurn(
          activity,
          controller,
          selectedMessages,
          captured.isCurrent,
        );
        if (!captured.isCurrent() || !targets) {
          return;
        }
        for (const message of targets) {
          if (!captured.isCurrent()) return;
          if (
            stopAiQueueRequestedRef.current ||
            controller.signal.aborted ||
            activity.cancelled()
          ) {
            if (activity.cancelled()) stopAiQueueRequestedRef.current = true;
            break;
          }

          const result = await summarizeMessages([message], {
            signal: controller.signal,
            force,
          });

          if (!captured.isCurrent()) return;
          if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
            break;
          }

          successCount += result.successCount;
          failedCount += result.failedCount;
          void activity.advance(successCount + failedCount);
        }

        if (!captured.isCurrent()) return;
        if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
          toast.info(
            sprintf(
              /* translators: %d: emails summarized before stopping. */
              __("Stopped AI queue after %d emails", "pressedmail"),
              successCount,
            ),
          );
          return;
        }

        if (successCount === 0 && failedCount > 0) {
          toast.error(__("Failed to summarize selected emails", "pressedmail"));
          return;
        }

        toast.success(
          sprintf(
            /* translators: %1$d: emails summarized, %2$d: failures. */
            __("Summarized %1$d emails (%2$d failed)", "pressedmail"),
            successCount,
            failedCount,
          ),
        );
        clearSelection();
      } catch (err) {
        if (!captured.isCurrent()) return;
        if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
          toast.info(
            sprintf(
              /* translators: %d: emails summarized before stopping. */
              __("Stopped AI queue after %d emails", "pressedmail"),
              successCount,
            ),
          );
          return;
        }

        if (surfaceApiAuthError(err)) {
          activityError = err.message;
          return;
        }

        activityError =
          err instanceof Error
            ? err.message
            : __("Failed to summarize selected emails", "pressedmail");
        toast.error(activityError);
      } finally {
        if (captured.isPrincipalCurrent())
          await activity?.finish(
            activityError
              ? "failed"
              : stopAiQueueRequestedRef.current || controller.signal.aborted
                ? "cancelled"
                : "done",
            activityError,
          );
        if (mountedRef.current && captured.isPrincipalCurrent()) {
          setBulkAiJob(null);
          setBulkAiAbortController(null);
          stopAiQueueRequestedRef.current = false;
        }
      }
    },
    [
      selectedMessages,
      validateSelectedMessages,
      captureBulkScope,
      summarizeMessages,
      awaitBulkAiTurn,
      bulkAiJob,
      clearSelection,
    ],
  );

  // Bulk auto-tag: classify one email per request so the long LLM work can be
  // stopped from the toolbar and never runs as one unbounded server-side loop.
  const handleBulkAutoTag = useCallback(async () => {
    if (bulkAiJob || !validateSelectedMessages()) return;
    const captured = captureBulkScope();
    if (!captured.isCurrent()) return;
    if (!autoTaggerAvailable) {
      toast.info(
        __(
          "AutoTagger requires a configured AI provider. Please contact your site administrator to configure AI settings.",
          "pressedmail",
        ),
      );
      return;
    }

    const controller = new AbortController();
    stopAiQueueRequestedRef.current = false;
    setBulkAiJob("autotag");
    setBulkAiAbortController(controller);
    setIsAutoTagging(true);

    let processed = 0;
    let applied = 0;
    let activity: BulkActivityReporter | null = null;
    let activityError: string | undefined;
    try {
      activity = await beginBulkActivity({
        label: sprintf(
          /* translators: %d: number of emails. */
          __("Auto-tagging %d emails", "pressedmail"),
          selectedMessages.length,
        ),
        total: selectedMessages.length,
        action: "autotag",
        waitForQueue: true,
        controller,
      });
      const targets = await awaitBulkAiTurn(
        activity,
        controller,
        selectedMessages,
        captured.isCurrent,
      );
      if (!captured.isCurrent() || !targets) {
        return;
      }
      for (const msg of targets) {
        if (!captured.isCurrent()) return;
        if (
          stopAiQueueRequestedRef.current ||
          controller.signal.aborted ||
          activity.cancelled()
        ) {
          if (activity.cancelled()) stopAiQueueRequestedRef.current = true;
          break;
        }

        const accountId = resolveMessageAccountId(
          msg,
          accounts,
          selectedAccount,
        );
        if (!accountId) continue;

        const result = await classifyEmails(
          accountId,
          [
            {
              uid: msg.uid,

              uidValidity: msg.uidValidity ?? msg.uid_validity,
              folder: msg.folder || "",
              subject: msg.subject ?? "",
              from: msg.from ?? "",
              date: msg.date ?? "",
              body: getBulkAiMessageBody(msg),
            },
          ],
          { signal: controller.signal },
        );

        if (!captured.isPrincipalCurrent()) return;
        // An aborted request comes back as an error result; that is a stop, not a failure.
        if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
          break;
        }

        if (result.status === "error") {
          if (!captured.isCurrent()) return;
          toast.error(
            result.message ?? __("Failed to auto-tag emails", "pressedmail"),
          );
          return;
        }

        processed += 1;
        applied += Number(result.tags_applied ?? 0);

        const returnedTags = result.results?.flatMap((item) => item.tags) ?? [];
        if (returnedTags.length > 0) {
          const nextTags = mergeAiReturnedTags(msg, returnedTags, tags);
          if (nextTags.length !== getMessageTagList(msg).length) {
            getInboxService().updateMessage(getMessageIdentityKey(msg), {
              tags: nextTags,
            });
          }
        }
        if (!captured.isCurrent()) return;
        void activity.advance(processed);
      }

      if (!captured.isCurrent()) return;
      if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
        toast.info(
          sprintf(
            /* translators: %d: emails tagged before stopping. */
            __("Stopped AI queue after %d emails", "pressedmail"),
            processed,
          ),
        );
        return;
      }

      if (applied > 0) {
        const filteredByTag =
          Array.isArray(activeFilters.tags) && activeFilters.tags.length > 0;
        if (filteredByTag) {
          applyFilters(activeFilters);
        }

        toast.success(
          sprintf(
            /* translators: %1$d: emails processed, %2$d: tags applied. */
            __("Tagged %1$d emails (%2$d tags applied)", "pressedmail"),
            processed,
            applied,
          ),
        );
        clearSelection();
      } else {
        toast.info(__("No matching tags found", "pressedmail"));
      }
    } catch (err) {
      if (!captured.isCurrent()) return;
      if (stopAiQueueRequestedRef.current || controller.signal.aborted) {
        toast.info(
          sprintf(
            /* translators: %d: emails tagged before stopping. */
            __("Stopped AI queue after %d emails", "pressedmail"),
            processed,
          ),
        );
        return;
      }

      if (surfaceApiAuthError(err)) {
        activityError = err.message;
        return;
      }

      activityError =
        err instanceof Error
          ? err.message
          : __("Failed to auto-tag emails", "pressedmail");
      toast.error(activityError);
    } finally {
      if (captured.isPrincipalCurrent())
        await activity?.finish(
          activityError
            ? "failed"
            : stopAiQueueRequestedRef.current || controller.signal.aborted
              ? "cancelled"
              : "done",
          activityError,
        );
      if (mountedRef.current && captured.isPrincipalCurrent()) {
        setIsAutoTagging(false);
        setBulkAiJob(null);
        setBulkAiAbortController(null);
        stopAiQueueRequestedRef.current = false;
      }
    }
  }, [
    selectedMessages,
    validateSelectedMessages,
    captureBulkScope,
    accounts,
    selectedAccount,
    selectedFolder,
    classifyEmails,
    awaitBulkAiTurn,
    bulkAiJob,
    clearSelection,
    tags,
    activeFilters,
    applyFilters,
  ]);

  // Single entry point for the three bulk AI ops: enforces the admin per-op cap
  // (block + ask to deselect) and the "this may take a while" confirmation above
  // the warn threshold before dispatching to the per-email loop.
  const runBulkAi = useCallback(
    (op: BulkAiOperation, options: { force?: boolean } = {}) => {
      if (op === "phishing") {
        void handleBulkPhishingCheck(Boolean(options.force));
      } else if (op === "summary") {
        void handleBulkSummarize(Boolean(options.force));
      } else {
        void handleBulkAutoTag();
      }
    },
    [handleBulkPhishingCheck, handleBulkSummarize, handleBulkAutoTag],
  );

  const requestBulkAi = useCallback(
    (op: BulkAiOperation) => {
      if (bulkAiJob || !validateSelectedMessages()) return;
      const count = selectedMessages.length;

      const cap =
        op === "phishing"
          ? aiBulkLimits.phishing
          : op === "summary"
            ? aiBulkLimits.summary
            : aiBulkLimits.autotag;

      if (count > cap) {
        toast.error(
          sprintf(
            /* translators: %d: maximum emails allowed per bulk AI run. */
            __(
              "Select at most %d emails for this AI action, then deselect some to continue.",
              "pressedmail",
            ),
            cap,
          ),
        );
        return;
      }

      const existingCount =
        op === "summary"
          ? selectedMessages.filter(
              (message) => getSummary(message)?.status === "success",
            ).length
          : op === "phishing"
            ? selectedMessages.filter((message) =>
                Boolean(getAnalysisResult(getMessageIdentityKey(message))),
              ).length
            : 0;
      const longRun = count > aiBulkLimits.warnThreshold;
      if (longRun || existingCount > 0) {
        setPendingBulkAi({
          op,
          force: existingCount > 0,
          longRun,
          existingCount,
        });
        return;
      }

      runBulkAi(op);
    },
    [
      selectedMessages,
      validateSelectedMessages,
      bulkAiJob,
      aiBulkLimits,
      getSummary,
      getAnalysisResult,
      runBulkAi,
    ],
  );

  const bulkSelectedTagIds = useMemo(
    () =>
      tags
        .filter(
          (tag) =>
            selectedMessages.length > 0 &&
            selectedMessages.every((message) => hasMessageTag(message, tag.id)),
        )
        .map((tag) => tag.id),
    [selectedMessages, tags],
  );

  // Manual bulk tagging: apply the dropdown's final tag selection to every
  // selected message. Available in all builds (manual tagging is Free).
  const handleBulkApplyTags = useCallback(
    async (nextTagIds: number[]) => {
      const snapshot = getSelectionSnapshot();
      const expectedCount =
        snapshot.mode === "explicit"
          ? snapshot.selectedIds.size
          : snapshot.totalCount - snapshot.excludedIds.size;
      if (expectedCount !== selectedMessages.length) {
        toast.error(
          __("Reload the mailbox before changing tags.", "pressedmail"),
        );
        return;
      }
      if (selectedMessages.length === 0) return;

      const previousTagIds = new Set(bulkSelectedTagIds);
      const nextTagIdSet = new Set(nextTagIds);
      const addedTagIds = nextTagIds.filter((id) => !previousTagIds.has(id));
      const removedTagIds = Array.from(previousTagIds).filter(
        (id) => !nextTagIdSet.has(id),
      );

      if (addedTagIds.length === 0 && removedTagIds.length === 0) return;

      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;
      const principal = captureRequestPrincipal();
      const identities = selectedMessages.map((message) =>
        getMessageIdentityRef(message),
      );
      if (!principal || identities.some((ref) => !ref)) {
        toast.error(
          __("Reload the mailbox before changing tags.", "pressedmail"),
        );
        return;
      }
      const validRefs = identities.flatMap((ref) =>
        ref
          ? [
              {
                account_id: ref.accountId,
                message_uid: ref.uid,
                folder: ref.folder,
                uid_validity: ref.uidValidity,
              },
            ]
          : [],
      );

      const invalidateTagCaches = () => {
        const cache = getCacheService();
        cache.invalidateMessages({});
        for (const ref of validRefs)
          cache.invalidateMessageDetail(
            String(ref.account_id),
            ref.folder,
            getMessageIdentityKey({
              accountId: ref.account_id,
              folder: ref.folder,
              uidValidity: ref.uid_validity,
              uid: ref.message_uid,
            }),
          );
      };
      setIsTagging(true);
      try {
        for (const tagId of addedTagIds) {
          if (!captured.isCurrent()) return;
          const result = await batchAssignTag(tagId, validRefs);
          if (!isRequestPrincipalCurrent(principal)) return;
          if (result.failed > 0)
            throw new Error(
              __(
                "Some tags could not be saved. Refresh the mailbox and retry.",
                "pressedmail",
              ),
            );
        }
        for (const tagId of removedTagIds) {
          if (!captured.isCurrent()) return;
          const result = await batchRemoveTag(tagId, validRefs);
          if (!isRequestPrincipalCurrent(principal)) return;
          if (result.failed > 0)
            throw new Error(
              __(
                "Some tags could not be removed. Refresh the mailbox and retry.",
                "pressedmail",
              ),
            );
        }

        const inboxService = getInboxService();
        selectedMessages.forEach((message) => {
          let nextTags = getMessageTagList(message);

          for (const tagId of addedTagIds) {
            const tag = tags.find((item) => item.id === tagId);
            if (!tag) continue;
            nextTags = buildMessageTagUpdate(
              { ...message, tags: nextTags },
              tag,
              true,
            ).tags;
          }

          for (const tagId of removedTagIds) {
            const tag = tags.find((item) => item.id === tagId);
            if (!tag) continue;
            nextTags = buildMessageTagUpdate(
              { ...message, tags: nextTags },
              tag,
              false,
            ).tags;
          }

          const localId = getMessageIdentityKey(message);
          if (localId) {
            inboxService.updateMessage(localId, { tags: nextTags });
          }
        });

        if (!captured.isCurrent()) return;
        const filteredByTag =
          Array.isArray(activeFilters.tags) && activeFilters.tags.length > 0;
        if (filteredByTag) {
          applyFilters(activeFilters);
        }

        toast.success(
          sprintf(
            /* translators: %d: number of emails tagged. */
            __("Updated tags for %d emails", "pressedmail"),
            validRefs.length,
          ),
        );
        clearSelection();
      } catch (err) {
        if (!isRequestPrincipalCurrent(principal)) return;
        invalidateTagCaches();
        if (!captured.isCurrent()) return;
        applyFilters(activeFilters);
        toast.error(
          err instanceof Error
            ? err.message
            : __("Failed to tag emails", "pressedmail"),
        );
      } finally {
        if (captured.isPrincipalCurrent()) {
          if (!captured.isCurrent()) invalidateTagCaches();
          if (mountedRef.current) setIsTagging(false);
        }
      }
    },
    [
      selectedMessages,
      captureBulkScope,
      tags,
      bulkSelectedTagIds,
      getSelectionSnapshot,
      batchAssignTag,
      batchRemoveTag,
      activeFilters,
      applyFilters,
      clearSelection,
    ],
  );

  if (!hasBulkSelection && variant !== "pressedout-command") return null;

  const moveTargets = getBulkMoveTargetFolders(
    getMoveTargetFolders(),
    selectedFolder,
  );
  const isBulkAiRunning = bulkAiJob !== null;
  // Phishing is admin-policy gated: respect the live `isEnabled`, not just the
  // compile flag. Stripped entirely from the Free build.
  const {
    showSnooze: bulkSnoozeAvailable,
    showPhishing: bulkPhishingAvailable,
    showSummarize: bulkSummarizeAvailable,
    showAutoTag: bulkAutoTagAvailable,
  } = resolveInboxActionVisibility({
    isFreeBuild: __IS_FREE__,
    snoozeBuildEnabled: __ENABLE_SNOOZE__,
    snoozeEnabled,
    phishingBuildEnabled: __ENABLE_PHISHING_DETECTION__,
    phishingEnabled,
    aiSummarizeAvailable,
    autoTaggerBuildEnabled: __ENABLE_AUTO_TAGGER__,
    aiAutoTaggerBuildEnabled: __ENABLE_AI_AUTO_TAGGER__,
    autoTaggerToolAvailable: autoTaggerAvailable,
  });
  const pendingBulkAiTitle = pendingBulkAi?.force
    ? pendingBulkAi.op === "summary"
      ? sprintf(
          /* translators: %d: number of selected emails with summaries. */
          __("Overwrite summaries for %d emails?", "pressedmail"),
          pendingBulkAi.existingCount,
        )
      : sprintf(
          /* translators: %d: number of selected emails with phishing reports. */
          __("Overwrite phishing reports for %d emails?", "pressedmail"),
          pendingBulkAi.existingCount,
        )
    : sprintf(
        /* translators: %d: number of selected emails. */
        __("Run AI on %d emails?", "pressedmail"),
        selectedMessages.length,
      );
  const pendingBulkAiDescription = pendingBulkAi?.force
    ? pendingBulkAi.op === "summary"
      ? __(
          "Some selected emails already have summaries. Re-summarizing will replace those saved summaries.",
          "pressedmail",
        )
      : __(
          "Some selected emails already have phishing reports. Re-analyzing will replace those saved reports.",
          "pressedmail",
        )
    : __(
        "Long AI runs may take a while and can error on slow connections. You can stop the queue at any time once it starts.",
        "pressedmail",
      );
  const pendingBulkAiConfirmText = pendingBulkAi?.force
    ? __("Overwrite", "pressedmail")
    : __("Proceed", "pressedmail");

  if (isDraftLikeFolder) {
    if (variant === "pressedout-command") {
      return (
        <div
          data-test="pressedout-bulk-action-bar"
          data-testid="pressedout-bulk-action-bar"
          className={cn("flex min-w-0 items-center gap-1", className)}>
          <PressedOutRibbonButton
            label={__("Delete", "pressedmail")}
            className={cn("hover:bg-destructive/10 hover:text-destructive")}
            disabled={!hasBulkSelection || isLoading}
            onClick={handleDelete}
            icon={<EmailTrashIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
          />
        </div>
      );
    }

    return (
      <div
        data-test="bulk-action-bar"
        className={cn(
          "flex w-full min-w-0 items-center gap-2 overflow-hidden border-b bg-primary/5 px-3 py-1.5 animate-in slide-in-from-top-1 duration-150",
          className,
        )}>
        <PressedTooltip content={__("Delete", "pressedmail")} side="top">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
            disabled={isLoading}
            onClick={handleDelete}
            aria-label={__("Delete", "pressedmail")}>
            <EmailTrashIcon className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        </PressedTooltip>
      </div>
    );
  }

  if (variant === "pressedout-command") {
    const pressedOutBulkDisabled = !hasBulkSelection || isLoading;
    const pressedOutMoveDisabled =
      pressedOutBulkDisabled || moveTargets.length === 0;

    return (
      <div
        data-test="pressedout-bulk-action-bar"
        data-testid="pressedout-bulk-action-bar"
        className={cn("flex min-w-0 items-center gap-1", className)}>
        <div
          role="group"
          aria-label={__("Read", "pressedmail")}
          className="flex items-center gap-1">
          <PressedOutRibbonButton
            label={__("✔ Read", "pressedmail")}
            disabled={pressedOutBulkDisabled}
            onClick={handleMarkRead}
            ariaLabel={__("Mark selected messages as read", "pressedmail")}
            icon={
              <EmailMarkReadIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
            }
          />

          <PressedOutRibbonButton
            label={__("✘ Unread", "pressedmail")}
            disabled={pressedOutBulkDisabled}
            onClick={handleMarkUnread}
            ariaLabel={__("Mark selected messages as unread", "pressedmail")}
            icon={
              <EmailMarkUnreadIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
            }
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          className="mx-1 h-9 w-px shrink-0 bg-border"
        />

        <div
          role="group"
          aria-label={__("Organize", "pressedmail")}
          className="flex items-center gap-1">
          {isTrashFolder ? (
            <PressedOutRibbonButton
              label={__("Restore", "pressedmail")}
              disabled={pressedOutBulkDisabled}
              data-test="bulk-restore"
              dataTest="bulk-restore"
              onClick={handleRestoreToInbox}
              ariaLabel={__("Restore selected emails", "pressedmail")}
              icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
          ) : isJunkFolder ? (
            <PressedOutRibbonButton
              label={__("Not spam", "pressedmail")}
              disabled={pressedOutBulkDisabled}
              dataTest="bulk-not-spam"
              onClick={handleMarkNotSpam}
              ariaLabel={__("Mark selected emails as not spam", "pressedmail")}
              icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
            />
          ) : (
            <>
              <PressedOutRibbonButton
                label={_x("Archive", "verb", "pressedmail")}
                disabled={pressedOutBulkDisabled}
                onClick={handleArchive}
                icon={
                  <EmailArchiveIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                }
              />

              <PressedOutRibbonButton
                label={__("Delete", "pressedmail")}
                className={cn("hover:bg-destructive/10 hover:text-destructive")}
                disabled={pressedOutBulkDisabled}
                onClick={handleDelete}
                icon={
                  <EmailTrashIcon className={PRESSED_OUT_RIBBON_ICON_CLASS} />
                }
              />
            </>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild disabled={pressedOutMoveDisabled}>
              <PressedOutRibbonButton
                label={__("Move", "pressedmail")}
                disabled={pressedOutMoveDisabled}
                ariaLabel={__("Move to folder", "pressedmail")}
                icon={<FolderInput className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
              />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              {moveTargets.map((folder) => (
                <DropdownMenuItem
                  key={folderTargetKey(folder)}
                  onClick={() => handleMove(folderMutationTarget(folder))}>
                  {folder.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>

          <MailTagActionDropdown
            availableTags={tags}
            selectedTagIds={bulkSelectedTagIds}
            onApplyTags={handleBulkApplyTags}
            onAutoTag={() => requestBulkAi("autotag")}
            aiEnabled={bulkAutoTagAvailable}
            aiDisabled={
              pressedOutBulkDisabled || isAutoTagging || isBulkAiRunning
            }
            isApplying={isTagging}
            isAutoTagging={isAutoTagging}
            disabled={pressedOutBulkDisabled || isTagging}
            trigger={
              <PressedOutRibbonButton
                label={__("Tag", "pressedmail")}
                disabled={pressedOutBulkDisabled || isTagging}
                dataTest="bulk-apply-tag"
                ariaLabel={__("Apply a tag", "pressedmail")}
                icon={<Tags className={PRESSED_OUT_RIBBON_ICON_CLASS} />}
              />
            }
          />
        </div>

        <div
          role="separator"
          aria-orientation="vertical"
          className="mx-1 h-9 w-px shrink-0 bg-border"
        />

        <DropdownMenu>
          <DropdownMenuTrigger asChild disabled={pressedOutBulkDisabled}>
            <PressedOutRibbonButton
              label={__("More", "pressedmail")}
              ariaLabel={__("More actions", "pressedmail")}
              dataTest="bulk-more-actions"
              disabled={pressedOutBulkDisabled}
              icon={
                <EmailMoreActionsIcon
                  className={PRESSED_OUT_RIBBON_ICON_CLASS}
                />
              }
            />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-56">
            {bulkSummarizeAvailable && (
              <DropdownMenuItem
                data-test="bulk-summarize"
                data-testid="bulk-summarize"
                aria-label={__("Summarize selected emails", "pressedmail")}
                disabled={
                  pressedOutBulkDisabled || isSummarizing || isBulkAiRunning
                }
                onSelect={() => requestBulkAi("summary")}>
                {isSummarizing ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <EmailSummaryIcon className="mr-2 size-4" />
                )}
                {__("Summarize", "pressedmail")}
              </DropdownMenuItem>
            )}

            {bulkPhishingAvailable && (
              <DropdownMenuItem
                data-test="bulk-phishing-check"
                data-testid="bulk-phishing-check"
                aria-label={__(
                  "Check selected emails for phishing",
                  "pressedmail",
                )}
                disabled={
                  pressedOutBulkDisabled ||
                  isPhishingChecking ||
                  isBulkAiRunning
                }
                onSelect={() => requestBulkAi("phishing")}>
                {isPhishingChecking ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <PhishingRodIcon className="mr-2 size-4" />
                )}
                {__("Phishing", "pressedmail")}
              </DropdownMenuItem>
            )}

            <DropdownMenuItem
              data-test="bulk-sweep-trigger"
              data-testid="bulk-sweep-trigger"
              aria-label={__("Sweep selected messages", "pressedmail")}
              disabled={pressedOutBulkDisabled || !sweepScope}
              onSelect={() => setSweepOpen(true)}>
              <EmailSweepIcon className="mr-2 size-4" />
              {__("Sweep", "pressedmail")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {sweepScope && (
          <EmailSweep
            open={sweepOpen}
            onOpenChange={setSweepOpen}
            initialMessages={selectedMessages}
            scope={sweepScope}
            folders={folders}
            onRun={handleOneOffSweepRun}
            selection={sweepSelection}
          />
        )}
        <AlertDialog
          open={pendingOrganizeRule !== null}
          onOpenChange={(open) => {
            if (!open && !ruleRunLoading) setPendingOrganizeRule(null);
          }}>
          <PressedAlertDialogContent size="confirmation">
            <PressedAlertDialogHeader
              title={__("Run saved rule", "pressedmail")}
              icon={Play}
              description={
                pendingOrganizeRule
                  ? sprintf(
                      /* translators: %s: rule name. */
                      __("Choose where to run “%s”.", "pressedmail"),
                      pendingOrganizeRule.name,
                    )
                  : __("Choose where to run this rule.", "pressedmail")
              }
            />
            <PressedOverlayFooter>
              <AlertDialogCancel disabled={ruleRunLoading}>
                {__("Cancel", "pressedmail")}
              </AlertDialogCancel>
              <Button
                type="button"
                variant="outline"
                disabled={ruleRunLoading || selectedRuleRefs.length === 0}
                onClick={() => {
                  void runPendingRule("selection");
                }}>
                {__("Current selection", "pressedmail")}
              </Button>
              <Button
                type="button"
                disabled={ruleRunLoading}
                onClick={() => {
                  void runPendingRule("view");
                }}>
                {ruleRunLoading && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {__("Whole current view", "pressedmail")}
              </Button>
            </PressedOverlayFooter>
          </PressedAlertDialogContent>
        </AlertDialog>
        <ConfirmationPanel
          open={pendingBulkAi !== null}
          onOpenChange={(open) => {
            if (!open) setPendingBulkAi(null);
          }}
          title={pendingBulkAiTitle}
          description={pendingBulkAiDescription}
          confirmText={pendingBulkAiConfirmText}
          cancelText={__("Cancel", "pressedmail")}
          onConfirm={() => {
            const pending = pendingBulkAi;
            setPendingBulkAi(null);
            if (pending) {
              runBulkAi(pending.op, { force: pending.force });
            }
          }}
        />
      </div>
    );
  }

  return (
    <div
      data-test="bulk-action-bar"
      className={cn(
        "flex w-full min-w-0 items-center gap-2 overflow-hidden px-3 py-1.5 bg-primary/5 border-b animate-in slide-in-from-top-1 duration-150",
        className,
      )}>
      <div className="relative flex min-w-0 flex-1 items-center overflow-hidden">
        {canScrollPrevious && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-6 shrink-0"
            data-test="bulk-overflow-left"
            onClick={scrollActionsPrevious}
            aria-label={__("Previous actions", "pressedmail")}>
            <PreviousActionOverflowIcon className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        )}
        <div
          ref={actionScrollRef}
          data-test="bulk-action-scroll"
          onScroll={updateActionOverflow}
          className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <PressedTooltip
            content={__("Mark as read", "pressedmail")}
            side="top">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isLoading}
              onClick={handleMarkRead}
              aria-label={__("Mark as read", "pressedmail")}>
              <EmailMarkReadIcon className={MAIL_ACTION_ICON_CLASS} />
            </Button>
          </PressedTooltip>

          <PressedTooltip
            content={__("Mark as unread", "pressedmail")}
            side="top">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isLoading}
              onClick={handleMarkUnread}
              aria-label={__("Mark as unread", "pressedmail")}>
              <EmailMarkUnreadIcon className={MAIL_ACTION_ICON_CLASS} />
            </Button>
          </PressedTooltip>

          {isTrashFolder ? (
            <PressedTooltip content={__("Restore", "pressedmail")} side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isLoading}
                data-test="bulk-restore"
                onClick={handleRestoreToInbox}
                aria-label={__("Restore selected emails", "pressedmail")}>
                <FolderInput className={MAIL_ACTION_ICON_CLASS} />
              </Button>
            </PressedTooltip>
          ) : isJunkFolder ? (
            <PressedTooltip content={__("Not spam", "pressedmail")} side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                disabled={isLoading}
                data-test="bulk-not-spam"
                onClick={handleMarkNotSpam}
                aria-label={__(
                  "Mark selected emails as not spam",
                  "pressedmail",
                )}>
                <FolderInput className={MAIL_ACTION_ICON_CLASS} />
              </Button>
            </PressedTooltip>
          ) : (
            <>
              <PressedTooltip
                content={_x("Archive", "verb", "pressedmail")}
                side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isLoading}
                  onClick={handleArchive}
                  aria-label={_x("Archive", "verb", "pressedmail")}>
                  <EmailArchiveIcon className={MAIL_ACTION_ICON_CLASS} />
                </Button>
              </PressedTooltip>

              <PressedTooltip content={__("Delete", "pressedmail")} side="top">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isLoading}
                  onClick={handleDelete}
                  aria-label={__("Delete", "pressedmail")}>
                  <EmailTrashIcon className={MAIL_ACTION_ICON_CLASS} />
                </Button>
              </PressedTooltip>
            </>
          )}

          {moveTargets.length > 0 && (
            <PressedTooltip
              content={__("Move to folder", "pressedmail")}
              side="top">
              <span className="inline-flex">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      disabled={isLoading}
                      aria-label={__("Move to folder", "pressedmail")}>
                      <FolderInput className={MAIL_ACTION_ICON_CLASS} />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start">
                    {moveTargets.map((folder) => (
                      <DropdownMenuItem
                        key={folderTargetKey(folder)}
                        onClick={() =>
                          handleMove(folderMutationTarget(folder))
                        }>
                        {folder.name}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </span>
            </PressedTooltip>
          )}

          <PressedTooltip
            content={__("Sweep selected messages", "pressedmail")}
            side="top">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              disabled={isLoading || !sweepScope}
              onClick={() => setSweepOpen(true)}
              aria-label={__("Sweep selected messages", "pressedmail")}
              data-test="bulk-sweep-trigger"
              data-testid="bulk-sweep-trigger">
              <EmailSweepIcon className={MAIL_ACTION_ICON_CLASS} />
            </Button>
          </PressedTooltip>

          {isBulkAiRunning && (
            <PressedTooltip
              content={__("Stop AI queue", "pressedmail")}
              side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-test="bulk-stop-ai-queue"
                onClick={handleStopAiQueue}
                aria-label={__("Stop AI queue", "pressedmail")}>
                <X className={MAIL_ACTION_ICON_CLASS} />
              </Button>
            </PressedTooltip>
          )}

          {!isTrashFolder && !isJunkFolder && (
            <PressedTooltip
              content={__("Move to junk", "pressedmail")}
              side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-test="bulk-move-junk"
                disabled={isLoading || isMovingJunk}
                onClick={() => {
                  void handleMoveToJunk();
                }}
                aria-label={__("Move selected emails to junk", "pressedmail")}>
                {isMovingJunk ? (
                  <Loader2
                    className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
                  />
                ) : (
                  <EmailJunkIcon className={MAIL_ACTION_ICON_CLASS} />
                )}
              </Button>
            </PressedTooltip>
          )}

          <PressedTooltip
            content={__("Organize with a rule", "pressedmail")}
            side="top">
            <span className="inline-flex">
              <DropdownMenu
                open={organizeOpen}
                onOpenChange={handleOrganizeOpenChange}>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isLoading}
                    data-test="bulk-organize"
                    aria-label={__("Organize with a rule", "pressedmail")}>
                    {organizeLoading ? (
                      <Loader2
                        className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
                      />
                    ) : (
                      <ListChecks className={MAIL_ACTION_ICON_CLASS} />
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  {organizeLoading ? (
                    <DropdownMenuItem disabled>
                      {__("Loading rules…", "pressedmail")}
                    </DropdownMenuItem>
                  ) : organizeRules.length === 0 ? (
                    <DropdownMenuItem disabled>
                      {__("No rules available", "pressedmail")}
                    </DropdownMenuItem>
                  ) : (
                    organizeRules.map((rule) => (
                      <DropdownMenuItem
                        key={rule.id}
                        data-test="bulk-organize-option"
                        onClick={() => handleRunRule(rule)}>
                        {rule.name}
                      </DropdownMenuItem>
                    ))
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </span>
          </PressedTooltip>

          <PressedTooltip content={__("Apply a tag", "pressedmail")} side="top">
            <span className="inline-flex">
              <MailTagActionDropdown
                availableTags={tags}
                selectedTagIds={bulkSelectedTagIds}
                onApplyTags={handleBulkApplyTags}
                onAutoTag={() => requestBulkAi("autotag")}
                aiEnabled={bulkAutoTagAvailable}
                aiDisabled={isLoading || isAutoTagging || isBulkAiRunning}
                isApplying={isTagging}
                isAutoTagging={isAutoTagging}
                disabled={isLoading || isTagging}
                trigger={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    disabled={isLoading || isTagging}
                    data-test="bulk-apply-tag"
                    aria-label={__("Apply a tag", "pressedmail")}>
                    <Tags className={MAIL_ACTION_ICON_CLASS} />
                  </Button>
                }
              />
            </span>
          </PressedTooltip>

          {bulkPhishingAvailable && (
            <PressedTooltip
              content={
                isPhishingChecking
                  ? __("Checking for phishing…", "pressedmail")
                  : __("Check selected for phishing", "pressedmail")
              }
              side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-test="bulk-phishing-check"
                disabled={isLoading || isPhishingChecking || isBulkAiRunning}
                onClick={() => {
                  requestBulkAi("phishing");
                }}
                aria-label={__(
                  "Check selected emails for phishing",
                  "pressedmail",
                )}>
                {isPhishingChecking ? (
                  <Loader2
                    className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
                  />
                ) : (
                  <PhishingRodIcon className={MAIL_ACTION_ICON_CLASS} />
                )}
              </Button>
            </PressedTooltip>
          )}

          {bulkSummarizeAvailable && (
            <PressedTooltip
              content={
                isSummarizing
                  ? __("Summarizing…", "pressedmail")
                  : __("Summarize selected emails", "pressedmail")
              }
              side="top">
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8"
                data-test="bulk-summarize"
                disabled={isLoading || isSummarizing || isBulkAiRunning}
                onClick={() => {
                  requestBulkAi("summary");
                }}
                aria-label={__("Summarize selected emails", "pressedmail")}>
                {isSummarizing ? (
                  <Loader2
                    className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
                  />
                ) : (
                  <EmailSummaryIcon className={MAIL_ACTION_ICON_CLASS} />
                )}
              </Button>
            </PressedTooltip>
          )}

          {bulkSnoozeAvailable && (
            <PressedTooltip content={__("Snooze", "pressedmail")} side="top">
              <SnoozePopover targets={snoozeTargets} onSnoozed={handleSnoozed}>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8"
                  disabled={isLoading}
                  data-test="bulk-snooze"
                  aria-label={__("Snooze", "pressedmail")}>
                  <SnoozeClockIcon className={MAIL_ACTION_ICON_CLASS} />
                </Button>
              </SnoozePopover>
            </PressedTooltip>
          )}
        </div>
        {canScrollNext && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-6 shrink-0"
            data-test="bulk-overflow-right"
            onClick={scrollActionsNext}
            aria-label={__("Next actions", "pressedmail")}>
            <NextActionOverflowIcon className={MAIL_ACTION_ICON_CLASS} />
          </Button>
        )}
      </div>

      {sweepScope && (
        <EmailSweep
          open={sweepOpen}
          onOpenChange={setSweepOpen}
          initialMessages={selectedMessages}
          scope={sweepScope}
          folders={folders}
          onRun={handleOneOffSweepRun}
          selection={sweepSelection}
        />
      )}
      <AlertDialog
        open={pendingOrganizeRule !== null}
        onOpenChange={(open) => {
          if (!open && !ruleRunLoading) setPendingOrganizeRule(null);
        }}>
        <PressedAlertDialogContent size="confirmation">
          <PressedAlertDialogHeader
            title={__("Run saved rule", "pressedmail")}
            icon={Play}
            description={
              pendingOrganizeRule
                ? sprintf(
                    /* translators: %s: rule name. */
                    __("Choose where to run “%s”.", "pressedmail"),
                    pendingOrganizeRule.name,
                  )
                : __("Choose where to run this rule.", "pressedmail")
            }
          />
          <PressedOverlayFooter>
            <AlertDialogCancel disabled={ruleRunLoading}>
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <Button
              type="button"
              variant="outline"
              disabled={ruleRunLoading || selectedRuleRefs.length === 0}
              onClick={() => {
                void runPendingRule("selection");
              }}>
              {__("Current selection", "pressedmail")}
            </Button>
            <Button
              type="button"
              disabled={ruleRunLoading}
              onClick={() => {
                void runPendingRule("view");
              }}>
              {ruleRunLoading && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              {__("Whole current view", "pressedmail")}
            </Button>
          </PressedOverlayFooter>
        </PressedAlertDialogContent>
      </AlertDialog>
      <ConfirmationPanel
        open={pendingBulkAi !== null}
        onOpenChange={(open) => {
          if (!open) setPendingBulkAi(null);
        }}
        title={pendingBulkAiTitle}
        description={pendingBulkAiDescription}
        confirmText={pendingBulkAiConfirmText}
        cancelText={__("Cancel", "pressedmail")}
        onConfirm={() => {
          const pending = pendingBulkAi;
          setPendingBulkAi(null);
          if (pending) {
            runBulkAi(pending.op, { force: pending.force });
          }
        }}
      />
    </div>
  );
}

export default BulkActionBar;
