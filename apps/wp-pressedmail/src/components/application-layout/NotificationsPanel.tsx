"use client";

import * as React from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  AlarmClock,
  AlertCircle,
  Bell,
  CalendarDays,
  Check,
  CheckCheck,
  CirclePause,
  Clock3,
  Database,
  Filter,
  Loader2,
  Mail,
  MoreHorizontal,
  Pin,
  RefreshCw,
  Reply,
  Send,
  ShieldAlert,
  Trash2,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import {
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  Skeleton,
  toast,
} from "@kit/ui/plugin";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { focusQuietly, PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useNotificationPause } from "@/hooks/useNotificationPause";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  DISMISS_UNDO_MS,
  getNotificationTargetPath,
  type NotificationFeedState,
  type PressedMailNotification,
} from "@/layouts/shared/hooks/useNotificationFeed";
import {
  fullAge,
  initialsOf,
  notificationDay,
  notificationDayLabel,
  rowTime,
  type NotificationDay,
} from "@/lib/notification-format";
import { describePause } from "@/lib/notification-pause";
import {
  findMainRegion,
  focusLanding,
  requestLandingFocus,
} from "@/lib/notification-landing";
import { cn } from "@/lib/utils";

import {
  NOTIFICATION_STATUS_CHIP,
  NotificationMuteButton,
  NotificationMutedNote,
} from "./NotificationMuteButton";
import { closeMenuOnly, NotificationPauseMenu } from "./NotificationPauseMenu";
import { useRovingFocus } from "./useRovingFocus";

/** Notifications are kept this long. Mirrors `NotificationService::RETENTION_DAYS`. */
const RETENTION_DAYS = 30;

/**
 * The look of a toolbar button that is switched on: muted, or paused. A filled
 * button, not a faint tint: the tint was 1.2:1 against the bar, and on and off
 * were told apart by colour alone.
 */
const ACTIVE_TOOLBAR_BUTTON =
  "bg-primary text-primary-foreground hover:bg-primary-hover hover:text-primary-foreground";

export interface NotificationsPanelProps extends NotificationFeedState {
  /**
   * Where the panel sits. A popover is capped in height and titled by its own
   * heading. A sheet fills the height it is given and is titled by the sheet.
   */
  variant: "popover" | "sheet";
  /** Called once a row has sent the reader somewhere, so the container can close. */
  onNavigate: () => void;
  /** The route of the alert settings the hidden-rows note points at. */
  alertSettingsPath: string;
  /** The popover's heading id, which it names itself by. */
  titleId?: string;
  /**
   * Called as the confirm dialog opens and closes. The popover stays open under
   * it, so Cancel and Escape land back in the list and not on a closed popup.
   */
  onConfirmingChange?: (confirming: boolean) => void;
}

function NotificationIcon({
  item,
  problem,
}: {
  item: PressedMailNotification;
  problem: boolean;
}) {
  const className = "size-4";
  // A failure is judged first. The kind of target says what a row is about, and a
  // scheduled send that failed is about the same thing as one that went out.
  if (problem) {
    return !__IS_FREE__ && item.targetKind === "plugin_integrity" ? (
      <ShieldAlert className={className} aria-hidden="true" />
    ) : (
      <AlertCircle className={className} aria-hidden="true" />
    );
  }
  // Integrity, calendar, scheduled-send, snooze and follow-up items are Pro feed
  // items.
  if (!__IS_FREE__) {
    if (item.targetKind === "plugin_integrity") {
      return <ShieldAlert className={className} aria-hidden="true" />;
    }
    if (item.targetKind === "calendar_event") {
      return <CalendarDays className={className} aria-hidden="true" />;
    }
    if (item.targetKind === "scheduled" || item.type.includes("scheduled")) {
      return item.targetKind === "sent" ? (
        <Send className={className} aria-hidden="true" />
      ) : (
        <Clock3 className={className} aria-hidden="true" />
      );
    }
    if (item.type.includes("snooze")) {
      return <AlarmClock className={className} aria-hidden="true" />;
    }
    if (item.type.includes("followup")) {
      return <Reply className={className} aria-hidden="true" />;
    }
  }
  if (item.targetKind === "email_rules") {
    return <Filter className={className} aria-hidden="true" />;
  }
  if (item.targetKind === "security_settings") {
    return <Database className={className} aria-hidden="true" />;
  }
  return <Mail className={className} aria-hidden="true" />;
}

/**
 * The disc at the start of a row. A mail row wears its sender's initials, which
 * is what tells fifty of them apart at a glance. Anything else wears the icon of
 * what it is, in the colour of what it means: red for something that did not
 * work, the accent for unread, quiet for read.
 */
function NotificationAvatar({
  item,
  problem,
  showSender,
}: {
  item: PressedMailNotification;
  problem: boolean;
  showSender: boolean;
}) {
  const unread = !item.readAt;
  const initials =
    showSender &&
    !problem &&
    item.type === "email_received" &&
    // A mail with no sender on it has no initials to show.
    item.title !== __("New email", "pressedmail")
      ? initialsOf(item.title)
      : "";

  return (
    <span
      aria-hidden="true"
      className={cn(
        "mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full text-xs font-semibold",
        problem
          ? "bg-destructive/10 text-destructive"
          : unread
            ? "bg-primary/10 text-primary"
            : "bg-muted text-muted-foreground",
      )}>
      {initials ? initials : <NotificationIcon item={item} problem={problem} />}
    </span>
  );
}

