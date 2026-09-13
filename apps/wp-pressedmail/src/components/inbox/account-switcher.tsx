"use client";

import { useCallback, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Layers, Plus } from "lucide-react";
import { __, sprintf } from "@wordpress/i18n";

import { cn } from "@/lib/utils";
import { getEffectiveConsolidatedAccountIds } from "@/lib/consolidated-account-scope";

import { useAppContext, PROVIDER_ICONS } from "@/context/AppProvider";
import { useInboxState } from "@/context/InboxContext";
import {
  useEntitlements,
  useFeatureAvailableOrPending,
} from "@/context/features/FeaturesContext";
import type { EmailAccount } from "@/types";

import {
  Badge,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Separator,
} from "@kit/ui/plugin";

/** Sentinel value for the "add account" action in the Select. */
const ADD_ACCOUNT_VALUE = "__add_account__";

/** Special value for consolidated inbox view. */
export const CONSOLIDATED_INBOX_VALUE = "all";
interface AccountSwitcherProps {
  isCollapsed: boolean;
  accounts: EmailAccount[];
}

export function AccountSwitcher({
  isCollapsed,
  accounts,
}: AccountSwitcherProps) {
  const {
    user,
    selectedAccount,
    selectedConsolidatedAccountIds,
    setSelectedAccount,
    setIsAddAccount,
  } = useAppContext();
  const { isLoading } = useInboxState();
  const { licenseValid } = useEntitlements();
  const combinedInboxAvailable = useFeatureAvailableOrPending("combined_inbox");
  const queryClient = useQueryClient();
  const switchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 150ms debounce: rapid arrow-key cycling through the Select doesn't fire a
  // refetch for every transient value. Each new choice resets the timer; only
  // the last selection lands as the effective account.
  const commitSelectedAccount = useCallback(
    (value: string) => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
      switchTimerRef.current = setTimeout(() => {
        // Cancel in-flight search queries scoped to the previous account so
        // they don't race the new account's first fetch.
        void queryClient.cancelQueries({ queryKey: ["search"] });
        setSelectedAccount(value);
        switchTimerRef.current = null;
      }, 150);
    },
    [queryClient, setSelectedAccount],
  );

  useEffect(() => {
    return () => {
      if (switchTimerRef.current) clearTimeout(switchTimerRef.current);
    };
  }, []);

  const currentValue = selectedAccount ?? user?.email ?? undefined;
  const isConsolidatedView = currentValue === CONSOLIDATED_INBOX_VALUE;
  const effectiveConsolidatedAccountIds = getEffectiveConsolidatedAccountIds(
    accounts,
    selectedConsolidatedAccountIds,
  );
  const activeAccount = isConsolidatedView
    ? null
    : accounts.find((account) => account.email?.toString() === currentValue);

  /**
   * Get provider icon from PROVIDER_ICONS based on account provider.
   * Never use account.icon as it can't be properly serialized from localStorage.
   */
  const activeIcon = isConsolidatedView ? (
    <Layers className="h-4 w-4" />
  ) : activeAccount?.provider ? (
    (PROVIDER_ICONS[activeAccount.provider as keyof typeof PROVIDER_ICONS] ??
    PROVIDER_ICONS.default)
  ) : (
    PROVIDER_ICONS.default
  );
  const activeLabel = isConsolidatedView
    ? sprintf(
        __("Combined inbox (%d)", "pressedmail"),
        effectiveConsolidatedAccountIds.length,
      )
    : (activeAccount?.label ??
      activeAccount?.email ??
      __("Select account", "pressedmail"));

  // Show consolidated inbox option for Pro users with combined_inbox feature.
  // `licenseValid` is seeded synchronously and the feature answer abstains
  // while the flags request is in flight, so a licensed user never watches the
  // option appear a second after the inbox does.
  const showConsolidatedOption =
    !__IS_FREE__ &&
    licenseValid &&
    combinedInboxAvailable &&
    accounts.length > 0;

  return (
    <Select
      disabled={isLoading}
      defaultValue={currentValue}
      onValueChange={(value) => {
        if (value === ADD_ACCOUNT_VALUE) {
          setIsAddAccount(true);
          return;
        }
        commitSelectedAccount(value);
      }}>
      <SelectTrigger
        className={cn(
          "flex items-center gap-2 [&>span]:line-clamp-1 [&>span]:flex [&>span]:w-full [&>span]:items-center [&>span]:gap-1 [&>span]:truncate [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
          isCollapsed &&
            "flex h-9 w-9 shrink-0 items-center justify-center p-0 [&>span]:w-auto [&>svg]:hidden",
        )}
        aria-label={__("Select account", "pressedmail")}>
        <SelectValue placeholder={__("Switch accounts", "pressedmail")}>
          {activeIcon}
          <span
            className={cn("ml-2 text-sm truncate", isCollapsed && "hidden")}>
            {activeLabel}
            {activeAccount?.is_shared && (
              <Badge variant="secondary" className="ml-2 text-xs">
                {__("Shared", "pressedmail")}
              </Badge>
            )}
          </span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {/* Consolidated inbox option for Pro users with multiple accounts */}
        {showConsolidatedOption && (
          <>
            <SelectItem
              key={CONSOLIDATED_INBOX_VALUE}
              value={CONSOLIDATED_INBOX_VALUE}
              data-test="consolidated-inbox-option">
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                <Layers className="h-4 w-4" />
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium">
                    {__("Combined inbox", "pressedmail")}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {effectiveConsolidatedAccountIds.length}
                  </Badge>
                </div>
              </div>
            </SelectItem>
            <Separator className="my-1" />
          </>
        )}
        {accounts.map((account) => {
          const accountIcon = account?.provider
            ? (PROVIDER_ICONS[
                account.provider as keyof typeof PROVIDER_ICONS
              ] ?? PROVIDER_ICONS.default)
            : PROVIDER_ICONS.default;

          return (
            <SelectItem key={account.email} value={account.email}>
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 [&_svg]:text-foreground">
                {accountIcon}
                <div className="flex items-center gap-2">
                  <span>{account.email}</span>
                  {account.is_shared && (
                    <Badge variant="secondary" className="text-xs">
                      {__("Shared", "pressedmail")}
                    </Badge>
                  )}
                </div>
              </div>
            </SelectItem>
          );
        })}
        {/* "Add another" needs a list to add to. This build has one slot. */}
        {__SINGLE_MAILBOX__ ? null : (
          <>
            <Separator className="my-1" />
            <SelectItem
              value={ADD_ACCOUNT_VALUE}
              className="cursor-pointer"
              data-test="add-account-button">
              <div className="flex items-center gap-3 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0 text-primary">
                <Plus className="h-4 w-4" />
                <span>{__("Add another email account", "pressedmail")}</span>
              </div>
            </SelectItem>
          </>
        )}
      </SelectContent>
    </Select>
  );
}
