"use client";

import { ChevronDown, Plus, Mail, User } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAppContext, PROVIDER_ICONS } from "@/context/AppProvider";
import { useInboxState } from "@/context/InboxContext";
import {
  useEntitlements,
  useFeatureAvailableOrPending,
} from "@/context/features/FeaturesContext";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import {
  getAccountNumericId,
  getAvailableAccountIds,
  getEffectiveConsolidatedAccountIds,
  normalizeConsolidatedAccountIds,
} from "@/lib/consolidated-account-scope";
import { isDefaultAccount } from "@/lib/default-account";
import CommonInboxIcon from "@/components/Icons/CommonInboxIcon";
import type { EmailAccount } from "@/types";

import {
  Badge,
  Button,
  Checkbox,
  cn,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuGroup,
} from "@kit/ui/plugin";

/**
 * Get provider icon from PROVIDER_ICONS based on account provider.
 * Never use account.icon as it can't be properly serialized from localStorage.
 */
function getProviderIcon(account: EmailAccount) {
  if (account.provider) {
    return (
      PROVIDER_ICONS[account.provider as keyof typeof PROVIDER_ICONS] ??
      PROVIDER_ICONS.default
    );
  }
  return PROVIDER_ICONS.default;
}

/**
 * Truncate text to specified length and append ellipsis if needed.
 */
function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength) + "...";
}

/**
 * Get display name from account.
 */
function getAccountDisplayName(account: EmailAccount): string | null {
  if (account.name) return account.name;
  if (account.first_name || account.last_name) {
    return [account.first_name, account.last_name].filter(Boolean).join(" ");
  }
  if (account.label && account.label !== account.email) return account.label;
  return null;
}

/**
 * Notification badge component for account-level new-mail count.
 */
function NewMailBadge({
  count,
  accountEmail,
}: {
  count: number;
  accountEmail: string;
}) {
  if (count <= 0) return null;

  const displayCount = count > 99 ? "99+" : count.toString();

  return (
    <Badge
      variant="outline"
      data-test={`account-new-mail-badge-${accountEmail}`}
      className="text-xs shrink-0 mt-0.5 border-primary/30 bg-primary text-primary-foreground shadow-sm"
      aria-label={`${count} new emails since last inbox visit`}>
      {displayCount}
    </Badge>
  );
}

export interface HeaderAccountSelectorProps {
  /**
   * New-mail count lookup shared from the header (one hoisted
   * `useAccountNotifications()` instance in `SharedHeader`). Defaults to a
   * zero function so isolated renders show no badges.
   */
  getNewCount?: (accountEmail: string) => number;
}

const ZERO_NEW_COUNT = () => 0;

