"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import type { EmailMessage } from "@/types";
import type { ImapFolder } from "@/services/interfaces";
import type { FilterRule, FilterRuleFolderTarget } from "@/types/filter-rules";
import { ruleRunsOnReceive } from "@/types/filter-rules";
import { isResolvedFilterRuleFolderTarget } from "@/services/filter-rule-folder-targets";
import {
  fetchFilterRules,
  matchMessageAgainstRules,
} from "@/services/filter-rules.service";
import {
  useFolderOperations,
  useInbox,
  useMessageOperations,
} from "@/context/InboxContext";

/** Sentinel account id meaning "rules that apply to every account". */
const ALL_ACCOUNTS = 0;

/**
 * Action executors the enforcement engine dispatches through. It wires the
 * actions that have InboxContext operations; the UNIMPLEMENTED_ACTIONS set in
 * types/filter-rules.ts has no executor on either side and is ignored here.
 * Auto-replies live on the dedicated Pro Auto-Replies settings tab, not as an
 * Email Rules action.
 */
export interface RuleEnforcementOps {
  batchMove: (ids: (string | number)[], targetFolder: string) => unknown;
  batchMarkRead: (ids: (string | number)[]) => unknown;
  batchDelete: (ids: (string | number)[], permanent?: boolean) => unknown;
  toggleStar: (id: string | number) => unknown;
  toggleImportant: (id: string | number) => unknown;
  trashPath?: string;
  spamPath?: string;
  archivePath?: string;
  resolveFolderTarget?: (target: FilterRuleFolderTarget) => string | undefined;
}

/** Importance carries a legacy snake_case key on older REST payloads. */
function isImportant(message: EmailMessage): boolean {
  return typeof message.important === "boolean"
    ? message.important
    : Boolean(message.is_important);
}

function pushTo(
  map: Map<string, (string | number)[]>,
  path: string,
  id: string | number,
) {
  const list = map.get(path) ?? [];
  list.push(id);
  map.set(path, list);
}

/**
 * Run the filter-rules matcher over a batch of messages and dispatch the
 * resulting actions, batching by action type/target. Returns the set of message
 * keys (String(id)) that matched at least one rule and were acted on.
 *
 * Pure with respect to React: shared by the live enforcement hook, the manual
 * "Run rules now" button and the Organize bulk action.
 */
export function applyRuleActionsToMessages(
  messages: EmailMessage[],
  rules: FilterRule[],
  ops: RuleEnforcementOps,
): Set<string> {
  const moveBuckets = new Map<string, (string | number)[]>();
  const toMarkRead: (string | number)[] = [];
  const toDelete: (string | number)[] = [];
  const toStar: (string | number)[] = [];
  const toImportant: (string | number)[] = [];
  const acted = new Set<string>();

  for (const message of messages) {
    const { actionsToApply } = matchMessageAgainstRules(message, rules);
    if (actionsToApply.length === 0) continue;

    let dispatched = false;
    for (const action of actionsToApply) {
      switch (action.type) {
        case "move_to_folder":
          if (isResolvedFilterRuleFolderTarget(action.value)) {
            const path =
              typeof ops.resolveFolderTarget === "function"
                ? ops.resolveFolderTarget(action.value)
                : action.value.lastKnownPath;
            if (!path) break;
            pushTo(moveBuckets, path, message.id);
            dispatched = true;
          }
          break;
        case "archive":
          if (ops.archivePath) {
            pushTo(moveBuckets, ops.archivePath, message.id);
            dispatched = true;
          }
          break;
        case "move_to_trash":
          if (ops.trashPath) {
            pushTo(moveBuckets, ops.trashPath, message.id);
            dispatched = true;
          }
          break;
        case "always_spam": {
          const target = ops.spamPath || ops.trashPath;
          if (target) {
            pushTo(moveBuckets, target, message.id);
            dispatched = true;
          }
          break;
        }
        case "delete":
          toDelete.push(message.id);
          dispatched = true;
          break;
        case "mark_as_read":
          toMarkRead.push(message.id);
          dispatched = true;
          break;
        case "mark_as_starred":
          // toggleStar inverts the current flag, so a message that is already
          // starred would be UN-starred here. The rule says "star it", which
          // means set, not flip: skip the ones that already are. The message
          // still counts as handled, its end state is what the rule asked for.
          if (!message.starred) toStar.push(message.id);
          dispatched = true;
          break;
        case "mark_as_important":
          if (!isImportant(message)) toImportant.push(message.id);
          dispatched = true;
          break;
        default:
          // UNIMPLEMENTED_ACTIONS (apply_label / forward / skip_inbox /
          // never_spam): stored on older rules but nothing executes them, and
          // the editor no longer offers them.
          break;
      }
    }
    if (dispatched) {
      acted.add(String(message.id));
    }
  }

  for (const [path, ids] of moveBuckets) {
    if (ids.length > 0) void ops.batchMove(ids, path);
  }
  if (toMarkRead.length > 0) void ops.batchMarkRead(toMarkRead);
  // Delete is permanent here because the server engine expunges (see
  // FilterRuleRunService::apply_mutation_chunk). move_to_trash is the soft one,
  // and the same rule must not destroy mail on cron but only trash it here.
  if (toDelete.length > 0) void ops.batchDelete(toDelete, true);
  for (const id of toStar) void ops.toggleStar(id);
  for (const id of toImportant) void ops.toggleImportant(id);

  return acted;
}

