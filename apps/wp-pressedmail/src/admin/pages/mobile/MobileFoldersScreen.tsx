"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  Archive,
  ChevronRight,
  FileText,
  Folder,
  Inbox as InboxIcon,
  Loader2,
  Send,
  Star,
  Trash2,
  UserCircle2,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { useAppContext } from "@/context/AppProvider";
import {
  EmailImportantIcon,
  EmailJunkIcon,
} from "@/components/icons/MailActionIcons";
import {
  ScheduledFolderIcon,
  SnoozeClockIcon,
} from "@/components/icons/FolderIcons";
import { TagFilterSection } from "@/components/tags/TagFilterSection";
import {
  useFolderOperations,
  type NormalizedFolder,
} from "@/layouts/shared/hooks/useFolderOperations";
import { computeSyncFrontier } from "@/hooks/useMailboxSyncProgress";
import type {
  FolderTarget,
  ImapFolder,
  SystemFolderType,
} from "@/services/interfaces";
import { cn } from "@/lib/utils";
import {
  ProviderFolderTree,
  filterProviderFolderTree,
} from "@/layouts/shared/components/ProviderFolderTree";

import {
  flattenImapFolders,
  getMailboxSlotLabel,
  mailboxBadgeCount,
} from "./folder-labels";

/**
 * Standard mailbox order, mirrored from the desktop PressedG sidebar:
 * Inbox, Important, Starred, Sent, Drafts, Archive, Junk, Trash, Scheduled,
 * Snoozed. Important/Starred/Scheduled/Snoozed are virtual views (no real IMAP
 * folder); the rest resolve to a real folder when the account is synced.
 */
type MailboxSlot = {
  type: SystemFolderType;
  iconKey: string;
  virtual: boolean;
  /** Rendered even before a real folder resolves, as the desktop sidebar does. */
  alwaysVisible?: boolean;
  /** Path used when no real folder has resolved yet. */
  fallbackPath?: string;
};

const MAILBOX_SLOTS: MailboxSlot[] = [
  {
    type: "inbox",
    iconKey: "inbox",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "INBOX",
  },
  {
    type: "important",
    iconKey: "important",
    virtual: true,
    fallbackPath: "important",
  },
  { type: "starred", iconKey: "star", virtual: true, fallbackPath: "starred" },
  {
    type: "sent",
    iconKey: "sent",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "Sent",
  },
  {
    type: "drafts",
    iconKey: "drafts",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "Drafts",
  },
  {
    type: "archive",
    iconKey: "archive",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "Archive",
  },
  {
    type: "spam",
    iconKey: "junk",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "Junk",
  },
  {
    type: "trash",
    iconKey: "trash",
    virtual: false,
    alwaysVisible: true,
    fallbackPath: "Trash",
  },
  {
    type: "scheduled",
    iconKey: "scheduled",
    virtual: true,
    fallbackPath: "scheduled",
  },
  {
    type: "snoozed",
    iconKey: "snoozed",
    virtual: true,
    fallbackPath: "snoozed",
  },
];

const ICONS: Record<string, LucideIcon> = {
  inbox: InboxIcon,
  important: EmailImportantIcon as LucideIcon,
  star: Star,
  sent: Send,
  drafts: FileText,
  archive: Archive,
  junk: EmailJunkIcon as LucideIcon,
  trash: Trash2,
  scheduled: ScheduledFolderIcon as LucideIcon,
  snoozed: SnoozeClockIcon as LucideIcon,
  folder: Folder,
};

