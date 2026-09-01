"use client";

import * as React from "react";
import {
  Archive,
  FileText,
  Folder,
  Inbox as InboxIcon,
  Loader2,
  Send,
  Star,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
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

/**
 * Standard mailbox order, mirrored from the desktop PressedG sidebar:
 * Inbox, Important, Starred, Sent, Drafts, Archive, Junk, Trash, Scheduled,
 * Snoozed. Important/Starred/Snoozed are virtual flag-filter views (no real
 * IMAP folder); the rest resolve to a real folder when the account is synced.
 */
type MailboxSlot = {
  type: SystemFolderType | "junk";
  label: string;
  iconKey: string;
  virtual: boolean;
};

const MAILBOX_SLOTS: MailboxSlot[] = [
  { type: "inbox", label: "Inbox", iconKey: "inbox", virtual: false },
  {
    type: "important",
    label: "Important",
    iconKey: "important",
    virtual: true,
  },
  { type: "starred", label: "Starred", iconKey: "star", virtual: true },
  { type: "sent", label: "Sent", iconKey: "sent", virtual: false },
  { type: "drafts", label: "Drafts", iconKey: "drafts", virtual: false },
  { type: "archive", label: "Archive", iconKey: "archive", virtual: false },
  { type: "spam", label: "Junk", iconKey: "junk", virtual: false },
  { type: "trash", label: "Trash", iconKey: "trash", virtual: false },
  {
    type: "scheduled",
    label: "Scheduled",
    iconKey: "scheduled",
    virtual: false,
  },
  { type: "snoozed", label: "Snoozed", iconKey: "snoozed", virtual: true },
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

function folderCount(folder: NormalizedFolder): number {
  return folder.displayCount ?? folder.unseen ?? folder.count ?? 0;
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
      {children}
    </h2>
  );
}

/**
 * Folders tab (bottom-nav "Folders"). Owns mailbox + tag navigation that used to
 * live inside the inbox hamburger drawer. Mailboxes are assembled from the same
 * source as the desktop sidebar (useFolderOperations + virtual flag views) so
 * the two stay in lockstep; tags come from the shared TagFilterSection.
 * Selecting a folder switches it and returns to the inbox.
 */
export function MobileFoldersScreen() {
  const navigate = useNavigate();
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
    const systemRows: MailboxRow[] = [];
    // One spinner at a time: the current frontier folder (first still-mirroring
    // in canonical order, inbox first).
    const syncFrontier = computeSyncFrontier(normalizedFolders);

    for (const slot of MAILBOX_SLOTS) {
      if (slot.virtual) {
        if (slot.type === "snoozed" && isFree) continue;
        const countSnapshot =
          slot.type === "important"
            ? virtualFolderCounts.important
            : slot.type === "starred"
              ? virtualFolderCounts.starred
              : { count: 0, partial: false };
        systemRows.push({
          id: slot.type,
          name: slot.label,
          count: countSnapshot.count,
          countPartial: countSnapshot.partial,
          iconKey: slot.iconKey,
          // Virtual views are not real mirrored folders → never the frontier.
          syncing: false,
        });
        continue;
      }

      const folder = normalizedFolders.find(
        (f) =>
          f.systemType === slot.type ||
          (slot.type === "spam" && f.systemType === "junk"),
      );

      if (!folder) {
        // Inbox is always present once an account is connected; show it even
        // before the first folder sync resolves a concrete path.
        if (slot.type === "inbox") {
          systemRows.push({
            id: "INBOX",
            name: slot.label,
            count: 0,
            iconKey: slot.iconKey,
            syncing: "INBOX" === syncFrontier,
          });
        }
        continue;
      }

      systemRows.push({
        id: folder.path,
        name: folder.name || slot.label,
        count: folderCount(folder),
        iconKey: slot.iconKey,
        syncing: folder.path === syncFrontier,
      });
    }

    return systemRows;
  }, [normalizedFolders, virtualFolderCounts]);

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
    <MobileScreen header={<MobileScreenHeader title="Folders" />}>
      <div className="px-3 py-4">
        <SectionHeading>Mailboxes</SectionHeading>
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
                      data-test="folder-syncing-indicator"
                      data-testid="folder-syncing-indicator"
                      aria-label="Syncing"
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
            <SectionHeading>Provider folders</SectionHeading>
            {combinedTrees.map((group) => (
              <section key={group.accountId} className="mb-3">
                <h3 className="truncate px-3 py-1 text-xs font-semibold text-muted-foreground">
                  {`Account ${group.accountId}`}
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
          <SectionHeading>Tags &amp; Labels</SectionHeading>
          <TagFilterSection />
        </div>
      </div>
    </MobileScreen>
  );
}

export default MobileFoldersScreen;
