"use client";

/**
 * Account Notifications Hook
 *
 * Tracks new-mail counts per account for notification badges.
 *
 * @since 2.0.0
 * @updated 3.0.0 - Fully migrated to InboxContext (no MessagesProvider)
 */

import * as React from "react";
import { apiFetch } from "@/lib/api-client";
import { useAppContext } from "@/context/AppProvider";
import { useInboxState } from "@/context/InboxContext";
import {
  inboxNotificationCountsRouteApi,
  inboxNotificationSeenRouteApi,
} from "@/context/Strings";
import type { EmailAccount } from "@/types";

export interface AccountNewMailInfo {
  accountId: string;
  email: string;
  newCount: number;
  /** Null only for a legacy response that cannot classify new priority mail. */
  priorityNewCount: number | null;
  syncStatus: "synced" | "syncing" | "error" | "unknown";
}

export interface AccountUnreadInfo {
  accountId: string;
  email: string;
  unreadCount: number;
  syncStatus: "synced" | "syncing" | "error" | "unknown";
}

export interface UseAccountNotificationsReturn {
  /** Map of account email to new-mail count info */
  accountNewCounts: Map<string, AccountNewMailInfo>;
  /** Total new-mail count across all accounts */
  totalNewCount: number;
  /** Whether any account has new mail since the inbox was last seen */
  hasNewMail: boolean;
  /** Whether the watermark-bounded server count includes priority mail */
  hasPriorityNewMail: boolean;
  /** Whether the server supplied enough durable metadata to classify the count */
  priorityNewMailResolved: boolean;
  /** Mark every accessible inbox as seen */
  markAllSeen: () => Promise<void>;
  /** Get new-mail count for a specific account */
  getNewCount: (accountEmail: string) => number;
  /** Map of account email to unread count info (legacy alias) */
  accountUnreadCounts: Map<string, AccountUnreadInfo>;
  /** Total unread count across all accounts (legacy alias for new-mail count) */
  totalUnreadCount: number;
  /** Refresh counts from server */
  refreshCounts: () => Promise<void>;
  /** Mark an account as having been read (legacy local alias) */
  markAccountRead: (accountEmail: string) => void;
  /** Get unread count for a specific account (legacy alias for new-mail count) */
  getUnreadCount: (accountEmail: string) => number;
  /** Check if any accounts are syncing */
  isSyncing: boolean;
}

interface NotificationAccountResponse {
  accountId?: number | string;
  email?: string;
  newCount?: number;
  priorityNewCount?: number;
  hasNew?: boolean;
  hasPriorityNew?: boolean;
}

interface NotificationResponse {
  status?: string;
  totalNewCount?: number;
  totalPriorityNewCount?: number;
  hasNew?: boolean;
  hasPriorityNew?: boolean;
  accounts?: NotificationAccountResponse[];
}

/**
 * Hook to track new email counts per account.
 * Useful for showing notification badges in account selectors.
 */
