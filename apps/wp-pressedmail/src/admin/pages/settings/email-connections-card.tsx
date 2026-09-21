"use client";

import { __, sprintf } from "@wordpress/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Check,
  Loader2,
  Mail,
  PencilLine,
  PenTool,
  PlusCircle,
  Share2,
  Star,
  Trash2,
  Users,
} from "lucide-react";

import type { EmailAccount } from "@/types";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useAppContext } from "@/context/AppProvider";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import { useSignatures } from "@/context/signatures";
import { isDefaultAccount as matchesDefaultAccount } from "@/lib/default-account";
import type { Signature } from "@/types/signatures";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
} from "@kit/ui/plugin";
import {
  SettingsEmptyState,
  SettingsSkeleton,
  SettingsHeaderActionButton,
  useSettingsHeaderAction,
} from "@/components/settings-ui";
// Brand names are not translated; the generic entries are. iCloud and Proton
// Mail are offered by the setup flow (setup/providers.ts), so leaving them out
// here showed the raw slug "icloud" as a provider name.
const PROVIDER_LABELS: Record<string, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  yahoo: "Yahoo Mail",
  icloud: "iCloud",
  protonmail: "Proton Mail",
  custom: __("Custom IMAP/SMTP", "pressedmail"),
  other: __("Other", "pressedmail"),
};

const getProviderLabel = (provider?: string) => {
  if (!provider) return __("Email", "pressedmail");
  return PROVIDER_LABELS[provider] || provider;
};

const PERMISSION_LABELS: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  view_only: { label: __("View Only", "pressedmail"), variant: "outline" },
  reply: { label: __("Can Reply", "pressedmail"), variant: "secondary" },
  full: { label: __("Full Access", "pressedmail"), variant: "default" },
};

const getPermissionBadge = (permission?: string) => {
  if (!permission)
    return {
      label: __("Unknown", "pressedmail"),
      variant: "secondary" as const,
    };
  return (
    PERMISSION_LABELS[permission] || {
      label: permission,
      variant: "secondary" as const,
    }
  );
};

const getNameParts = (account: EmailAccount) => {
  if (account.first_name || account.last_name) {
    return {
      first: account.first_name ?? "",
      last: account.last_name ?? "",
    };
  }

  if (account.name) {
    const segments = account.name.split(/\s+/).filter(Boolean);
    if (segments.length === 0) {
      return { first: "", last: "" };
    }
    if (segments.length === 1) {
      return { first: segments[0] ?? "", last: "" };
    }
    return {
      first: segments[0] ?? "",
      last: segments.slice(1).join(" "),
    };
  }

  if (account.label && account.label !== account.email) {
    return { first: account.label, last: "" };
  }

  const [localPart] = account.email.split("@");
  return { first: localPart ?? "", last: "" };
};

const getDisplayName = (account: EmailAccount) => {
  const { first, last } = getNameParts(account);
  const name = [first, last].filter(Boolean).join(" ");
  return name || account.email;
};

const getAssignedSignature = (
  accountId: EmailAccount["id"],
  signatures: Signature[],
) =>
  signatures.find(
    (signature) =>
      signature.is_active &&
      signature.account_ids.some((id) => Number(id) === Number(accountId)),
  ) ?? null;

