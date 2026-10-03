"use client";
import * as React from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { MailComp } from "@/components/inbox/mail";
import { useTheme } from "@/components/themes";
import { useLayout } from "@/components/layouts";
import { cn } from "@/lib/utils";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import { MobileInboxLayout } from "@/components/mobile";
import { useMobileShellFlag } from "@/components/mobile-shell";
import { MobileInboxScreen } from "@/admin/pages/mobile/MobileInboxScreen";
import { useAppContext } from "@/context/AppProvider";
import { useOpenMessageFromUrl } from "@/hooks/useOpenMessageFromUrl";
import { useFolderOperations } from "@/layouts/shared/hooks/useFolderOperations";
import { getMessageIdentityKey } from "@/lib/message-identity";
import type { EmailMessage, MailProps } from "@/types";

interface ThemedMailLayoutProps extends Omit<
  MailProps,
  // `mails` goes with the demo fixture that used to feed it. Every layout
  // takes its messages from InboxContext and always has.
  "defaultLayout" | "navCollapsedSize" | "layoutVariant" | "mails"
> {
  className?: string;
}

/**
 * Brings the inbox to the folder a link names: `?folder=<name>&accountId=<id>`.
 *
 * A notification for a failed scheduled send, a header search hit and the like
 * link to a folder with no message in it. The folder is chosen by the same call
 * the sidebar makes, which is the one that knows Scheduled, Starred and
 * Important are views over another folder: they fetch the folder behind them
 * with their filter on, and the sidebar highlights them. Choosing them as a bare
 * folder name asked the mailbox for a folder called "Scheduled", which it does
 * not have, and showed an empty list with nothing highlighted.
 *
 * A component of its own, so the folder state this reads re-renders nothing but
 * itself.
 */
function OpenFolderFromUrl() {
  const { selectedNav, selectFolder } = useFolderOperations();
  const { accounts, selectedAccount, setSelectedAccount } = useAppContext();
  const [searchParams, setSearchParams] = useSearchParams();

  React.useEffect(() => {
    if (searchParams.has("openMessageId")) return;
    const requestedFolder = searchParams.get("folder")?.trim() ?? "";
    if (!requestedFolder) return;

    const requestedAccountId = Number(searchParams.get("accountId"));
    if (Number.isSafeInteger(requestedAccountId) && requestedAccountId > 0) {
      const requestedAccount = accounts.find(
        (account) => Number(account.id) === requestedAccountId,
      );
      const requestedEmail = requestedAccount?.email?.toString() ?? "";
      if (requestedEmail && requestedEmail !== selectedAccount) {
        setSelectedAccount(requestedEmail);
        return;
      }
    }

    if (requestedFolder.toLowerCase() !== selectedNav.toLowerCase()) {
      selectFolder(requestedFolder);
    }
    const next = new URLSearchParams(searchParams);
    next.delete("accountId");
    next.delete("folder");
    setSearchParams(next, { replace: true });
  }, [
    accounts,
    searchParams,
    selectFolder,
    selectedAccount,
    selectedNav,
    setSearchParams,
    setSelectedAccount,
  ]);

  return null;
}

/**
 * Themed Mail Layout Component
 *
 * Wraps the main mail component and applies layout and theme styling.
 * Layout (Gmail, Outlook, Roundcube) is now independent of color theme.
 */
export function ThemedMailLayout({
  className,
  ...mailProps
}: ThemedMailLayoutProps) {
  const { currentTheme, theme } = useTheme();
  const { currentLayout, layoutConfig } = useLayout();
  const isMobileOrTablet = useIsMobileOrTablet();
  const mobileShellEnabled = useMobileShellFlag();

  // The phone shell lists messages and reads them on a screen of their own, so a
  // link that selects one has to go on to that screen. The desktop panes already
  // show what is selected.
  const navigate = useNavigate();
  const phoneShell = isMobileOrTablet && mobileShellEnabled;
  const openPhoneReader = React.useCallback(
    (message: EmailMessage) => {
      const identity = getMessageIdentityKey(message);
      if (identity) navigate(`/inbox/m/${encodeURIComponent(identity)}`);
    },
    [navigate],
  );
  useOpenMessageFromUrl(phoneShell ? openPhoneReader : undefined);

  // Boot is handled by layout variants (e.g., DefaultLayout, PressedGLayout)
  // or InboxView for frontend. Do NOT boot here to avoid double initialization.

  // Phone-shell inbox screen: routed list + reader, sticky header, bottom tab bar
  if (isMobileOrTablet && mobileShellEnabled) {
    return (
      <div
        className={cn(
          "h-full min-h-0 w-full",
          theme.container,
          "mobile-layout",
          className,
        )}
        data-theme={currentTheme}
        data-layout={currentLayout}
        data-theme-variant="phone">
        <OpenFolderFromUrl />
        <MobileInboxScreen />
      </div>
    );
  }

  // Render mobile layout for smaller screens
  if (isMobileOrTablet) {
    return (
      <div
        className={cn(
          "h-full min-h-0 w-full",
          theme.container,
          "mobile-layout",
          className,
        )}
        data-theme={currentTheme}
        data-layout={currentLayout}
        data-theme-variant="mobile">
        <OpenFolderFromUrl />
        <MobileInboxLayout accounts={mailProps.accounts} />
      </div>
    );
  }

  return (
    <div
      className={cn(
        "h-full min-h-0 w-full",
        theme.container,
        `${currentLayout}-layout`,
        className,
      )}
      data-theme={currentTheme}
      data-layout={currentLayout}>
      <OpenFolderFromUrl />
      <MailComp
        {...mailProps}
        defaultLayout={layoutConfig.defaultPanelSizes}
        navCollapsedSize={layoutConfig.navCollapsedSize}
        layoutVariant={layoutConfig.layoutVariant}
        listVariant={layoutConfig.listVariant}
        pageSize={layoutConfig.pageSize ?? 50}
      />
    </div>
  );
}

/**
 * Theme-specific mail list wrapper
 */
export function ThemedMailList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  return (
    <div className={cn(theme.mailListContainer, className)}>{children}</div>
  );
}

/**
 * Theme-specific mail display wrapper
 */
export function ThemedMailDisplay({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  return (
    <div className={cn(theme.mailDisplayContainer, className)}>{children}</div>
  );
}

/**
 * Theme-specific navigation wrapper
 */
export function ThemedNavigation({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  return <div className={cn(theme.navContainer, className)}>{children}</div>;
}

/**
 * Theme-specific search wrapper
 */
export function ThemedSearch({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const { theme } = useTheme();

  return <div className={cn(theme.searchContainer, className)}>{children}</div>;
}
