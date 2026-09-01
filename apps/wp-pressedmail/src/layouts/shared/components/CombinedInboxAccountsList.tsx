"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";

import { cn } from "@/lib/utils";
import { getAccountNumericId } from "@/lib/consolidated-account-scope";
import { PROVIDER_ICONS } from "@/context/AppProvider";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import type { EmailAccount } from "@/types";

export interface CombinedInboxAccountsListProps {
  /** Account ids currently included in the combined inbox (scope.accountIds). */
  accountIds: number[];
  accounts: EmailAccount[];
  /** Switch to a single account's inbox by email. */
  onSelectAccount: (accountEmail: string) => void;
  isCollapsed?: boolean;
  className?: string;
}

/**
 * "Combined Inbox": the per-account drill-in list shown below the Mailbox
 * folders while a combined_inbox scope is active (default + pressedg layouts).
 * Clicking a row switches to that account's inbox. Renders nothing when no
 * accounts are in scope. PressedOut has its own equivalent accordion tree.
 */
export function CombinedInboxAccountsList({
  accountIds,
  accounts,
  onSelectAccount,
  isCollapsed = false,
  className,
}: CombinedInboxAccountsListProps) {
  const inScope = React.useMemo(() => {
    const ids = new Set(accountIds);
    return accounts.filter((account) => {
      const id = getAccountNumericId(account);
      return id !== null && ids.has(id);
    });
  }, [accountIds, accounts]);

  if (inScope.length === 0) {
    return null;
  }

  return (
    <div data-test="combined-inbox-accounts" className={cn("px-2", className)}>
      {!isCollapsed && (
        <div className="px-0 py-1">
          <span className="text-2xs font-medium uppercase tracking-wider text-muted-foreground">
            {__("Combined Inbox", "pressedmail")}
          </span>
        </div>
      )}
      <nav
        className={cn("grid gap-1", isCollapsed && "justify-center")}
        aria-label={__("Combined Inbox", "pressedmail")}>
        {inScope.map((account) => {
          const icon = account.provider
            ? (PROVIDER_ICONS[
                account.provider as keyof typeof PROVIDER_ICONS
              ] ?? PROVIDER_ICONS.default)
            : PROVIDER_ICONS.default;
          const label = account.label ?? account.email ?? "";

          const button = (
            <button
              type="button"
              key={account.email}
              data-test="combined-inbox-account"
              onClick={() => account.email && onSelectAccount(account.email)}
              title={label}
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground hover:bg-muted hover:text-foreground transition-colors [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0",
                isCollapsed && "w-9 justify-center px-0",
              )}>
              {icon}
              {!isCollapsed && <span className="truncate">{label}</span>}
            </button>
          );

          return isCollapsed ? (
            <PressedTooltip key={account.email} content={label} side="right">
              {button}
            </PressedTooltip>
          ) : (
            button
          );
        })}
      </nav>
    </div>
  );
}

export default CombinedInboxAccountsList;
