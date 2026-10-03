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
import { RuleRunHistory } from "@/components/settings/filter-rules/RuleRunHistory";
import {
  SharedInboxRules,
  sharedMailboxesLabel,
  type SharedRuleAccount,
} from "@/components/settings/filter-rules/pro-rule-options.active";
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
  const [sharedAccounts, setSharedAccounts] = useState<SharedRuleAccount[]>([]);
  const [accountsFailed, setAccountsFailed] = useState(false);
  const [reloadAccounts, setReloadAccounts] = useState(0);
  const [activeRulesTab, setActiveRulesTab] = useState("manual");
  const [ruleCount, setRuleCount] = useState<number | undefined>(undefined);
  // It runs your own rules. On the shared tab that read as running the
  // shared mailbox's rules, which a viewer is told they cannot touch.
  const runRulesHeaderAction = useMemo(
    () =>
      !__IS_FREE__ && activeRulesTab === "shared" ? null : (
        <RunRulesNowButton accountId={null} ruleCount={ruleCount} />
      ),
    [activeRulesTab, ruleCount],
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
        // A user's own rules cover their own mailboxes. A shared mailbox's
        // rules belong to its owner and live on the shared-inbox tab (Pro).
        type LoadedAccount = {
          id: number | string;
          email: string;
          share?: { role?: string; owner_name?: string };
        };
        setAccounts(
          (loaded as LoadedAccount[])
            .filter((account) => __IS_FREE__ || !account.share)
            .map((account) => ({
              id: Number(account.id),
              email: account.email,
            })),
        );
        if (!__IS_FREE__) {
          setSharedAccounts(
            (loaded as LoadedAccount[])
              .filter((account) => account.share?.role)
              .map((account) => ({
                id: Number(account.id),
                email: account.email,
                role: account.share?.role as SharedRuleAccount["role"],
                ownerName: String(account.share?.owner_name ?? ""),
              })),
          );
        }
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

      {!usingSharedHeaderActions &&
      (__IS_FREE__ || activeRulesTab !== "shared") ? (
        <div className="flex justify-end">
          <RunRulesNowButton accountId={null} ruleCount={ruleCount} />
        </div>
      ) : null}

      <UnderlineTabs
        value={activeRulesTab}
        onValueChange={setActiveRulesTab}
        className="w-full">
        {/* Hugs its tabs instead of a full-width box with the tabs bunched left. */}
        <UnderlineTabsList className="w-fit max-w-full">
          <UnderlineTabsTrigger
            value="manual"
            data-test="email-rules-source-manual"
            data-testid="email-rules-source-manual">
            {__("Yours", "pressedmail")}
          </UnderlineTabsTrigger>
          <UnderlineTabsTrigger
            value="generated"
            data-test="email-rules-source-generated"
            data-testid="email-rules-source-generated">
            {__("Generated", "pressedmail")}
          </UnderlineTabsTrigger>
          {!__IS_FREE__ &&
          sharedMailboxesLabel() &&
          sharedAccounts.length > 0 ? (
            <UnderlineTabsTrigger
              value="shared"
              data-test="email-rules-source-shared"
              data-testid="email-rules-source-shared">
              {sharedMailboxesLabel()}
            </UnderlineTabsTrigger>
          ) : null}
          <UnderlineTabsTrigger
            value="activity"
            data-test="email-rules-activity"
            data-testid="email-rules-activity">
            {__("Activity", "pressedmail")}
          </UnderlineTabsTrigger>
        </UnderlineTabsList>
        <UnderlineTabsContent
          value="manual"
          forceMount
          className="data-[state=inactive]:hidden">
          <FilterRulesManager
            accountId={null}
            accountOptions={accounts}
            sourceFilter="manual"
            onRuleCountChange={setRuleCount}
            // Generated rules come from sweeps, so that tab offers no Create rule.
            headerActionHidden={
              (!__IS_FREE__ && activeRulesTab === "shared") ||
              activeRulesTab === "generated"
            }
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
        {!__IS_FREE__ &&
        sharedMailboxesLabel() &&
        sharedAccounts.length > 0 ? (
          <UnderlineTabsContent value="shared">
            <SharedInboxRules accountOptions={sharedAccounts} />
          </UnderlineTabsContent>
        ) : null}
        <UnderlineTabsContent value="activity">
          <RuleRunHistory />
        </UnderlineTabsContent>
      </UnderlineTabs>
    </div>
  );
}

export default EmailRulesTab;