export function useAccountNotifications(): UseAccountNotificationsReturn {
  const { accounts } = useAppContext();
  const { isLoading } = useInboxState();

  const [accountNewCounts, setAccountNewCounts] = React.useState<
    Map<string, AccountNewMailInfo>
  >(new Map());
  const [hasEndpointError, setHasEndpointError] = React.useState(false);

  const buildEmptyCounts = React.useCallback(() => {
    const countsMap = new Map<string, AccountNewMailInfo>();
    accounts.forEach((account: EmailAccount) => {
      const email = account.email?.toString() ?? "";
      if (email) {
        countsMap.set(email, {
          accountId: account.id?.toString() ?? email,
          email,
          newCount: 0,
          priorityNewCount: 0,
          syncStatus: hasEndpointError
            ? "error"
            : isLoading
              ? "syncing"
              : "synced",
        });
      }
    });

    return countsMap;
  }, [accounts, hasEndpointError, isLoading]);

  const applyNotificationResponse = React.useCallback(
    (payload: NotificationResponse) => {
      const countsMap = buildEmptyCounts();

      for (const account of payload.accounts ?? []) {
        const email = account.email?.toString() ?? "";
        if (!email) {
          continue;
        }

        const existing = countsMap.get(email);
        const newCount = Math.max(0, Number(account.newCount ?? 0));
        const rawPriorityCount = account.priorityNewCount;
        const parsedPriorityCount = Number(rawPriorityCount);
        const priorityNewCount =
          newCount === 0
            ? 0
            : rawPriorityCount !== undefined &&
                Number.isFinite(parsedPriorityCount)
              ? Math.min(newCount, Math.max(0, Math.floor(parsedPriorityCount)))
              : null;
        countsMap.set(email, {
          accountId:
            account.accountId?.toString() ?? existing?.accountId ?? email,
          email,
          newCount,
          priorityNewCount,
          syncStatus: isLoading ? "syncing" : "synced",
        });
      }

      setHasEndpointError(false);
      setAccountNewCounts(countsMap);
    },
    [buildEmptyCounts, isLoading],
  );

  const clearCounts = React.useCallback(() => {
    setAccountNewCounts(buildEmptyCounts());
  }, [buildEmptyCounts]);

  const clearAdminBarDot = React.useCallback(() => {
    if (typeof document === "undefined") {
      return;
    }

    const adminBarNode = document.getElementById("wp-admin-bar-pressedmail");
    adminBarNode?.classList.remove("pm-has-new-mail");
    adminBarNode?.querySelector(".pm-new-mail-dot")?.remove();
  }, []);

  const fetchCounts =
    React.useCallback(async (): Promise<NotificationResponse> => {
      // WordPress REST cookie auth only treats the request as logged-in when the
      // nonce is present; without it the route's default permission callback
      // returns 401. The counts route requires auth, so the GET must carry it.
      const response = await apiFetch(inboxNotificationCountsRouteApi, {
        method: "GET",
        credentials: "same-origin",
        headers: {},
      });

      if (!response.ok) {
        throw new Error("Failed to load inbox notification counts.");
      }

      return (await response.json()) as NotificationResponse;
    }, []);

  const refreshCounts = React.useCallback(async () => {
    try {
      applyNotificationResponse(await fetchCounts());
    } catch {
      setHasEndpointError(true);
      clearCounts();
    }
  }, [applyNotificationResponse, clearCounts, fetchCounts]);

  // A stable key for the *set* of accounts. The underlying `accounts` array is
  // backed by useLocalStorage and gets a fresh reference on most renders, so
  // depending on it directly (or on callbacks derived from it) turned the load
  // effect into a render -> fetch -> setState -> render storm. Keying the effect
  // on this primitive makes it run once per real account-set change.
  const accountsKey = React.useMemo(
    () =>
      accounts
        .map((account: EmailAccount) => account.email?.toString() ?? "")
        .filter(Boolean)
        .join("|"),
    [accounts],
  );

  // Keep the latest response handlers without retriggering the load effect.
  const applyRef = React.useRef(applyNotificationResponse);
  const clearRef = React.useRef(clearCounts);
  React.useEffect(() => {
    applyRef.current = applyNotificationResponse;
    clearRef.current = clearCounts;
  }, [applyNotificationResponse, clearCounts]);

  React.useEffect(() => {
    if (accountsKey === "") {
      clearRef.current();
      return;
    }

    let cancelled = false;

    void (async () => {
      try {
        const payload = await fetchCounts();
        if (!cancelled) {
          applyRef.current(payload);
        }
      } catch {
        if (!cancelled) {
          setHasEndpointError(true);
          clearRef.current();
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accountsKey, fetchCounts]);

  const totalNewCount = React.useMemo(() => {
    let total = 0;
    accountNewCounts.forEach((info) => {
      total += info.newCount;
    });
    return total;
  }, [accountNewCounts]);

  const hasNewMail = totalNewCount > 0;
  const priorityNewMail = React.useMemo(() => {
    let hasPriorityNewMail = false;
    let resolved = true;
    accountNewCounts.forEach((info) => {
      if (info.newCount <= 0) {
        return;
      }
      if (info.priorityNewCount === null) {
        resolved = false;
        return;
      }
      if (info.priorityNewCount > 0) {
        hasPriorityNewMail = true;
      }
    });

    return {
      hasPriorityNewMail,
      resolved: hasPriorityNewMail || resolved,
    };
  }, [accountNewCounts]);

  const accountUnreadCounts = React.useMemo(() => {
    const countsMap = new Map<string, AccountUnreadInfo>();
    accountNewCounts.forEach((info, email) => {
      countsMap.set(email, {
        accountId: info.accountId,
        email: info.email,
        unreadCount: info.newCount,
        syncStatus: info.syncStatus,
      });
    });
    return countsMap;
  }, [accountNewCounts]);

  const markAccountRead = React.useCallback((accountEmail: string) => {
    setAccountNewCounts((prev) => {
      const newMap = new Map(prev);
      const existing = newMap.get(accountEmail);
      if (existing) {
        newMap.set(accountEmail, {
          ...existing,
          newCount: 0,
          priorityNewCount: 0,
        });
      }
      return newMap;
    });
  }, []);

  const markAllSeen = React.useCallback(async () => {
    try {
      const response = await apiFetch(inboxNotificationSeenRouteApi, {
        method: "POST",
        credentials: "same-origin",
        headers: {},
      });

      if (!response.ok) {
        throw new Error("Failed to mark inbox notifications seen.");
      }

      const payload = (await response.json()) as NotificationResponse;
      applyNotificationResponse(payload);
      clearAdminBarDot();
    } catch {
      setHasEndpointError(true);
    }
  }, [applyNotificationResponse, clearAdminBarDot]);

  const getNewCount = React.useCallback(
    (accountEmail: string): number => {
      return accountNewCounts.get(accountEmail)?.newCount ?? 0;
    },
    [accountNewCounts],
  );

  const getUnreadCount = React.useCallback(
    (accountEmail: string): number => getNewCount(accountEmail),
    [getNewCount],
  );

  const isSyncing = React.useMemo(() => {
    let syncing = false;
    accountNewCounts.forEach((info) => {
      if (info.syncStatus === "syncing") {
        syncing = true;
      }
    });
    return syncing;
  }, [accountNewCounts]);

  return {
    accountNewCounts,
    totalNewCount,
    hasNewMail,
    hasPriorityNewMail: priorityNewMail.hasPriorityNewMail,
    priorityNewMailResolved: priorityNewMail.resolved,
    markAllSeen,
    getNewCount,
    accountUnreadCounts,
    totalUnreadCount: totalNewCount,
    refreshCounts,
    markAccountRead,
    getUnreadCount,
    isSyncing,
  };
}

export default useAccountNotifications;
