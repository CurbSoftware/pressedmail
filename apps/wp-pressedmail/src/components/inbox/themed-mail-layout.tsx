"use client";
import * as React from "react";
import { useSearchParams } from "react-router-dom";
import { MailComp } from "@/components/inbox/mail";
import { useTheme } from "@/components/themes";
import { useLayout } from "@/components/layouts";
import { cn } from "@/lib/utils";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import { MobileInboxLayout } from "@/components/mobile";
import { useMobileShellFlag } from "@/components/mobile-shell";
import { MobileInboxScreen } from "@/admin/pages/mobile/MobileInboxScreen";
import {
  useFolderOperations,
  useInboxState,
  useMessageOperations,
} from "@/context/InboxContext";
import { useAppContext } from "@/context/AppProvider";
import { useOpenFromSearchParam } from "@/hooks/useOpenFromSearchParam";
import type { MailProps } from "@/types";

interface ThemedMailLayoutProps extends Omit<
  MailProps,
  "defaultLayout" | "navCollapsedSize" | "layoutVariant"
> {
  className?: string;
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
  const { messages } = useInboxState();
  const { selectMessage } = useMessageOperations();
  const { selectedFolder, selectFolder } = useFolderOperations();
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

    let cancelled = false;
    void (async () => {
      if (requestedFolder.toLowerCase() !== selectedFolder.toLowerCase()) {
        await selectFolder(requestedFolder);
      }
      if (cancelled) return;
      const next = new URLSearchParams(searchParams);
      next.delete("accountId");
      next.delete("folder");
      setSearchParams(next, { replace: true });
    })();

    return () => {
      cancelled = true;
    };
  }, [
    accounts,
    searchParams,
    selectFolder,
    selectedAccount,
    selectedFolder,
    setSearchParams,
    setSelectedAccount,
  ]);

  const handleOpenMessageFromUrl = React.useCallback(
    (id: number) => {
      const requestedAccountId = Number(searchParams.get("accountId"));
      if (Number.isSafeInteger(requestedAccountId) && requestedAccountId > 0) {
        const requestedAccount = accounts.find(
          (account) => Number(account.id) === requestedAccountId,
        );
        const requestedEmail = requestedAccount?.email?.toString() ?? "";
        if (requestedEmail && requestedEmail !== selectedAccount) {
          setSelectedAccount(requestedEmail);
          return false;
        }
      }

      const requestedFolder = searchParams.get("folder")?.trim() ?? "";
      if (
        requestedFolder &&
        requestedFolder.toLowerCase() !== selectedFolder.toLowerCase()
      ) {
        void selectFolder(requestedFolder);
        return false;
      }

      const match = messages.find((m) => Number(m.id) === id);
      if (match) {
        void selectMessage(match);
        return true;
      }
      return false;
    },
    [
      accounts,
      messages,
      searchParams,
      selectFolder,
      selectMessage,
      selectedAccount,
      selectedFolder,
      setSelectedAccount,
    ],
  );

  useOpenFromSearchParam("openMessageId", handleOpenMessageFromUrl, [
    "accountId",
    "folder",
  ]);

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
