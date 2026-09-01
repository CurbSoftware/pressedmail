"use client";

import * as React from "react";
import { Plus, UserCircle2 } from "lucide-react";

import { cn } from "@/lib/utils";

import { MobileSheet } from "./MobileSheet";

export interface MobileAccountSummary {
  id: string;
  email: string;
  label?: string;
  unread?: number;
  avatarUrl?: string;
}

export interface MobileAccountSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  accounts: MobileAccountSummary[];
  selectedAccountId: string | null;
  onSelectAccount: (id: string) => void;
  onAddAccount: () => void;
}

/**
 * Bottom-sheet account switcher. Phase A renders the structural skeleton;
 * Phase B will wire it to the same context that HeaderAccountSelector uses
 * via a shared <AccountList /> presentational component.
 */
export function MobileAccountSheet({
  open,
  onOpenChange,
  accounts,
  selectedAccountId,
  onSelectAccount,
  onAddAccount,
}: MobileAccountSheetProps) {
  return (
    <MobileSheet open={open} onOpenChange={onOpenChange} title="Accounts">
      <ul role="list" className="flex flex-col gap-1">
        {accounts.map((account) => {
          const active = account.id === selectedAccountId;
          return (
            <li key={account.id}>
              <button
                type="button"
                aria-current={active ? "true" : undefined}
                onClick={() => {
                  onSelectAccount(account.id);
                  onOpenChange(false);
                }}
                className={cn(
                  "pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-muted",
                  active && "bg-primary/10 text-primary",
                )}>
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  {account.avatarUrl ? (
                    <img
                      src={account.avatarUrl}
                      alt=""
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <UserCircle2 className="h-6 w-6" aria-hidden="true" />
                  )}
                </span>
                <span className="flex flex-1 flex-col">
                  <span className="text-sm font-medium">
                    {account.label || account.email}
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    {account.email}
                  </span>
                </span>
                {account.unread ? (
                  <span className="rounded-full bg-primary px-2 text-[11px] font-semibold text-primary-foreground">
                    {account.unread > 99 ? "99+" : account.unread}
                  </span>
                ) : null}
              </button>
            </li>
          );
        })}
        {/* One slot, so there is nothing to add alongside the mailbox. */}
        {__SINGLE_MAILBOX__ ? null : (
          <li>
            <button
              type="button"
              onClick={() => {
                onAddAccount();
                onOpenChange(false);
              }}
              className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-left text-muted-foreground active:bg-muted">
              <Plus className="h-5 w-5" aria-hidden="true" />
              <span className="text-sm font-medium">Add account</span>
            </button>
          </li>
        )}
      </ul>
    </MobileSheet>
  );
}

export default MobileAccountSheet;