function NotificationSkeleton() {
  return (
    <div role="status" data-test="notifications-loading" className="divide-y">
      <span className="sr-only">
        {__("Loading notifications…", "pressedmail")}
      </span>
      {[0, 1, 2, 3].map((row) => (
        <div key={row} aria-hidden="true" className="flex gap-2.5 px-4 py-3">
          <Skeleton className="size-8 shrink-0 rounded-full motion-reduce:animate-none" />
          <div className="min-w-0 flex-1 space-y-2 pt-0.5">
            <Skeleton className="h-3.5 w-2/5 motion-reduce:animate-none" />
            <Skeleton className="h-3 w-4/5 motion-reduce:animate-none" />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * What one row looks like: the avatar, the headline with the time on its line,
 * and what sits under it. The live row wraps it in its button, and a row that is
 * folding away wraps it in nothing, so the two cannot look different.
 */
function RowFace({
  item,
  now,
  showSender,
}: {
  item: PressedMailNotification;
  now: number;
  showSender: boolean;
}) {
  const unread = !item.readAt;
  const problem = item.severity === "problem";
  const summary = item.summary;
  return (
    <>
      <NotificationAvatar
        item={item}
        problem={problem}
        showSender={showSender}
      />
      {/* A grid, so the time can sit on the title's line while it comes last in
          the reading order: a screen reader hears who and what before when. */}
      <span className="grid min-w-0 flex-1 grid-cols-[minmax(0,1fr)_auto] items-center gap-x-2">
        {/* Out of the title's own text: `dir="auto"` reads its direction from the
            first letter it holds, and "Unread." would make every title left to
            right. It is also read first, which is where it belongs. */}
        {unread ? (
          <span className="sr-only">{__("Unread.", "pressedmail")} </span>
        ) : null}
        {/* The sender and the subject are the sender's own words, in any
            direction, so each reads its own. A fixed direction cut an Arabic
            subject off at the wrong end with no ellipsis. */}
        <span
          dir="auto"
          className={cn(
            "col-start-1 row-start-1 truncate text-sm",
            unread ? "font-semibold" : "font-medium",
          )}>
          {item.title}
        </span>
        {summary ? (
          <span
            dir="auto"
            className={cn(
              "col-span-2 block text-xs text-muted-foreground",
              item.type === "email_received" ? "truncate" : "line-clamp-2",
            )}>
            {summary}
          </span>
        ) : null}
        {item.accountLabel ? (
          <span
            data-test="notification-account"
            className="col-span-2 block truncate text-[11px] text-muted-foreground">
            {item.accountLabel}
          </span>
        ) : null}
        {!item.dismissable ? (
          <span
            data-test="notification-sticky"
            className="col-span-2 mt-0.5 inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
            <Pin className="size-3" aria-hidden="true" />
            {__("Stays until fixed", "pressedmail")}
          </span>
        ) : null}
        <time
          dateTime={item.createdAt}
          title={new Date(item.createdAt).toLocaleString()}
          // Always in the same place, at the right edge. Where the row's actions
          // open over it, it steps aside for them instead of sitting beside them.
          className={cn(
            "col-start-2 row-start-1 text-xs tabular-nums text-muted-foreground",
            TIME_YIELDS_TO_ACTIONS,
          )}>
          <span aria-hidden="true">{rowTime(item.createdAt, now)}</span>
          <span className="sr-only">{fullAge(item.createdAt, now)}</span>
        </time>
      </span>
    </>
  );
}

/** How long a row takes to fold away once the reader has removed it. */
const LEAVE_MS = 180;

/**
 * A row the reader just dismissed or read away, folding shut where it was. It is
 * a picture of the row and nothing else: the real one is already gone from the
 * list, so there is nothing to focus or press, and a screen reader never sees
 * it.
 */
function LeavingRow({
  item,
  now,
  showSender,
  surface,
  onDone,
}: {
  item: PressedMailNotification;
  now: number;
  showSender: boolean;
  surface: string;
  onDone: (id: number) => void;
}) {
  const [folded, setFolded] = React.useState(false);
  React.useEffect(() => {
    const frame = window.requestAnimationFrame(() => setFolded(true));
    const timer = window.setTimeout(() => onDone(item.id), LEAVE_MS + 40);
    return () => {
      window.cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [item.id, onDone]);

  return (
    <li
      aria-hidden="true"
      data-notification-leaving={item.id}
      className={cn(
        "grid overflow-hidden border-b transition-[grid-template-rows,opacity] duration-150 ease-out motion-reduce:transition-none",
        folded ? "grid-rows-[0fr] opacity-0" : "grid-rows-[1fr] opacity-100",
        item.readAt ? surface : UNREAD_TINT,
      )}>
      <div className="flex min-h-0 items-start gap-2.5 overflow-hidden px-4 py-2">
        <RowFace item={item} now={now} showSender={showSender} />
      </div>
    </li>
  );
}

const prefersReducedMotion = () =>
  typeof window !== "undefined" &&
  typeof window.matchMedia === "function" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Whether focus got where it is by the keyboard, which is when a line about keys
 * helps. A click that moves focus by script (Show older) does not count. A
 * browser that cannot answer is taken to mean yes, so the hint is never lost.
 */
const isKeyboardFocus = (element: EventTarget): boolean => {
  try {
    return (element as Element).matches(":focus-visible");
  } catch {
    return true;
  }
};

/**
 * A pointer that can hover gets the row's actions laid over the row's right edge,
 * where the time is, instead of beside it. Beside it, an unread row (a check and
 * a menu) held more room than a read one (a menu), so the time sat at a different
 * place on each and the titles lost the room for nothing. Touch has no hover to
 * wait for: there the menu stays in the row, one button wide on every row, so the
 * time still lines up.
 *
 * They show while the row is hovered, has keyboard focus (`:focus-visible`, so
 * the row that takes focus when the popup opens does not wear them for a reader
 * who clicked the bell) or has its menu open. Hidden, they take no clicks, so the
 * time under them still opens the row.
 */
const ROW_ACTIONS =
  "flex shrink-0 items-start " +
  "[@media(hover:hover)]:absolute [@media(hover:hover)]:end-2 [@media(hover:hover)]:top-0.5 [@media(hover:hover)]:items-center [@media(hover:hover)]:rounded-md [@media(hover:hover)]:border [@media(hover:hover)]:shadow-sm " +
  "[@media(hover:hover)]:pointer-events-none [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:duration-100 motion-reduce:transition-none " +
  "[@media(hover:hover)]:group-hover/row:pointer-events-auto [@media(hover:hover)]:group-hover/row:opacity-100 " +
  "[@media(hover:hover)]:group-has-[:focus-visible]/row:pointer-events-auto [@media(hover:hover)]:group-has-[:focus-visible]/row:opacity-100 " +
  "[@media(hover:hover)]:has-[[data-state=open]]:pointer-events-auto [@media(hover:hover)]:has-[[data-state=open]]:opacity-100";

/** The time, fading out under the actions at exactly the moments they fade in. */
const TIME_YIELDS_TO_ACTIONS =
  "[@media(hover:hover)]:transition-opacity [@media(hover:hover)]:duration-100 motion-reduce:transition-none " +
  "[@media(hover:hover)]:group-hover/row:opacity-0 " +
  "[@media(hover:hover)]:group-has-[:focus-visible]/row:opacity-0 " +
  "[@media(hover:hover)]:group-has-[[data-state=open]]/row:opacity-0";

/** A row's own menu, in the sheet, on a screen with no hover: a thumb-sized button. */
const SHEET_ROW_TOUCH =
  "[@media(hover:none)]:min-h-11 [@media(hover:none)]:min-w-11";

/** Whether `item` sits below `other` in the feed, which runs newest first. */
const isOlderThan = (
  item: PressedMailNotification,
  other: PressedMailNotification,
): boolean =>
  item.createdAt < other.createdAt ||
  (item.createdAt === other.createdAt && item.id < other.id);

/** The unread tint, strong enough to read on the dark palettes too. */
const UNREAD_TINT = "bg-primary/[0.07] dark:bg-primary/[0.14]";

type Listed =
  | { kind: "day"; day: NotificationDay }
  | { kind: "item"; item: PressedMailNotification }
  | { kind: "leaving"; item: PressedMailNotification };

/** A row on its way out, and the row it sat above: null when it was the last. */
interface Leaving {
  item: PressedMailNotification;
  above: number | null;
}

/**
 * The notification feed: its header and toolbar, the rows, and the footers that
 * page and explain. The bell's popover and the phone's sheet both hold this and
 * nothing else, so the two can never drift apart.
 */
export function NotificationsPanel({
  variant,
  onNavigate,
  alertSettingsPath,
  titleId,
  onConfirmingChange,
  items,
  unreadCount,
  totalUnreadCount,
  hiddenCount,
  hiddenReadCount = 0,
  showAll,
  setShowAll,
  hasMore,
  isLoading,
  isLoadingMore,
  error,
  loadMoreError,
  refresh,
  startOver,
  loadMore,
  markRead,
  markAllRead,
  undoMarkAllRead,
  dismissWithUndo,
  undoDismiss,
  clearAll,
}: NotificationsPanelProps) {
  const navigate = useNavigate();
  const silence = useNotificationPause();
  const { preferences } = useUserPreferences();
  const [clearOpen, setClearOpen] = React.useState(false);
  const [clearing, setClearing] = React.useState(false);
  // `n` is the message's own key: the same words twice in a row (two pages of ten)
  // are a new node each time, which a screen reader reads out again, where a text
  // node that came out the same would not be.
  const [announcement, setAnnouncement] = React.useState({ text: "", n: 0 });
  const announce = React.useCallback(
    (text: string) =>
      setAnnouncement((current) => ({ text, n: current.n + 1 })),
    [],
  );
  const [pagedOlder, setPagedOlder] = React.useState(false);
  const [listFocused, setListFocused] = React.useState(false);
  // Times read "5m", which is right until the next minute turns over.
  const [now, setNow] = React.useState(() => Date.now());
  // Rows the reader just removed, folding away where they were. Only a removal
  // the panel's own actions asked for gets this: a row that leaves because a
  // filter changed or a page was read again just goes.
  const [leaving, setLeaving] = React.useState<Leaving[]>([]);
  const lastItems = React.useRef(items);
  const removalExpectedUntil = React.useRef(0);
  const expectRemoval = () => {
    removalExpectedUntil.current = Date.now() + 2_000;
  };
  const finishLeaving = React.useCallback(
    (id: number) =>
      setLeaving((current) => current.filter((row) => row.item.id !== id)),
    [],
  );
  // Before paint, so the row is never seen gone and then back for its fold.
  React.useLayoutEffect(() => {
    const before = lastItems.current;
    lastItems.current = items;
    if (
      before === items ||
      Date.now() > removalExpectedUntil.current ||
      prefersReducedMotion()
    ) {
      return;
    }
    const kept = new Set(items.map((item) => item.id));
    const gone: Leaving[] = [];
    before.forEach((item, index) => {
      if (kept.has(item.id)) return;
      const below = before.slice(index + 1).find((row) => kept.has(row.id));
      gone.push({ item, above: below ? below.id : null });
    });
    if (gone.length > 0) {
      setLeaving((current) => [
        ...current.filter((row) => kept.has(row.item.id) === false),
        ...gone,
      ]);
    }
  }, [items]);
  // A row whose neighbour left too has nothing to fold above. They are dropped
  // rather than kept for a place that is gone.
  React.useEffect(() => {
    if (leaving.length === 0) return;
    const timer = window.setTimeout(() => setLeaving([]), 1_000);
    return () => window.clearTimeout(timer);
  }, [leaving]);
  // The page of older rows the reader asked for, from the click until the render
  // that holds it has been seen. What it knew then is what tells the new rows
  // from the ones a refresh brought in meanwhile.
  const olderRequest = React.useRef<{
    known: Set<number>;
    tail: PressedMailNotification | null;
    hiddenBefore: number;
    hadFocus: boolean;
    settled: boolean;
  } | null>(null);
  // Bumped when the request has been answered, so the layout effect that reads the
  // committed rows runs even when the answer changed nothing on screen.
  const [olderSettled, setOlderSettled] = React.useState(0);
  const root = React.useRef<HTMLDivElement>(null);
  const clearButton = React.useRef<HTMLButtonElement>(null);
  // The row a menu was opened on, and the row beside it, for the moment its menu
  // closes and focus has to land somewhere that still exists.
  const afterRowMenu = React.useRef<{
    row: HTMLElement | null;
    neighbour: HTMLElement | null;
  }>({ row: null, neighbour: null });
  const toolbar = useRovingFocus<HTMLDivElement>("horizontal");
  const list = useRovingFocus<HTMLUListElement>("vertical");
  const hintId = React.useId();

  // The panel mounts each time its container opens, and older pages loaded last
  // time may have changed elsewhere since, so it starts from the newest page.
  const startOverRef = React.useRef(startOver);
  startOverRef.current = startOver;
  React.useEffect(() => {
    void startOverRef.current();
  }, []);

  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  // A panel that goes away with its confirm still up (a route change closes the
  // sheet under it) must not leave its container thinking one is open.
  const onConfirmingChangeRef = React.useRef(onConfirmingChange);
  onConfirmingChangeRef.current = onConfirmingChange;
  React.useEffect(() => () => onConfirmingChangeRef.current?.(false), []);

  const label = __("Notifications", "pressedmail");
  const paused = silence.paused;
  const pausedText =
    silence.endsAt !== null ? describePause(silence.endsAt) : "";
  const isEmpty = items.length === 0;
  // What the header says about the count is only true once the feed has said it.
  // Before the first answer the count is a default, and after a failed one it is
  // a default still, and "all caught up" over either is a claim nobody checked.
  const countKnown = !isLoading && !(Boolean(error) && isEmpty);
  // The badge can count less than the list holds: "Inbox unread" leaves out
  // rules, reminders and the rest, so it can even be blank over unread rows. Say
  // so, or the two numbers just disagree. A paused bell hides its badge on
  // purpose, and the header already says it is paused.
  const badgeCountsLess =
    !paused && totalUnreadCount > 0 && unreadCount !== totalUnreadCount;
  // Caught up means there was something to catch up on. A feed with nothing in
  // it, and nothing held back, says that instead.
  const nothingStored = isEmpty && hiddenCount === 0 && !hasMore;
  const unreadText =
    totalUnreadCount === 0
      ? nothingStored
        ? __("No notifications", "pressedmail")
        : __("You are all caught up", "pressedmail")
      : badgeCountsLess
        ? unreadCount > 0
          ? sprintf(
              /* translators: 1: unread notifications in all, 2: how many of them the bell badge counts. */
              __("%1$d unread, %2$d on the badge", "pressedmail"),
              totalUnreadCount,
              unreadCount,
            )
          : sprintf(
              /* translators: %d: unread notifications, none of which the bell badge counts. */
              __("%d unread, none on the badge", "pressedmail"),
              totalUnreadCount,
            )
        : sprintf(__("%d unread", "pressedmail"), totalUnreadCount);

  const runMutation = React.useCallback(
    async (mutation: () => Promise<unknown>, failureMessage: string) => {
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

  const changeSilence = React.useCallback(
    async (change: () => Promise<boolean>, failureMessage: string) => {
      if (!(await change())) toast.error(failureMessage);
    },
    [],
  );

  const openNotification = (
    item: PressedMailNotification,
    event: React.MouseEvent,
  ) => {
    // Marking read is a courtesy, not a gate: it never holds the click back, and
    // a failed write puts the row back and says so.
    if (!item.readAt) {
      void runMutation(
        () => markRead(item.id, true),
        __("Could not mark notification as read", "pressedmail"),
      );
    }
    const target = getNotificationTargetPath(item);
    if (target) {
      // A click with no pointer behind it (`detail` is its click count) is Enter,
      // Space or a screen reader. The popup is about to hand focus back to a bell
      // that is nowhere near what was just opened, so focus follows the target.
      // The inbox and the calendar take it once they have drawn the message or
      // event; a page with neither gets the page.
      const fromKeyboard = event.detail === 0;
      const opensItem = /[?&]openMessageId=/.test(target)
        || (__ENABLE_CALENDAR__ && /[?&]openEventId=/.test(target));
      // A newer pointer open clears a keyboard request whose target never arrived.
      requestLandingFocus(fromKeyboard && opensItem);
      if (fromKeyboard && !opensItem) focusLanding(findMainRegion);
      onNavigate();
      navigate(target);
    }
  };

  const markEverythingRead = async () => {
    expectRemoval();
    const marked = await runMutation(
      markAllRead,
      __("Could not mark notifications as read", "pressedmail"),
    );
    if (!marked) return;
    // Every unread row went at once, and mail read here leaves the list under
    // the default setting. Say so, with the way back.
    toast.info(__("Marked all as read.", "pressedmail"), {
      duration: 8_000,
      action: {
        label: __("Undo", "pressedmail"),
        onClick: () => {
          void runMutation(
            async () => undoMarkAllRead?.(),
            __("Could not undo that", "pressedmail"),
          );
        },
      },
    });
  };

  const rowButton = (id: number): HTMLElement | null =>
    list.node.current?.querySelector<HTMLElement>(
      `[data-notification-id="${id}"] [data-roving-item]`,
    ) ?? null;

  /** Note the row a menu action is for, and the one beside it. Returns the row. */
  const rememberRow = (id: number): HTMLElement | null => {
    const row = rowButton(id);
    afterRowMenu.current = {
      row,
      neighbour: row ? list.neighbourOf(row) : null,
    };
    return row;
  };

  // A row's menu hands focus back to its trigger, and the action just taken may
  // have taken the row out of the list, trigger and all. Focus goes to the row
  // if it is still listed, and to the one beside it if not, so the reader keeps
  // their place. A menu closed with no action keeps the default.
  const restoreFocusAfterRowMenu = (event: Event) => {
    const { row, neighbour } = afterRowMenu.current;
    afterRowMenu.current = { row: null, neighbour: null };
    const target = row?.isConnected
      ? row
      : neighbour?.isConnected
        ? neighbour
        : null;
    if (!target) return;
    event.preventDefault();
    target.focus();
  };

  const dismissNotification = async (
    item: PressedMailNotification,
    row: HTMLElement | null,
  ) => {
    const neighbour = row ? list.neighbourOf(row) : null;
    expectRemoval();
    const removed = await runMutation(
      () => dismissWithUndo(item.id),
      __("Could not dismiss notification", "pressedmail"),
    );
    if (!removed) return;
    // The menu hands focus back to a row that is now gone, so it lands on the
    // next one instead of on the page.
    if (neighbour?.isConnected) neighbour.focus();
    // The row is out of the list at once and the server is told when this toast
    // is over, so a mis-click on a warning that stays can be taken back, as Mark
    // all as read can.
    toast.info(__("Notification dismissed.", "pressedmail"), {
      duration: DISMISS_UNDO_MS,
      action: {
        label: __("Undo", "pressedmail"),
        onClick: () => {
          if (!undoDismiss(item.id)) {
            toast.error(__("It is too late to undo that.", "pressedmail"));
          }
        },
      },
    });
  };

  // The check on a hovered row. Reading it takes the row out of the list under
  // "Unread only", so focus goes to the row beside it, as it does for Dismiss.
  const readNotification = async (item: PressedMailNotification) => {
    const row = rowButton(item.id);
    const neighbour = row ? list.neighbourOf(row) : null;
    expectRemoval();
    const done = await runMutation(
      () => markRead(item.id, true),
      __("Could not update notification", "pressedmail"),
    );
    if (done && row && !row.isConnected && neighbour?.isConnected) {
      neighbour.focus();
    }
  };

  const setConfirming = (next: boolean) => {
    setClearOpen(next);
    onConfirmingChange?.(next);
  };

  const confirmClear = async () => {
    expectRemoval();
    setClearing(true);
    const cleared = await runMutation(
      clearAll,
      __("Could not clear notifications", "pressedmail"),
    );
    setClearing(false);
    if (cleared) setConfirming(false);
  };

  const showOlder = async (button: HTMLElement) => {
    if (isLoadingMore) return;
    const request = {
      known: new Set(items.map((item) => item.id)),
      tail: items[items.length - 1] ?? null,
      hiddenBefore: hiddenCount,
      hadFocus: document.activeElement === button,
      settled: false,
    };
    olderRequest.current = request;
    setPagedOlder(true);
    try {
      await loadMore();
    } finally {
      request.settled = true;
      if (olderRequest.current === request) setOlderSettled((n) => n + 1);
    }
  };

  // Once the page is in the DOM, not a frame after the click. The feed commits the
  // rows when it is ready, and a frame is not a promise about when that is: a read
  // that came before the commit saw no new rows, and moved no focus and said
  // nothing. This runs on the render that holds them, whenever that is.
  React.useLayoutEffect(() => {
    const request = olderRequest.current;
    if (!request?.settled || isLoadingMore) return;
    olderRequest.current = null;
    // Rows that were not there and sit below the last one that was: a refresh can
    // add newer ones above while the page loads, and those are not older.
    const added = items.filter(
      (item) =>
        !request.known.has(item.id) &&
        (request.tail === null || isOlderThan(item, request.tail)),
    );
    const first = added[0];
    if (first) {
      rowButton(first.id)?.focus();
      announce(
        sprintf(
          /* translators: %d: number of older notifications that were added to the list. */
          _n(
            "%d older notification loaded.",
            "%d older notifications loaded.",
            added.length,
            "pressedmail",
          ),
          added.length,
        ),
      );
      return;
    }
    const hidden = hiddenCount - request.hiddenBefore;
    if (hidden > 0) {
      // A page of rows the alert settings all hold back adds nothing to see,
      // and silence would read as though the button did nothing.
      announce(
        sprintf(
          /* translators: %d: number of older notifications that were loaded but are hidden by the user's alert settings. */
          _n(
            "%d older notification loaded, but your alert settings hide it.",
            "%d older notifications loaded, but your alert settings hide them.",
            hidden,
            "pressedmail",
          ),
          hidden,
        ),
      );
    }
    // The button went with the last page, and focus with it. A reader who was on
    // it keeps their place in the list.
    if (request.hadFocus && !root.current?.contains(document.activeElement)) {
      const rows = list.items();
      (
        rows[rows.length - 1] ??
        root.current?.querySelector<HTMLElement>(
          '[data-test="notifications-show-hidden"]',
        )
      )?.focus();
    }
  }, [items, hiddenCount, isLoadingMore, olderSettled, announce]);

  // Clear all leaves the warnings that only their cause can retire, so it is only
  // on offer when there is something else to clear: a dismissable row on screen,
  // one the alert settings hold back (hidden rows are always mail), or older ones
  // not loaded yet.
  const hasSticky = items.some((item) => !item.dismissable);
  const canClear =
    hiddenCount > 0 || hasMore || items.some((item) => item.dismissable);
  // What the confirm is about to delete, as far as it is known. Hidden rows are
  // deletable too, and are already in `items` when they are showing.
  const deletable =
    items.filter((item) => item.dismissable).length +
    (showAll ? 0 : hiddenCount);
  const clearTitle =
    deletable > 0 && !hasMore
      ? sprintf(
          /* translators: %d: number of notifications about to be deleted. */
          _n(
            "Delete %d notification?",
            "Delete all %d notifications?",
            deletable,
            "pressedmail",
          ),
          deletable,
        )
      : __("Clear all notifications?", "pressedmail");
  const clearBody =
    deletable === 0
      ? __(
          "This permanently deletes every notification in your feed.",
          "pressedmail",
        )
      : sprintf(
          hasMore
            ? /* translators: %d: number of notifications loaded; more, older ones are deleted too. */
              _n(
                "This permanently deletes %d notification and every older one.",
                "This permanently deletes %d notifications and every older one.",
                deletable,
                "pressedmail",
              )
            : /* translators: %d: number of notifications about to be deleted. */
              _n(
                "This permanently deletes %d notification.",
                "This permanently deletes %d notifications.",
                deletable,
                "pressedmail",
              ),
          deletable,
        );

  const showListError = Boolean(error) && !isEmpty;
  // Only mail that "Unread only" holds back is called read mail, because that is
  // the one switch that explains it.
  const hiddenAreRead = hiddenReadCount > 0 && hiddenReadCount === hiddenCount;
  const showSender = preferences.notification_preview_level !== "none";
  const listed = React.useMemo<Listed[]>(() => {
    const rows: Listed[] = [];
    const folding = (above: number | null) =>
      leaving
        .filter((row) => row.above === above)
        .map((row): Listed => ({ kind: "leaving", item: row.item }));
    let last: NotificationDay | null = null;
    for (const item of items) {
      const day = notificationDay(item.createdAt, now);
      if (day !== last) {
        rows.push({ kind: "day", day });
        last = day;
      }
      // A row that was above this one folds away where it was.
      rows.push(...folding(item.id));
      rows.push({ kind: "item", item });
    }
    rows.push(...folding(null));
    return rows;
  }, [items, leaving, now]);

  const surface = variant === "popover" ? "bg-popover" : "bg-background";
  // Only where the actions float over the row do they need a ground of their own.
  const actionsSurface =
    variant === "popover"
      ? "[@media(hover:hover)]:bg-popover"
      : "[@media(hover:hover)]:bg-background";
  // A thumb needs 44px; a pointer is fine with the compact controls.
  const touch = variant === "sheet" ? "pm-touch-target" : undefined;

  return (
    <div
      ref={root}
      data-variant={variant}
      // A column the container caps: the popover by its available height, the
      // sheet by its own. The header and the notes take what they need and the
      // list is the one thing that scrolls, so the container never scrolls on top
      // of it and the toolbar never leaves the top.
      className={cn(
        "flex min-h-0 flex-col",
        variant === "sheet" ? "h-full" : "flex-1",
      )}>
      <div
        className={cn(
          "flex gap-2 border-b px-3",
          // The popover's toolbar sits with the title. The sheet has no title
          // over its status, so the status is centred on the buttons beside it.
          variant === "popover" ? "items-start py-2" : "items-center pb-2",
        )}>
        <div className="min-w-0 flex-1 py-0.5">
          {variant === "popover" ? (
            <h2 id={titleId} className="text-sm font-semibold leading-5">
              {label}
            </h2>
          ) : null}
          <div
            aria-live="polite"
            data-test="notifications-status"
            // Always this tall, so nothing under it moves as the line fills in,
            // or grows a pause on the end of it.
            className="min-h-4 text-xs leading-4 text-muted-foreground">
            {countKnown ? (
              // Each fact is one piece that wraps whole, so a narrow sheet never
              // leaves a separator at the end of a line or the start of the next.
              <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                <span>{unreadText}</span>
                {paused ? (
                  <span
                    data-test="notifications-paused-until"
                    className={NOTIFICATION_STATUS_CHIP}>
                    <CirclePause
                      className="size-3 shrink-0"
                      aria-hidden="true"
                    />
                    {pausedText}
                  </span>
                ) : null}
                <NotificationMutedNote />
              </p>
            ) : isLoading ? (
              <Skeleton
                aria-hidden="true"
                className="mt-0.5 h-3 w-24 motion-reduce:animate-none"
              />
            ) : null}
          </div>
        </div>

        <div
          ref={toolbar.ref}
          role="toolbar"
          aria-label={__("Notification actions", "pressedmail")}
          onFocus={toolbar.onFocus}
          onKeyDown={toolbar.onKeyDown}
          className="flex shrink-0 items-center gap-0.5">
          <PressedTooltip
            content={__("Mark all as read", "pressedmail")}
            side="bottom">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              data-roving-item=""
              data-test="notifications-mark-all-read"
              // Focusable while off: the click that just cleared the last
              // unread one leaves focus here, and a control that stops being
              // focusable drops the reader out of the popup.
              disabled={totalUnreadCount === 0}
              focusableWhenDisabled
              aria-label={__("Mark all as read", "pressedmail")}
              className={cn(
                "text-muted-foreground hover:text-foreground",
                touch,
              )}
              onClick={() => void markEverythingRead()}>
              <CheckCheck className="size-4" aria-hidden="true" />
            </Button>
          </PressedTooltip>

          <NotificationMuteButton
            activeClassName={ACTIVE_TOOLBAR_BUTTON}
            className={touch}
          />

          <NotificationPauseMenu
            paused={paused}
            pausedText={pausedText}
            tooltipSide="bottom"
            buttonClassName={cn(
              "text-muted-foreground hover:text-foreground",
              touch,
              paused && ACTIVE_TOOLBAR_BUTTON,
            )}
            onPause={(preset) =>
              changeSilence(
                () => silence.pause(preset),
                __("Could not pause notifications", "pressedmail"),
              )
            }
            onResume={() =>
              changeSilence(
                silence.resume,
                __("Could not resume notifications", "pressedmail"),
              )
            }
          />

          <PressedTooltip
            content={__("Clear all", "pressedmail")}
            side="bottom">
            <Button
              ref={clearButton}
              type="button"
              variant="ghost"
              size="icon"
              data-roving-item=""
              data-test="notifications-clear-all"
              className={cn(
                "text-muted-foreground hover:text-foreground",
                touch,
              )}
              disabled={!canClear}
              focusableWhenDisabled
              aria-label={__("Clear all", "pressedmail")}
              onClick={() => setConfirming(true)}>
              <Trash2 className="size-4" aria-hidden="true" />
            </Button>
          </PressedTooltip>
        </div>
      </div>

      {hiddenCount > 0 ? (
        <div
          data-test="notifications-hidden-note"
          className="flex items-center justify-between gap-x-3 gap-y-0.5 border-b bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground">
          <p className="min-w-0">
            {showAll
              ? hiddenAreRead
                ? __("Showing read notifications, too.", "pressedmail")
                : __(
                    "Showing notifications your alert settings hide, too.",
                    "pressedmail",
                  )
              : hasMore
                ? // Only the pages loaded so far were counted, so a number would be
                  // a floor that climbs with every page. Say what is true and
                  // leave the count for when it is complete.
                  hiddenAreRead
                  ? __(
                      "Unread only is on, so read notifications are hidden.",
                      "pressedmail",
                    )
                  : __(
                      "Your alert settings are hiding some notifications.",
                      "pressedmail",
                    )
                : hiddenAreRead
                  ? sprintf(
                      /* translators: %d: number of read notifications (mail, follow-ups) the "Unread only" setting keeps out of the list. */
                      _n(
                        "Unread only hides %d read notification.",
                        "Unread only hides %d read notifications.",
                        hiddenCount,
                        "pressedmail",
                      ),
                      hiddenCount,
                    )
                  : sprintf(
                      /* translators: %d: number of notifications the user's alert settings keep out of the list. */
                      _n(
                        "Your alert settings hide %d notification.",
                        "Your alert settings hide %d notifications.",
                        hiddenCount,
                        "pressedmail",
                      ),
                      hiddenCount,
                    )}{" "}
            {/* One piece, so a narrow screen wraps before it and never inside it. */}
            <Link
              to={alertSettingsPath}
              data-test="notifications-alert-settings"
              onClick={onNavigate}
              className="whitespace-nowrap font-medium text-foreground underline underline-offset-2">
              {__("Alert settings", "pressedmail")}
            </Link>
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            data-test="notifications-show-hidden"
            className={cn(
              "-me-1 shrink-0 whitespace-nowrap text-primary underline underline-offset-2",
              touch,
            )}
            onClick={() => setShowAll(!showAll)}>
            {showAll
              ? __("Hide again", "pressedmail")
              : __("Show hidden", "pressedmail")}
          </Button>
        </div>
      ) : null}

      {showListError ? (
        <div
          role="alert"
          data-test="notifications-refresh-error"
          className="flex items-center justify-between gap-3 border-b bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <p>
            {__("Could not refresh. Showing what was loaded.", "pressedmail")}
          </p>
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="-me-1 shrink-0 text-destructive hover:text-destructive"
            onClick={() => void refresh(true)}>
            {__("Retry", "pressedmail")}
          </Button>
        </div>
      ) : null}

      <div className="flex min-h-0 flex-1 flex-col">
        <div
          data-test="notifications-scroll"
          className={cn(
            // Room above for the day label that sticks to the top, so a row the
            // keyboard moves to is never tucked under it.
            "min-h-0 flex-1 overflow-y-auto scroll-pb-2 scroll-pt-8",
            // The popover keeps the page behind it still. The sheet does not ask:
            // if this box is not the one that scrolls, the wheel has to reach the
            // sheet's own scroller, and a contained overscroll swallowed it.
            variant === "popover" && "overscroll-contain",
          )}>
          {isLoading && isEmpty ? (
            <NotificationSkeleton />
          ) : error && isEmpty ? (
            <div className="space-y-3 px-4 py-7 text-center">
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
              <Button
                type="button"
                variant="outline"
                className="gap-1.5"
                onClick={() => void refresh()}>
                <RefreshCw className="size-3.5" aria-hidden="true" />
                {__("Retry", "pressedmail")}
              </Button>
            </div>
          ) : isEmpty && leaving.length === 0 ? (
            <div
              data-test="notifications-empty"
              className="flex flex-col items-center px-4 py-8 text-center">
              <span
                aria-hidden="true"
                className="mb-3 flex size-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
                <Bell className="size-5" />
              </span>
              {/* The header already says there is nothing, so this says what
                  will change that. */}
              <p className="text-sm text-muted-foreground">
                {hiddenCount > 0
                  ? __("Nothing new to show.", "pressedmail")
                  : __(
                      "New mail and reminders will show up here.",
                      "pressedmail",
                    )}
              </p>
            </div>
          ) : (
            <ul
              ref={list.ref}
              data-test="notifications-list"
              aria-label={label}
              aria-describedby={hintId}
              onFocus={(event) => {
                list.onFocus(event);
                setListFocused(isKeyboardFocus(event.target));
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) {
                  setListFocused(false);
                }
              }}
              onKeyDown={(event) => {
                // Right steps from a row into its actions, and Left back out.
                const target = event.target as HTMLElement;
                const row = target.closest("li");
                if (
                  event.key === "ArrowRight" &&
                  target.matches("[data-roving-item]")
                ) {
                  event.preventDefault();
                  row
                    ?.querySelector<HTMLElement>("[data-row-actions]")
                    ?.focus();
                  return;
                }
                if (
                  event.key === "ArrowLeft" &&
                  target.matches("[data-row-actions]")
                ) {
                  event.preventDefault();
                  row
                    ?.querySelector<HTMLElement>("[data-roving-item]")
                    ?.focus();
                  return;
                }
                list.onKeyDown(event);
              }}>
              {listed.map((entry, index) => {
                if (entry.kind === "day") {
                  return (
                    <li
                      key={`day-${index}-${entry.day}`}
                      role="presentation"
                      data-notification-day={entry.day}
                      className={cn(
                        "sticky top-0 z-10 border-b px-4 py-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground",
                        surface,
                      )}>
                      {notificationDayLabel(entry.day)}
                    </li>
                  );
                }
                if (entry.kind === "leaving") {
                  return (
                    <LeavingRow
                      key={`leaving-${entry.item.id}`}
                      item={entry.item}
                      now={now}
                      showSender={showSender}
                      surface={surface}
                      onDone={finishLeaving}
                    />
                  );
                }
                const { item } = entry;
                const unread = !item.readAt;
                const problem = item.severity === "problem";
                const summary = item.summary;
                return (
                  <li
                    key={item.id}
                    data-notification-id={item.id}
                    data-severity={problem ? "problem" : "info"}
                    className={cn(
                      "relative border-b last:border-b-0",
                      unread ? UNREAD_TINT : surface,
                    )}>
                    {unread ? (
                      // The bar is the cue that does not depend on reading a
                      // tint: a stripe down the edge is seen before anything is.
                      <span
                        data-test={`notification-unread-${item.id}`}
                        data-testid={`notification-unread-${item.id}`}
                        aria-hidden="true"
                        className="absolute inset-y-2 start-0 w-[3px] rounded-e-full bg-primary"
                      />
                    ) : null}
                    <div className="group/row relative flex items-start gap-1 ps-2 pe-1.5">
                      <button
                        type="button"
                        data-roving-item=""
                        className="flex min-h-[3.25rem] min-w-0 flex-1 items-start gap-2.5 rounded-md px-2 py-2 text-start hover:bg-muted/70"
                        onClick={(event) => openNotification(item, event)}>
                        <RowFace
                          item={item}
                          now={now}
                          showSender={showSender}
                        />
                      </button>

                      <div
                        data-test={`notification-row-actions-${item.id}`}
                        className={cn(ROW_ACTIONS, actionsSurface)}>
                        {unread ? (
                          <PressedTooltip
                            content={__("Mark as read", "pressedmail")}
                            side="top">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              data-row-quick=""
                              data-test={`notification-quick-read-${item.id}`}
                              tabIndex={-1}
                              aria-label={sprintf(
                                /* translators: %s: a notification's title. Names the quick button of one row, so rows with the same wording can be told apart. */
                                __("Mark as read: %s", "pressedmail"),
                                item.title,
                              )}
                              // Touch has the row menu, and two 44px buttons
                              // would take a third of a phone's width.
                              className="hidden shrink-0 text-muted-foreground hover:text-foreground [@media(hover:hover)]:inline-flex"
                              onClick={(event) => {
                                event.stopPropagation();
                                void readNotification(item);
                              }}>
                              <Check className="size-4" aria-hidden="true" />
                            </Button>
                          </PressedTooltip>
                        ) : null}

                        <DropdownMenu modal={false}>
                          <DropdownMenuTrigger asChild>
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              data-row-actions=""
                              tabIndex={-1}
                              className={cn(
                                "shrink-0 text-muted-foreground hover:text-foreground [@media(hover:none)]:mt-1",
                                variant === "sheet" && SHEET_ROW_TOUCH,
                              )}
                              aria-label={
                                summary
                                  ? sprintf(
                                      /* translators: 1: a notification's title, 2: its summary. Names the menu of one row, so rows with the same title can be told apart. */
                                      __(
                                        "Actions for %1$s, %2$s",
                                        "pressedmail",
                                      ),
                                      item.title,
                                      summary,
                                    )
                                  : sprintf(
                                      __("Actions for %s", "pressedmail"),
                                      item.title,
                                    )
                              }
                              onClick={(event) => event.stopPropagation()}>
                              <MoreHorizontal
                                className="size-4"
                                aria-hidden="true"
                              />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent
                            align="end"
                            onEscapeKeyDown={closeMenuOnly}
                            onCloseAutoFocus={restoreFocusAfterRowMenu}>
                            <DropdownMenuItem
                              onClick={() => {
                                rememberRow(item.id);
                                expectRemoval();
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
                                    void dismissNotification(
                                      item,
                                      rememberRow(item.id),
                                    );
                                  }}>
                                  {__("Dismiss", "pressedmail")}
                                </DropdownMenuItem>
                              </>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}

          {hasMore ? (
            <div className="border-t p-2">
              {loadMoreError ? (
                <p
                  role="alert"
                  data-test="notifications-older-error"
                  className="px-1 pb-1.5 text-xs text-destructive">
                  {loadMoreError}
                </p>
              ) : null}
              <Button
                type="button"
                variant="ghost"
                data-test="notifications-show-older"
                aria-busy={isLoadingMore}
                aria-disabled={isLoadingMore}
                className={cn(
                  "w-full gap-1.5 text-muted-foreground hover:text-foreground",
                  touch,
                )}
                onClick={(event) => void showOlder(event.currentTarget)}>
                {isLoadingMore ? (
                  <>
                    <Loader2
                      className="size-3.5 animate-spin motion-reduce:animate-none"
                      aria-hidden="true"
                    />
                    {__("Loading older…", "pressedmail")}
                  </>
                ) : loadMoreError ? (
                  __("Try again", "pressedmail")
                ) : (
                  __("Show older", "pressedmail")
                )}
              </Button>
            </div>
          ) : pagedOlder && !isEmpty ? (
            <p
              data-test="notifications-end"
              className="border-t px-3 py-2.5 text-center text-xs text-muted-foreground">
              {sprintf(
                /* translators: %d: number of days notifications are kept. */
                __(
                  "That is everything. Most notifications are kept for %d days.",
                  "pressedmail",
                ),
                RETENTION_DAYS,
              )}
            </p>
          ) : null}
        </div>
      </div>

      {/* The keys the list answers to. It sits under the list and never over it:
          laid over the foot of the list it covered the focused last row, the
          Show older button and the end of the list, the very things a keyboard
          reader is moving towards. Its height is always reserved, so it appears
          without moving anything, and it only shows while the list has keyboard
          focus. It is always in the page, for the list's description. A screen
          with no hover has no keys to teach and keeps it for a screen reader. */}
      {!isEmpty ? (
        <p
          id={hintId}
          data-test="notifications-keyboard-hint"
          className={cn(
            "flex min-h-6 shrink-0 items-center px-4 py-1 text-[11px] leading-4 text-muted-foreground transition-opacity duration-100 motion-reduce:transition-none [@media(hover:none)]:min-h-0 [@media(hover:none)]:sr-only",
            listFocused ? "opacity-100" : "opacity-0",
          )}>
          {__(
            "Up and down arrows move between notifications. Right arrow opens actions.",
            "pressedmail",
          )}
        </p>
      ) : null}

      <p role="status" className="sr-only">
        <span key={announcement.n}>{announcement.text}</span>
      </p>

      <ConfirmationPanel
        open={clearOpen}
        onOpenChange={setConfirming}
        title={clearTitle}
        description={
          hasSticky
            ? `${clearBody} ${__(
                "Warnings that still need your attention stay until they are fixed.",
                "pressedmail",
              )}`
            : clearBody
        }
        confirmText={__("Delete notifications", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        variant="destructive"
        loading={clearing}
        onConfirm={confirmClear}
        // The popup stays open under the dialog, so Cancel, Escape and a finished
        // delete all land back on the button that opened it.
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          // Quietly: after Escape the browser counts this focus as the keyboard's,
          // and the tooltip would open over the button and take the next Escape.
          if (clearButton.current) focusQuietly(clearButton.current);
        }}
      />
    </div>
  );
}
