import {
  AlertCircle,
  Archive,
  ArchiveX,
  File,
  Inbox,
  MessagesSquare,
  PenBox,
  Send,
  ShoppingCart,
  Trash2,
  Users2,
  ArrowDownToDot,
  LucideIcon,
} from "lucide-react";
import { getPluginRestBase } from "@/lib/runtime-config";

const getApiRoot = (): string => {
  return getPluginRestBase().replace(/\/$/, "");
};

// API route prefix configuration
export const routeApiPrefix = getApiRoot();

/**
 * Builds a URL with query parameters, handling both pretty permalinks and rest_route format.
 * When using ?rest_route= format, additional query params use & instead of ?
 */
export function buildApiUrl(
  baseUrl: string,
  queryParams?: Record<string, string | number | boolean | undefined>,
): string {
  if (!queryParams) return baseUrl;

  const params = Object.entries(queryParams)
    .filter(([, value]) => value !== undefined && value !== "")
    .map(
      ([key, value]) =>
        `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    )
    .join("&");

  if (!params) return baseUrl;

  // Check if the URL already has a query string (e.g., ?rest_route=)
  const separator = baseUrl.includes("?") ? "&" : "?";
  return `${baseUrl}${separator}${params}`;
}

// API route constants
export const testConnectionROuteApi =
  routeApiPrefix + "/accounts/test-connection";
export const accountCreateROuteApi = routeApiPrefix + "/accounts/create";
export const oauthStartUrlRouteApi = (provider: "microsoft" | "google") =>
  routeApiPrefix + "/oauth/" + provider + "/start-url";
export const oauthStatusRouteApi = (provider: "microsoft" | "google") =>
  routeApiPrefix + "/oauth/" + provider + "/status";
export const accountsLoadRouteApi = routeApiPrefix + "/accounts/get";
export const messagesLoadRouteApi = routeApiPrefix + "/messages/get/";
export const messagesConsolidatedRouteApi =
  routeApiPrefix + "/messages/consolidated";
export const messagesDiffRouteApi = routeApiPrefix + "/messages/diff/";
export const messagesConsolidatedDiffRouteApi =
  routeApiPrefix + "/messages/consolidated/diff";
export const messagesFoldersRouteApi = routeApiPrefix + "/messages/folders/";
export const syncBootstrapRouteApi = routeApiPrefix + "/sync/bootstrap";
export const messageDetailRouteApi = routeApiPrefix + "/messages/detail/";
export const messageBatchDetailRouteApi =
  routeApiPrefix + "/messages/batch/details";
export const sendEmailRouteApi = routeApiPrefix + "/messages/send-email";
export const saveDraftRouteApi = routeApiPrefix + "/messages/save-draft";
export const accountRemoveROuteApi = routeApiPrefix + "/account/delete";
export const accountUpdateRouteApi = routeApiPrefix + "/accounts/update";
export const accountSetDefaultRouteApi =
  routeApiPrefix + "/accounts/set-default";
export const markEmailAsReadRouteApi =
  routeApiPrefix + "/messages/mark-as-read";
export const markEmailAsUnreadRouteApi =
  routeApiPrefix + "/messages/mark-as-unread";
export const batchMarkReadRouteApi =
  routeApiPrefix + "/messages/batch/mark-read";
export const batchMarkUnreadRouteApi =
  routeApiPrefix + "/messages/batch/mark-unread";
export const batchDeleteRouteApi = routeApiPrefix + "/messages/batch/delete";
export const batchMoveRouteApi = routeApiPrefix + "/messages/batch/move";
export const emptyTrashRouteApi = routeApiPrefix + "/messages/trash/empty";
export const deleteEmailFromImapRouteApi = routeApiPrefix + "/message/delete";
export const searchEmailRouteApi = routeApiPrefix + "/messages/search";
export const moveEmailRouteApi = routeApiPrefix + "/message/move";
export const flagEmailRouteApi = routeApiPrefix + "/message/flag";
export const messageRawHeadersRouteApi =
  routeApiPrefix + "/message/raw-headers";
export const inboxNotificationCountsRouteApi =
  routeApiPrefix + "/notifications/inbox-counts";
export const inboxNotificationSeenRouteApi =
  routeApiPrefix + "/notifications/inbox-seen";
export const notificationsRouteApi = routeApiPrefix + "/notifications";
export const notificationReadRouteApi = routeApiPrefix + "/notifications/read";
export const notificationReadAllRouteApi =
  routeApiPrefix + "/notifications/read-all";
export const notificationDismissRouteApi =
  routeApiPrefix + "/notifications/dismiss";
export const notificationClearRouteApi =
  routeApiPrefix + "/notifications/clear";

// Type for app icon configuration
export interface AppIcon {
  name: string;
  icon: LucideIcon;
}

// App icons mapping for different categories
export const AppIcons: AppIcon[] = [
  { name: "Today", icon: Inbox },
  { name: "Important", icon: AlertCircle },
  { name: "Automated", icon: Archive },
  { name: "Personal", icon: Users2 },
  { name: "Shopping", icon: ShoppingCart },
  { name: "Notification", icon: AlertCircle },
  { name: "Alert", icon: AlertCircle },
  { name: "Error", icon: AlertCircle },
  { name: "Success", icon: ArrowDownToDot },
  { name: "File", icon: File },
  { name: "Social", icon: Users2 },
  { name: "Work", icon: PenBox },
  { name: "Spam", icon: Trash2 },
  { name: "Promotional", icon: ArchiveX },
  { name: "Transactional", icon: File },
  { name: "Newsletter", icon: MessagesSquare },
  { name: "Meeting", icon: Users2 },
  { name: "Reminder", icon: AlertCircle },
  { name: "Update", icon: ArrowDownToDot },
  { name: "Archive", icon: Archive },
  { name: "Sent", icon: Send },
];
