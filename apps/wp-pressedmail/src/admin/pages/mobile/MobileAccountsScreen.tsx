"use client";

import * as React from "react";
import { Plus, UserCircle2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { useAppContext } from "@/context/AppProvider";
import { cn } from "@/lib/utils";

/**
 * Full-content-area account selector reached from the inbox hamburger. Owns the
 * account-switching concern only, folders and tags live on the Folders tab, so
 * this screen never lists them. Selecting an account switches the active mailbox
 * and returns to the inbox; the shell header + bottom tab bar stay visible and
 * the standard Back button comes from MobileScreenHeader.
 */
export function MobileAccountsScreen() {
  const navigate = useNavigate();
  const {
    accounts,
    selectedAccount,
    setSelectedAccount,
    setIsAddAccount,
    setEditingAccount,
  } = useAppContext();

  const rows = React.useMemo(
    () =>
      (accounts ?? []).map((account) => {
        const email = String(account.email ?? "");
        const label = (account as { name?: string }).name;
        return { email, label };
      }),
    [accounts],
  );

  const handleSelect = (email: string) => {
    setSelectedAccount(email);
    navigate("/inbox");
  };

  return (
    <MobileScreen header={<MobileScreenHeader title="Accounts" />}>
      <div className="px-3 py-4">
        <ul role="list" className="flex flex-col gap-1">
          {rows.map((account) => {
            const active = account.email === selectedAccount;
            return (
              <li key={account.email}>
                <button
                  type="button"
                  aria-current={active ? "true" : undefined}
                  onClick={() => handleSelect(account.email)}
                  className={cn(
                    "pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left active:bg-muted",
                    active && "bg-primary/10 text-primary",
                  )}>
                  <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                    <UserCircle2 className="h-6 w-6" aria-hidden="true" />
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {account.label || account.email}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      {account.email}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
          {/* One slot. Offered while it is empty, gone once it is filled:
              changing mailbox is Disconnect then Connect, so the destructive
              step stays visible. */}
          {__SINGLE_MAILBOX__ && (accounts ?? []).length > 0 ? null : (
            <li>
              <button
                type="button"
                onClick={() => {
                  // Same pattern as email-connections-card: the setup wizard
                  // overlays the inbox route while isAddAccount is set.
                  setEditingAccount(null);
                  setIsAddAccount(true);
                  navigate("/inbox");
                }}
                className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 rounded-lg border border-dashed border-border px-3 py-2 text-left text-muted-foreground active:bg-muted">
                <Plus className="h-5 w-5" aria-hidden="true" />
                <span className="text-sm font-medium">
                  {__SINGLE_MAILBOX__ ? "Connect mailbox" : "Add account"}
                </span>
              </button>
            </li>
          )}
        </ul>
      </div>
    </MobileScreen>
  );
}

export default MobileAccountsScreen;