function resolveFolderPaths(
  folders: ImapFolder[],
  getTrashFolder: () => ImapFolder | undefined,
) {
  return {
    trashPath: getTrashFolder()?.path,
    spamPath: folders.find(
      (f) => f.systemType === "spam" || f.systemType === "junk",
    )?.path,
    archivePath: folders.find((f) => f.systemType === "archive")?.path,
  };
}

function findFolderByPath(
  folders: ImapFolder[],
  path: string,
): ImapFolder | undefined {
  const stack = [...folders];
  while (stack.length > 0) {
    const folder = stack.shift();
    if (!folder) continue;
    if (folder.path === path) return folder;
    stack.push(...(folder.children ?? []));
  }
  return undefined;
}

/**
 * Mirrors FilterRuleAutomationService::is_inbox_folder on the server: the
 * literal INBOX, or a folder the account marked as its inbox. Anything else
 * (Sent, Archive, Trash, a custom folder) is left alone, so browsing a folder
 * never re-runs rules over mail that already landed somewhere.
 */
function isInboxFolder(folders: ImapFolder[], path: string): boolean {
  if (path === "" || path.toUpperCase() === "INBOX") return true;
  return findFolderByPath(folders, path)?.systemType === "inbox";
}

/**
 * Automatically evaluate the user's on-receive Email Rules against freshly
 * fetched inbox messages and apply their actions. Manual-only and scheduled
 * rules are the server's job, exactly as with the on_receive hook in PHP.
 * Uses per-render processed tracking, resets on folder change. Rules are loaded
 * for the active account (plus all-account rules, which the backend merges in).
 */
export function useEmailRulesEnforcement(messages: EmailMessage[]): void {
  const { selectedAccountId } = useInbox();
  const { batchMove, batchMarkRead, batchDelete, toggleStar, toggleImportant } =
    useMessageOperations();
  const { folders, selectedFolder, getTrashFolder } = useFolderOperations();

  const [rules, setRules] = useState<FilterRule[]>([]);
  // Bumped when rules are saved elsewhere (pm-filter-rules-changed) to force a
  // re-evaluation of the loaded messages even if the rule list ref is unchanged.
  const [reapplyNonce, setReapplyNonce] = useState(0);
  const processedRef = useRef<Set<string>>(new Set());
  const prevFolderRef = useRef<string | null>(null);
  const messagesRef = useRef<EmailMessage[]>(messages);

  const accountId =
    typeof selectedAccountId === "number" ? selectedAccountId : ALL_ACCOUNTS;

  const messagesKey = useMemo(
    () => messages.map((m) => String(m.id)).join("|"),
    [messages],
  );

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    const currentFolder = selectedFolder ?? "INBOX";
    if (prevFolderRef.current !== currentFolder) {
      processedRef.current = new Set();
      prevFolderRef.current = currentFolder;
    }
  }, [selectedFolder]);

  useEffect(() => {
    let cancelled = false;
    const load = () => {
      fetchFilterRules(accountId)
        .then((loaded) => {
          // Only rules the user asked to run as mail arrives. A manual-only
          // rule (the editor default) must wait for Run rules now or Organize,
          // or a saved "delete invoices" rule would fire the moment the inbox
          // loaded.
          if (!cancelled) {
            setRules(loaded.filter((r) => r.enabled && ruleRunsOnReceive(r)));
          }
        })
        .catch(() => {
          // Rules are best-effort; a failed load just means no enforcement.
        });
    };

    load();

    // When a rule is created/edited in settings, re-evaluate the already-loaded
    // inbox messages against the updated rule set (new mail is covered by the
    // on-load enforcement below). Clearing the processed set lets matching
    // messages be acted on again.
    const onRulesChanged = () => {
      processedRef.current = new Set();
      setReapplyNonce((n) => n + 1);
      load();
    };
    window.addEventListener("pm-filter-rules-changed", onRulesChanged);

    return () => {
      cancelled = true;
      window.removeEventListener("pm-filter-rules-changed", onRulesChanged);
    };
  }, [accountId]);

  useEffect(() => {
    if (rules.length === 0) return;

    const { trashPath, spamPath, archivePath } = resolveFolderPaths(
      folders,
      getTrashFolder,
    );

    const eligible = messagesRef.current.filter((m) => {
      if (processedRef.current.has(String(m.id))) return false;
      return isInboxFolder(folders, m.folder || selectedFolder || "INBOX");
    });

    if (eligible.length === 0) return;

    const acted = applyRuleActionsToMessages(eligible, rules, {
      batchMove,
      batchMarkRead,
      batchDelete,
      toggleStar,
      toggleImportant,
      trashPath,
      spamPath,
      archivePath,
      resolveFolderTarget: (target) => {
        const stack = [...folders];
        while (stack.length > 0) {
          const folder = stack.shift();
          if (!folder) continue;
          if (folder.id === target.folderId && folder.accountId === target.accountId) {
            return folder.path;
          }
          stack.push(...(folder.children ?? []));
        }
        return undefined;
      },
    });
    acted.forEach((key) => processedRef.current.add(key));
  }, [
    messagesKey,
    rules,
    reapplyNonce,
    selectedFolder,
    folders,
    batchMove,
    batchMarkRead,
    batchDelete,
    toggleStar,
    toggleImportant,
    getTrashFolder,
  ]);
}
