"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { formatDistanceToNow } from "date-fns";
import {
  AlertCircle,
  Bell,
  CalendarDays,
  CheckCheck,
  Clock3,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  RefreshCw,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Popover,
  PopoverTrigger,
  toast,
} from "@kit/ui/plugin";
import {
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import {
  getNotificationTargetPath,
  type NotificationFeedState,
  type PressedMailNotification,
} from "@/layouts/shared/hooks/useNotificationFeed";

type TooltipSide = "top" | "right" | "bottom" | "left";

export interface HeaderNotificationsButtonProps extends NotificationFeedState {
  tooltipSide?: TooltipSide;
}

function NotificationIcon({ item }: { item: PressedMailNotification }) {
  const className = "h-4 w-4";
  if (item.targetKind === "plugin_integrity") {
    return <ShieldAlert className={className} aria-hidden="true" />;
  }
  if (item.targetKind === "calendar_event") {
    return <CalendarDays className={className} aria-hidden="true" />;
  }
  if (item.targetKind === "email_rules") {
    return <Filter className={className} aria-hidden="true" />;
  }
  if (item.targetKind === "scheduled" || item.type.includes("scheduled")) {
    return <Clock3 className={className} aria-hidden="true" />;
  }
  if (item.type.includes("failed") || item.type.includes("failure")) {
    return <AlertCircle className={className} aria-hidden="true" />;
  }
  return <Mail className={className} aria-hidden="true" />;
}

function relativeTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ""
    : formatDistanceToNow(date, { addSuffix: true });
}

