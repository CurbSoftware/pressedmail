"use client";

import * as React from "react";
import { apiFetch } from "@/lib/api-client";
import {
  notificationClearRouteApi,
  notificationDismissRouteApi,
  notificationReadAllRouteApi,
  notificationReadRouteApi,
  notificationsRouteApi,
} from "@/context/Strings";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useInboxState } from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { applyNotificationPreview } from "@/lib/inbox-alert-dispatch";
import {
  resolveNotificationBadgeCount,
  shouldShowInboxAlert,
} from "@/lib/preference-behavior";
import type { EmailMessage } from "@/types";

export type NotificationTargetKind =
  | "inbox_message"
  | "snoozed_message"
  | "scheduled"
  | "sent"
  | "email_rules"
  | "wp_mail_settings"
  | "calendar_event"
  | "plugin_integrity";

export interface PressedMailNotification {
  id: number;
  accountId: number | null;
  type: string;
  title: string;
  summary: string;
  targetKind: NotificationTargetKind;
  targetMetadata: Record<string, unknown>;
  /**
   * False for sticky notifications (e.g. modified plugin files) that only
   * their producer may retire. Defaults to true when the server omits it.
   */
  dismissable: boolean;
  readAt: string | null;
  createdAt: string;
}

export interface NotificationFeedState {
  items: PressedMailNotification[];
  /** Unfiltered persisted rows for the single alert-dispatch owner. */
  rawItems: PressedMailNotification[];
  unreadCount: number;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markRead: (id: number, read: boolean) => Promise<void>;
  markAllRead: () => Promise<void>;
  dismiss: (id: number) => Promise<void>;
  clearAll: () => Promise<void>;
}

function isPriorityInboxNotification(
  notification: PressedMailNotification,
  messages: EmailMessage[],
  singleAccountId: string | number | null,
): boolean {
  const metadata = notification.targetMetadata ?? {};
  if (typeof metadata.priority === "boolean") {
    return metadata.priority;
  }
  const uid = metadata.uid;
  const accountId = metadata.accountId ?? notification.accountId;
  const folder =
    typeof metadata.folder === "string" ? metadata.folder.trim() : "";
  if (
    uid === null ||
    uid === undefined ||
    uid === "" ||
    accountId === null ||
    accountId === undefined ||
    !folder
  ) {
    return false;
  }

  return messages.some((message) => {
    const messageAccountId = message.accountId ?? singleAccountId;
    return (
      String(message.uid) === String(uid) &&
      messageAccountId !== null &&
      String(messageAccountId) === String(accountId) &&
      message.folder?.toLowerCase() === folder.toLowerCase() &&
      (message.important === true || message.is_important === true)
    );
  });
}

export function getNotificationTargetPath(
  notification: PressedMailNotification,
): string | null {
  const metadata = notification.targetMetadata ?? {};
  const toInteger = (value: unknown): number | null => {
    const parsed = typeof value === "number" ? value : Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  };
  const addMessageContext = (params: URLSearchParams) => {
    const messageId = toInteger(metadata.messageId);
    const accountId = toInteger(metadata.accountId ?? notification.accountId);
    const folder =
      typeof metadata.folder === "string" ? metadata.folder.trim() : "";
    if (messageId) params.set("openMessageId", String(messageId));
    if (accountId) params.set("accountId", String(accountId));
    if (folder) params.set("folder", folder);
  };

  if (
    notification.targetKind === "inbox_message" ||
    notification.targetKind === "snoozed_message"
  ) {
    const params = new URLSearchParams();
    addMessageContext(params);
    return params.size > 0 ? `/inbox?${params.toString()}` : "/inbox";
  }

  if (
    notification.targetKind === "scheduled" ||
    notification.targetKind === "sent"
  ) {
    const params = new URLSearchParams();
    const folder =
      notification.targetKind === "scheduled" ? "Scheduled" : "Sent";
    params.set("folder", folder);
    addMessageContext(params);
    return `/inbox?${params.toString()}`;
  }

  if (notification.targetKind === "email_rules") {
    return "/settings?tab=email-rules";
  }

  if (notification.targetKind === "wp_mail_settings") {
    return "/settings?tab=admin-wp-mail";
  }

  // Integrity reports and the licence settings tab are Pro-only surfaces.
  // Guarding on the build constant keeps the route literal out of Free.
  if (!__IS_FREE__ && notification.targetKind === "plugin_integrity") {
    return "/settings?tab=admin-license";
  }

  // The calendar is a Pro feature, so only that build has a route to open and
  // only that build names the query parameter.
  if (__ENABLE_CALENDAR__ && notification.targetKind === "calendar_event") {
    const eventId = toInteger(metadata.eventId);
    const date = typeof metadata.date === "string" ? metadata.date.trim() : "";
    if (!eventId) return "/calendar";
    const params = new URLSearchParams({ openEventId: String(eventId) });
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) params.set("date", date);
    return `/calendar?${params.toString()}`;
  }

  return null;
}

