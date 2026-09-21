"use client";

import * as React from "react";
import { __, _n, _x, sprintf } from "@wordpress/i18n";
import {
  CheckSquare,
  CircleAlert,
  Calendar,
  FolderInput,
  ListChecks,
  Loader2,
  Menu,
  MoreHorizontal,
  Paperclip,
  Search,
  Settings2,
  Star,
  StarOff,
  Tag,
} from "lucide-react";
import {
  folderMutationTarget,
  folderTargetKey,
  type MutationTarget,
} from "@/lib/folder-target";
import {
  DropdownMenu,
  Badge,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  toast,
} from "@kit/ui/plugin";
import {
  EmailArchiveIcon,
  EmailAutoTagIcon,
  EmailJunkIcon,
  EmailMarkReadIcon,
  EmailMarkUnreadIcon,
  EmailRefreshIcon,
  EmailSummaryIcon,
  EmailSweepIcon,
  EmailTrashIcon,
} from "@/components/icons/MailActionIcons";
import { SnoozeClockIcon } from "@/components/icons/FolderIcons";
import { PhishingRodIcon } from "@/components/icons/PhishingIcons";
import { useNavigate } from "react-router-dom";

import {
  BottomActionBar,
  InboxFilterChips,
  MobileSheet,
  MobileScreen,
  MobileScreenHeader,
  PullToRefresh,
  useHideTabBar,
} from "@/components/mobile-shell";
import type { InboxQuickFilter } from "@/components/mobile-shell";
import { SwipeActions } from "@/components/mobile/SwipeActions";
import { EmailTagBadges } from "@/components/tags/EmailTagBadges";
import {
  useFilterOperations,
  useFolderOperations,
  useInbox,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { useComposer } from "@/context/composer";
import { useTags } from "@/context/tags";
import { useOptionalScheduledEmails } from "@/context/scheduled/ScheduledEmailsContext";
import { useFolderOperations as useSharedFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import {
  buildMessageTagUpdate,
  getBulkMoveTargetFolders,
  getFolderRole,
  hasMessageTag,
  resolveArchiveMoveTarget,
  resolveJunkMoveTarget,
  resolveTrashMoveTarget,
} from "@/lib/bulk-mail-actions";
import {
  resolveMessageAccountId,
  toPhishingEmailData,
} from "@/lib/phishing-email";
import { EmailSweep } from "@/components/inbox/EmailSweep";
import { TaskProgressBanner } from "@/components/inbox/TaskProgressBanner";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { useLayout } from "@/components/layouts";
import { useLongPress } from "@/hooks/useLongPress";
import { useEmailListMode } from "@/hooks/useEmailListMode";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { cn } from "@/lib/utils";
import { surfaceApiAuthError } from "@/lib/api-auth-errors";
import { apiFetch } from "@/lib/api-client";
import { requestScheduledDraftHandoff } from "@/services/scheduled-email-edit";
import { getReadableMessagePreview } from "@/lib/email-content-normalization";
import {
  getAccountQualifiedMessageToken,
  getMessageIdentityKey,
  getMessageIdentityRef,
  getMessageListRowKeys,
} from "@/lib/message-identity";
import { getAccountBadgeLabel } from "@/lib/account-label";
import { sortEmailMessages } from "@/lib/email-list-sort";
import {
  emailListDateGroupKey,
  emailListSortStateFromPreference,
  getEmailListRowPresentation,
} from "@/lib/preference-behavior";
import { groupMessagesForDisplay } from "@/lib/message-grouping";
import { getEffectiveEmailListGrouping } from "@/lib/effective-email-list-grouping";
import { getMessageFilterSignature } from "@/lib/message-filter-signature";
import {
  draftComposeIdentitiesMatch,
  getDraftComposeData,
  hasDraftComposeDetail,
  getDraftComposeIdentity,
  getScheduledEmailDraftIdentity,
  getScheduledEmailId,
  isDraftMessage,
  isScheduledMessage,
} from "@/lib/draft-compose";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";
import {
  type StartOneOffSweepRequest,
  type SweepScope,
} from "@/services/one-off-sweep.service";
import { enqueueSweepQueue } from "@/services/process-queue.service";
import { buildSweepScope } from "@/lib/sweep-scope";
import { refreshProcessQueue } from "@/hooks/useProcessQueue";
import type { EmailMessage, EmailMessageTag } from "@/types";
import {
  getScheduledComposeData,
  parseScheduledDraftHandoff,
} from "@/types/scheduled-emails";
import type {
  FolderTarget,
  MessageFilters,
  SystemFolderType,
} from "@/services/interfaces";
import { getCacheService, getInboxService } from "@/services/implementations";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import { usePhishing } from "@/context/phishing/PhishingContext";
import { useEmailSummaries } from "@/context/email-summary";
import {
  useFeatureAvailable,
  useFeatureEnabled,
} from "@/context/features/FeaturesContext";
import {
  useAutoTagger,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import { useSnooze } from "@/components/snooze/use-snooze";
import {
  getSnoozeTargetIdentityKey,
  parseSnoozeTargets,
  type SnoozeTarget,
} from "@/components/snooze/snooze-target";
import { DateTimeSelector } from "@/components/ui/date-time-selector";
import {
  fetchFilterRules,
  startFilterRuleRun,
} from "@/services/filter-rules.service";
import type { FilterRule } from "@/types/filter-rules";
import { ruleCanRunManually } from "@/types/filter-rules";
import {
  isImportantActionAvailable,
  resolveInboxActionVisibility,
} from "@/lib/inbox-action-visibility";
import { PaginationFooter } from "@/layouts/shared/components/footer-system";
import { buildEmailRowViewModel } from "@/components/inbox/email-row-model";

import { flattenImapFolders, getMailboxSlotLabel } from "./folder-labels";

function getFromDisplay(mail: EmailMessage): string {
  if (mail.name) return mail.name;
  if (mail.email) return mail.email;
  if (mail.from) return mail.from;
  return __("Unknown", "pressedmail");
}

interface MailRowProps {
  mail: EmailMessage;
  /** Stable identity for this row, resolved once by the list. */
  identity: string;
  selected: boolean;
  bulkMode: boolean;
  // Callbacks take the row they act on, so the list can hand every row the
  // same stable function instead of minting a fresh closure per row per
  // render. Without that, React.memo below can never hold.
  onTap: (mail: EmailMessage) => void;
  onLongPress: (identity: string) => void;
  onArchive: (identity: string) => void;
  onDelete: (identity: string) => void;
  swipeDisabled?: boolean;
  onTagClick: (tag: EmailMessageTag) => void;
  rowPresentation: ReturnType<typeof getEmailListRowPresentation>;
  threadCount?: number;
  threadGrouped?: boolean;
}

function mobileRowDensityClass(
  density: ReturnType<typeof getEmailListRowPresentation>["density"],
): string {
  switch (density) {
    case "dense":
      return "min-h-12 gap-0.5 p-2";
    case "compact":
      return "min-h-[52px] gap-0.5 p-3";
    case "loose":
      return "min-h-16 gap-2 p-5";
    case "comfortable":
    default:
      return "min-h-14 gap-1 p-4";
  }
}

function MailRowComponent({
  mail,
  identity,
  selected,
  bulkMode,
  onTap,
  onLongPress,
  onArchive,
  onDelete,
  swipeDisabled,
  onTagClick,
  rowPresentation,
  threadCount,
  threadGrouped,
}: MailRowProps) {
  const justLongPressed = React.useRef(false);
  const longPress = useLongPress({
    onLongPress: () => {
      justLongPressed.current = true;
      onLongPress(identity);
    },
    delay: 500,
  });

  const handleClick = (event: React.MouseEvent) => {
    if (justLongPressed.current) {
      justLongPressed.current = false;
      event.preventDefault();
      return;
    }
    onTap(mail);
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onTap(mail);
  };
  const preview = getReadableMessagePreview(mail);
  // The desktop row model, so a phone row reads "9:03 AM", "Thu" or "Sep 9"
  // like every other list in the product instead of "9/10/2026" on every row.
  const rowModel = React.useMemo(() => buildEmailRowViewModel(mail), [mail]);
  const emphasizeUnread =
    !mail.read &&
    (rowPresentation.unreadIndicator === "bold" ||
      rowPresentation.unreadIndicator === "dot_and_bold");
  const showUnreadDot =
    !mail.read &&
    (rowPresentation.unreadIndicator === "dot" ||
      rowPresentation.unreadIndicator === "dot_and_bold");
  const accountBadge =
    rowPresentation.showAccountBadge && mail.accountEmail
      ? getAccountBadgeLabel(mail)
      : null;
  const showAttachment =
    rowPresentation.showAttachmentIcon &&
    Boolean(
      mail.hasAttachments ||
      mail.attachments?.length ||
      mail.attachmentsMeta?.length,
    );

  return (
    <SwipeActions
      mail={mail}
      onArchive={() => onArchive(identity)}
      onDelete={() => onDelete(identity)}
      disabled={swipeDisabled}>
      <div
        role="button"
        tabIndex={0}
        data-pm-mail-row
        data-thread-grouped={threadGrouped || undefined}
        aria-pressed={bulkMode ? selected : undefined}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        onPointerDown={longPress.onPointerDown}
        onPointerUp={longPress.onPointerUp}
        onPointerMove={longPress.onPointerMove}
        onPointerCancel={longPress.onPointerCancel}
        onPointerLeave={longPress.onPointerLeave}
        className={cn(
          "pm-no-tap-highlight flex w-full flex-col text-left transition-colors",
          // The row is the phone shell's primary control and it is a div, but
          // role="button" and tabIndex put it inside the shared focus rule in
          // tailwind-base.css, so it shows an indicator like any other control.
          mobileRowDensityClass(rowPresentation.density),
          threadGrouped && "border-l-4 border-l-primary",
          selected && bulkMode ? "bg-primary/10" : "active:bg-muted/50",
        )}>
        <span className="sr-only">
          {mail.read
            ? __("Read message", "pressedmail")
            : __("Unread message", "pressedmail")}
        </span>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {/* A fixed gutter, present on every row of a dot-enabled list.
                The dot used to sit inline only when a message was unread, so
                unread senders started 12px right of read ones and the column
                of names never lined up. */}
            {rowPresentation.unreadIndicator === "dot" ||
            rowPresentation.unreadIndicator === "dot_and_bold" ? (
              <span
                className="flex w-2 shrink-0 justify-center"
                aria-hidden="true">
                {showUnreadDot ? (
                  <span
                    data-test="email-row-unread-dot"
                    data-testid="email-row-unread-dot"
                    className="h-1.5 w-1.5 rounded-full bg-primary"
                  />
                ) : null}
              </span>
            ) : null}
            {accountBadge ? (
              <Badge
                variant="outline"
                className="h-4 max-w-24 shrink-0 truncate px-1 py-0 text-[9px] font-normal text-muted-foreground"
                title={mail.accountEmail}
                data-test="message-account-badge"
                data-testid="email-row-account-badge">
                {/* An element holds one data-test, so the testid's twin sits inside. */}
                <span data-test="email-row-account-badge">{accountBadge}</span>
              </Badge>
            ) : null}
            <span
              data-pm-mail-sender
              className={cn(
                "min-w-0 truncate text-sm",
                emphasizeUnread && "font-semibold",
              )}>
              {getFromDisplay(mail)}
            </span>
          </div>
          <span className="shrink-0 whitespace-nowrap text-xs text-muted-foreground">
            {rowModel.dateLabel}
          </span>
        </div>
        <div className="flex min-w-0 items-center gap-1.5">
          <span
            className={cn(
              "min-w-0 truncate text-sm",
              emphasizeUnread
                ? "font-semibold text-foreground"
                : "text-muted-foreground",
            )}>
            {mail.subject || __("(No subject)", "pressedmail")}
          </span>
          {threadCount && threadCount > 1 ? (
            <span
              data-test="thread-count-badge"
              data-testid="thread-count-badge"
              className="shrink-0 rounded-full bg-muted px-1.5 text-[10px] font-medium text-muted-foreground">
              {threadCount}
            </span>
          ) : null}
          <EmailTagBadges
            tags={mail.tags}
            maxVisible={2}
            onTagClick={onTagClick}
          />
          {showAttachment ? (
            <Paperclip
              role="img"
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label={__("Has attachment", "pressedmail")}
            />
          ) : null}
        </div>
        {rowPresentation.showPreview && preview ? (
          <span
            data-test="email-row-preview"
            data-testid="email-row-preview"
            className={cn(
              "text-xs text-muted-foreground",
              rowPresentation.preview === "full" ? "line-clamp-2" : "truncate",
            )}>
            {preview}
          </span>
        ) : null}
      </div>
    </SwipeActions>
  );
}

/**
 * Memoized because the phone list is unbounded: infinite scroll keeps adding
 * rows, so every toast, sheet, snooze flag or
 * selection change re-rendered every row on screen along with its swipe state
 * and long-press timers.
 */
const MailRow = React.memo(MailRowComponent);

type SheetActionIcon = React.ElementType<{
  className?: string;
  "aria-hidden"?: React.AriaAttributes["aria-hidden"];
}>;

interface SelectedSheetActionProps {
  label: string;
  icon: SheetActionIcon;
  onAction: () => void;
  description?: string;
  disabled?: boolean;
  destructive?: boolean;
  loading?: boolean;
}

function SelectedSheetAction({
  label,
  icon: Icon,
  onAction,
  description,
  disabled,
  destructive,
  loading,
}: SelectedSheetActionProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-label={label}
      onClick={onAction}
      className={cn(
        "pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-muted",
        destructive ? "text-destructive" : "text-foreground",
        (disabled || loading) && "opacity-50",
      )}>
      <span
        className={cn(
          "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted",
          destructive ? "text-destructive" : "text-muted-foreground",
        )}>
        {loading ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <Icon className="h-5 w-5" aria-hidden="true" />
        )}
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
    </button>
  );
}

function SelectedSheetGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-1">
      <h3 className="px-3 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </h3>
      <div className="space-y-1">{children}</div>
    </section>
  );
}