export function HeaderNotificationsButton({
  items,
  unreadCount,
  isLoading,
  error,
  refresh,
  markRead,
  markAllRead,
  dismiss,
  clearAll,
  tooltipSide = "bottom",
}: HeaderNotificationsButtonProps) {
  const navigate = useNavigate();
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  const label = __("Notifications", "pressedmail");
  const badgeDisplay =
    unreadCount > 0 ? (unreadCount > 99 ? "99+" : String(unreadCount)) : null;

  const runMutation = React.useCallback(
    async (mutation: () => Promise<void>, failureMessage: string) => {
      try {
        await mutation();
        return true;
      } catch (caught) {
        toast.error(caught instanceof Error ? caught.message : failureMessage);
        return false;
      }
    },
    [],
  );

  const openNotification = async (item: PressedMailNotification) => {
    if (!item.readAt) {
      const updated = await runMutation(
        () => markRead(item.id, true),
        __("Could not mark notification as read", "pressedmail"),
      );
      if (!updated) return;
    }
    const target = getNotificationTargetPath(item);
    if (target) navigate(target);
  };

  const confirmClear = async () => {
    setClearing(true);
    const cleared = await runMutation(
      clearAll,
      __("Could not clear notifications", "pressedmail"),
    );
    setClearing(false);
    if (cleared) setClearOpen(false);
  };

  return (
    <>
      <Popover
        onOpenChange={(open) => {
          if (open) void refresh();
        }}>
        <PressedTooltip content={label} side={tooltipSide}>
          <PopoverTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              type="button"
              aria-label={label}
              data-test="notifications-button"
              className="relative h-8 w-8 rounded-md text-muted-foreground hover:text-foreground">
              <Bell className="h-5 w-5" aria-hidden="true" />
              {badgeDisplay ? (
                <span
                  data-test="notifications-badge"
                  aria-label={sprintf(
                    __("%d unread notifications", "pressedmail"),
                    unreadCount,
                  )}
                  className="pointer-events-none absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground">
                  {badgeDisplay}
                </span>
              ) : null}
            </Button>
          </PopoverTrigger>
        </PressedTooltip>

        <PressedPopoverContent size="paletteForm" align="end">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <div>
              <p className="text-sm font-semibold">{label}</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount > 0
                  ? sprintf(__("%d unread", "pressedmail"), unreadCount)
                  : __("You are all caught up", "pressedmail")}
              </p>
            </div>
            <div className="flex items-center gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={unreadCount === 0}
                aria-label={__("Mark all as read", "pressedmail")}
                className="h-8 gap-1.5 px-2 text-xs"
                onClick={() => {
                  void runMutation(
                    markAllRead,
                    __("Could not mark notifications as read", "pressedmail"),
                  );
                }}>
                <CheckCheck className="h-3.5 w-3.5" aria-hidden="true" />
                {__("Mark all as read", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground"
                disabled={items.length === 0}
                aria-label={__("Clear all", "pressedmail")}
                onClick={() => setClearOpen(true)}>
                <Trash2 className="h-4 w-4" aria-hidden="true" />
              </Button>
            </div>
          </div>

          {isLoading && items.length === 0 ? (
            <div className="flex items-center justify-center gap-2 px-4 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              {__("Loading notifications…", "pressedmail")}
            </div>
          ) : error && items.length === 0 ? (
            <div className="space-y-3 px-4 py-7 text-center">
              <p className="text-sm text-destructive">{error}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="gap-1.5"
                onClick={() => void refresh()}>
                <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
                {__("Retry", "pressedmail")}
              </Button>
            </div>
          ) : items.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              {__("No notifications yet.", "pressedmail")}
            </p>
          ) : (
            <ul
              data-test="notifications-list"
              className="max-h-96 divide-y overflow-y-auto"
              aria-label={__("Notifications", "pressedmail")}>
              {items.map((item) => (
                <li
                  key={item.id}
                  className={item.readAt ? "bg-background" : "bg-primary/5"}>
                  <div className="group flex items-start gap-2 px-2 py-2">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-start gap-2 rounded-sm p-1.5 text-left outline-none hover:bg-muted"
                      aria-label={`${item.title}: ${item.summary}`}
                      onClick={() => void openNotification(item)}>
                      <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <NotificationIcon item={item} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex items-start gap-2">
                          <span className="min-w-0 flex-1 truncate text-sm font-medium">
                            {item.title}
                          </span>
                          {!item.readAt ? (
                            <span
                              data-test={`notification-unread-${item.id}`}
                              data-testid={`notification-unread-${item.id}`}
                              className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-primary"
                              aria-label={__("Unread", "pressedmail")}
                            />
                          ) : null}
                        </span>
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {item.summary}
                        </span>
                        <span className="mt-1 block text-[11px] text-muted-foreground">
                          {relativeTime(item.createdAt)}
                        </span>
                      </span>
                    </button>

                    <DropdownMenu modal={false}>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 shrink-0"
                          aria-label={sprintf(
                            __("Actions for %s", "pressedmail"),
                            item.title,
                          )}
                          onClick={(event) => event.stopPropagation()}>
                          <MoreHorizontal
                            className="h-4 w-4"
                            aria-hidden="true"
                          />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() => {
                            void runMutation(
                              () => markRead(item.id, !item.readAt),
                              __(
                                "Could not update notification",
                                "pressedmail",
                              ),
                            );
                          }}>
                          {item.readAt
                            ? __("Mark as unread", "pressedmail")
                            : __("Mark as read", "pressedmail")}
                        </DropdownMenuItem>
                        {item.dismissable && (
                          <>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem
                              className="text-destructive focus:text-destructive"
                              onClick={() => {
                                void runMutation(
                                  () => dismiss(item.id),
                                  __(
                                    "Could not dismiss notification",
                                    "pressedmail",
                                  ),
                                );
                              }}>
                              {__("Dismiss", "pressedmail")}
                            </DropdownMenuItem>
                          </>
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </PressedPopoverContent>
      </Popover>

      <ConfirmationPanel
        open={clearOpen}
        onOpenChange={setClearOpen}
        title={__("Clear all notifications?", "pressedmail")}
        description={__(
          "This permanently deletes every notification in your feed.",
          "pressedmail",
        )}
        confirmText={__("Delete notifications", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={clearing}
        onConfirm={confirmClear}
      />
    </>
  );
}

export default HeaderNotificationsButton;