export function useNotificationFeed(): NotificationFeedState {
  const { preferences } = useUserPreferences();
  const { selectedAccount } = useAppContext();
  const { messages, selectedAccountId } = useInboxState();
  const singleAccountId =
    selectedAccount &&
    selectedAccount !== CONSOLIDATED_INBOX_VALUE &&
    selectedAccountId !== null
      ? selectedAccountId
      : null;
  const [items, setItems] = React.useState<PressedMailNotification[]>([]);
  const [unreadTotals, setUnreadTotals] = React.useState({
    unreadCount: 0,
    inboxUnreadCount: 0,
  });
  const [isLoading, setIsLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const response = await apiFetch(notificationsRouteApi, {
        method: "GET",
        credentials: "same-origin",
      });
      if (!response.ok) throw new Error("Could not load notifications");
      const payload = (await response.json()) as {
        items?: PressedMailNotification[];
        unreadCount?: number;
        inboxUnreadCount?: number;
        data?: {
          items?: PressedMailNotification[];
          unreadCount?: number;
          inboxUnreadCount?: number;
        };
      };
      const feed = payload.data ?? payload;
      // Older servers omit `dismissable`; default true so everything stays
      // dismissable until the backend says otherwise.
      const parsed = (Array.isArray(feed.items) ? feed.items : []).map(
        (item) => ({ ...item, dismissable: item.dismissable !== false }),
      );
      const unreadItems = parsed.filter((item) => !item.readAt);
      const countOrFallback = (value: unknown, fallback: number): number => {
        const count = Number(value);
        return Number.isFinite(count) && count >= 0
          ? Math.floor(count)
          : fallback;
      };
      setItems(parsed);
      setUnreadTotals({
        unreadCount: countOrFallback(feed.unreadCount, unreadItems.length),
        inboxUnreadCount: countOrFallback(
          feed.inboxUnreadCount,
          unreadItems.filter((item) => item.targetKind === "inbox_message")
            .length,
        ),
      });
      setError(null);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Could not load notifications",
      );
    } finally {
      setIsLoading(false);
    }
  }, []);

  const postMutation = React.useCallback(
    async (
      url: string,
      body?: Record<string, unknown>,
      message = "Notification action failed",
    ) => {
      const response = await apiFetch(url, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body ?? {}),
      });
      if (!response.ok) throw new Error(message);
    },
    [],
  );

  const markRead = React.useCallback(
    async (id: number, read: boolean) => {
      await postMutation(
        notificationReadRouteApi,
        { id, read },
        "Could not update notification",
      );
      setItems((current) =>
        current.map((item) =>
          item.id === id
            ? { ...item, readAt: read ? new Date().toISOString() : null }
            : item,
        ),
      );
      await refresh();
    },
    [items, postMutation, refresh],
  );

  const markAllRead = React.useCallback(async () => {
    await postMutation(
      notificationReadAllRouteApi,
      undefined,
      "Could not mark notifications as read",
    );
    const readAt = new Date().toISOString();
    setItems((current) => current.map((item) => ({ ...item, readAt })));
    await refresh();
  }, [postMutation, refresh]);

  const dismiss = React.useCallback(
    async (id: number) => {
      await postMutation(
        notificationDismissRouteApi,
        { id },
        "Could not dismiss notification",
      );
      setItems((current) => current.filter((item) => item.id !== id));
      await refresh();
    },
    [postMutation, refresh],
  );

  const clearAll = React.useCallback(async () => {
    await postMutation(
      notificationClearRouteApi,
      undefined,
      "Could not clear notifications",
    );
    // Sticky notifications survive Clear all server-side; mirror that in the
    // optimistic update instead of blanking the list and flashing them back.
    setItems((current) => current.filter((item) => !item.dismissable));
    await refresh();
  }, [postMutation, refresh]);

  React.useEffect(() => {
    void refresh();
    const onFocus = () => void refresh();
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void refresh();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibilityChange);
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, 60_000);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.clearInterval(interval);
    };
  }, [refresh]);

  // Quiet hours mute interruptions, not the history panel you opened on purpose.
  // Filtering the stored list by them left the bell showing a count over an empty
  // panel, and kept mail hidden until the next 60s refresh after the window ended.
  // The live gate in inbox-alert-dispatch still honours quiet hours.
  const panelPreferences = React.useMemo(
    () => ({ ...preferences, notification_quiet_hours_enabled: false }),
    [preferences],
  );

  const visibleItems = React.useMemo(() => {
    return items
      .filter((item) => {
        if (item.targetKind !== "inbox_message") {
          return true;
        }
        const folder =
          typeof item.targetMetadata?.folder === "string"
            ? item.targetMetadata.folder
            : "INBOX";
        return shouldShowInboxAlert({
          preferences: panelPreferences,
          folder,
          unread: !item.readAt,
          priority: isPriorityInboxNotification(
            item,
            messages,
            singleAccountId,
          ),
        });
      })
      .map((item) =>
        applyNotificationPreview(
          item,
          panelPreferences.notification_preview_level,
        ),
      );
  }, [items, messages, panelPreferences, singleAccountId]);

  const unreadCount = React.useMemo(() => {
    return resolveNotificationBadgeCount({
      mode: preferences.notification_badge_count_mode,
      unreadCount: unreadTotals.unreadCount,
      inboxUnreadCount: unreadTotals.inboxUnreadCount,
    });
  }, [preferences.notification_badge_count_mode, unreadTotals]);

  return {
    items: visibleItems,
    rawItems: items,
    unreadCount,
    isLoading,
    error,
    refresh,
    markRead,
    markAllRead,
    dismiss,
    clearAll,
  };
}
