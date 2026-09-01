import { useEffect, useRef } from "react";

import type { ProcessTask } from "@/services/process-queue.service";
import { useInbox } from "@/context/InboxContext";

const REFRESH_DEBOUNCE_MS = 1000;

const TERMINAL_STATUSES = new Set(["done", "failed", "cancelled", "skipped"]);

/**
 * Live-update the currently viewed email list while a sweep runs, and true it
 * up when sweep work completes.
 *
 * Receives ALL sweep-kind tasks (active AND terminal, from the queue payload's
 * recent history):
 *  - progress changes on ACTIVE tasks fire a trailing-debounced
 *    `refreshMessages()` so swept mail disappears while you watch;
 *  - a terminal task id we have not seen before fires a final refresh plus a
 *    folder-badge reload. This is what catches a small sweep that starts AND
 *    finishes between two polls, it never appears active, and the old
 *    active-set-drained trigger never fired for it, leaving the cached list
 *    stale indefinitely.
 *
 * The first payload after mount only seeds the seen-set: history rows from
 * before this session must not trigger a refresh storm.
 */
export function useSweepLiveRefresh(sweepTasks: ProcessTask[]): void {
  const { refreshMessages, refreshCurrentFolders } = useInbox();

  const refreshRef = useRef(refreshMessages);
  refreshRef.current = refreshMessages;
  const foldersRef = useRef(refreshCurrentFolders);
  foldersRef.current = refreshCurrentFolders;

  const activeTasks = sweepTasks.filter(
    (task) => !TERMINAL_STATUSES.has(task.status),
  );
  const activeSignature = activeTasks
    .map((task) => `${task.id}:${task.status}:${task.progress_current}`)
    .join("|");
  const terminalSignature = sweepTasks
    .filter((task) => TERMINAL_STATUSES.has(task.status))
    .map((task) => task.id)
    .sort((a, b) => Number(a) - Number(b))
    .join("|");

  const lastActiveSignatureRef = useRef<string | null>(null);
  const seenTerminalRef = useRef<Set<ProcessTask["id"]> | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
      timerRef.current = setTimeout(() => {
        timerRef.current = null;
        void refreshRef.current();
      }, REFRESH_DEBOUNCE_MS);
    };

    // Active progress → follow along. Not on first sight (nothing moved yet).
    if (activeTasks.length > 0) {
      if (
        lastActiveSignatureRef.current !== null &&
        lastActiveSignatureRef.current !== activeSignature
      ) {
        scheduleRefresh();
      }
      lastActiveSignatureRef.current = activeSignature;
    } else {
      lastActiveSignatureRef.current = null;
    }

    // Newly-terminal sweep work → final refresh + folder badges.
    const terminalIds = sweepTasks
      .filter((task) => TERMINAL_STATUSES.has(task.status))
      .map((task) => task.id);
    if (seenTerminalRef.current === null) {
      // First payload seeds the baseline; pre-existing history is not news.
      seenTerminalRef.current = new Set(terminalIds);
      return;
    }
    const seen = seenTerminalRef.current;
    const unseen = terminalIds.filter((id) => !seen.has(id));
    if (unseen.length > 0) {
      unseen.forEach((id) => seen.add(id));
      scheduleRefresh();
      // Badges reflect pre-sweep counts until the folder list reloads,
      // nothing else refreshes them.
      void foldersRef.current?.();
    }
  }, [activeSignature, terminalSignature]);

  useEffect(
    () => () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    },
    [],
  );
}