export function HeaderAccountSelector({
  getNewCount = ZERO_NEW_COUNT,
}: HeaderAccountSelectorProps) {
  const navigate = useNavigate();
  const {
    accounts,
    setIsAddAccount,
    setEditingAccount,
    user,
    selectedAccount,
    setSelectedAccount,
    selectedConsolidatedAccountIds,
    setSelectedConsolidatedAccountIds,
    defaultAccountId,
  } = useAppContext();
  const { isLoading } = useInboxState();
  const { licenseValid } = useEntitlements();
  const combinedInboxAvailable = useFeatureAvailableOrPending("combined_inbox");

  const [open, setOpen] = useState(false);

  // Pending combined-inbox selection: checkbox edits are staged here and only
  // applied (→ a single inbox reload) when the user clicks the "Combined Inbox"
  // button. Synced from the applied selection each time the popover opens, so the
  // user always edits from the current scope.
  const [pendingIds, setPendingIds] = useState<number[]>(() =>
    normalizeConsolidatedAccountIds(selectedConsolidatedAccountIds),
  );
  useEffect(() => {
    if (open) {
      setPendingIds(
        normalizeConsolidatedAccountIds(selectedConsolidatedAccountIds),
      );
    }
  }, [open, selectedConsolidatedAccountIds]);
  const pendingIdSet = new Set(pendingIds);

  const currentValue = selectedAccount ?? user?.email ?? undefined;
  const isConsolidatedView = currentValue === CONSOLIDATED_INBOX_VALUE;
  const effectiveConsolidatedAccountIds = getEffectiveConsolidatedAccountIds(
    accounts,
    selectedConsolidatedAccountIds,
    defaultAccountId,
  );
  // "Loaded" = accounts the combined inbox is currently showing; "Selected" = what
  // the pending checkbox selection will load when "Combined Inbox" is clicked.
  const pendingEffectiveAccountIds = getEffectiveConsolidatedAccountIds(
    accounts,
    pendingIds,
    defaultAccountId,
  );
  const loadedCount = effectiveConsolidatedAccountIds.length;
  const selectedCount = pendingEffectiveAccountIds.length;
  const hasPendingCombinedChanges =
    [...effectiveConsolidatedAccountIds].sort((a, b) => a - b).join(",") !==
    [...pendingEffectiveAccountIds].sort((a, b) => a - b).join(",");
  const explicitConsolidatedAccountIds = normalizeConsolidatedAccountIds(
    selectedConsolidatedAccountIds,
  );
  // Per-account checkboxes reflect the PENDING selection (pendingIdSet), the staged
  // edits the user curates before clicking "Combined Inbox" to apply them.
  // `licenseValid` is seeded synchronously and the feature answer abstains while
  // the flags request is in flight, so a licensed user never watches the option
  // appear a second after the header does.
  const showConsolidatedOption =
    !__IS_FREE__ &&
    licenseValid &&
    combinedInboxAvailable &&
    accounts.length > 0;
  const activeAccount = isConsolidatedView
    ? null
    : accounts.find(
        (account) => account.email && account.email.toString() === currentValue,
      );

  const activeEmail = isConsolidatedView
    ? explicitConsolidatedAccountIds.length === 0
      ? "Combined Inbox"
      : `Combined Inbox (${effectiveConsolidatedAccountIds.length})`
    : (activeAccount?.email ?? "Select account");
  const truncatedEmail = truncateText(activeEmail, 40);
  const handleAddAccount = () => {
    setEditingAccount(null);
    setIsAddAccount(true);
    setOpen(false);
    navigate("/inbox");
  };

  const handleSelectAccount = (email: string) => {
    setSelectedAccount(email);
    // Navigate to inbox page when selecting an account
    navigate("/inbox");
  };

  // Combined-inbox edits stage into pendingIds (NO reload); the "Combined Inbox"
  // button commits them.
  const handleSelectAllConsolidated = () => {
    setPendingIds(getAvailableAccountIds(accounts));
  };

  const handleSelectNoneConsolidated = () => {
    // An empty selection resolves to the single default account (see
    // getEffectiveConsolidatedAccountIds), not "all accounts".
    setPendingIds([]);
  };

  const handleToggleConsolidatedAccount = (account: EmailAccount) => {
    const accountId = getAccountNumericId(account);
    if (accountId === null) {
      return;
    }
    setPendingIds((current) =>
      current.includes(accountId)
        ? current.filter((id) => id !== accountId)
        : [...current, accountId],
    );
  };

  // Apply the pending combined-inbox membership and open the combined view. This
  // commit to selectedConsolidatedAccountIds is what changes the scope and triggers
  // the single inbox reload (an identical pending → applied set is a no-op).
  const handleApplyCombinedInbox = () => {
    setSelectedConsolidatedAccountIds(pendingIds);
    setSelectedAccount(CONSOLIDATED_INBOX_VALUE);
    setOpen(false);
    navigate("/inbox");
  };

  // Show simple add account button if no accounts exist
  if (accounts.length === 0) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleAddAccount}
        title="Set up your first email account"
        data-test="add-first-account-button"
        className="flex items-center gap-1.5">
        <Mail className="h-4 w-4" aria-hidden="true" />
        <span className="text-sm">Add an email account</span>
      </Button>
    );
  }

  // Free is single-account: the header button is a direct shortcut to the
  // inbox instead of an account-switcher dropdown.
  if (__IS_FREE__) {
    return (
      <Button
        variant="outline"
        size="sm"
        disabled={isLoading}
        onClick={() => navigate("/inbox")}
        aria-label={`Go to inbox: ${activeEmail}`}
        data-test="account-selector-trigger"
        className={cn(
          "flex w-full min-w-80 items-center gap-1.5 border-primary/50 bg-background text-foreground",
        )}>
        <span className="relative shrink-0">
          <Mail className="h-4 w-4" aria-hidden="true" />
        </span>
        <span className="text-sm truncate">{truncatedEmail}</span>
      </Button>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen}>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isLoading}
          aria-label={`Current account: ${activeEmail}. Click to switch accounts.`}
          data-test="account-selector-trigger"
          className={cn(
            "flex w-full min-w-80 items-center gap-1.5 border-primary/50 bg-background text-foreground",
          )}>
          <span className="relative shrink-0">
            {isConsolidatedView ? (
              <CommonInboxIcon className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Mail className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          <span className="text-sm truncate">{truncatedEmail}</span>
          <ChevronDown
            className="h-3.5 w-3.5 text-muted-foreground shrink-0"
            aria-hidden="true"
          />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-80 border-primary/50">
        {/* Consolidated Inbox Option */}
        {showConsolidatedOption && (
          <>
            <DropdownMenuItem
              onClick={handleApplyCombinedInbox}
              data-test="consolidated-inbox-option"
              className={cn(
                "flex items-center gap-3 cursor-pointer py-2",
                isConsolidatedView && "bg-accent",
                hasPendingCombinedChanges &&
                  "bg-primary/5 ring-1 ring-primary/40",
              )}>
              <CommonInboxIcon className="h-4 w-4 shrink-0" />
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="text-sm font-medium">Combined Inbox</span>
                <Badge
                  variant="outline"
                  className="text-xs tabular-nums"
                  data-test="combined-inbox-count">
                  {hasPendingCombinedChanges
                    ? `${loadedCount} → ${selectedCount}`
                    : selectedCount}
                </Badge>
                {hasPendingCombinedChanges && (
                  <span className="text-[10px] font-medium text-primary">
                    click to load
                  </span>
                )}
              </div>
            </DropdownMenuItem>
            <div className="flex items-center gap-1.5 px-2 pb-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelectAllConsolidated();
                }}
                data-test="consolidated-select-all">
                Select all
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs text-muted-foreground hover:text-foreground"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  handleSelectNoneConsolidated();
                }}
                data-test="consolidated-select-none">
                Select none
              </Button>
            </div>
            <DropdownMenuSeparator />
          </>
        )}
        {/* Email Accounts list. The label + add control above and the
            consolidated controls stay pinned; only this list scrolls. */}
        <DropdownMenuGroup>
          <DropdownMenuLabel className="flex items-center justify-between gap-2 px-2 py-1.5">
            <span className="flex items-center gap-2 text-sm font-medium">
              <User className="h-4 w-4" aria-hidden="true" />
              Email Accounts
            </span>
            {/* One slot, so nothing to add alongside. */}
            {__SINGLE_MAILBOX__ ? null : (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleAddAccount}
                aria-label="Add email account"
                title="Add email account"
                data-test="add-account-button">
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </Button>
            )}
          </DropdownMenuLabel>

          <div className="max-h-[min(60vh,20rem)] overflow-y-auto">
            {accounts.map((account) => {
              const accountIcon = getProviderIcon(account);
              const accountEmail = account.email?.toString() ?? "";
              const accountId = getAccountNumericId(account);
              const isSelected = accountEmail === currentValue;
              const isIncluded =
                accountId !== null && pendingIdSet.has(accountId);
              const isDefault = isDefaultAccount(account, defaultAccountId);
              const displayName = getAccountDisplayName(account);
              const newCount = getNewCount(accountEmail);

              return (
                <div
                  key={accountEmail}
                  className={cn(
                    "flex items-start gap-2 px-2",
                    isSelected && "bg-accent",
                    isConsolidatedView && isIncluded && "bg-accent/40",
                  )}
                  data-test={`account-row-${accountEmail}`}>
                  {showConsolidatedOption && (
                    <label
                      className="mt-2.5 flex shrink-0 cursor-pointer items-center"
                      aria-label={`Include ${accountEmail} in combined inbox`}
                      onClick={(event) => event.stopPropagation()}
                      onPointerDown={(event) => event.stopPropagation()}>
                      <Checkbox
                        checked={isIncluded}
                        onCheckedChange={() =>
                          handleToggleConsolidatedAccount(account)
                        }
                        aria-label={`Include ${accountEmail} in combined inbox`}
                                                data-test={`consolidated-account-checkbox-${accountEmail}`}
                      />
                    </label>
                  )}
                  <DropdownMenuItem
                    onClick={() => handleSelectAccount(accountEmail)}
                    data-test={`account-option-${accountEmail}`}
                    className="flex flex-1 min-w-0 items-start gap-3 cursor-pointer py-2">
                    <span
                      className="flex items-center mt-0.5 [&_svg]:h-4 [&_svg]:w-4 [&_svg]:shrink-0"
                      aria-hidden="true">
                      {accountIcon}
                    </span>
                    <div className="flex flex-col flex-1 min-w-0 max-w-70">
                      <div className="flex items-center gap-1.5">
                        {displayName && (
                          <span className="text-sm font-medium wrap-break-word">
                            {displayName}
                          </span>
                        )}
                        {isDefault && (
                          <Badge
                            variant="secondary"
                            className="shrink-0 px-1.5 py-0 text-[10px] font-medium uppercase tracking-wide"
                            data-test={`account-default-badge-${accountEmail}`}>
                            Default
                          </Badge>
                        )}
                      </div>
                      <span
                        className={cn(
                          "text-sm wrap-break-word",
                          displayName && "text-muted-foreground",
                        )}>
                        {accountEmail}
                      </span>
                    </div>
                    <NewMailBadge
                      count={newCount}
                      accountEmail={accountEmail}
                    />
                  </DropdownMenuItem>
                </div>
              );
            })}
          </div>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default HeaderAccountSelector;
