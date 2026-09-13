import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useLocation, useNavigate, Outlet } from "react-router-dom";
import { Inbox, MoreHorizontal } from "lucide-react";
import { __ } from "@wordpress/i18n";

import { DynamicHeader } from "@/components/application-layout/DynamicHeader.active";
import { ComposeNavigationBlocker } from "./ComposeNavigationBlocker";
import { CalendarHeaderIcon, ContactsHeaderIcon } from "./HeaderIconSvgs";
import { EmailComposeNewIcon } from "@/components/icons/MailActionIcons";
import { LayoutNavigationShell } from "./LayoutNavigationShell";
import { UpgradeModal } from "@/components/features/UpgradeModal.active";
import { PressedTooltipProvider } from "@/components/ui/pressed-tooltip";
import { PaneComposeProvider } from "@/context/composer";
import { useAppContext } from "@/context/AppProvider";
import { useInboxState, useFolderOperations } from "@/context/InboxContext";
import { computeSyncProgress } from "@/hooks/useMailboxSyncProgress";
import { useSyncDriver } from "@/hooks/useSyncDriver";
import { useNonceRefresh } from "@/hooks/useNonceRefresh";
import { useProcessQueue } from "@/hooks/useProcessQueue";
import {
  setActivityPanelOpen,
  toggleActivityPanel,
  useActivityPanelOpen,
} from "@/components/activity/use-activity-panel";
import { ActivitySheet } from "@/components/activity/ActivitySheet";
import { PressedOutUiProvider } from "@/context/PressedOutUiContext";
import {
  AppStatusBar,
  type AppStatusBarConnectionStatus,
} from "@/layouts/shared/components/footer-system";
import {
  SpeedDialMenu,
  SPEED_DIAL_MENU_PALETTE_PRESETS,
  SPEED_DIAL_MENU_SIZE_PRESETS,
  type SpeedDialMenuPlacement,
} from "@/layouts/shared/components/speed-dial-menu";
import {
  useUserPreferences,
  type SpeedDialPosition,
} from "@/hooks/useUserPreferences";
import { useAutoSyncDisabled } from "@/context/admin-settings";
import { restoreWordPressChrome } from "@/hooks/useImmersiveMode";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import { useWpAdminChrome } from "@/hooks/useWpAdminChrome";
import { getPersistedPaneState } from "@/lib/open-pane-persistence";
import {
  MobileAppShell,
  MobileTabBar,
  useApplyShellMode,
  useMobileShellFlag,
  type MobileTabItem,
} from "@/components/mobile-shell";

const _startcase = (str: string) => {
  return str
    .toLowerCase() // Convert the whole string to lowercase
    .replace(/_/g, " ") // Replace underscores with spaces
    .replace(/-/g, " ") // Replace hyphens with spaces
    .split(" ") // Split the string into words
    .map((word: string) => word.charAt(0).toUpperCase() + word.slice(1)) // Capitalize the first letter of each word
    .join(" "); // Join the words back into a string
};

const SPEED_DIAL_PLACEMENTS: Record<
  Exclude<SpeedDialPosition, "off">,
  SpeedDialMenuPlacement
> = {
  "top-left": "fixed-top-left",
  "top-center": "fixed-top-center",
  "top-right": "fixed-top-right",
  "middle-left": "fixed-middle-left",
  "middle-right": "fixed-middle-right",
  "bottom-left": "fixed-bottom-left",
  "bottom-center": "fixed-bottom-center",
  "bottom-right": "fixed-bottom-right",
};

function AutomationPauseNotice() {
  if (window.pressedmailPlugin?.automationPaused !== true) return null;
  return (
    <div
      role="region"
      aria-label={__("Site automation status", "pressedmail")}
      className="shrink-0 border-b bg-muted px-4 py-2 text-sm text-foreground">
      {__IS_PRO__
        ? __(
            "Automatic mailbox work is paused on this site. Send now still works; Undo Send is unavailable.",
            "pressedmail",
          )
        : __(
            "Automatic mailbox work is paused on this site. Send now still works.",
            "pressedmail",
          )}{" "}
      {window.pressedmailPlugin.automationReviewUrl && (
        <a
          className="font-medium text-primary underline"
          href={window.pressedmailPlugin.automationReviewUrl}>
          {__("Review this site", "pressedmail")}
        </a>
      )}
    </div>
  );
}