export function EmailConnectionsCard() {
  const {
    accounts,
    isLoading,
    error,
    removeAccount,
    setIsAddAccount,
    setEditingAccount,
    defaultAccountId,
    setDefaultAccount,
  } = useAppContext();
  const navigate = useNavigate();
  const location = useLocation();
  const isMobile = useIsMobileOrTablet();
  const {
    signatures,
    loading: signaturesLoading,
    updateSignature,
  } = useSignatures();

  const [hasLoaded, setHasLoaded] = useState<boolean>(accounts.length > 0);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<EmailAccount | null>(
    null,
  );
  const [pendingAccountId, setPendingAccountId] = useState<
    string | number | null
  >(null);
  const [pendingDefaultId, setPendingDefaultId] = useState<
    string | number | null
  >(null);
  const [signatureDialogAccount, setSignatureDialogAccount] =
    useState<EmailAccount | null>(null);
  const [signatureSaving, setSignatureSaving] = useState(false);
  const [signatureError, setSignatureError] = useState<string | null>(null);
  const { ownedAccounts, sharedAccounts } = useMemo(() => {
    const owned = accounts.filter((account) => !account.is_shared);
    const shared = accounts.filter((account) => account.is_shared);

    const sortAccounts = (accountList: EmailAccount[]) =>
      [...accountList].sort((a, b) =>
        a.email.localeCompare(b.email, undefined, { sensitivity: "base" }),
      );

    return {
      ownedAccounts: sortAccounts(owned),
      sharedAccounts: sortAccounts(shared),
    };
  }, [accounts]);

  const activeSignatures = useMemo(
    () =>
      signatures
        .filter((signature) => signature.is_active)
        .sort((a, b) => {
          const sortDelta = a.sort_order - b.sort_order;
          if (sortDelta !== 0) {
            return sortDelta;
          }

          return a.name.localeCompare(b.name, undefined, {
            sensitivity: "base",
          });
        }),
    [signatures],
  );

  // Mark the account list as loaded without modifying existing data.
  useEffect(() => {
    if (!isLoading) {
      setHasLoaded(true);
    }
  }, [isLoading]);

  const handleAddConnection = useCallback(() => {
    setEditingAccount(null);
    setIsAddAccount(true);
    navigate("/inbox", {
      state: { setupReturnTo: `${location.pathname}${location.search}` },
    });
  }, [
    location.pathname,
    location.search,
    navigate,
    setEditingAccount,
    setIsAddAccount,
  ]);

  const openEditDialog = (account: EmailAccount) => {
    setEditingAccount(account);
    setIsAddAccount(true);
    navigate("/inbox", {
      state: { setupReturnTo: `${location.pathname}${location.search}` },
    });
  };

  const openDeleteDialog = (account: EmailAccount) => {
    setSelectedAccount(account);
    setDeleteOpen(true);
  };

  const resetDialogs = () => {
    setSelectedAccount(null);
    setDeleteOpen(false);
    setPendingAccountId(null);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAccount) return;
    setPendingAccountId(selectedAccount.id);

    let success = false;

    try {
      await removeAccount(selectedAccount.id);
      success = true;
    } catch (err) {
      // Errors are surfaced via toasts; keep the dialog open for retry.
    } finally {
      setPendingAccountId(null);
      if (success) {
        resetDialogs();
      }
    }
  };

  const handleSetDefault = useCallback(
    async (account: EmailAccount) => {
      setPendingDefaultId(account.id);
      try {
        await setDefaultAccount(account.id);
      } catch (err) {
        // Errors are surfaced via toasts in setDefaultAccount.
      } finally {
        setPendingDefaultId(null);
      }
    },
    [setDefaultAccount],
  );

  const openSignatureDialog = (account: EmailAccount) => {
    setSignatureError(null);
    setSignatureDialogAccount(account);
  };

  const closeSignatureDialog = () => {
    if (signatureSaving) {
      return;
    }

    setSignatureDialogAccount(null);
    setSignatureError(null);
  };

  const handleSignatureSelect = async (
    account: EmailAccount,
    signature: Signature | null,
  ) => {
    const currentSignature = getAssignedSignature(account.id, activeSignatures);

    if (currentSignature?.id === signature?.id) {
      closeSignatureDialog();
      return;
    }

    setSignatureSaving(true);
    setSignatureError(null);

    try {
      // One call, whichever way it goes: the payload is the signature's whole
      // account set. Assigning adds this account to it, so a signature already
      // serving another account keeps serving it and now serves this one too.
      // "No signature" takes this account back out. Either way the server
      // releases whatever else was bound to the account, so there is no clear
      // step and no window where the account has none.
      const target = signature ?? currentSignature;
      if (!target) {
        closeSignatureDialog();
        return;
      }

      const assigned = target.account_ids.map(Number);
      const accountIds = signature
        ? Array.from(new Set([...assigned, Number(account.id)]))
        : assigned.filter((id) => id !== Number(account.id));

      const result = await updateSignature(target.id, {
        account_ids: accountIds,
      });

      if (!result.success) {
        throw new Error(
          result.error ??
            __("Failed to update signature assignment.", "pressedmail"),
        );
      }

      setSignatureDialogAccount(null);
    } catch (err) {
      setSignatureError(
        err instanceof Error
          ? err.message
          : __("Failed to update signature assignment.", "pressedmail"),
      );
    } finally {
      setSignatureSaving(false);
    }
  };

  const disableActions = pendingAccountId !== null || (!hasLoaded && isLoading);

  // One mailbox, one slot. This build offers the connect action while the slot
  // is empty and nothing once it is filled: there is no list to add to, so
  // there is no "add another". Changing mailbox is Disconnect then Connect,
  // which keeps the destructive step visible and deliberate. The guard is a
  // build-time constant, so on a single-mailbox build the branch below is gone
  // from the bundle rather than hidden at runtime.
  const mailboxSlotFilled = __SINGLE_MAILBOX__ && accounts.length > 0;

  const accountHeaderAction = useMemo(
    () =>
      mailboxSlotFilled ? null : (
        <SettingsHeaderActionButton
          icon={PlusCircle}
          label={
            __SINGLE_MAILBOX__
              ? __("Connect mailbox", "pressedmail")
              : __("Add Account", "pressedmail")
          }
          onClick={handleAddConnection}
          dataTest="account-add"
        />
      ),
    [handleAddConnection, mailboxSlotFilled],
  );
  const usingSharedHeaderActions = useSettingsHeaderAction(
    "accounts:add",
    accountHeaderAction,
    10,
  );

  return (
    <Card className="rounded-none border-0 bg-transparent ring-0 shadow-none sm:rounded-lg sm:bg-card sm:ring-1 sm:shadow-sm">
      {!usingSharedHeaderActions ? (
        <CardHeader className="px-0 sm:px-6">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="space-y-1">
              <h3 className="text-lg font-medium text-foreground">
                {__SINGLE_MAILBOX__
                  ? __("Your Mailbox", "pressedmail")
                  : __("Your Email Accounts", "pressedmail")}
              </h3>
            </div>
            {mailboxSlotFilled ? null : (
              <Button
                onClick={handleAddConnection}
                data-test="account-add"
                data-testid="account-add"
                className="w-full sm:w-auto">
                <PlusCircle className="mr-2 h-4 w-4" />
                {__SINGLE_MAILBOX__
                  ? __("Connect mailbox", "pressedmail")
                  : __("Add Account", "pressedmail")}
              </Button>
            )}
          </div>
        </CardHeader>
      ) : null}
      <CardContent className="space-y-4 px-0 sm:px-6">
        {error ? (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        {signatureError ? (
          <Alert variant="destructive">
            <AlertDescription>{signatureError}</AlertDescription>
          </Alert>
        ) : null}

        {ownedAccounts.length === 0 && sharedAccounts.length === 0 ? (
          !hasLoaded ? (
            <SettingsSkeleton
              label={__("Loading your existing connections", "pressedmail")}
              rows={2}
            />
          ) : (
            <SettingsEmptyState
              icon={<Mail className="h-5 w-5" />}
              title={__("No email connections yet", "pressedmail")}
              description={
                hasLoaded
                  ? __(
                      "Add your first email address to start syncing messages.",
                      "pressedmail",
                    )
                  : __("Loading your existing connections...", "pressedmail")
              }
            />
          )
        ) : (
          <div className="space-y-6">
            {/* Owned Accounts Section */}
            {ownedAccounts.length > 0 && (
              <div>
                {isMobile ? (
                  <ul
                    data-pm-mobile-cards
                    role="list"
                    className="divide-y divide-border">
                    {ownedAccounts.map((account) => {
                      const provider = getProviderLabel(account.provider);
                      const isPending = pendingAccountId === account.id;
                      const isDefault = matchesDefaultAccount(
                        account,
                        defaultAccountId,
                      );
                      const isSettingDefault = pendingDefaultId === account.id;
                      const assignedSignature = getAssignedSignature(
                        account.id,
                        activeSignatures,
                      );

                      return (
                        <li
                          key={account.id}
                          data-test="email-account-card"
                          data-testid="email-account-card"
                          className="py-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-1.5">
                                <span
                                  className="block break-words text-sm font-medium text-foreground"
                                  title={getDisplayName(account)}>
                                  {getDisplayName(account)}
                                </span>
                                {isDefault ? (
                                  <Badge
                                    variant="secondary"
                                    className="shrink-0"
                                    data-test={`account-default-badge-${account.email}`}>
                                    {__("Default", "pressedmail")}
                                  </Badge>
                                ) : null}
                              </div>
                              <span
                                className="block break-all text-sm text-muted-foreground"
                                title={account.email}>
                                {account.email}
                              </span>
                              <span className="block text-xs text-muted-foreground">
                                {provider}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2">
                            <AccountSignatureControl
                              accountId={account.id}
                              signature={assignedSignature}
                              loading={signaturesLoading}
                              disabled={disableActions || signatureSaving}
                              onClick={() => openSignatureDialog(account)}
                            />
                          </div>

                          {!isDefault ? (
                            <div className="mt-2">
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full"
                                onClick={() => handleSetDefault(account)}
                                disabled={disableActions || isSettingDefault}
                                data-test={`account-set-default-${account.email}`}>
                                {isSettingDefault ? (
                                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                ) : (
                                  <Star className="mr-2 h-4 w-4" />
                                )}
                                {__("Set as default", "pressedmail")}
                              </Button>
                            </div>
                          ) : null}

                          <div className="mt-3 flex items-center justify-end gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              aria-label={sprintf(
                                __("Edit email account %s", "pressedmail"),
                                account.email,
                              )}
                              className="pm-touch-target h-11 w-11 p-0"
                              onClick={() => openEditDialog(account)}
                              disabled={disableActions}
                              data-test={`account-edit-${account.email}`}
                              data-testid={`account-edit-${account.email}`}>
                              <PencilLine className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              aria-label={sprintf(
                                __("Delete email account %s", "pressedmail"),
                                account.email,
                              )}
                              className="pm-touch-target h-11 w-11 p-0"
                              onClick={() => openDeleteDialog(account)}
                              disabled={disableActions}
                              data-test={`account-delete-${account.email}`}
                              data-testid={`account-delete-${account.email}`}>
                              {isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="w-full overflow-x-auto rounded-lg border">
                    <table className="w-full min-w-[820px] table-auto divide-y divide-border text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                            {__("Display Name", "pressedmail")}
                          </th>
                          <th className="whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                            {__("Email Address", "pressedmail")}
                          </th>
                          <th className="w-[1%] whitespace-nowrap px-4 py-3 pr-6 font-medium text-muted-foreground">
                            {__("Provider", "pressedmail")}
                          </th>
                          <th className="w-[1%] whitespace-nowrap px-4 py-3 font-medium text-muted-foreground">
                            {__("Signature", "pressedmail")}
                          </th>
                          <th className="w-[1%] whitespace-nowrap px-4 py-3 text-right font-medium text-muted-foreground">
                            {__("Actions", "pressedmail")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {ownedAccounts.map((account) => {
                          const provider = getProviderLabel(account.provider);
                          const isPending = pendingAccountId === account.id;
                          const isDefault = matchesDefaultAccount(
                            account,
                            defaultAccountId,
                          );
                          const isSettingDefault =
                            pendingDefaultId === account.id;
                          const assignedSignature = getAssignedSignature(
                            account.id,
                            activeSignatures,
                          );

                          return (
                            <tr
                              key={account.id}
                              data-test="email-account-row"
                              data-testid="email-account-row">
                              <td className="max-w-[18rem] overflow-hidden whitespace-nowrap px-4 py-3">
                                <div className="flex min-w-0 items-center gap-1.5">
                                  <span
                                    className="block min-w-0 truncate text-sm font-medium text-foreground"
                                    title={getDisplayName(account)}>
                                    {getDisplayName(account)}
                                  </span>
                                  {isDefault ? (
                                    <Badge
                                      variant="secondary"
                                      className="shrink-0"
                                      data-test={`account-default-badge-${account.email}`}>
                                      {__("Default", "pressedmail")}
                                    </Badge>
                                  ) : null}
                                </div>
                              </td>
                              <td className="max-w-[24rem] overflow-hidden whitespace-nowrap px-4 py-3 text-muted-foreground">
                                <span
                                  className="block truncate"
                                  title={account.email}>
                                  {account.email}
                                </span>
                              </td>
                              <td className="whitespace-nowrap px-4 py-3 pr-6">
                                <Badge variant="outline">{provider}</Badge>
                              </td>
                              <td className="max-w-[14rem] overflow-hidden whitespace-nowrap px-4 py-3">
                                <AccountSignatureControl
                                  accountId={account.id}
                                  signature={assignedSignature}
                                  loading={signaturesLoading}
                                  disabled={disableActions || signatureSaving}
                                  onClick={() => openSignatureDialog(account)}
                                />
                              </td>
                              <td className="w-[1%] whitespace-nowrap px-4 py-3 text-right">
                                <div className="inline-flex items-center gap-2">
                                  <PressedTooltip
                                    content={
                                      isDefault
                                        ? __("Default account", "pressedmail")
                                        : __("Set as default", "pressedmail")
                                    }
                                    side="top">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      aria-label={
                                        isDefault
                                          ? sprintf(
                                              __(
                                                "%s is the default account",
                                                "pressedmail",
                                              ),
                                              account.email,
                                            )
                                          : sprintf(
                                              __(
                                                "Set %s as the default account",
                                                "pressedmail",
                                              ),
                                              account.email,
                                            )
                                      }
                                      className={
                                        isDefault
                                          ? "h-9 w-9 p-0 text-primary disabled:opacity-100 data-[disabled]:opacity-100"
                                          : "h-9 w-9 p-0"
                                      }
                                      onClick={
                                        isDefault
                                          ? undefined
                                          : () => handleSetDefault(account)
                                      }
                                      disabled={
                                        isDefault ||
                                        disableActions ||
                                        isSettingDefault
                                      }
                                      data-test={`account-set-default-${account.email}`}>
                                      {isSettingDefault && !isDefault ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Star
                                          className={
                                            isDefault
                                              ? "h-4 w-4 fill-current"
                                              : "h-4 w-4"
                                          }
                                          data-test={
                                            isDefault
                                              ? `account-default-star-${account.email}`
                                              : undefined
                                          }
                                        />
                                      )}
                                    </Button>
                                  </PressedTooltip>
                                  <PressedTooltip
                                    content={__("Edit", "pressedmail")}
                                    side="top">
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      aria-label={sprintf(
                                        __(
                                          "Edit email account %s",
                                          "pressedmail",
                                        ),
                                        account.email,
                                      )}
                                      className="h-9 w-9 p-0"
                                      onClick={() => openEditDialog(account)}
                                      disabled={disableActions}
                                      data-test={`account-edit-${account.email}`}
                                      data-testid={`account-edit-${account.email}`}>
                                      <PencilLine className="h-4 w-4" />
                                    </Button>
                                  </PressedTooltip>
                                  <PressedTooltip
                                    content={__("Delete", "pressedmail")}
                                    side="top">
                                    <Button
                                      variant="destructive"
                                      size="sm"
                                      aria-label={sprintf(
                                        __(
                                          "Delete email account %s",
                                          "pressedmail",
                                        ),
                                        account.email,
                                      )}
                                      className="h-9 w-9 p-0"
                                      onClick={() => openDeleteDialog(account)}
                                      disabled={disableActions}
                                      data-test={`account-delete-${account.email}`}
                                      data-testid={`account-delete-${account.email}`}>
                                      {isPending ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Trash2 className="h-4 w-4" />
                                      )}
                                    </Button>
                                  </PressedTooltip>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* Shared Accounts Section */}
            {sharedAccounts.length > 0 && (
              <div>
                <h3 className="mb-3 text-lg font-medium text-foreground flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  {__("Shared Mailboxes", "pressedmail")}
                </h3>
                {isMobile ? (
                  <ul data-pm-mobile-cards role="list" className="space-y-2">
                    {sharedAccounts.map((account) => {
                      const provider = getProviderLabel(account.provider);
                      const permissionBadge = getPermissionBadge(
                        account.permission,
                      );

                      return (
                        <li
                          key={account.id}
                          data-test="shared-email-account-card"
                          data-testid="shared-email-account-card"
                          className="rounded-lg border p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <span className="block truncate text-sm font-medium text-foreground">
                                {getDisplayName(account)}
                              </span>
                              <span className="block truncate text-sm text-muted-foreground">
                                {account.email}
                              </span>
                            </div>
                            <Badge
                              variant="secondary"
                              className="flex shrink-0 items-center gap-1">
                              <Share2 className="h-3 w-3" />
                              {__("Shared", "pressedmail")}
                            </Badge>
                          </div>
                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{provider}</Badge>
                            <Badge variant={permissionBadge.variant}>
                              {permissionBadge.label}
                            </Badge>
                          </div>
                          <p className="mt-2 text-sm text-muted-foreground">
                            {sprintf(
                              __("Shared by %s", "pressedmail"),
                              account.owner_name ||
                                __("Unknown", "pressedmail"),
                            )}
                          </p>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <div className="overflow-hidden rounded-lg border">
                    <table className="min-w-full divide-y divide-border text-sm">
                      <thead className="bg-muted/50 text-left">
                        <tr>
                          <th className="px-4 py-3 font-medium text-muted-foreground">
                            {__("Display Name", "pressedmail")}
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">
                            {__("Email Address", "pressedmail")}
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">
                            {__("Provider", "pressedmail")}
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">
                            {__("Access Level", "pressedmail")}
                          </th>
                          <th className="px-4 py-3 font-medium text-muted-foreground">
                            {__("Shared By", "pressedmail")}
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border">
                        {sharedAccounts.map((account) => {
                          const provider = getProviderLabel(account.provider);
                          const permissionBadge = getPermissionBadge(
                            account.permission,
                          );

                          return (
                            <tr key={account.id}>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium text-foreground">
                                    {getDisplayName(account)}
                                  </span>
                                  <Badge
                                    variant="secondary"
                                    className="flex items-center gap-1">
                                    <Share2 className="h-3 w-3" />
                                    {__("Shared", "pressedmail")}
                                  </Badge>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {account.email}
                              </td>
                              <td className="px-4 py-3 pr-6">
                                <Badge variant="outline">{provider}</Badge>
                              </td>
                              <td className="px-4 py-3">
                                <Badge variant={permissionBadge.variant}>
                                  {permissionBadge.label}
                                </Badge>
                              </td>
                              <td className="px-4 py-3 text-muted-foreground">
                                {account.owner_name ||
                                  __("Unknown", "pressedmail")}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>

      <Dialog
        open={deleteOpen}
        onOpenChange={(open) => (open ? setDeleteOpen(true) : resetDialogs())}>
        <DialogContent
          className="max-w-md"
          data-test="account-delete-dialog"
          data-testid="account-delete-dialog">
          <DialogHeader>
            <DialogTitle>
              <DialogTitleRow variant="destructive">
                <Trash2 />
                <span>{__("Remove email connection", "pressedmail")}</span>
              </DialogTitleRow>
            </DialogTitle>
            <DialogDescription>
              {sprintf(
                __(
                  "This will remove the connection for %s. You can reconnect it at any time through the onboarding flow.",
                  "pressedmail",
                ),
                selectedAccount?.email ?? "",
              )}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={resetDialogs}
              disabled={pendingAccountId !== null}
              data-test="account-delete-cancel"
              data-testid="account-delete-cancel">
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={pendingAccountId !== null}
              data-test="account-delete-confirm"
              data-testid="account-delete-confirm">
              {pendingAccountId ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {__("Delete connection", "pressedmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={signatureDialogAccount !== null}
        onOpenChange={(open) => {
          if (!open) {
            closeSignatureDialog();
          }
        }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              <DialogTitleRow>
                <PenTool />
                <span>{__("Select signature", "pressedmail")}</span>
              </DialogTitleRow>
            </DialogTitle>
            <DialogDescription>
              {sprintf(
                __("Choose the signature for %s.", "pressedmail"),
                signatureDialogAccount?.email ?? "",
              )}
            </DialogDescription>
          </DialogHeader>

          {signatureDialogAccount ? (
            <div className="space-y-2">
              {activeSignatures.length > 0 ? (
                <Button
                  type="button"
                  variant={
                    getAssignedSignature(
                      signatureDialogAccount.id,
                      activeSignatures,
                    )
                      ? "secondary"
                      : "default"
                  }
                  className="w-full justify-start text-base font-medium"
                  disabled={signatureSaving}
                  onClick={() =>
                    handleSignatureSelect(signatureDialogAccount, null)
                  }>
                  {__("No signature", "pressedmail")}
                </Button>
              ) : null}

              {activeSignatures.length > 0 ? (
                activeSignatures.map((signature) => {
                  const isAssigned =
                    getAssignedSignature(
                      signatureDialogAccount.id,
                      activeSignatures,
                    )?.id === signature.id;

                  return (
                    <Button
                      key={signature.id}
                      type="button"
                      variant={isAssigned ? "default" : "outline"}
                      className="w-full justify-start gap-2 whitespace-nowrap"
                      disabled={signatureSaving}
                      onClick={() =>
                        handleSignatureSelect(signatureDialogAccount, signature)
                      }>
                      {isAssigned ? (
                        <Check className="h-4 w-4 flex-shrink-0" />
                      ) : (
                        <PenTool className="h-4 w-4 flex-shrink-0" />
                      )}
                      <span className="truncate">{signature.name}</span>
                    </Button>
                  );
                })
              ) : (
                <p className="text-sm text-muted-foreground">
                  {__(
                    "Create a signature in Personal Settings first.",
                    "pressedmail",
                  )}
                </p>
              )}
            </div>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={closeSignatureDialog}
              disabled={signatureSaving}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setSignatureDialogAccount(null);
                navigate("/settings?tab=signatures");
              }}
              disabled={signatureSaving}>
              {__("Manage signatures", "pressedmail")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function AccountSignatureControl({
  accountId,
  signature,
  loading,
  disabled,
  onClick,
}: {
  accountId: string | number;
  signature: Signature | null;
  loading: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const label = loading
    ? __("Loading", "pressedmail")
    : signature?.name || __("Signature", "pressedmail");
  const isAssigned = signature !== null;

  return (
    <div className="flex w-full min-w-0 items-center gap-1">
      <Button
        type="button"
        variant={isAssigned ? "default" : "outline"}
        size="sm"
        className="min-w-0 flex-1"
        onClick={onClick}
        disabled={disabled || loading}
        data-test={`account-signature-action-${accountId}`}
        data-testid={`account-signature-action-${accountId}`}>
        <span className="truncate">{label}</span>
      </Button>
    </div>
  );
}