interface MailboxRow {
  id: string;
  name: string;
  count: number;
  iconKey: string;
  syncing?: boolean;
  countPartial?: boolean;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

function matchesSlot(
  folder: { systemType?: SystemFolderType },
  type: SystemFolderType,
): boolean {
  if (folder.systemType === type) return true;
  // The two spellings of the same mailbox.
  if (type === "spam") return folder.systemType === "junk";
  if (type === "junk") return folder.systemType === "spam";
  return false;
}

/**
 * Folders screen. Owns mailbox + tag navigation, and is what the inbox
 * hamburger opens. Mailboxes are assembled from the same source as the desktop
 * sidebar (the provider tree plus the virtual flag views) so the two stay in
 * lockstep; tags come from the shared TagFilterSection. Selecting a folder
 * switches it and returns to the inbox.
 */
export function MobileFoldersScreen() {
  const navigate = useNavigate();
  const { selectedAccount } = useAppContext();
  const {
    normalizedFolders,
    folders = [],
    selectFolder,
    selectedNav,
    selectedFolderTarget,
    virtualFolderCounts,
  } = useFolderOperations();
  const providerFolders = React.useMemo<ImapFolder[]>(
    () =>
      folders.length > 0
        ? folders
        : normalizedFolders.map(
            ({ id: _id, displayCount: _displayCount, ...folder }) => folder,
          ),
    [folders, normalizedFolders],
  );

  const rows = React.useMemo<MailboxRow[]>(() => {
    const isFree = typeof __IS_FREE__ !== "undefined" && __IS_FREE__;
    const scheduledEnabled = __ENABLE_SCHEDULED_EMAILS__ && !isFree;
    const systemRows: MailboxRow[] = [];
    // One spinner at a time: the current frontier folder (first still-mirroring
    // in canonical order, inbox first).
    const syncFrontier = computeSyncFrontier(normalizedFolders);
    // Gmail keeps Sent/Drafts/Trash/Spam under [Gmail], and only the top level
    // is normalized, so the tree has to be walked to find them.
    const flatProviderFolders = flattenImapFolders(providerFolders);
    const normalizedByPath = new Map<string, NormalizedFolder>(
      normalizedFolders.map((folder) => [folder.path, folder]),
    );

    for (const slot of MAILBOX_SLOTS) {
      const label = getMailboxSlotLabel(slot.type);

      if (slot.virtual) {
        if (slot.type === "snoozed" && isFree) continue;
        if (slot.type === "scheduled" && !scheduledEnabled) continue;
        const countSnapshot =
          slot.type === "important"
            ? virtualFolderCounts.important
            : slot.type === "starred"
              ? virtualFolderCounts.starred
              : slot.type === "scheduled"
                ? {
                    count: virtualFolderCounts.scheduled ?? 0,
                    partial: false,
                  }
                : { count: 0, partial: false };
        systemRows.push({
          id: slot.fallbackPath ?? slot.type,
          name: label,
          count: countSnapshot.count,
          countPartial: countSnapshot.partial,
          iconKey: slot.iconKey,
          // Virtual views are not real mirrored folders → never the frontier.
          syncing: false,
        });
        continue;
      }

      const providerFolder = flatProviderFolders.find((folder) =>
        matchesSlot(folder, slot.type),
      );
      const normalized = providerFolder
        ? normalizedByPath.get(providerFolder.path)
        : normalizedFolders.find((folder) => matchesSlot(folder, slot.type));
      const resolved = normalized ?? providerFolder;

      if (!resolved) {
        // Every core mailbox stays reachable even before the first folder sync
        // resolves a concrete path, exactly as the desktop sidebar does.
        if (slot.alwaysVisible && slot.fallbackPath) {
          systemRows.push({
            id: slot.fallbackPath,
            name: label,
            count: 0,
            iconKey: slot.iconKey,
            syncing: slot.fallbackPath === syncFrontier,
          });
        }
        continue;
      }

      systemRows.push({
        id: resolved.path,
        // Always the translated slot label. The provider's own name is where
        // "INBOX" came from.
        name: label,
        count: mailboxBadgeCount({ ...resolved, systemType: slot.type }),
        iconKey: slot.iconKey,
        syncing: resolved.path === syncFrontier,
      });
    }

    return systemRows;
  }, [normalizedFolders, providerFolders, virtualFolderCounts]);

  const customTree = React.useMemo(
    () =>
      filterProviderFolderTree(
        providerFolders,
        (folder) =>
          !folder.systemType &&
          !folder.path.startsWith("pressedmail-account://"),
      ),
    [providerFolders],
  );
  const combinedTrees = React.useMemo(
    () =>
      providerFolders.flatMap((folder) =>
        folder.path.startsWith("pressedmail-account://") && folder.accountId
          ? [{ accountId: folder.accountId, folders: folder.children ?? [] }]
          : [],
      ),
    [providerFolders],
  );
  const isCombinedInbox = combinedTrees.length > 0;
  const activeAccountId =
    providerFolders.find((folder) => typeof folder.accountId === "number")
      ?.accountId ?? 0;

  const handleSelect = (folder: string | FolderTarget) => {
    selectFolder(folder);
    navigate("/inbox");
  };

  const navLc = selectedNav.toLowerCase();

  return (
    <MobileScreen
      header={
        <MobileScreenHeader title={__("Folders", "pressedmail")} hideBack />
      }>
      <div className="px-3 py-4">
        {/* The account this mailbox list belongs to, and the way to switch it.
            This screen is what the inbox hamburger opens, so the account
            switcher has to be reachable from here rather than being the thing
            the hamburger opened instead of folders. */}
        {selectedAccount ? (
          <button
            type="button"
            onClick={() => navigate("/accounts")}
            data-test="mobile-folders-account"
            data-testid="mobile-folders-account"
            className="pm-touch-target pm-no-tap-highlight mb-2 flex w-full items-center gap-3 rounded-lg border border-border px-3 py-2 text-left active:bg-muted">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
              <UserCircle2 className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-medium">
                {selectedAccount}
              </span>
              <span className="text-xs text-muted-foreground">
                {__("Switch account", "pressedmail")}
              </span>
            </span>
            <ChevronRight
              className="h-4 w-4 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </button>
        ) : null}

        <SectionHeading>{__("Mailboxes", "pressedmail")}</SectionHeading>
        <ul role="list" className="flex flex-col gap-1">
          {rows.map((row) => {
            const Icon = ICONS[row.iconKey] ?? Folder;
            const active = navLc === row.id.toLowerCase();
            return (
              <li key={`${row.iconKey}:${row.id}`}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => handleSelect(row.id)}
                  className={cn(
                    "pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-muted",
                    active && "bg-primary/10 text-primary",
                  )}>
                  <Icon
                    className="h-5 w-5"
                    aria-hidden="true"
                    data-pm-folder-icon={row.iconKey}
                  />
                  <span className="flex-1 truncate text-sm">{row.name}</span>
                  {row.syncing ? (
                    <Loader2
                      role="img"
                      data-test="folder-syncing-indicator"
                      data-testid="folder-syncing-indicator"
                      aria-label={__("Syncing", "pressedmail")}
                      className="h-4 w-4 shrink-0 animate-spin text-primary"
                    />
                  ) : row.countPartial || row.count > 0 ? (
                    <span className="text-xs text-muted-foreground">
                      {row.countPartial ? "2000+" : row.count}
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {!isCombinedInbox && (
            <li>
              <ProviderFolderTree
                accountId={activeAccountId}
                folders={customTree}
                selectedPath={selectedNav}
                selectedTarget={selectedFolderTarget}
                mobile
                onSelect={handleSelect}
              />
            </li>
          )}
        </ul>

        {isCombinedInbox && (
          <div className="mt-4 border-t border-border pt-3">
            <SectionHeading>
              {__("Provider folders", "pressedmail")}
            </SectionHeading>
            {combinedTrees.map((group) => (
              <section key={group.accountId} className="mb-3">
                <h3 className="truncate px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {sprintf(
                    /* translators: %d: numeric id of the connected mail account. */
                    __("Account %d", "pressedmail"),
                    group.accountId,
                  )}
                </h3>
                <ProviderFolderTree
                  accountId={group.accountId}
                  folders={group.folders}
                  selectedPath={selectedNav}
                  selectedTarget={selectedFolderTarget}
                  mobile
                  onSelect={handleSelect}
                />
              </section>
            ))}
          </div>
        )}

        <div className="mt-4 border-t border-border pt-3">
          <SectionHeading>{__("Tags & Labels", "pressedmail")}</SectionHeading>
          <TagFilterSection />
        </div>
      </div>
    </MobileScreen>
  );
}

export default MobileFoldersScreen;