const ApplicationLayout = () => {
  const { adminBarHeight } = useWpAdminChrome();
  const {
    accounts,
    selectedAccount,
    numberOfMessages,
    hasCompletedSetup,
    isAddAccount,
  } = useAppContext();
  const showSetupWizard = !hasCompletedSetup || isAddAccount;
  const {
    messages: statusMessages,
    totalCount: inboxTotalCount,
    isLoading: inboxIsLoading,
    error: inboxError,
    selectedMessage,
  } = useInboxState();
  // Footer sync counters are derived CHEAPLY (pure) from the folder list the
  // inbox context already holds, NO polling and NO heavy folder hook at the
  // root (that caused a render storm / freeze). The folder list refreshes via
  // the boot hook's strategic, bounded settling refresh; the footer just reads
  // whatever is current.
  const { folders: contextFolders, selectedFolder } = useFolderOperations();
  const syncProgress = useMemo(
    () => computeSyncProgress(contextFolders ?? []),
    [contextFolders],
  );
  const autoSyncDisabled = useAutoSyncDisabled();
  // Drive the sequential mailbox sync forward while the app is open (WP-Cron is
  // unreliable). Respects the auto-sync setting, when sync is turned off (0), only a
  // manual Refresh advances. Manual refresh stays available regardless.
  useSyncDriver(accounts.length > 0 && !autoSyncDisabled);
  // Keep the REST nonce fresh via WP Heartbeat so a long-open tab doesn't start 403ing
  // every request with rest_cookie_invalid_nonce once the original nonce expires.
  useNonceRefresh();
  // The footer shares the single process-queue poller; surface the active task's
  // label as a trailing status fragment.
  const { currentTask: currentProcessTask, activeTasks } = useProcessQueue();
  const activityPanelOpen = useActivityPanelOpen();
  const [connectionStatus, setConnectionStatus] =
    useState<AppStatusBarConnectionStatus>(() =>
      typeof navigator !== "undefined" && navigator.onLine === false
        ? "offline"
        : "connected",
    );

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const handleOnline = () => setConnectionStatus("connected");
    const handleOffline = () => setConnectionStatus("offline");

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const rootElement =
      window.document.getElementById("pressedmail-plugin") ||
      (window.document.querySelector(
        ".pressedmail-plugin",
      ) as HTMLElement | null);

    if (!rootElement) {
      return;
    }

    const previousInlineMargin = rootElement.style.marginBottom;
    const previousInlinePadding = rootElement.style.paddingBottom;
    rootElement.style.marginBottom = "0";
    rootElement.style.paddingBottom = "0";

    return () => {
      rootElement.style.marginBottom = previousInlineMargin;
      rootElement.style.paddingBottom = previousInlinePadding;
    };
  }, []);

  useEffect(() => {
    return () => {
      restoreWordPressChrome();
    };
  }, []);

  const isMobileOrTablet = useIsMobileOrTablet();
  useApplyShellMode("pressedmail-plugin");

  const navigate = useNavigate();
  let location = useLocation();
  const pathSegments = location.pathname.split("/").filter(Boolean);
  const hasPath = pathSegments.length > 0;
  const fallbackSlug = pathSegments[pathSegments.length - 1];
  const pageTitle = fallbackSlug ? _startcase(fallbackSlug) : "Inbox";
  const { preferences } = useUserPreferences();
  // The launcher is viewport-fixed at bottom-right, which is exactly where
  // every settings pane right-aligns its switches and selects: at 1280 and
  // 1440 it sat on top of them. Settings already has its own sidebar and
  // header navigation, so the launcher has nothing to offer there.
  const onSettingsRoute = location.pathname.startsWith("/settings");
  const speedDialPlacement =
    preferences.speed_dial_position === "off" || onSettingsRoute
      ? null
      : (SPEED_DIAL_PLACEMENTS[preferences.speed_dial_position] ??
        "fixed-bottom-right");

  useEffect(() => {
    if (!hasPath) {
      navigate("inbox", { replace: true });
    }
  }, [hasPath, navigate]);

  useEffect(() => {
    window.document.title = pageTitle;
  }, [pageTitle]);

  const mobileShellEnabled = useMobileShellFlag();
  const compactShellEnabled = isMobileOrTablet && mobileShellEnabled;
  const paneFolder = selectedFolder || selectedMessage?.folder || "INBOX";
  const wasCompact = useRef(compactShellEnabled);
  useEffect(() => {
    const becameCompact = compactShellEnabled && !wasCompact.current;
    wasCompact.current = compactShellEnabled;
    if (
      becameCompact &&
      location.pathname === "/inbox" &&
      selectedAccount &&
      getPersistedPaneState(selectedAccount, paneFolder)?.mode === "compose"
    ) {
      // Desktop compose lives in the Inbox pane; compact compose needs its
      // route. A bare route resumes the same shared draft without new fields.
      navigate("/compose");
    }
  }, [
    compactShellEnabled,
    location.pathname,
    navigate,
    selectedAccount,
    paneFolder,
  ]);
  const statusItemCount =
    numberOfMessages || inboxTotalCount || statusMessages.length;
  const statusUnreadCount = statusMessages.filter(
    (message) => !(message.read || message.is_read),
  ).length;
  const statusSyncStatus = inboxIsLoading
    ? "syncing"
    : inboxError
      ? "error"
      : "idle";
  const frameStyle = compactShellEnabled
    ? ({
        "--wp-admin-bar-height": "0px",
        height: "100dvh",
        minHeight: "100dvh",
        maxHeight: "100dvh",
      } as CSSProperties)
    : ({
        "--wp-admin-bar-height": `${adminBarHeight}px`,
        height: "calc(100dvh - var(--wp-admin-bar-height, 32px))",
        minHeight: "calc(100dvh - var(--wp-admin-bar-height, 32px))",
        maxHeight: "calc(100dvh - var(--wp-admin-bar-height, 32px))",
      } as CSSProperties);

  const tabItems = useMemo<MobileTabItem[]>(() => {
    const items: MobileTabItem[] = [
      {
        id: "inbox",
        label: __("Inbox", "pressedmail"),
        to: "/inbox",
        icon: Inbox,
      },
    ];
    if (typeof __ENABLE_CALENDAR__ !== "undefined" && __ENABLE_CALENDAR__) {
      items.push({
        id: "calendar",
        label: __("Calendar", "pressedmail"),
        to: "/calendar",
        icon: CalendarHeaderIcon,
      });
    }
    if (typeof __ENABLE_CONTACTS__ !== "undefined" && __ENABLE_CONTACTS__) {
      items.push({
        id: "contacts",
        label: __("Contacts", "pressedmail"),
        to: "/contacts",
        icon: ContactsHeaderIcon,
      });
    }
    items.push({
      id: "more",
      to: "/more",
      label: __("More", "pressedmail"),
      icon: MoreHorizontal,
    });
    return items;
  }, []);

  return (
    <PressedTooltipProvider>
      <ComposeNavigationBlocker />
      <div
        data-pm-app-frame
        className="relative w-full overflow-hidden bg-background font-sans transition-all duration-250 ease-out"
        style={frameStyle}>
        <PaneComposeProvider>
          <PressedOutUiProvider>
            {compactShellEnabled ? (
              <MobileAppShell
                tabBar={
                  <MobileTabBar
                    items={tabItems}
                    centerAction={{
                      label: __("Compose", "pressedmail"),
                      icon: EmailComposeNewIcon,
                      onAction: () => navigate("/compose"),
                    }}
                  />
                }>
                <main className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
                  <AutomationPauseNotice />
                  <div className="flex-1 min-h-0">
                    <LayoutNavigationShell>
                      <Outlet />
                    </LayoutNavigationShell>
                  </div>
                </main>
              </MobileAppShell>
            ) : (
              <div className="flex h-full w-full flex-col overflow-hidden">
                {/* Dynamic header - renders layout-specific header based on current layout */}
                <DynamicHeader />
                <main className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
                  <AutomationPauseNotice />
                  <div className="flex-1 min-h-0">
                    <LayoutNavigationShell>
                      <Outlet />
                    </LayoutNavigationShell>
                  </div>
                </main>
                <AppStatusBar
                  itemCount={statusItemCount}
                  unreadCount={statusUnreadCount}
                  syncStatus={statusSyncStatus}
                  connectionStatus={connectionStatus}
                  hasAccount={accounts.length > 0}
                  totalFolders={syncProgress.totalFolders}
                  syncedFolders={syncProgress.syncedFolders}
                  totalEmails={syncProgress.totalEmails}
                  syncedEmails={syncProgress.syncedEmails}
                  isSyncing={syncProgress.isSyncing}
                  isInitialSync={syncProgress.isInitialSync}
                  hasSyncError={syncProgress.hasSyncError}
                  autoSyncDisabled={autoSyncDisabled}
                  frontierIndex={syncProgress.frontierIndex}
                  frontierTotal={syncProgress.frontierTotal}
                  processTaskLabel={currentProcessTask?.label ?? null}
                  onToggleActivity={toggleActivityPanel}
                  activeTaskCount={activeTasks.length}
                  activityOpen={activityPanelOpen}
                />
              </div>
            )}
            {!compactShellEnabled && !showSetupWizard && speedDialPlacement && (
              <SpeedDialMenu
                placement={speedDialPlacement}
                size={SPEED_DIAL_MENU_SIZE_PRESETS.header}
                palette={SPEED_DIAL_MENU_PALETTE_PRESETS.surfacePrimary}
              />
            )}
          </PressedOutUiProvider>
        </PaneComposeProvider>
        <UpgradeModal />
        {/* Single activity/process panel for the whole app, driven by the shared
            open-state store so the header icon + the footer status-bar toggle both
            control it. Mounted at the frame root (not inside a trigger) so it works
            regardless of which header/shell is active. */}
        <ActivitySheet
          open={activityPanelOpen}
          onOpenChange={setActivityPanelOpen}
        />
      </div>
    </PressedTooltipProvider>
  );
};

export default ApplicationLayout;