function resolveCurrentFolderRole(
  folders: ReturnType<typeof useFolderOperations>["folders"],
  selectedFolder: string | null | undefined,
  selectedNav?: string | null,
): string | null {
  const normalizedNav = String(selectedNav ?? "")
    .trim()
    .toLowerCase();
  if (normalizedNav === "scheduled") return "scheduled";
  if (normalizedNav === "draft" || normalizedNav === "drafts") return "drafts";

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

  if (matchedFolder) return getFolderRole(matchedFolder);
  if (!selectedFolder) return null;
  return getFolderRole({
    name: selectedFolder,
    path: selectedFolder,
    count: 0,
  });
}

function todayInputValue(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

/**
 * Phone-shell inbox. Renders a momentum-scrolling mail list inside a
 * MobileScreen with a sticky header, InboxFilterChips (All/Unread + tag
 * chips), pull-to-refresh, swipe-to-archive/delete, and a long-press
 * bulk-select mode wired to the existing inbox operations. The hamburger
 * opens the /accounts selector; folders + tags live on the Folders tab.
 */
export function MobileInboxScreen() {
  const navigate = useNavigate();
  const composer = useComposer();
  const {
    refreshMessages,
    loadMore,
    loadPage,
    selectedAccountId,
    prefetch,
    threadGroups,
  } = useInbox();
  const { messages, isLoading, isLoadingMore, hasMore, totalCount } =
    useInboxState();
  const {
    selectMessage,
    archiveMessage,
    deleteMessage,
    batchMarkRead,
    batchMarkUnread,
    batchMove,
    batchDelete,
    toggleStar,
    toggleImportant,
  } = useMessageOperations();
  const { folders, selectedFolder, getMoveTargetFolders } =
    useFolderOperations();
  const { activeFilters, applyFilters } = useFilterOperations();
  const { preferences } = useUserPreferences();
  const { isPagination, pageSize } = useEmailListMode();
  const { accounts, selectedAccount, selectedConsolidatedAccountIds } =
    useAppContext();
  const { currentLayout } = useLayout();
  const isConsolidatedInbox = selectedAccount === CONSOLIDATED_INBOX_VALUE;
  const getMobileMessageIdentity = React.useCallback(
    (message: EmailMessage) =>
      isConsolidatedInbox
        ? getAccountQualifiedMessageToken(message)
        : getMessageIdentityKey(message),
    [isConsolidatedInbox],
  );
  const { tags, batchAssignTag, batchRemoveTag } = useTags();
  const scheduledEmails = useOptionalScheduledEmails();
  const { analyzeEmail, isEnabled: phishingEnabled } = usePhishing();
  const { summarizeMessages } = useEmailSummaries();
  const aiSummarizeAvailable = useFeatureAvailable("ai_summarize");
  const snoozeAvailable = useFeatureEnabled("snooze");
  const showSelectedImportant = isImportantActionAvailable({
    isFreeBuild: __IS_FREE__,
    smartInboxEnabled: useFeatureEnabled("smart_inbox"),
  });
  const { classifyEmails } = useAutoTagger();
  const autoTaggerAvailable = useAutoTaggerToolAvailable();
  const {
    showSnooze: showSelectedSnooze,
    showPhishing: showSelectedPhishing,
    showSummarize: showSelectedSummarize,
    showAutoTag: showSelectedAutoTag,
  } = resolveInboxActionVisibility({
    isFreeBuild: __IS_FREE__,
    snoozeBuildEnabled: __ENABLE_SNOOZE__,
    snoozeEnabled: snoozeAvailable,
    phishingBuildEnabled: __ENABLE_PHISHING_DETECTION__,
    phishingEnabled,
    aiSummarizeAvailable,
    autoTaggerBuildEnabled: __ENABLE_AUTO_TAGGER__,
    aiAutoTaggerBuildEnabled: __ENABLE_AI_AUTO_TAGGER__,
    autoTaggerToolAvailable: autoTaggerAvailable,
  });
  const showSelectedSecurityAiGroup =
    showSelectedPhishing || showSelectedAutoTag || showSelectedSummarize;
  const {
    presets: snoozePresets,
    snoozeEmail,
    fetchPresets,
    fetchCapabilities,
  } = useSnooze();
  // selectedNav drives the centred folder title; folder + tag navigation now
  // lives on the Folders tab and account switching on the /accounts screen.
  const { selectedNav } = useSharedFolderOperations();

  const [bulkMode, setBulkMode] = React.useState(false);
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());
  const [actionSheetOpen, setActionSheetOpen] = React.useState(false);
  const [moveSheetOpen, setMoveSheetOpen] = React.useState(false);
  const [tagSheetOpen, setTagSheetOpen] = React.useState(false);
  const [snoozeSheetOpen, setSnoozeSheetOpen] = React.useState(false);
  const [snoozeCustomOpen, setSnoozeCustomOpen] = React.useState(false);
  const [customSnoozeDate, setCustomSnoozeDate] = React.useState("");
  const [customSnoozeTime, setCustomSnoozeTime] = React.useState("09:00");
  const [isSnoozing, setIsSnoozing] = React.useState(false);
  const [sweepOpen, setSweepOpen] = React.useState(false);
  const [rulesSheetOpen, setRulesSheetOpen] = React.useState(false);
  const [rulesLoading, setRulesLoading] = React.useState(false);
  const [availableRules, setAvailableRules] = React.useState<FilterRule[]>([]);
  const [pendingRule, setPendingRule] = React.useState<FilterRule | null>(null);
  const [ruleRunLoading, setRuleRunLoading] = React.useState(false);
  const [confirmPermanentOpen, setConfirmPermanentOpen] = React.useState(false);
  // Set when a single swiped row is waiting on the permanent-delete
  // confirmation. Null means the confirmation belongs to the bulk selection.
  const [pendingDeleteId, setPendingDeleteId] = React.useState<string | null>(
    null,
  );
  const [isBulkActionRunning, setIsBulkActionRunning] = React.useState(false);
  const selectionScopeKey = JSON.stringify([
    selectedAccount,
    currentLayout,
    isConsolidatedInbox
      ? accounts.map((account) => String(account.id)).sort()
      : [],
    [...selectedConsolidatedAccountIds].sort((a, b) => a - b),
    selectedFolder,
    getMessageFilterSignature(activeFilters),
    [...selectedIds].sort(),
  ]);
  const selectionScopeRef = React.useRef({ key: selectionScopeKey });
  if (selectionScopeRef.current.key !== selectionScopeKey)
    selectionScopeRef.current = { key: selectionScopeKey };
  const selectionScope = selectionScopeRef.current;
  const mountedRef = React.useRef(true);
  React.useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const captureBulkScope = React.useCallback(() => {
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
  React.useEffect(() => {
    setActionSheetOpen(false);
    setMoveSheetOpen(false);
    setTagSheetOpen(false);
    setSnoozeSheetOpen(false);
    setSnoozeCustomOpen(false);
    setSweepOpen(false);
    setRulesSheetOpen(false);
    setPendingRule(null);
    setConfirmPermanentOpen(false);
    setPendingDeleteId(null);
  }, [selectionScope]);

  const messageRowsRef = React.useRef(messages);
  messageRowsRef.current = messages;
  const scheduledEmailsRef = React.useRef(scheduledEmails);
  scheduledEmailsRef.current = scheduledEmails;
  const scheduledEditRequestRef = React.useRef(0);
  const scheduledEditPendingRef = React.useRef(false);
  const draftOpenRequestRef = React.useRef(0);
  const draftScopeRef = React.useRef({
    selectedAccountId,
    selectedAccount,
    selectedFolder,
  });
  draftScopeRef.current = {
    selectedAccountId,
    selectedAccount,
    selectedFolder,
  };

  React.useEffect(
    () => () => {
      scheduledEditRequestRef.current += 1;
      scheduledEditPendingRef.current = false;
      draftOpenRequestRef.current += 1;
    },
    [],
  );

  useHideTabBar(bulkMode);

  const exitBulkMode = React.useCallback(() => {
    setBulkMode(false);
    setSelectedIds(new Set());
    setActionSheetOpen(false);
    setMoveSheetOpen(false);
    setTagSheetOpen(false);
    setSnoozeSheetOpen(false);
    setSnoozeCustomOpen(false);
    setSweepOpen(false);
    setRulesSheetOpen(false);
    setPendingRule(null);
    setConfirmPermanentOpen(false);
    setPendingDeleteId(null);
  }, []);

  const enterBulkMode = React.useCallback((id?: string) => {
    draftOpenRequestRef.current += 1;
    setBulkMode(true);
    setSelectedIds(new Set(id ? [id] : []));
  }, []);

  const toggleSelected = React.useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openMobileCompose = React.useCallback(
    (draft: ReturnType<typeof getDraftComposeData>) => {
      composer.setComposeData({
        to: draft.to ?? "",
        cc: draft.cc ?? "",
        bcc: draft.bcc ?? "",
        subject: draft.subject ?? "",
        body: draft.body ?? "",
        draftDocument: draft.draftDocument,
        draftDocumentExpired: draft.draftDocumentExpired,
        contentType: draft.contentType ?? "html",
        mode: "new",
        bodyBackgroundColor: draft.bodyBackgroundColor,
        attachments: draft.attachments ?? [],
        draftUid: draft.draftUid,
        draftFolder: draft.draftFolder,
        draftAccountId: draft.draftAccountId,
        draftUidValidity: draft.draftUidValidity,
        draftMessageId: draft.draftMessageId,
        inReplyTo: draft.inReplyTo,
        references: draft.references,
        draftAttachmentManifestComplete: draft.draftAttachmentManifestComplete,
        draftOpened: draft.draftOpened,
        scheduledEmailId: draft.scheduledEmailId,
        scheduledAccountId: draft.scheduledAccountId,
        scheduledAt: draft.scheduledAt,
        is_reply: false,
      });
      navigate("/compose");
    },
    [composer, navigate],
  );

  const handleScheduledRowTap = React.useCallback(
    async (mail: EmailMessage) => {
      if (scheduledEditPendingRef.current) return;

      const scheduledEmailId = getScheduledEmailId(mail);
      const scheduledEmail = scheduledEmails?.emails.find(
        (email) => email.id === scheduledEmailId,
      );
      const sourceIdentity = getScheduledEmailDraftIdentity(
        scheduledEmail ?? null,
      );
      if (!scheduledEmailId || !scheduledEmail || !sourceIdentity) {
        toast.error(
          __("Reload this scheduled email before editing it.", "pressedmail"),
        );
        return;
      }

      const composeSessionVersion = composer.getComposeSessionVersion();
      const requestId = ++scheduledEditRequestRef.current;
      scheduledEditPendingRef.current = true;

      try {
        const response = await requestScheduledDraftHandoff(
          scheduledEmailId,
          sourceIdentity,
        );
        const handoff = parseScheduledDraftHandoff(response);
        if (!handoff) {
          throw new Error(
            __("Scheduled draft handoff was incomplete", "pressedmail"),
          );
        }
        void Promise.resolve(scheduledEmailsRef.current?.refreshEmails()).catch(
          () => undefined,
        );

        const currentMessage = messageRowsRef.current.find(
          (candidate) => getScheduledEmailId(candidate) === scheduledEmailId,
        );
        const currentScheduledEmail =
          scheduledEmailsRef.current?.emails.find(
            (email) => email.id === scheduledEmailId,
          ) ?? null;
        if (
          scheduledEditRequestRef.current !== requestId ||
          composer.getComposeSessionVersion() !== composeSessionVersion ||
          !currentMessage ||
          !draftComposeIdentitiesMatch(
            getScheduledEmailDraftIdentity(currentScheduledEmail),
            sourceIdentity,
          )
        ) {
          return;
        }

        openMobileCompose(getScheduledComposeData(scheduledEmail, handoff));
      } catch (error) {
        if (!surfaceApiAuthError(error)) {
          toast.error(
            __(
              "We could not open this scheduled email for editing.",
              "pressedmail",
            ),
          );
        }
      } finally {
        if (scheduledEditRequestRef.current === requestId) {
          scheduledEditPendingRef.current = false;
        }
      }
    },
    [composer, openMobileCompose, scheduledEmails],
  );

  const handleDraftRowTap = React.useCallback(
    async (mail: EmailMessage, requestId: number) => {
      const draft = getDraftComposeData(
        mail,
        selectedFolder,
        selectedAccountId,
      );
      const identity = getDraftComposeIdentity(draft);
      if (!identity) {
        toast.error(__("Reload this draft before editing it.", "pressedmail"));
        return;
      }
      if (hasDraftComposeDetail(mail)) {
        openMobileCompose(draft);
        return;
      }

      const composeSessionVersion = composer.getComposeSessionVersion();
      const ownsRequest = () =>
        draftOpenRequestRef.current === requestId &&
        draftScopeRef.current.selectedAccountId === selectedAccountId &&
        draftScopeRef.current.selectedAccount === selectedAccount &&
        draftScopeRef.current.selectedFolder === selectedFolder &&
        composer.getComposeSessionVersion() === composeSessionVersion &&
        messageRowsRef.current.some((row) =>
          draftComposeIdentitiesMatch(
            getDraftComposeIdentity(
              getDraftComposeData(row, selectedFolder, selectedAccountId),
            ),
            identity,
          ),
        );

      try {
        const outcome = await prefetch.fetchDetail(
          String(identity.accountId),
          identity.folder,
          getAccountQualifiedMessageToken(mail),
          "user-selected",
        );
        if (!ownsRequest()) return;
        if (outcome && "failed" in outcome && outcome.requiresRefresh) {
          toast.error(
            __(
              "The draft identity changed. Refreshing the mailbox.",
              "pressedmail",
            ),
          );
          await refreshMessages();
          return;
        }
        if (
          !outcome ||
          !("detail" in outcome) ||
          !hasDraftComposeDetail(outcome.detail)
        ) {
          if (
            outcome &&
            ("pending" in outcome ||
              ("detail" in outcome && outcome.detail.bodyState === "partial"))
          ) {
            toast.info(
              __(
                "This draft is still loading. Tap it again to retry.",
                "pressedmail",
              ),
            );
          } else {
            toast.error(
              __(
                "We could not load this draft. Tap it again to retry.",
                "pressedmail",
              ),
            );
          }
          return;
        }
        const loaded = getDraftComposeData(
          { ...mail, ...outcome.detail },
          selectedFolder,
          selectedAccountId,
        );
        if (
          !draftComposeIdentitiesMatch(
            getDraftComposeIdentity(loaded),
            identity,
          )
        ) {
          toast.error(
            __("Reload this draft before editing it.", "pressedmail"),
          );
          return;
        }
        openMobileCompose(loaded);
      } catch (error) {
        if (ownsRequest() && !surfaceApiAuthError(error)) {
          toast.error(
            __(
              "We could not load this draft. Tap it again to retry.",
              "pressedmail",
            ),
          );
        }
      }
    },
    [
      composer,
      openMobileCompose,
      prefetch,
      selectedAccountId,
      selectedAccount,
      selectedFolder,
    ],
  );

  const handleRowTap = React.useCallback(
    (mail: EmailMessage) => {
      const requestId = ++draftOpenRequestRef.current;
      const id = getMobileMessageIdentity(mail);
      if (bulkMode) {
        toggleSelected(id);
        return;
      }

      if (isScheduledMessage(mail)) {
        void handleScheduledRowTap(mail);
        return;
      }

      if (isDraftMessage(mail)) {
        void handleDraftRowTap(mail, requestId);
        return;
      }

      navigate(`/inbox/m/${encodeURIComponent(id)}`);
      void selectMessage(mail);
    },
    [
      bulkMode,
      getMobileMessageIdentity,
      handleScheduledRowTap,
      navigate,
      handleDraftRowTap,
      selectMessage,
      toggleSelected,
    ],
  );

  // The chip row reads the shared inbox filters rather than local state: the
  // screen unmounts on every navigation but the filters do not, and a chip
  // saying "All" over a filtered list is how mail looks missing.
  const filter: InboxQuickFilter =
    activeFilters.readStatus === "unread"
      ? "unread"
      : activeFilters.important
        ? "important"
        : activeFilters.starred
          ? "starred"
          : "all";

  const handleFilterChange = (next: InboxQuickFilter) => {
    const nextFilters: MessageFilters = {
      ...activeFilters,
      readStatus: "all" as const,
    };
    delete nextFilters.important;
    delete nextFilters.starred;

    if (next === "unread") {
      nextFilters.readStatus = "unread";
    } else if (next === "important") {
      nextFilters.important = true;
    } else if (next === "starred") {
      nextFilters.starred = true;
    }

    applyFilters(nextFilters);
  };

  const selectedMessages = React.useMemo(
    () =>
      messages.filter((message) =>
        selectedIds.has(getMobileMessageIdentity(message)),
      ),
    [getMobileMessageIdentity, messages, selectedIds],
  );
  const selectedMessageIds = React.useMemo(
    () => selectedMessages.map(getMobileMessageIdentity).filter(Boolean),
    [getMobileMessageIdentity, selectedMessages],
  );
  const selectedCount = selectedIds.size;
  const allSelectedRead =
    selectedMessages.length > 0 && selectedMessages.every((mail) => mail.read);
  const allSelectedUnread =
    selectedMessages.length > 0 && selectedMessages.every((mail) => !mail.read);
  const allSelectedStarred =
    selectedMessages.length > 0 &&
    selectedMessages.every((mail) => Boolean(mail.starred));
  const allSelectedImportant =
    selectedMessages.length > 0 &&
    selectedMessages.every((mail) => Boolean(mail.important));
  const archiveTarget = React.useMemo(
    () => resolveArchiveMoveTarget(folders),
    [folders],
  );
  const trashPath = React.useMemo(
    () => resolveTrashMoveTarget(folders),
    [folders],
  );
  const junkPath = React.useMemo(
    () => resolveJunkMoveTarget(folders),
    [folders],
  );
  const currentFolderRole = React.useMemo(
    () => resolveCurrentFolderRole(folders, selectedFolder, selectedNav),
    [folders, selectedFolder, selectedNav],
  );
  const isDraftLikeFolder =
    currentFolderRole === "drafts" || currentFolderRole === "scheduled";
  const isTrashFolder = currentFolderRole === "trash";
  const isJunkFolder =
    currentFolderRole === "spam" || currentFolderRole === "junk";
  const moveTargets = React.useMemo(
    () => getBulkMoveTargetFolders(getMoveTargetFolders(), selectedFolder),
    [getMoveTargetFolders, selectedFolder],
  );
  const accountIdForActions = React.useMemo(() => {
    const matched = accounts.find(
      (account) => account.email === selectedAccount,
    );
    const rawId = matched?.id ?? accounts[0]?.id ?? 0;
    return Number(rawId) || 0;
  }, [accounts, selectedAccount]);
  const sweepScope = React.useMemo<SweepScope | null>(
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

  const snoozeTargets = React.useMemo(
    () =>
      parseSnoozeTargets(
        selectedMessages.map((message) => ({
          accountId:
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions,
          messageUid: message.uid != null ? String(message.uid) : "",
          folder: typeof message.folder === "string" ? message.folder : "",
          sourceUidValidity: message.uidValidity ?? message.uid_validity ?? "",
          sourceMessageId: message.messageId ?? message.message_id ?? "",
          subject: message.subject ?? undefined,
          from: message.from ?? undefined,
          date: message.date ?? undefined,
        })),
      ) ?? [],
    [accountIdForActions, accounts, selectedAccount, selectedMessages],
  );

  const selectedRuleRefs = React.useMemo(
    () =>
      selectedMessages.map((message) => ({
        accountId:
          resolveMessageAccountId(message, accounts, selectedAccount) ??
          accountIdForActions,
        uid: message.uid == null ? "" : String(message.uid),
        uidValidity: String(message.uidValidity ?? message.uid_validity ?? ""),
        folder: typeof message.folder === "string" ? message.folder : "",
      })),
    [
      accountIdForActions,
      accounts,
      selectedAccount,
      selectedFolder,
      selectedMessages,
    ],
  );

  React.useEffect(() => {
    if (bulkMode && selectedIds.size === 0) {
      exitBulkMode();
    }
  }, [bulkMode, exitBulkMode, selectedIds.size]);

  React.useEffect(() => {
    if (!snoozeSheetOpen) return;
    void fetchPresets();
    void fetchCapabilities();
  }, [fetchCapabilities, fetchPresets, snoozeSheetOpen]);

  const validateSelectedMessages = React.useCallback(() => {
    if (
      selectedCount !== selectedMessages.length ||
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
    return selectedCount > 0;
  }, [selectedCount, selectedMessages]);

  const runBulkOperation = React.useCallback(
    async (
      operation: (captured: ReturnType<typeof captureBulkScope>) => Promise<{
        success?: boolean;
        error?: string;
        failedIds?: (string | number)[];
      } | void>,
      successMessage: string,
      failureMessage = __("Operation failed", "pressedmail"),
    ) => {
      if (!validateSelectedMessages()) return;
      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;

      setIsBulkActionRunning(true);
      try {
        const result = await operation(captured);
        if (!captured.isCurrent()) return;
        if (result && result.success === false) {
          if (Array.isArray(result.failedIds)) {
            setSelectedIds(new Set(result.failedIds.map(String)));
          }
          toast.error(result.error || failureMessage);
          return;
        }
        toast.success(successMessage);
        exitBulkMode();
      } catch (error) {
        if (!captured.isCurrent()) return;
        if (surfaceApiAuthError(error)) {
          return;
        }
        toast.error(error instanceof Error ? error.message : failureMessage);
      } finally {
        if (mountedRef.current && captured.isPrincipalCurrent())
          setIsBulkActionRunning(false);
      }
    },
    [exitBulkMode, validateSelectedMessages, captureBulkScope],
  );

  const handleBulkArchive = React.useCallback(
    () =>
      runBulkOperation(
        () => batchMove(selectedMessageIds, archiveTarget),
        sprintf(
          _n(
            "Archived %d message",
            "Archived %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Archive failed", "pressedmail"),
      ),
    [
      archiveTarget,
      batchMove,
      runBulkOperation,
      selectedCount,
      selectedMessageIds,
    ],
  );

  const handleBulkTrash = React.useCallback(
    () =>
      runBulkOperation(
        () => batchMove(selectedMessageIds, trashPath),
        sprintf(
          _n(
            "Moved %d message to Trash",
            "Moved %d messages to Trash",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Trash failed", "pressedmail"),
      ),
    [batchMove, runBulkOperation, selectedCount, selectedMessageIds, trashPath],
  );

  const handleDraftLikeDelete = React.useCallback(() => {
    if (currentFolderRole === "scheduled") {
      void runBulkOperation(
        async (captured) => {
          const failedIds: string[] = [];
          let successCount = 0;
          let firstError: string | undefined;

          for (const message of selectedMessages) {
            if (!captured.isCurrent()) return;
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
            if (!captured.isPrincipalCurrent()) return;
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
            error: firstError,
          };
        },
        sprintf(
          _n(
            "Deleted %d scheduled message",
            "Deleted %d scheduled messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Scheduled delete failed", "pressedmail"),
      );
      return;
    }

    void runBulkOperation(
      () => batchDelete(selectedMessageIds),
      sprintf(
        _n(
          "Deleted %d draft",
          "Deleted %d drafts",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Draft delete failed", "pressedmail"),
    );
  }, [
    batchDelete,
    currentFolderRole,
    runBulkOperation,
    scheduledEmails,
    selectedCount,
    selectedMessageIds,
    selectedMessages,
  ]);

  /**
   * Swipe-to-delete on a row. Outside Trash this moves the message; inside
   * Trash the server expunges it for good, so it goes through the same
   * confirmation the bulk permanent delete uses.
   */
  const requestRowDelete = React.useCallback(
    (id: string) => {
      if (isTrashFolder) {
        setPendingDeleteId(id);
        setConfirmPermanentOpen(true);
        return;
      }
      void deleteMessage(id);
    },
    [deleteMessage, isTrashFolder],
  );

  const closeConfirmPermanent = React.useCallback(() => {
    setConfirmPermanentOpen(false);
    setPendingDeleteId(null);
  }, []);

  const handlePermanentDelete = React.useCallback(
    () =>
      runBulkOperation(
        () => batchDelete(selectedMessageIds, true),
        sprintf(
          _n(
            "Deleted %d message",
            "Deleted %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Delete failed", "pressedmail"),
      ),
    [batchDelete, runBulkOperation, selectedCount, selectedMessageIds],
  );

  const confirmPermanentDelete = React.useCallback(() => {
    const rowId = pendingDeleteId;
    closeConfirmPermanent();
    if (rowId) {
      void deleteMessage(rowId);
      return;
    }
    void handlePermanentDelete();
  }, [
    closeConfirmPermanent,
    deleteMessage,
    handlePermanentDelete,
    pendingDeleteId,
  ]);

  const handleBulkReadToggle = React.useCallback(() => {
    if (allSelectedRead) {
      void runBulkOperation(
        () => batchMarkUnread(selectedMessageIds),
        sprintf(
          _n(
            "Marked %d message as unread",
            "Marked %d messages as unread",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Mark unread failed", "pressedmail"),
      );
      return;
    }

    void runBulkOperation(
      () => batchMarkRead(selectedMessageIds),
      sprintf(
        _n(
          "Marked %d message as read",
          "Marked %d messages as read",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Mark read failed", "pressedmail"),
    );
  }, [
    allSelectedRead,
    batchMarkRead,
    batchMarkUnread,
    runBulkOperation,
    selectedCount,
    selectedMessageIds,
  ]);

  const handleMove = React.useCallback(
    (targetFolder: MutationTarget) => {
      setMoveSheetOpen(false);
      void runBulkOperation(
        () => batchMove(selectedMessageIds, targetFolder),
        sprintf(
          _n(
            "Moved %d message",
            "Moved %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        ),
        __("Move failed", "pressedmail"),
      );
    },
    [batchMove, runBulkOperation, selectedCount, selectedMessageIds],
  );

  const handleMoveToJunk = React.useCallback(() => {
    void runBulkOperation(
      () => batchMove(selectedMessageIds, junkPath),
      sprintf(
        _n(
          "Moved %d message to Junk",
          "Moved %d messages to Junk",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Move to junk failed", "pressedmail"),
    );
  }, [
    batchMove,
    junkPath,
    runBulkOperation,
    selectedCount,
    selectedMessageIds,
  ]);

  const handleMoveToInbox = React.useCallback(
    (message: string) => {
      void runBulkOperation(
        () => batchMove(selectedMessageIds, "INBOX"),
        message,
        __("Move failed", "pressedmail"),
      );
    },
    [batchMove, runBulkOperation, selectedMessageIds],
  );

  const handleToggleStarForSelection = React.useCallback(
    (targetStarred: boolean) => {
      void runBulkOperation(
        async (captured) => {
          const targets = selectedMessages.filter(
            (message) => Boolean(message.starred) !== targetStarred,
          );
          for (const message of targets) {
            if (!captured.isCurrent()) return;
            const result = await toggleStar(getMessageIdentityKey(message));
            if (result?.success === false)
              throw new Error(
                result.error || __("Message update failed", "pressedmail"),
              );
          }
          return { success: true };
        },
        targetStarred
          ? sprintf(
              _n(
                "Starred %d message",
                "Starred %d messages",
                selectedCount,
                "pressedmail",
              ),
              selectedCount,
            )
          : sprintf(
              _n(
                "Unstarred %d message",
                "Unstarred %d messages",
                selectedCount,
                "pressedmail",
              ),
              selectedCount,
            ),
        __("Star update failed", "pressedmail"),
      );
    },
    [runBulkOperation, selectedCount, selectedMessages, toggleStar],
  );

  const handleToggleImportantForSelection = React.useCallback(
    (targetImportant: boolean) => {
      void runBulkOperation(
        async (captured) => {
          const targets = selectedMessages.filter(
            (message) => Boolean(message.important) !== targetImportant,
          );
          for (const message of targets) {
            if (!captured.isCurrent()) return;
            const result = await toggleImportant(
              getMessageIdentityKey(message),
            );
            if (result?.success === false)
              throw new Error(
                result.error || __("Message update failed", "pressedmail"),
              );
          }
          return { success: true };
        },
        targetImportant
          ? sprintf(
              _n(
                "Marked %d message important",
                "Marked %d messages important",
                selectedCount,
                "pressedmail",
              ),
              selectedCount,
            )
          : sprintf(
              _n(
                "Removed important from %d message",
                "Removed important from %d messages",
                selectedCount,
                "pressedmail",
              ),
              selectedCount,
            ),
        __("Important update failed", "pressedmail"),
      );
    },
    [runBulkOperation, selectedCount, selectedMessages, toggleImportant],
  );

  const handleBulkApplyTag = React.useCallback(
    async (tagId: number) => {
      const tag = tags.find((item) => Number(item.id) === Number(tagId));
      if (selectedCount !== selectedMessages.length) {
        toast.error(
          __("Reload the mailbox before changing tags.", "pressedmail"),
        );
        return;
      }
      if (!tag || selectedMessages.length === 0) return;

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
      const refs = identities.flatMap((ref) =>
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

      const shouldRemove = selectedMessages.every((message) =>
        hasMessageTag(message, tagId),
      );
      setTagSheetOpen(false);
      setIsBulkActionRunning(true);
      try {
        const operation = shouldRemove ? batchRemoveTag : batchAssignTag;
        const result = await operation(tagId, refs);
        if (!isRequestPrincipalCurrent(principal)) return;
        if (result.failed > 0)
          throw new Error(
            __(
              "Some tags could not be changed. Refresh the mailbox and retry.",
              "pressedmail",
            ),
          );
        const inboxService = getInboxService();
        selectedMessages.forEach((message) => {
          const update = buildMessageTagUpdate(message, tag, !shouldRemove);
          inboxService.updateMessage(update.localId, { tags: update.tags });
        });
        if (!captured.isCurrent()) return;
        const count = result.success;
        toast.success(
          shouldRemove
            ? sprintf(
                _n(
                  "Removed tag from %d message",
                  "Removed tag from %d messages",
                  count,
                  "pressedmail",
                ),
                count,
              )
            : sprintf(
                _n(
                  "Tagged %d message",
                  "Tagged %d messages",
                  count,
                  "pressedmail",
                ),
                count,
              ),
        );
        exitBulkMode();
      } catch (error) {
        if (!isRequestPrincipalCurrent(principal)) return;
        const cache = getCacheService();
        cache.invalidateMessages({});
        for (const ref of refs)
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
        if (captured.isCurrent())
          toast.error(
            error instanceof Error
              ? error.message
              : __("Tag failed", "pressedmail"),
          );
      } finally {
        if (mountedRef.current && captured.isPrincipalCurrent())
          setIsBulkActionRunning(false);
      }
    },
    [
      batchAssignTag,
      batchRemoveTag,
      exitBulkMode,
      selectedMessages,
      selectedCount,
      tags,
      captureBulkScope,
    ],
  );

  const handleSnoozeUntil = React.useCallback(
    async (snoozeUntil: string) => {
      if (!showSelectedSnooze) {
        toast.info(__("Snooze is not available", "pressedmail"));
        return;
      }
      if (snoozeTargets.length === 0) {
        toast.error(__("No selected messages can be snoozed", "pressedmail"));
        return;
      }

      if (!validateSelectedMessages()) return;
      const captured = captureBulkScope();
      if (!captured.isCurrent()) return;
      setIsSnoozing(true);
      try {
        const succeeded: SnoozeTarget[] = [];
        let firstError = "";
        for (const target of snoozeTargets) {
          if (!captured.isCurrent()) break;
          const result = await snoozeEmail({
            account_id: target.accountId,
            message_uid: target.messageUid,
            source_uidvalidity: target.sourceUidValidity,
            source_message_id: target.sourceMessageId,
            snooze_until: snoozeUntil,
            folder: target.folder,
            subject: target.subject,
            from: target.from,
            date: target.date,
          });
          if (!captured.isPrincipalCurrent()) return;
          if (result.success) succeeded.push(target);
          else if (!firstError) firstError = result.error || "";
        }

        if (succeeded.length === 0) {
          if (!captured.isCurrent()) return;
          toast.error(firstError || __("Snooze failed", "pressedmail"));
          return;
        }

        const okKeys = new Set(succeeded.map(getSnoozeTargetIdentityKey));
        const inboxService = getInboxService();
        selectedMessages.forEach((message, index) => {
          const target = snoozeTargets[index];
          if (target && okKeys.has(getSnoozeTargetIdentityKey(target))) {
            inboxService.removeMessage?.(getMessageIdentityKey(message));
          }
        });
        if (!captured.isCurrent()) return;
        toast.success(
          sprintf(
            _n(
              "Snoozed %d message",
              "Snoozed %d messages",
              succeeded.length,
              "pressedmail",
            ),
            succeeded.length,
          ),
        );
        if (succeeded.length === snoozeTargets.length) {
          exitBulkMode();
        }
      } catch (error) {
        if (!captured.isCurrent()) return;
        toast.error(
          error instanceof Error
            ? error.message
            : __("Snooze failed", "pressedmail"),
        );
      } finally {
        if (mountedRef.current && captured.isPrincipalCurrent())
          setIsSnoozing(false);
      }
    },
    [
      exitBulkMode,
      captureBulkScope,
      validateSelectedMessages,
      selectedMessages,
      showSelectedSnooze,
      snoozeEmail,
      snoozeTargets,
    ],
  );

  const handleCustomSnooze = React.useCallback(() => {
    if (!customSnoozeDate) {
      toast.error(__("Choose a snooze date", "pressedmail"));
      return;
    }
    const snoozeDate = new Date(`${customSnoozeDate}T${customSnoozeTime}:00`);
    if (Number.isNaN(snoozeDate.getTime()) || snoozeDate <= new Date()) {
      toast.error(__("Choose a future snooze time", "pressedmail"));
      return;
    }
    void handleSnoozeUntil(snoozeDate.toISOString());
  }, [customSnoozeDate, customSnoozeTime, handleSnoozeUntil]);

  const handleOneOffSweepRun = React.useCallback(
    async (request: StartOneOffSweepRequest) => {
      const captured = captureBulkScope();
      if (!captured.isCurrent())
        throw new Error(
          __("The selection changed. Reopen Sweep and retry.", "pressedmail"),
        );
      // Route the sweep through the process / activity queue.
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
      exitBulkMode();
      return result;
    },
    [exitBulkMode, captureBulkScope],
  );

  const loadRules = React.useCallback(async () => {
    const captured = captureBulkScope();
    if (!captured.isCurrent()) return;
    setRulesLoading(true);
    try {
      const rules = await fetchFilterRules(accountIdForActions);
      if (!captured.isCurrent()) return;
      setAvailableRules(
        rules.filter((rule) => rule.enabled && ruleCanRunManually(rule)),
      );
    } catch {
      if (captured.isCurrent()) setAvailableRules([]);
    } finally {
      if (mountedRef.current && captured.isPrincipalCurrent())
        setRulesLoading(false);
    }
  }, [accountIdForActions, captureBulkScope]);

  const openRulesSheet = React.useCallback(() => {
    setActionSheetOpen(false);
    setRulesSheetOpen(true);
    void loadRules();
  }, [loadRules]);

  const confirmRunRule = React.useCallback(async () => {
    if (!pendingRule || !validateSelectedMessages()) return;
    const captured = captureBulkScope();
    if (!captured.isCurrent()) return;
    if (selectedRuleRefs.length === 0) {
      toast.info(__("No selected messages can be organized", "pressedmail"));
      setPendingRule(null);
      return;
    }

    setRuleRunLoading(true);
    try {
      await startFilterRuleRun({
        ruleIds: [pendingRule.id],
        scope: {
          mode: "selection",
          accountId: accountIdForActions,
          accountIds: [],
          folder: selectedFolder || "INBOX",
          folderMap: {},
          filters: {},
          syncFirst: false,
          refs: selectedRuleRefs,
        },
      });
      if (!captured.isCurrent()) return;
      toast.success(
        __("Rule run started for selected messages", "pressedmail"),
      );
      exitBulkMode();
    } catch (error) {
      if (!captured.isCurrent()) return;
      toast.error(
        error instanceof Error
          ? error.message
          : __("Could not start the rule run", "pressedmail"),
      );
    } finally {
      if (mountedRef.current && captured.isPrincipalCurrent())
        setRuleRunLoading(false);
      if (captured.isCurrent()) setPendingRule(null);
    }
  }, [
    accountIdForActions,
    captureBulkScope,
    validateSelectedMessages,
    exitBulkMode,
    pendingRule,
    selectedFolder,
    selectedRuleRefs,
  ]);

  const handlePhishingCheck = React.useCallback(() => {
    if (!showSelectedPhishing) {
      toast.info(__("Phishing check is not available", "pressedmail"));
      return;
    }
    void runBulkOperation(
      async (captured) => {
        for (const message of selectedMessages) {
          if (!captured.isCurrent()) return;
          const accountId =
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions;
          if (!accountId || !Number.isFinite(accountId)) {
            throw new Error(
              __(
                "Could not resolve the email account for a selected message",
                "pressedmail",
              ),
            );
          }
          await analyzeEmail(
            accountId,
            toPhishingEmailData(message),
            message.folder || selectedFolder || "INBOX",
          );
        }
        return { success: true };
      },
      sprintf(
        _n(
          "Running phishing check on %d message",
          "Running phishing check on %d messages",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Phishing check failed", "pressedmail"),
    );
  }, [
    accountIdForActions,
    accounts,
    analyzeEmail,
    runBulkOperation,
    selectedAccount,
    selectedCount,
    selectedFolder,
    selectedMessages,
    showSelectedPhishing,
  ]);

  const handleSummarize = React.useCallback(() => {
    if (!showSelectedSummarize) {
      toast.info(__("Summarize is not available", "pressedmail"));
      return;
    }
    void runBulkOperation(
      async () => {
        const result = await summarizeMessages(selectedMessages);
        const firstFailure = result.failures?.[0]?.error;
        if (
          result.failedCount > 0 ||
          result.successCount !== selectedMessages.length
        ) {
          throw new Error(
            firstFailure || __("Summarize failed", "pressedmail"),
          );
        }
        return { success: true };
      },
      sprintf(
        _n(
          "Summarizing %d message",
          "Summarizing %d messages",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Summarize failed", "pressedmail"),
    );
  }, [
    runBulkOperation,
    selectedCount,
    selectedMessages,
    showSelectedSummarize,
    summarizeMessages,
  ]);

  const handleAutoTag = React.useCallback(() => {
    if (!showSelectedAutoTag) {
      toast.info(__("Auto-tag is not available", "pressedmail"));
      return;
    }
    void runBulkOperation(
      async (captured) => {
        for (const message of selectedMessages) {
          if (!captured.isCurrent()) return;
          const accountId =
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions;
          if (!accountId) continue;
          const result = await classifyEmails(accountId, [
            {
              uid: message.uid,

              uidValidity: message.uidValidity ?? message.uid_validity,
              folder: message.folder || "",
              subject: message.subject ?? "",
              from: message.from ?? "",
              date: message.date ?? "",
              body:
                message.plainBody ||
                message.textBody ||
                message.body ||
                message.htmlBody ||
                message.snippet ||
                "",
            },
          ]);
          if (result.status === "error") {
            throw new Error(
              result.message || __("Auto-tag failed", "pressedmail"),
            );
          }
        }
        return { success: true };
      },
      sprintf(
        _n(
          "Auto-tagging %d message",
          "Auto-tagging %d messages",
          selectedCount,
          "pressedmail",
        ),
        selectedCount,
      ),
      __("Auto-tag failed", "pressedmail"),
    );
  }, [
    accountIdForActions,
    accounts,
    classifyEmails,
    runBulkOperation,
    selectedAccount,
    selectedCount,
    selectedFolder,
    selectedMessages,
    showSelectedAutoTag,
  ]);

  // Search lives on the dedicated /search route now; the inbox renders the
  // active folder/filter result set directly, using the same persisted list
  // behavior as the desktop layouts.
  const listSort = React.useMemo(
    () =>
      emailListSortStateFromPreference(
        preferences.email_list_default_sort ?? "newest",
      ),
    [preferences.email_list_default_sort],
  );
  const sortedMessages = React.useMemo(
    () => sortEmailMessages(messages, listSort),
    [listSort, messages],
  );
  const groupedMessages = React.useMemo(
    () =>
      groupMessagesForDisplay(
        sortedMessages,
        getEffectiveEmailListGrouping(
          preferences.email_list_grouping ?? "list",
        ),
        threadGroups,
      ),
    [preferences.email_list_grouping, sortedMessages, threadGroups],
  );
  const visibleMessages = groupedMessages.items;
  const rowPresentation = React.useMemo(
    () => getEmailListRowPresentation(preferences),
    [preferences],
  );
  const visibleMessageKeys = React.useMemo(
    () => getMessageListRowKeys(visibleMessages),
    [visibleMessages],
  );

  const [currentPage, setCurrentPage] = React.useState(1);
  const filterSignature = React.useMemo(
    () => getMessageFilterSignature(activeFilters),
    [activeFilters],
  );

  React.useEffect(() => {
    if (!isPagination || !selectedAccountId) return;

    setCurrentPage(1);
    void loadPage(1, pageSize);
  }, [
    filterSignature,
    isPagination,
    loadPage,
    pageSize,
    selectedAccountId,
    selectedFolder,
  ]);

  const effectiveTotal =
    typeof totalCount === "number" && totalCount > sortedMessages.length
      ? totalCount
      : sortedMessages.length;
  const totalPages = Math.max(1, Math.ceil(effectiveTotal / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const hasMoreServer = isPagination
    ? safeCurrentPage * pageSize < effectiveTotal
    : hasMore ||
      (typeof totalCount === "number" && totalCount > messages.length);

  const handlePageChange = React.useCallback(
    (page: number) => {
      setCurrentPage(page);
      void loadPage(page, pageSize);
    },
    [loadPage, pageSize],
  );

  const loadMoreRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (isPagination) return;
    const node = loadMoreRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const target = entries[0];
        if (target?.isIntersecting && hasMoreServer && !isLoadingMore) {
          void loadMore();
        }
      },
      { threshold: 0.1, rootMargin: "100px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreServer, isLoadingMore, isPagination, loadMore]);

  const readActionLabel = allSelectedRead
    ? __("Unread", "pressedmail")
    : __("Read", "pressedmail");
  const readActionAria = allSelectedRead
    ? __("Mark selected messages as unread", "pressedmail")
    : __("Mark selected messages as read", "pressedmail");
  const primaryFolderAction = isTrashFolder
    ? {
        id: "restore",
        label: __("Restore", "pressedmail"),
        ariaLabel: __("Restore selected messages", "pressedmail"),
        icon: FolderInput,
        onAction: () =>
          handleMoveToInbox(__("Messages restored", "pressedmail")),
      }
    : isJunkFolder
      ? {
          id: "not-spam",
          label: __("Not spam", "pressedmail"),
          ariaLabel: __("Move selected messages to Inbox", "pressedmail"),
          icon: FolderInput,
          onAction: () =>
            handleMoveToInbox(__("Messages moved to Inbox", "pressedmail")),
        }
      : {
          id: "archive",
          label: _x("Archive", "verb", "pressedmail"),
          ariaLabel: __("Archive selected messages", "pressedmail"),
          icon: EmailArchiveIcon,
          onAction: handleBulkArchive,
        };
  const destructivePrimaryAction = isTrashFolder
    ? {
        id: "permanent-delete",
        label: __("Delete", "pressedmail"),
        ariaLabel: __("Delete selected messages permanently", "pressedmail"),
        icon: EmailTrashIcon,
        onAction: () => setConfirmPermanentOpen(true),
        destructive: true,
      }
    : {
        id: "trash",
        label: __("Trash", "pressedmail"),
        ariaLabel: __("Trash selected messages", "pressedmail"),
        icon: EmailTrashIcon,
        onAction: handleBulkTrash,
        destructive: true,
      };
  const bulkActions = bulkMode
    ? isDraftLikeFolder
      ? [
          {
            id: "delete-draft",
            label: __("Delete", "pressedmail"),
            ariaLabel:
              currentFolderRole === "scheduled"
                ? __("Delete selected scheduled messages", "pressedmail")
                : __("Delete selected drafts", "pressedmail"),
            icon: EmailTrashIcon,
            onAction: handleDraftLikeDelete,
            destructive: true,
            disabled: selectedCount === 0,
            loading: isBulkActionRunning,
          },
        ]
      : [
          primaryFolderAction,
          {
            id: "read",
            label: readActionLabel,
            ariaLabel: readActionAria,
            icon: allSelectedRead ? EmailMarkUnreadIcon : EmailMarkReadIcon,
            onAction: handleBulkReadToggle,
            disabled:
              selectedCount === 0 || (allSelectedRead && allSelectedUnread),
            loading: isBulkActionRunning,
          },
          {
            ...destructivePrimaryAction,
            disabled: selectedCount === 0,
            loading: isBulkActionRunning,
          },
          {
            id: "more",
            label: __("More", "pressedmail"),
            ariaLabel: __("More actions for selected messages", "pressedmail"),
            icon: MoreHorizontal,
            onAction: () => setActionSheetOpen(true),
          },
        ].map((action) => ({
          ...action,
          disabled:
            action.id !== "more" &&
            (("disabled" in action && action.disabled) || selectedCount === 0),
        }))
    : [];

  // The heading names the mailbox the way the rest of the product names it.
  // `selectedNav` is a raw nav id, so the phone header read "INBOX",
  // "snoozed" or "scheduled" where every desktop sidebar says Inbox, Snoozed
  // and Scheduled.
  const folderTitle = React.useMemo(() => {
    const nav = String(selectedNav ?? "").trim();
    if (!nav) return getMailboxSlotLabel("inbox");
    const lower = nav.toLowerCase();
    const virtualViews: Record<string, SystemFolderType> = {
      important: "important",
      starred: "starred",
      flagged: "flagged",
      snoozed: "snoozed",
      scheduled: "scheduled",
    };
    const virtual = virtualViews[lower];
    if (virtual) return getMailboxSlotLabel(virtual);
    // Flattened: a Gmail account keeps Sent and friends under [Gmail], so a
    // top-level lookup misses whatever the user actually selected.
    const match = flattenImapFolders(folders).find(
      (folder) =>
        String(folder.path ?? "").toLowerCase() === lower ||
        String(folder.name ?? "").toLowerCase() === lower,
    );
    if (match?.systemType) return getMailboxSlotLabel(match.systemType);
    return match?.name || nav;
  }, [folders, selectedNav]);

  const handleRowLongPress = React.useCallback(
    (identity: string) => enterBulkMode(identity),
    [enterBulkMode],
  );
  const handleRowArchive = React.useCallback(
    (identity: string) => {
      void archiveMessage(identity);
    },
    [archiveMessage],
  );
  const handleRowTagClick = React.useCallback(
    (tag: EmailMessageTag) => {
      applyFilters({ ...activeFilters, tags: [String(tag.id)] });
    },
    [activeFilters, applyFilters],
  );

  const headerTitle = bulkMode
    ? sprintf(
        /* translators: %d: number of selected messages. */
        _n("%d selected", "%d selected", selectedIds.size, "pressedmail"),
        selectedIds.size,
      )
    : folderTitle;

  return (
    <MobileScreen
      header={
        <MobileScreenHeader
          title={headerTitle}
          leading={
            bulkMode ? (
              <button
                type="button"
                onClick={exitBulkMode}
                className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full px-3 text-sm font-medium text-muted-foreground active:bg-muted">
                {__("Cancel", "pressedmail")}
              </button>
            ) : (
              // Account selector + Search sit together on the left; the title
              // stays centred (MobileScreenHeader centers it independently).
              <>
                <button
                  type="button"
                  aria-label={__("Folders and labels", "pressedmail")}
                  onClick={() => navigate("/folders")}
                  className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label={__("Search", "pressedmail")}
                  onClick={() => navigate("/search")}
                  className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
                  <Search className="h-5 w-5" aria-hidden="true" />
                </button>
              </>
            )
          }
          trailing={
            bulkMode ? (
              isDraftLikeFolder ? null : (
                <button
                  type="button"
                  aria-label={__(
                    "More actions for selected messages",
                    "pressedmail",
                  )}
                  onClick={() => setActionSheetOpen(true)}
                  className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
                  <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                </button>
              )
            ) : (
              // Lower-priority actions collapse into an overflow menu so the
              // header never crowds on narrow phones (Menu/Search/Title/More
              // stay visible; Refresh, Select, Settings live here).
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    aria-label={__("More options", "pressedmail")}
                    className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted aria-expanded:bg-muted">
                    <MoreHorizontal className="h-5 w-5" aria-hidden="true" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={isLoading}
                    onClick={() => refreshMessages()}>
                    <EmailRefreshIcon
                      className={cn(
                        "mr-2 h-4 w-4",
                        isLoading && "animate-spin",
                      )}
                      aria-hidden="true"
                    />
                    {__("Refresh", "pressedmail")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => enterBulkMode()}>
                    <CheckSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                    {__("Select", "pressedmail")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    {__("Settings", "pressedmail")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )
          }
        />
      }
      footer={
        bulkMode ? (
          <BottomActionBar actions={bulkActions} />
        ) : // The pager has no loading state of its own, so while the first
        // page was in flight the body said "Loading messages..." and the
        // footer said "No messages" at the same time.
        isPagination && !(isLoading && visibleMessages.length === 0) ? (
          <PaginationFooter
            currentPage={safeCurrentPage}
            totalItems={sortedMessages.length}
            pageSize={pageSize}
            onPageChange={handlePageChange}
            serverTotalItems={totalCount}
            hasMore={hasMoreServer}
          />
        ) : null
      }>
      <InboxFilterChips
        quickFilter={filter}
        onQuickFilterChange={handleFilterChange}
      />
      <TaskProgressBanner />
      <PullToRefresh
        onRefresh={async () => {
          await refreshMessages();
        }}
        disabled={bulkMode}>
        {isLoading && visibleMessages.length === 0 ? (
          <p
            role="status"
            className="px-4 py-6 text-center text-sm text-muted-foreground">
            {__("Loading messages...", "pressedmail")}
          </p>
        ) : null}
        {!isLoading && visibleMessages.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">
              {sprintf(
                /* translators: %s: the name of the current mailbox, e.g. Inbox. */
                __("Nothing in %s", "pressedmail"),
                folderTitle,
              )}
            </p>
            <p className="text-xs text-muted-foreground">
              {__("New mail shows up here as it arrives.", "pressedmail")}
            </p>
            <button
              type="button"
              onClick={() => refreshMessages()}
              disabled={isLoading}
              className="pm-touch-target pm-no-tap-highlight mt-1 inline-flex items-center justify-center rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground active:bg-primary/90 disabled:opacity-50">
              {__("Check for new mail", "pressedmail")}
            </button>
          </div>
        ) : null}
        {/* The compact inbox is its own list, so it needs the same two hooks
            the desktop list publishes. Without them the phone and tablet inbox
            is invisible to the capture harness and the craft gate, which is
            why neither had ever been graded there. */}
        <ul
          role="list"
          className="divide-y divide-border"
          data-test="message-list"
          data-testid="message-list">
          {visibleMessages.map((mail, index) => {
            const id = getMobileMessageIdentity(mail);
            const threadMeta = groupedMessages.meta.get(
              getMessageIdentityKey(mail),
            );
            const groupKey = emailListDateGroupKey(
              mail.receivedDate ?? mail.date,
              rowPresentation.dateGrouping,
            );
            const previous = visibleMessages[index - 1];
            const previousGroupKey = previous
              ? emailListDateGroupKey(
                  previous.receivedDate ?? previous.date,
                  rowPresentation.dateGrouping,
                )
              : null;
            const showDateGroup =
              Boolean(groupKey) && groupKey !== previousGroupKey;
            return (
              <React.Fragment key={visibleMessageKeys[index] ?? id}>
                {showDateGroup ? (
                  <li
                    className="px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground"
                    data-test="email-list-date-group"
                    data-testid="email-list-date-group">
                    {groupKey}
                  </li>
                ) : null}
                <li
                  data-test="email-row"
                  data-testid="email-row"
                  // Keep long lists searchable and accessible while the browser
                  // skips layout and paint for offscreen rows.
                  style={
                    visibleMessages.length > 200
                      ? {
                          contentVisibility: "auto",
                          containIntrinsicSize: "auto 80px",
                        }
                      : undefined
                  }>
                  <MailRow
                    mail={mail}
                    identity={id}
                    selected={selectedIds.has(id)}
                    bulkMode={bulkMode}
                    onTap={handleRowTap}
                    onLongPress={handleRowLongPress}
                    onArchive={handleRowArchive}
                    onDelete={requestRowDelete}
                    swipeDisabled={bulkMode}
                    onTagClick={handleRowTagClick}
                    rowPresentation={rowPresentation}
                    threadCount={
                      threadMeta?.isNewest ? threadMeta.count : undefined
                    }
                    threadGrouped={threadMeta?.isThreaded}
                  />
                </li>
              </React.Fragment>
            );
          })}
        </ul>
        {!isPagination ? (
          <div ref={loadMoreRef} className="h-16" aria-hidden="true" />
        ) : null}
      </PullToRefresh>
      <MobileSheet
        open={actionSheetOpen}
        onOpenChange={setActionSheetOpen}
        title={sprintf(
          /* translators: %d: number of selected messages. */
          _n("%d selected", "%d selected", selectedCount, "pressedmail"),
          selectedCount,
        )}>
        <div className="space-y-5">
          <SelectedSheetGroup title={__("Status", "pressedmail")}>
            <SelectedSheetAction
              label={__("Mark as read", "pressedmail")}
              icon={EmailMarkReadIcon}
              disabled={selectedCount === 0 || allSelectedRead}
              onAction={() => {
                setActionSheetOpen(false);
                void runBulkOperation(
                  () => batchMarkRead(selectedMessageIds),
                  sprintf(
                    _n(
                      "Marked %d message as read",
                      "Marked %d messages as read",
                      selectedCount,
                      "pressedmail",
                    ),
                    selectedCount,
                  ),
                  __("Mark read failed", "pressedmail"),
                );
              }}
            />
            <SelectedSheetAction
              label={__("Mark as unread", "pressedmail")}
              icon={EmailMarkUnreadIcon}
              disabled={selectedCount === 0 || allSelectedUnread}
              onAction={() => {
                setActionSheetOpen(false);
                void runBulkOperation(
                  () => batchMarkUnread(selectedMessageIds),
                  sprintf(
                    _n(
                      "Marked %d message as unread",
                      "Marked %d messages as unread",
                      selectedCount,
                      "pressedmail",
                    ),
                    selectedCount,
                  ),
                  __("Mark unread failed", "pressedmail"),
                );
              }}
            />
            <SelectedSheetAction
              label={__("Star", "pressedmail")}
              icon={Star}
              disabled={selectedCount === 0 || allSelectedStarred}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleStarForSelection(true);
              }}
            />
            <SelectedSheetAction
              label={__("Unstar", "pressedmail")}
              icon={StarOff}
              disabled={selectedCount === 0 || !allSelectedStarred}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleStarForSelection(false);
              }}
            />
            {showSelectedImportant ? (
              <>
                <SelectedSheetAction
                  label={__("Mark important", "pressedmail")}
                  icon={CircleAlert}
                  disabled={selectedCount === 0 || allSelectedImportant}
                  onAction={() => {
                    setActionSheetOpen(false);
                    handleToggleImportantForSelection(true);
                  }}
                />
                <SelectedSheetAction
                  label={__("Remove important", "pressedmail")}
                  icon={CircleAlert}
                  disabled={selectedCount === 0 || !allSelectedImportant}
                  onAction={() => {
                    setActionSheetOpen(false);
                    handleToggleImportantForSelection(false);
                  }}
                />
              </>
            ) : null}
          </SelectedSheetGroup>

          <SelectedSheetGroup title={__("Organize", "pressedmail")}>
            {!isTrashFolder && !isJunkFolder ? (
              <SelectedSheetAction
                label={_x("Archive", "verb", "pressedmail")}
                icon={EmailArchiveIcon}
                disabled={selectedCount === 0}
                onAction={() => {
                  setActionSheetOpen(false);
                  handleBulkArchive();
                }}
              />
            ) : null}
            <SelectedSheetAction
              label={__("Move to folder", "pressedmail")}
              icon={FolderInput}
              disabled={selectedCount === 0 || moveTargets.length === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setMoveSheetOpen(true);
              }}
            />
            <SelectedSheetAction
              label={__("Tag / Label", "pressedmail")}
              icon={Tag}
              disabled={selectedCount === 0 || tags.length === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setTagSheetOpen(true);
              }}
            />
            {showSelectedSnooze ? (
              <SelectedSheetAction
                label={__("Snooze", "pressedmail")}
                icon={SnoozeClockIcon}
                disabled={selectedCount === 0}
                onAction={() => {
                  setActionSheetOpen(false);
                  setSnoozeCustomOpen(false);
                  setCustomSnoozeDate(todayInputValue());
                  setSnoozeSheetOpen(true);
                }}
              />
            ) : null}
            <SelectedSheetAction
              label={__("Sweep", "pressedmail")}
              icon={EmailSweepIcon}
              disabled={selectedCount === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setSweepOpen(true);
              }}
            />
            <SelectedSheetAction
              label={__("Run rules", "pressedmail")}
              icon={ListChecks}
              disabled={selectedCount === 0}
              loading={rulesLoading}
              onAction={openRulesSheet}
            />
          </SelectedSheetGroup>

          {showSelectedSecurityAiGroup ? (
            <SelectedSheetGroup title={__("Security and AI", "pressedmail")}>
              {showSelectedPhishing ? (
                <SelectedSheetAction
                  label={__("Phishing check", "pressedmail")}
                  icon={PhishingRodIcon}
                  disabled={selectedCount === 0}
                  onAction={() => {
                    setActionSheetOpen(false);
                    handlePhishingCheck();
                  }}
                />
              ) : null}
              {showSelectedAutoTag ? (
                <SelectedSheetAction
                  label={__("Auto-tag", "pressedmail")}
                  icon={EmailAutoTagIcon}
                  disabled={selectedCount === 0}
                  onAction={() => {
                    setActionSheetOpen(false);
                    handleAutoTag();
                  }}
                />
              ) : null}
              {showSelectedSummarize ? (
                <SelectedSheetAction
                  label={__("Summarize", "pressedmail")}
                  icon={EmailSummaryIcon}
                  disabled={selectedCount === 0}
                  onAction={() => {
                    setActionSheetOpen(false);
                    handleSummarize();
                  }}
                />
              ) : null}
            </SelectedSheetGroup>
          ) : null}

          <SelectedSheetGroup title={__("Spam and delete", "pressedmail")}>
            {!isJunkFolder && !isTrashFolder ? (
              <SelectedSheetAction
                label={__("Move to junk", "pressedmail")}
                icon={EmailJunkIcon}
                disabled={selectedCount === 0}
                onAction={() => {
                  setActionSheetOpen(false);
                  handleMoveToJunk();
                }}
              />
            ) : null}
            {!isTrashFolder ? (
              <SelectedSheetAction
                label={__("Trash", "pressedmail")}
                icon={EmailTrashIcon}
                disabled={selectedCount === 0}
                destructive
                onAction={() => {
                  setActionSheetOpen(false);
                  handleBulkTrash();
                }}
              />
            ) : null}
            {isTrashFolder ? (
              <SelectedSheetAction
                label={__("Delete permanently", "pressedmail")}
                icon={EmailTrashIcon}
                disabled={selectedCount === 0}
                destructive
                onAction={() => {
                  setActionSheetOpen(false);
                  setConfirmPermanentOpen(true);
                }}
              />
            ) : null}
          </SelectedSheetGroup>
        </div>
      </MobileSheet>

      <MobileSheet
        open={moveSheetOpen}
        onOpenChange={setMoveSheetOpen}
        title={sprintf(
          _n(
            "Move %d message",
            "Move %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        )}>
        <ul role="list" className="space-y-1">
          {moveTargets.map((folder) => (
            <li key={folderTargetKey(folder)}>
              <button
                type="button"
                className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm active:bg-muted"
                onClick={() => handleMove(folderMutationTarget(folder))}>
                <FolderInput
                  className="h-5 w-5 text-muted-foreground"
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{folder.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </MobileSheet>

      <MobileSheet
        open={tagSheetOpen}
        onOpenChange={setTagSheetOpen}
        title={sprintf(
          _n("Tag %d message", "Tag %d messages", selectedCount, "pressedmail"),
          selectedCount,
        )}>
        <ul role="list" className="space-y-1">
          {tags.map((tag) => (
            <li key={tag.id}>
              <button
                type="button"
                className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm active:bg-muted"
                onClick={() => {
                  void handleBulkApplyTag(tag.id);
                }}>
                <span
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: tag.color }}
                  aria-hidden="true"
                />
                <span className="min-w-0 truncate">{tag.name}</span>
              </button>
            </li>
          ))}
        </ul>
      </MobileSheet>

      <MobileSheet
        open={snoozeSheetOpen}
        onOpenChange={setSnoozeSheetOpen}
        title={sprintf(
          _n(
            "Snooze %d message",
            "Snooze %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        )}>
        {!__IS_FREE__ && !snoozeAvailable ? (
          <div className="space-y-3 px-2 text-sm text-muted-foreground">
            <p>
              {__(
                "Snooze is not available for this account or license.",
                "pressedmail",
              )}
            </p>
          </div>
        ) : snoozeCustomOpen ? (
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <label
                htmlFor="mobile-bulk-snooze-date"
                className="text-xs font-medium text-muted-foreground">
                {__("Date", "pressedmail")}
              </label>
              <DateTimeSelector
                id="mobile-bulk-snooze-date"
                mode="date"
                min={todayInputValue()}
                value={customSnoozeDate}
                onChange={setCustomSnoozeDate}
                data-test="mobile-bulk-snooze-date"
                data-testid="mobile-bulk-snooze-date"
              />
            </div>
            <div className="space-y-2">
              <label
                htmlFor="mobile-bulk-snooze-time"
                className="text-xs font-medium text-muted-foreground">
                {__("Time", "pressedmail")}
              </label>
              <DateTimeSelector
                id="mobile-bulk-snooze-time"
                mode="time"
                value={customSnoozeTime}
                onChange={setCustomSnoozeTime}
                data-test="mobile-bulk-snooze-time"
                data-testid="mobile-bulk-snooze-time"
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted"
                onClick={() => setSnoozeCustomOpen(false)}>
                {__("Back", "pressedmail")}
              </button>
              <button
                type="button"
                disabled={isSnoozing}
                className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground active:bg-primary/90 disabled:opacity-50"
                onClick={handleCustomSnooze}>
                {isSnoozing
                  ? __("Snoozing...", "pressedmail")
                  : __("Snooze", "pressedmail")}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {snoozePresets.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                {__("Loading snooze options...", "pressedmail")}
              </p>
            ) : (
              snoozePresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  disabled={isSnoozing}
                  className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm active:bg-muted disabled:opacity-50"
                  onClick={() => {
                    void handleSnoozeUntil(preset.time);
                  }}>
                  <SnoozeClockIcon
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate">
                    {preset.label}
                  </span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {preset.relative}
                  </span>
                </button>
              ))
            )}
            <button
              type="button"
              className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm active:bg-muted"
              onClick={() => {
                setCustomSnoozeDate((current) => current || todayInputValue());
                setSnoozeCustomOpen(true);
              }}>
              <Calendar
                className="h-5 w-5 text-muted-foreground"
                aria-hidden="true"
              />
              <span>{__("Pick date/time", "pressedmail")}</span>
            </button>
          </div>
        )}
      </MobileSheet>

      <MobileSheet
        open={rulesSheetOpen}
        onOpenChange={setRulesSheetOpen}
        title={sprintf(
          _n(
            "Run rules on %d message",
            "Run rules on %d messages",
            selectedCount,
            "pressedmail",
          ),
          selectedCount,
        )}>
        {rulesLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            {__("Loading rules...", "pressedmail")}
          </div>
        ) : availableRules.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            {__("No enabled rules are available.", "pressedmail")}
          </p>
        ) : (
          <ul role="list" className="space-y-1">
            {availableRules.map((rule) => (
              <li key={rule.id}>
                <button
                  type="button"
                  className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm active:bg-muted"
                  onClick={() => {
                    setRulesSheetOpen(false);
                    setPendingRule(rule);
                  }}>
                  <ListChecks
                    className="h-5 w-5 text-muted-foreground"
                    aria-hidden="true"
                  />
                  <span className="min-w-0 truncate">{rule.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </MobileSheet>

      <MobileSheet
        open={pendingRule !== null}
        onOpenChange={(open) => {
          if (!open && !ruleRunLoading) setPendingRule(null);
        }}
        title={__("Run saved rule?", "pressedmail")}
        description={
          pendingRule
            ? sprintf(
                /* translators: %s: the name of a saved organize rule. */
                __("Run %s on the selected messages.", "pressedmail"),
                pendingRule.name,
              )
            : __("Run this rule on the selected messages.", "pressedmail")
        }>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            disabled={ruleRunLoading}
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted disabled:opacity-50"
            onClick={() => setPendingRule(null)}>
            {__("Cancel", "pressedmail")}
          </button>
          <button
            type="button"
            disabled={ruleRunLoading}
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground active:bg-primary/90 disabled:opacity-50"
            onClick={() => {
              void confirmRunRule();
            }}>
            {ruleRunLoading
              ? __("Running...", "pressedmail")
              : __("Run rule", "pressedmail")}
          </button>
        </div>
      </MobileSheet>

      {sweepScope && (
        <EmailSweep
          open={sweepOpen}
          onOpenChange={setSweepOpen}
          initialMessages={selectedMessages}
          scope={sweepScope}
          folders={folders}
          onRun={handleOneOffSweepRun}
          selection={{ selectedCount: selectedMessages.length }}
        />
      )}

      <MobileSheet
        open={confirmPermanentOpen}
        onOpenChange={(open) => {
          if (!open) closeConfirmPermanent();
        }}
        title={__("Delete permanently?", "pressedmail")}
        description={
          pendingDeleteId
            ? __(
                "This permanently deletes the message and cannot be undone.",
                "pressedmail",
              )
            : __(
                "This permanently deletes the selected messages and cannot be undone.",
                "pressedmail",
              )
        }>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted"
            onClick={closeConfirmPermanent}>
            {__("Cancel", "pressedmail")}
          </button>
          <button
            type="button"
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground active:bg-destructive/90"
            onClick={confirmPermanentDelete}>
            {__("Delete permanently", "pressedmail")}
          </button>
        </div>
      </MobileSheet>
    </MobileScreen>
  );
}

export default MobileInboxScreen;
