"use client";

import * as React from "react";
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
import { getReadableMessagePreview } from "@/lib/email-content-normalization";
import {
  getAccountQualifiedMessageToken,
  getMessageIdentityKey,
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
import type { FolderTarget, MessageFilters } from "@/services/interfaces";
import { getInboxService } from "@/services/implementations";
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
import { resolveInboxActionVisibility } from "@/lib/inbox-action-visibility";
import { PaginationFooter } from "@/layouts/shared/components/footer-system";

function getFromDisplay(mail: EmailMessage): string {
  if (mail.name) return mail.name;
  if (mail.email) return mail.email;
  if (mail.from) return mail.from;
  return "Unknown";
}

interface MailRowProps {
  mail: EmailMessage;
  selected: boolean;
  bulkMode: boolean;
  onTap: () => void;
  onLongPress: () => void;
  onArchive: () => void;
  onDelete: () => void;
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

function MailRow({
  mail,
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
      onLongPress();
    },
    delay: 500,
  });

  const handleClick = (event: React.MouseEvent) => {
    if (justLongPressed.current) {
      justLongPressed.current = false;
      event.preventDefault();
      return;
    }
    onTap();
  };
  const handleKeyDown = (event: React.KeyboardEvent) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    onTap();
  };
  const preview = getReadableMessagePreview(mail);
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
      onArchive={onArchive}
      onDelete={onDelete}
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
          // The row is the phone shell's primary control and it is a div, so it
          // gets no focus ring for free. Without this, tabbing the message list
          // moves through every message showing nothing at all.
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30 focus-visible:ring-inset",
          mobileRowDensityClass(rowPresentation.density),
          threadGrouped && "border-l-4 border-l-primary",
          selected && bulkMode ? "bg-primary/10" : "active:bg-muted/50",
        )}>
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            {showUnreadDot ? (
              <span
                data-test="email-row-unread-dot"
                data-testid="email-row-unread-dot"
                className="h-1.5 w-1.5 shrink-0 rounded-full bg-primary"
                aria-label="Unread"
              />
            ) : null}
            {accountBadge ? (
              <Badge
                variant="outline"
                className="h-4 max-w-24 shrink-0 truncate px-1 py-0 text-[9px] font-normal text-muted-foreground"
                title={mail.accountEmail}
                data-test="message-account-badge"
                data-testid="email-row-account-badge">
                {accountBadge}
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
            {mail.date ? new Date(mail.date).toLocaleDateString() : ""}
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
            {mail.subject || "(No subject)"}
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
              className="h-3.5 w-3.5 shrink-0 text-muted-foreground"
              aria-label="Has attachment"
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
  const messageRowsRef = React.useRef(messages);
  messageRowsRef.current = messages;
  const scheduledEmailsRef = React.useRef(scheduledEmails);
  scheduledEmailsRef.current = scheduledEmails;
  const scheduledEditRequestRef = React.useRef(0);
  const scheduledEditPendingRef = React.useRef(false);

  React.useEffect(
    () => () => {
      scheduledEditRequestRef.current += 1;
      scheduledEditPendingRef.current = false;
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

  const enterBulkMode = React.useCallback((id: string) => {
    setBulkMode(true);
    setSelectedIds(new Set([id]));
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
        contentType: draft.contentType ?? "html",
        mode: "new",
        bodyBackgroundColor: draft.bodyBackgroundColor,
        attachments: draft.attachments ?? [],
        draftUid: draft.draftUid,
        draftFolder: draft.draftFolder,
        draftAccountId: draft.draftAccountId,
        draftUidValidity: draft.draftUidValidity,
        draftMessageId: draft.draftMessageId,
        draftAttachmentManifestComplete: draft.draftAttachmentManifestComplete,
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
        toast.error("Reload this scheduled email before editing it.");
        return;
      }

      const composeSessionVersion = composer.getComposeSessionVersion();
      const requestId = ++scheduledEditRequestRef.current;
      scheduledEditPendingRef.current = true;

      try {
        const apiUrl = window.pressedmailPlugin?.apiUrl || "";
        const response = await apiFetch(
          `${apiUrl}${getRuntimeRestNamespace()}/scheduled-emails/edit/${scheduledEmailId}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              prior_draft_uid: sourceIdentity.uid,
              prior_draft_folder: sourceIdentity.folder,
              prior_draft_account_id: sourceIdentity.accountId,
              prior_draft_uidvalidity: sourceIdentity.uidValidity,
              prior_draft_message_id: sourceIdentity.messageId,
            }),
          },
        );
        const handoff = parseScheduledDraftHandoff(await response.json());
        if (!handoff) {
          throw new Error("Scheduled draft handoff was incomplete");
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
          toast.error("We could not open this scheduled email for editing.");
        }
      } finally {
        if (scheduledEditRequestRef.current === requestId) {
          scheduledEditPendingRef.current = false;
        }
      }
    },
    [composer, openMobileCompose, scheduledEmails],
  );

  const handleRowTap = React.useCallback(
    (mail: EmailMessage) => {
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
        const draft = getDraftComposeData(
          mail,
          selectedFolder,
          selectedAccountId,
        );
        if (!getDraftComposeIdentity(draft)) {
          toast.error("Reload this draft before editing it.");
          return;
        }
        openMobileCompose(draft);
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
      openMobileCompose,
      selectMessage,
      selectedAccountId,
      selectedFolder,
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
      selectedMessages
        .map((message) => ({
          accountId:
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions,
          uid: message.uid != null ? String(message.uid) : String(message.id),
          folder: message.folder || selectedFolder || "INBOX",
        }))
        .filter((ref) => ref.accountId > 0 && ref.uid !== ""),
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

  const runBulkOperation = React.useCallback(
    async (
      operation: () => Promise<{
        success?: boolean;
        error?: string;
        failedIds?: (string | number)[];
      } | void>,
      successMessage: string,
      failureMessage = "Operation failed",
    ) => {
      if (selectedMessageIds.length === 0) return;

      setIsBulkActionRunning(true);
      try {
        const result = await operation();
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
        if (surfaceApiAuthError(error)) {
          return;
        }
        toast.error(error instanceof Error ? error.message : failureMessage);
      } finally {
        setIsBulkActionRunning(false);
      }
    },
    [exitBulkMode, selectedMessageIds],
  );

  const handleBulkArchive = React.useCallback(
    () =>
      runBulkOperation(
        () => batchMove(selectedMessageIds, archiveTarget),
        `Archived ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
        "Archive failed",
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
        `Moved ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} to Trash`,
        "Trash failed",
      ),
    [batchMove, runBulkOperation, selectedCount, selectedMessageIds, trashPath],
  );

  const handleDraftLikeDelete = React.useCallback(() => {
    if (currentFolderRole === "scheduled") {
      void runBulkOperation(
        async () => {
          const failedIds: string[] = [];
          let successCount = 0;
          let firstError: string | undefined;

          for (const message of selectedMessages) {
            const localId = getMessageIdentityKey(message);
            const scheduledId = Number(message.scheduledEmailId);
            if (
              !scheduledEmails ||
              !Number.isInteger(scheduledId) ||
              scheduledId <= 0
            ) {
              failedIds.push(localId);
              firstError ??= "Scheduled email could not be identified";
              continue;
            }

            const result = await scheduledEmails.deleteEmail(scheduledId);
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
        `Deleted ${selectedCount} ${selectedCount === 1 ? "scheduled message" : "scheduled messages"}`,
        "Scheduled delete failed",
      );
      return;
    }

    void runBulkOperation(
      () => batchDelete(selectedMessageIds),
      `Deleted ${selectedCount} ${selectedCount === 1 ? "draft" : "drafts"}`,
      "Draft delete failed",
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
        `Deleted ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
        "Delete failed",
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
        `Marked ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} as unread`,
        "Mark unread failed",
      );
      return;
    }

    void runBulkOperation(
      () => batchMarkRead(selectedMessageIds),
      `Marked ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} as read`,
      "Mark read failed",
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
        `Moved ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
        "Move failed",
      );
    },
    [batchMove, runBulkOperation, selectedCount, selectedMessageIds],
  );

  const handleMoveToJunk = React.useCallback(() => {
    void runBulkOperation(
      () => batchMove(selectedMessageIds, junkPath),
      `Moved ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} to Junk`,
      "Move to junk failed",
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
        "Move failed",
      );
    },
    [batchMove, runBulkOperation, selectedMessageIds],
  );

  const handleToggleStarForSelection = React.useCallback(
    (targetStarred: boolean) => {
      void runBulkOperation(
        async () => {
          const targets = selectedMessages.filter(
            (message) => Boolean(message.starred) !== targetStarred,
          );
          await Promise.all(
            targets.map((message) =>
              toggleStar(getMessageIdentityKey(message)),
            ),
          );
          return { success: true };
        },
        targetStarred
          ? `Starred ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`
          : `Unstarred ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
        "Star update failed",
      );
    },
    [runBulkOperation, selectedCount, selectedMessages, toggleStar],
  );

  const handleToggleImportantForSelection = React.useCallback(
    (targetImportant: boolean) => {
      void runBulkOperation(
        async () => {
          const targets = selectedMessages.filter(
            (message) => Boolean(message.important) !== targetImportant,
          );
          await Promise.all(
            targets.map((message) =>
              toggleImportant(getMessageIdentityKey(message)),
            ),
          );
          return { success: true };
        },
        targetImportant
          ? `Marked ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} important`
          : `Removed important from ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
        "Important update failed",
      );
    },
    [runBulkOperation, selectedCount, selectedMessages, toggleImportant],
  );

  const handleBulkApplyTag = React.useCallback(
    async (tagId: number) => {
      const tag = tags.find((item) => Number(item.id) === Number(tagId));
      if (!tag || selectedMessages.length === 0) return;

      const refs = selectedMessages
        .map((message) => ({
          account_id:
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions,
          message_uid:
            message.uid != null ? String(message.uid) : String(message.id),
          folder: message.folder || selectedFolder || "INBOX",
        }))
        .filter((ref) => ref.account_id > 0 && ref.message_uid !== "");
      if (refs.length === 0) {
        toast.error("No selected messages can be tagged");
        return;
      }

      const shouldRemove = selectedMessages.every((message) =>
        hasMessageTag(message, tagId),
      );
      setTagSheetOpen(false);
      setIsBulkActionRunning(true);
      try {
        const operation = shouldRemove ? batchRemoveTag : batchAssignTag;
        const result = await operation(tagId, refs);
        const inboxService = getInboxService();
        selectedMessages.forEach((message) => {
          const update = buildMessageTagUpdate(message, tag, !shouldRemove);
          inboxService.updateMessage(update.localId, { tags: update.tags });
        });
        const count = result?.success ?? refs.length;
        toast.success(
          shouldRemove
            ? `Removed tag from ${count} ${count === 1 ? "message" : "messages"}`
            : `Tagged ${count} ${count === 1 ? "message" : "messages"}`,
        );
        exitBulkMode();
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Tag failed");
      } finally {
        setIsBulkActionRunning(false);
      }
    },
    [
      accountIdForActions,
      accounts,
      batchAssignTag,
      batchRemoveTag,
      exitBulkMode,
      selectedAccount,
      selectedFolder,
      selectedMessages,
      tags,
    ],
  );

  const handleSnoozeUntil = React.useCallback(
    async (snoozeUntil: string) => {
      if (!showSelectedSnooze) {
        toast.info("Snooze is not available");
        return;
      }
      if (snoozeTargets.length === 0) {
        toast.error("No selected messages can be snoozed");
        return;
      }

      setIsSnoozing(true);
      try {
        const succeeded: SnoozeTarget[] = [];
        let firstError = "";
        for (const target of snoozeTargets) {
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
          if (result.success) succeeded.push(target);
          else if (!firstError) firstError = result.error || "";
        }

        if (succeeded.length === 0) {
          toast.error(firstError || "Snooze failed");
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
        toast.success(
          `Snoozed ${succeeded.length} ${succeeded.length === 1 ? "message" : "messages"}`,
        );
        if (succeeded.length === snoozeTargets.length) {
          exitBulkMode();
        }
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Snooze failed");
      } finally {
        setIsSnoozing(false);
      }
    },
    [
      exitBulkMode,
      selectedMessages,
      showSelectedSnooze,
      snoozeEmail,
      snoozeTargets,
    ],
  );

  const handleCustomSnooze = React.useCallback(() => {
    if (!customSnoozeDate) {
      toast.error("Choose a snooze date");
      return;
    }
    const snoozeDate = new Date(`${customSnoozeDate}T${customSnoozeTime}:00`);
    if (Number.isNaN(snoozeDate.getTime()) || snoozeDate <= new Date()) {
      toast.error("Choose a future snooze time");
      return;
    }
    void handleSnoozeUntil(snoozeDate.toISOString());
  }, [customSnoozeDate, customSnoozeTime, handleSnoozeUntil]);

  const handleOneOffSweepRun = React.useCallback(
    async (request: StartOneOffSweepRequest) => {
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
      toast.success(
        result.deduplicated
          ? "That sweep is already running"
          : "Added to the activity queue",
      );
      refreshProcessQueue();
      exitBulkMode();
      return result;
    },
    [exitBulkMode],
  );

  const loadRules = React.useCallback(async () => {
    setRulesLoading(true);
    try {
      const rules = await fetchFilterRules(accountIdForActions);
      setAvailableRules(
        rules.filter((rule) => rule.enabled && ruleCanRunManually(rule)),
      );
    } catch {
      setAvailableRules([]);
    } finally {
      setRulesLoading(false);
    }
  }, [accountIdForActions]);

  const openRulesSheet = React.useCallback(() => {
    setActionSheetOpen(false);
    setRulesSheetOpen(true);
    void loadRules();
  }, [loadRules]);

  const confirmRunRule = React.useCallback(async () => {
    if (!pendingRule) return;
    if (selectedRuleRefs.length === 0) {
      toast.info("No selected messages can be organized");
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
      toast.success("Rule run started for selected messages");
      exitBulkMode();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Could not start the rule run",
      );
    } finally {
      setRuleRunLoading(false);
      setPendingRule(null);
    }
  }, [
    accountIdForActions,
    exitBulkMode,
    pendingRule,
    selectedFolder,
    selectedRuleRefs,
  ]);

  const handlePhishingCheck = React.useCallback(() => {
    if (!showSelectedPhishing) {
      toast.info("Phishing check is not available");
      return;
    }
    void runBulkOperation(
      async () => {
        for (const message of selectedMessages) {
          const accountId =
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions;
          if (!accountId || !Number.isFinite(accountId)) {
            throw new Error(
              "Could not resolve the email account for a selected message",
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
      `Running phishing check on ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
      "Phishing check failed",
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
      toast.info("Summarize is not available");
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
          throw new Error(firstFailure || "Summarize failed");
        }
        return { success: true };
      },
      `Summarizing ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
      "Summarize failed",
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
      toast.info("Auto-tag is not available");
      return;
    }
    void runBulkOperation(
      async () => {
        for (const message of selectedMessages) {
          const accountId =
            resolveMessageAccountId(message, accounts, selectedAccount) ??
            accountIdForActions;
          if (!accountId) continue;
          const result = await classifyEmails(accountId, [
            {
              uid:
                message.uid != null ? String(message.uid) : String(message.id),
              folder: message.folder || selectedFolder || "INBOX",
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
            throw new Error(result.message || "Auto-tag failed");
          }
        }
        return { success: true };
      },
      `Auto-tagging ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`,
      "Auto-tag failed",
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

  const readActionLabel = allSelectedRead ? "Unread" : "Read";
  const readActionAria = allSelectedRead
    ? "Mark selected messages as unread"
    : "Mark selected messages as read";
  const primaryFolderAction = isTrashFolder
    ? {
        id: "restore",
        label: "Restore",
        ariaLabel: "Restore selected messages",
        icon: FolderInput,
        onAction: () => handleMoveToInbox("Messages restored"),
      }
    : isJunkFolder
      ? {
          id: "not-spam",
          label: "Not spam",
          ariaLabel: "Move selected messages to Inbox",
          icon: FolderInput,
          onAction: () => handleMoveToInbox("Messages moved to Inbox"),
        }
      : {
          id: "archive",
          label: "Archive",
          ariaLabel: "Archive selected messages",
          icon: EmailArchiveIcon,
          onAction: handleBulkArchive,
        };
  const destructivePrimaryAction = isTrashFolder
    ? {
        id: "permanent-delete",
        label: "Delete",
        ariaLabel: "Delete selected messages permanently",
        icon: EmailTrashIcon,
        onAction: () => setConfirmPermanentOpen(true),
        destructive: true,
      }
    : {
        id: "trash",
        label: "Trash",
        ariaLabel: "Trash selected messages",
        icon: EmailTrashIcon,
        onAction: handleBulkTrash,
        destructive: true,
      };
  const bulkActions = bulkMode
    ? isDraftLikeFolder
      ? [
          {
            id: "delete-draft",
            label: "Delete",
            ariaLabel:
              currentFolderRole === "scheduled"
                ? "Delete selected scheduled messages"
                : "Delete selected drafts",
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
              selectedCount === 0 ||
              (readActionLabel === "Read" && allSelectedRead) ||
              (readActionLabel === "Unread" && allSelectedUnread),
            loading: isBulkActionRunning,
          },
          {
            ...destructivePrimaryAction,
            disabled: selectedCount === 0,
            loading: isBulkActionRunning,
          },
          {
            id: "more",
            label: "More",
            ariaLabel: "More actions for selected messages",
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

  const headerTitle = bulkMode
    ? `${selectedIds.size} selected`
    : selectedNav || "Inbox";

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
                Cancel
              </button>
            ) : (
              // Account selector + Search sit together on the left; the title
              // stays centred (MobileScreenHeader centers it independently).
              <>
                <button
                  type="button"
                  aria-label="Mailbox menu"
                  onClick={() => navigate("/accounts")}
                  className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted">
                  <Menu className="h-5 w-5" aria-hidden="true" />
                </button>
                <button
                  type="button"
                  aria-label="Search"
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
                  aria-label="More actions for selected messages"
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
                    aria-label="More options"
                    className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-full text-foreground active:bg-muted aria-expanded:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
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
                    Refresh
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => setBulkMode(true)}>
                    <CheckSquare className="mr-2 h-4 w-4" aria-hidden="true" />
                    Select
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/settings")}>
                    <Settings2 className="mr-2 h-4 w-4" aria-hidden="true" />
                    Settings
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
        ) : isPagination ? (
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
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            Loading messages...
          </p>
        ) : null}
        {!isLoading && visibleMessages.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-muted-foreground">
            No messages
          </p>
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
                <li data-test="email-row" data-testid="email-row">
                  <MailRow
                    mail={mail}
                    selected={selectedIds.has(id)}
                    bulkMode={bulkMode}
                    onTap={() => handleRowTap(mail)}
                    onLongPress={() => enterBulkMode(id)}
                    onArchive={() => archiveMessage(id)}
                    onDelete={() => requestRowDelete(id)}
                    swipeDisabled={bulkMode}
                    onTagClick={(tag) =>
                      applyFilters({
                        ...activeFilters,
                        tags: [String(tag.id)],
                      })
                    }
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
        title={`${selectedCount} selected`}>
        <div className="space-y-5">
          <SelectedSheetGroup title="Status">
            <SelectedSheetAction
              label="Mark as read"
              icon={EmailMarkReadIcon}
              disabled={selectedCount === 0 || allSelectedRead}
              onAction={() => {
                setActionSheetOpen(false);
                void runBulkOperation(
                  () => batchMarkRead(selectedMessageIds),
                  `Marked ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} as read`,
                  "Mark read failed",
                );
              }}
            />
            <SelectedSheetAction
              label="Mark as unread"
              icon={EmailMarkUnreadIcon}
              disabled={selectedCount === 0 || allSelectedUnread}
              onAction={() => {
                setActionSheetOpen(false);
                void runBulkOperation(
                  () => batchMarkUnread(selectedMessageIds),
                  `Marked ${selectedCount} ${selectedCount === 1 ? "message" : "messages"} as unread`,
                  "Mark unread failed",
                );
              }}
            />
            <SelectedSheetAction
              label="Star"
              icon={Star}
              disabled={selectedCount === 0 || allSelectedStarred}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleStarForSelection(true);
              }}
            />
            <SelectedSheetAction
              label="Unstar"
              icon={StarOff}
              disabled={selectedCount === 0 || !allSelectedStarred}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleStarForSelection(false);
              }}
            />
            <SelectedSheetAction
              label="Mark important"
              icon={CircleAlert}
              disabled={selectedCount === 0 || allSelectedImportant}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleImportantForSelection(true);
              }}
            />
            <SelectedSheetAction
              label="Remove important"
              icon={CircleAlert}
              disabled={selectedCount === 0 || !allSelectedImportant}
              onAction={() => {
                setActionSheetOpen(false);
                handleToggleImportantForSelection(false);
              }}
            />
          </SelectedSheetGroup>

          <SelectedSheetGroup title="Organize">
            {!isTrashFolder && !isJunkFolder ? (
              <SelectedSheetAction
                label="Archive"
                icon={EmailArchiveIcon}
                disabled={selectedCount === 0}
                onAction={() => {
                  setActionSheetOpen(false);
                  handleBulkArchive();
                }}
              />
            ) : null}
            <SelectedSheetAction
              label="Move to folder"
              icon={FolderInput}
              disabled={selectedCount === 0 || moveTargets.length === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setMoveSheetOpen(true);
              }}
            />
            <SelectedSheetAction
              label="Tag / Label"
              icon={Tag}
              disabled={selectedCount === 0 || tags.length === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setTagSheetOpen(true);
              }}
            />
            {showSelectedSnooze ? (
              <SelectedSheetAction
                label="Snooze"
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
              label="Sweep"
              icon={EmailSweepIcon}
              disabled={selectedCount === 0}
              onAction={() => {
                setActionSheetOpen(false);
                setSweepOpen(true);
              }}
            />
            <SelectedSheetAction
              label="Run rules"
              icon={ListChecks}
              disabled={selectedCount === 0}
              loading={rulesLoading}
              onAction={openRulesSheet}
            />
          </SelectedSheetGroup>

          {showSelectedSecurityAiGroup ? (
            <SelectedSheetGroup title="Security and AI">
              {showSelectedPhishing ? (
                <SelectedSheetAction
                  label="Phishing check"
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
                  label="Auto-tag"
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
                  label="Summarize"
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

          <SelectedSheetGroup title="Spam and delete">
            {!isJunkFolder && !isTrashFolder ? (
              <SelectedSheetAction
                label="Move to junk"
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
                label="Trash"
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
                label="Delete permanently"
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
        title={`Move ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`}>
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
        title={`Tag ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`}>
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
        title={`Snooze ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`}>
        {!__IS_FREE__ && !snoozeAvailable ? (
          <div className="space-y-3 px-2 text-sm text-muted-foreground">
            <p>Snooze is not available for this account or license.</p>
          </div>
        ) : snoozeCustomOpen ? (
          <div className="space-y-4 px-1">
            <div className="space-y-2">
              <label
                htmlFor="mobile-bulk-snooze-date"
                className="text-xs font-medium text-muted-foreground">
                Date
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
                Time
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
                Back
              </button>
              <button
                type="button"
                disabled={isSnoozing}
                className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground active:bg-primary/90 disabled:opacity-50"
                onClick={handleCustomSnooze}>
                {isSnoozing ? "Snoozing..." : "Snooze"}
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-1">
            {snoozePresets.length === 0 ? (
              <p className="px-3 py-2 text-sm text-muted-foreground">
                Loading snooze options...
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
              <span>Pick date/time</span>
            </button>
          </div>
        )}
      </MobileSheet>

      <MobileSheet
        open={rulesSheetOpen}
        onOpenChange={setRulesSheetOpen}
        title={`Run rules on ${selectedCount} ${selectedCount === 1 ? "message" : "messages"}`}>
        {rulesLoading ? (
          <div className="flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Loading rules...
          </div>
        ) : availableRules.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">
            No enabled rules are available.
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
        title="Run saved rule?"
        description={
          pendingRule
            ? `Run "${pendingRule.name}" on the selected messages.`
            : "Run this rule on the selected messages."
        }>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            disabled={ruleRunLoading}
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted disabled:opacity-50"
            onClick={() => setPendingRule(null)}>
            Cancel
          </button>
          <button
            type="button"
            disabled={ruleRunLoading}
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-primary px-3 text-sm font-medium text-primary-foreground active:bg-primary/90 disabled:opacity-50"
            onClick={() => {
              void confirmRunRule();
            }}>
            {ruleRunLoading ? "Running..." : "Run rule"}
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
        title="Delete permanently?"
        description={
          pendingDeleteId
            ? "This permanently deletes the message and cannot be undone."
            : "This permanently deletes the selected messages and cannot be undone."
        }>
        <div className="flex gap-2 px-1">
          <button
            type="button"
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md border border-border px-3 text-sm font-medium active:bg-muted"
            onClick={closeConfirmPermanent}>
            Cancel
          </button>
          <button
            type="button"
            className="pm-touch-target pm-no-tap-highlight inline-flex flex-1 items-center justify-center rounded-md bg-destructive px-3 text-sm font-medium text-destructive-foreground active:bg-destructive/90"
            onClick={confirmPermanentDelete}>
            Delete permanently
          </button>
        </div>
      </MobileSheet>
    </MobileScreen>
  );
}

export default MobileInboxScreen;
