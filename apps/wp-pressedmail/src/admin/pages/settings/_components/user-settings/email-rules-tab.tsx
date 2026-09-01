"use client";

/**
 * Email Rules settings tab.
 *
 * Top-level personal settings tab that hosts the Auto Organize rule builder
 * (scoped to a chosen account, or all accounts). Email Sweep is done from the
 * inbox UI and no longer has a settings section here.
 */

import { useEffect, useMemo, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { __ } from "@wordpress/i18n";
import { Button } from "@kit/ui/plugin";
import { FilterRulesManager } from "@/components/settings/filter-rules/FilterRulesManager";
import { RunRulesNowButton } from "@/components/settings/filter-rules/RunRulesNowButton";
import { useSettingsHeaderAction } from "@/components/settings-ui";
import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "../underline-tabs";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

interface AccountOption {
  id: number;
  email: string;
}

const getApiUrl = (): string => window.pressedmailPlugin?.apiUrl || "";
export function EmailRulesTab() {
  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [accountsFailed, setAccountsFailed] = useState(false);
  const [reloadAccounts, setReloadAccounts] = useState(0);
  const [activeRulesTab, setActiveRulesTab] = useState("manual");
  const runRulesHeaderAction = useMemo(
    () => <RunRulesNowButton accountId={null} />,
    [],
  );
  const usingSharedHeaderActions = useSettingsHeaderAction(
    "email-rules:run",
    runRulesHeaderAction,
    10,
  );

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const response = await apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/accounts/get`,
          {
            credentials: "include",
          },
        );
        if (!response.ok) {
          if (!cancelled) setAccountsFailed(true);
          return;
        }
        const data = await response.json();
        // `/accounts/get` answers `{ success: true, accounts: [...] }`.
        // `Controllers\Accounts\Actions::get()` never emits a `status` key, so
        // gating on `status === "success"` left this list permanently empty and
        // every account-scoped rule rendered as "Unknown account". The list
        // itself is the only signal worth gating on, the same read
        // `AppProvider.loadAccounts` does.
        const loaded = data?.accounts ?? data?.data?.accounts;
        if (cancelled) return;
        if (!Array.isArray(loaded)) {
          setAccountsFailed(true);
          return;
        }
        setAccountsFailed(false);
        setAccounts(
          loaded.map((account: { id: number | string; email: string }) => ({
            id: Number(account.id),
            email: account.email,
          })),
        );
      } catch {
        // Without the account list, every folder picker is empty and a
        // move-to-folder rule can never be saved. Say so instead of rendering
        // an editor that quietly refuses to submit.
        if (!cancelled) setAccountsFailed(true);
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [reloadAccounts]);

  return (
    <div
      className="space-y-8"
      data-test="email-rules-tab"
      data-testid="email-rules-tab">
      {accountsFailed ? (
        <div
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          data-test="email-rules-accounts-error"
          data-testid="email-rules-accounts-error">
          <span>
            {__(
              "We could not load your email accounts. Rules that file mail into a folder need them, so those options stay unavailable until this works.",
              "pressedmail",
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setReloadAccounts((token) => token + 1)}
            data-test="email-rules-accounts-retry"
            data-testid="email-rules-accounts-retry">
            {__("Try again", "pressedmail")}
          </Button>
        </div>
      ) : null}

      {!usingSharedHeaderActions ? (
        <div className="flex justify-end">
          <RunRulesNowButton accountId={null} />
        </div>
      ) : null}

      <UnderlineTabs
        value={activeRulesTab}
        onValueChange={setActiveRulesTab}
        className="w-full">
        <UnderlineTabsList>
          <UnderlineTabsTrigger
            value="manual"
            data-test="email-rules-source-manual"
            data-testid="email-rules-source-manual">
            {__("User-created", "pressedmail")}
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger
            value="generated"
            data-test="email-rules-source-generated"
            data-testid="email-rules-source-generated">
            {__("Automatically generated", "pressedmail")}
          </UnderlineTabsTrigger>
        </UnderlineTabsList>
        <UnderlineTabsContent value="manual">
          <FilterRulesManager
            accountId={null}
            accountOptions={accounts}
            sourceFilter="manual"
          />
        </UnderlineTabsContent>
        <UnderlineTabsContent value="generated">
          <FilterRulesManager
            accountId={null}
            accountOptions={accounts}
            sourceFilter="sweep"
            allowCreate={false}
          />
        </UnderlineTabsContent>
      </UnderlineTabs>
    </div>
  );
}

export default EmailRulesTab;
