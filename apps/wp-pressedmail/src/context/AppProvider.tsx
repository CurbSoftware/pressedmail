import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  accountCreateROuteApi,
  accountRemoveROuteApi,
  accountsLoadRouteApi,
  accountSetDefaultRouteApi,
  accountUpdateRouteApi,
} from "./Strings";
import { appMessage } from "./toast";
import useLocalStorage from "./useLocalStorage";
import { apiFetch, apiForm } from "@/lib/api-client";
import {
  accountIdSetEquals,
  getAvailableAccountIds,
  normalizeConsolidatedAccountIds,
} from "@/lib/consolidated-account-scope";
import { resolveServerAccountId } from "@/lib/account-id";
import { reconcileRemovedAccounts } from "@/lib/account-state-cleanup";
import {
  resolveDefaultAccountId,
  stampDefaultAccountState,
} from "@/lib/default-account";
import type {
  EmailAccount,
  EmailMessage,
  AppContextType,
  AppUser,
  AccountData,
  AccountUpdateInput,
} from "@/types";
import { PhishingProvider } from "@/context/phishing/PhishingContext";

// Provider icons for different email services
export const PROVIDER_ICONS = {
  gmail: (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Gmail</title>
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z"
        fill="currentColor"
      />
    </svg>
  ),
  outlook: (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Microsoft Outlook</title>
      <path
        d="M7.88 12.04q0 .45-.11.87-.1.41-.33.74-.22.33-.58.52-.37.2-.87.2t-.86-.2q-.36-.19-.58-.52-.22-.33-.33-.74-.1-.42-.1-.87 0-.44.1-.86.11-.41.33-.74.22-.33.58-.52.36-.19.86-.19t.87.19q.35.19.58.52.22.33.33.74.11.42.11.86zm-3.24 0q0 .58.22.94.21.35.61.35.4 0 .61-.35.22-.36.22-.94 0-.59-.22-.95-.21-.35-.61-.35-.4 0-.61.35-.22.36-.22.95zM24 12v9.38q0 .46-.33.8-.33.32-.8.32H7.13q-.46 0-.8-.33-.32-.33-.32-.8V18.9q.18.08.36.14.18.07.36.12.18.05.36.09.18.03.36.04.18.01.36.01q.48 0 .9-.13.44-.14.8-.4.37-.25.65-.6.28-.35.47-.78.19-.44.3-.94.1-.5.1-1.06q0-.56-.1-1.06-.11-.5-.3-.94-.19-.43-.47-.78-.28-.35-.65-.6-.36-.26-.8-.4-.42-.13-.9-.13-.18 0-.36.01-.18.01-.36.04-.18.04-.36.09-.18.05-.36.12-.18.06-.36.14V3.62q0-.46.33-.8.33-.32.8-.32h16.54q.46 0 .8.33.32.33.32.8V12z"
        fill="currentColor"
      />
    </svg>
  ),
  yahoo: (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Yahoo!</title>
      <path
        d="M0 0v24h24V0H0zm6.252 4.629l2.817 6.552h.021l2.836-6.552h2.158l-3.896 8.463v4.279H8.102v-4.279L4.096 4.629h2.156zm7.691 0h2.084v10.742h3.865v1.9H13.943V4.629z"
        fill="currentColor"
      />
    </svg>
  ),
  custom: (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Email</title>
      <path
        d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-.904.732-1.636 1.636-1.636h20.728c.904 0 1.636.732 1.636 1.636zM1.636 6.545v11.819h20.728V6.545L12 13.09 1.636 6.545z"
        fill="currentColor"
      />
    </svg>
  ),
  default: (
    <svg role="img" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
      <title>Vercel</title>
      <path d="M24 22.525H0l12-21.05 12 21.05z" fill="currentColor" />
    </svg>
  ),
};

export const AppContext = React.createContext<AppContextType | undefined>(
  undefined,
);

export function useAppContext(): AppContextType {
  const context = React.useContext(AppContext);

  if (!context) {
    throw new Error("useAppContext must be used within an AppProvider");
  }

  return context;
}

const managedAccountErrorMessage = (code: unknown): string => {
  switch (code) {
    case "DOMAIN_POLICY_DISABLED":
    case "DOMAIN_POLICY_FORBIDDEN":
    case "DOMAIN_NOT_ALLOWED":
      return "This managed email account is not allowed by the current site policy.";
    case "DOMAIN_CONFIG_INVALID":
      return "Managed email setup is temporarily unavailable.";
    default:
      return "Managed account setup failed. Please try again.";
  }
};

interface CanonicalManagedAccount {
  id: unknown;
  email: string;
  provider: "custom";
  first_name?: string | null;
  last_name?: string | null;
  name?: string | null;
  user_id?: number;
}

const isCanonicalManagedAccount = (
  value: unknown,
): value is CanonicalManagedAccount => {
  if (!value || typeof value !== "object") return false;
  const account = value as Record<string, unknown>;
  const optionalNamesValid = [
    account.first_name,
    account.last_name,
    account.name,
  ].every(
    (field) =>
      field === undefined || field === null || typeof field === "string",
  );

  return (
    typeof account.email === "string" &&
    /^[^\s@]+@[^\s@]+$/.test(account.email) &&
    account.provider === "custom" &&
    optionalNamesValid
  );
};

interface AppProviderProps {
  children: React.ReactNode;
}

export default function AppProvider({ children }: AppProviderProps) {
  const [user, setUser] = useLocalStorage<AppUser | null>("user", null, {
    principalScoped: true,
  });
  const [accounts, setAccounts] = useLocalStorage<EmailAccount[]>(
    "accounts",
    [],
    { principalScoped: true },
  );
  const [selectedAccount, setSelectedAccount] = useLocalStorage<string | null>(
    "selectedAccount",
    null,
    { principalScoped: true },
  );
  const [selectedConsolidatedAccountIds, setSelectedConsolidatedAccountIds] =
    useLocalStorage<number[]>("selectedConsolidatedAccountIds", [], {
      principalScoped: true,
    });
  const [defaultAccountId, setDefaultAccountId] = useLocalStorage<
    number | null
  >("defaultAccountId", null, { principalScoped: true });
  const [isLoading, setIsLoading] = React.useState<boolean>(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isAddAccount, setIsAddAccount] = React.useState<boolean>(false);
  const [editingAccount, setEditingAccount] =
    React.useState<EmailAccount | null>(null);
  const [selectedMessage, setSelectedMessage] =
    React.useState<EmailMessage | null>(null);
  const [numberOfMessages, setNumberOfMessages] = React.useState<number>(0);
  const reloadAccountsRef = React.useRef<() => Promise<void>>(async () => {});

  React.useEffect(() => {
    if (typeof (user as unknown) === "boolean") {
      setUser(null);
    }
  }, [user, setUser]);

  React.useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const userInfo = window.pressedmailPlugin?.userInfo;

    if (!userInfo) {
      return;
    }

    setUser((previous) => {
      const merged: AppUser = {
        id: userInfo.userId ?? previous?.id ?? 0,
        name: userInfo.displayName || userInfo.username || previous?.name || "",
        email: userInfo.email || previous?.email || "",
        hasCompletedSetup: previous?.hasCompletedSetup ?? false,
        avatar: userInfo.avatar || previous?.avatar,
        username: userInfo.username || previous?.username,
      };

      if (!previous) {
        return merged;
      }

      if (
        previous.id !== merged.id ||
        previous.name !== merged.name ||
        previous.email !== merged.email ||
        previous.avatar !== merged.avatar ||
        previous.username !== merged.username
      ) {
        return {
          ...previous,
          ...merged,
          hasCompletedSetup:
            previous.hasCompletedSetup || merged.hasCompletedSetup,
        };
      }

      return previous;
    });
  }, [setUser]);

  React.useEffect(() => {
    setUser((previous) => {
      if (!previous) {
        return previous;
      }

      const completed = accounts.length > 0;

      if (previous.hasCompletedSetup === completed) {
        return previous;
      }

      return {
        ...previous,
        hasCompletedSetup: completed,
      };
    });
  }, [accounts.length, setUser]);

  React.useEffect(() => {
    setSelectedConsolidatedAccountIds((previous) => {
      const normalized = normalizeConsolidatedAccountIds(previous);
      const available = new Set(getAvailableAccountIds(accounts));
      const pruned = normalized.filter((id) => available.has(id));

      if (accountIdSetEquals(normalized, pruned)) {
        return previous;
      }

      return pruned;
    });
  }, [accounts, setSelectedConsolidatedAccountIds]);

  // Keep the default-account pointer and per-account flags valid: when the stored
  // default no longer references an owned account, fall back to the oldest owned
  // account, mirroring the server's deterministic fallback. The next /accounts/get
  // refresh reconciles to the authoritative server value.
  React.useEffect(() => {
    const nextState = stampDefaultAccountState(accounts, defaultAccountId);

    if (nextState.defaultAccountId !== defaultAccountId) {
      setDefaultAccountId(nextState.defaultAccountId);
    }

    if (nextState.accounts !== accounts) {
      setAccounts(nextState.accounts);
    }
  }, [accounts, defaultAccountId, setAccounts, setDefaultAccountId]);

  // Check if user has completed setup (has at least one account)
  const hasCompletedSetup = React.useMemo(() => {
    if (accounts.length > 0) {
      return true;
    }

    return Boolean(user?.hasCompletedSetup);
  }, [accounts.length, user?.hasCompletedSetup]);

  // Add a new account
  const addAccount = React.useCallback(
    async (accountData: AccountData): Promise<EmailAccount> => {
      setIsLoading(true);
      setError(null);
      const managed = accountData.managed === true;

      try {
        // Call WordPress REST API to create account
        const response = await apiFetch(accountCreateROuteApi, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(
            managed
              ? {
                  managed: true,
                  localPart: accountData.localPart,
                  domain: accountData.domain,
                  senderName: accountData.senderName,
                  ...(accountData.imapPassword !== undefined
                    ? {
                        imapPassword: accountData.imapPassword,
                        smtpPassword: accountData.smtpPassword,
                      }
                    : { password: accountData.password }),
                }
              : {
                  email: accountData.email,
                  firstName:
                    accountData.displayName.split(" ")[0] ||
                    accountData.displayName,
                  lastName: accountData.displayName.split(" ")[1] || "",
                  appPassword: accountData.password,
                  provider: accountData.provider,
                  imapHost: accountData.imapHost,
                  imapPort: accountData.imapPort,
                  imapSecurity: accountData.imapSecurity,
                  imapUsername: accountData.imapUsername,
                  imapPassword: accountData.imapPassword,
                  smtpHost: accountData.smtpHost,
                  smtpPort: accountData.smtpPort,
                  smtpSecurity: accountData.smtpSecurity,
                  smtpUsername: accountData.smtpUsername,
                  smtpPassword: accountData.smtpPassword,
                  useSeparateCredentials: accountData.useSeparateCredentials,
                  useOAuth: accountData.useOAuth,
                },
          ),
        });

        if (!response.ok) {
          const errorData = await response.json();
          const message = managed
            ? managedAccountErrorMessage(
                errorData?.code ?? errorData?.data?.code,
              )
            : errorData.message || `HTTP error! status: ${response.status}`;
          throw Object.assign(new Error(message), {
            safeManagedMessage: managed,
          });
        }

        const result = await response.json();

        if (result.status === "error") {
          const message = managed
            ? managedAccountErrorMessage(result.code ?? result.data?.code)
            : result.message;
          throw Object.assign(new Error(message), {
            safeManagedMessage: managed,
          });
        }

        const newAccount = result.data?.user || result;
        if (managed && !isCanonicalManagedAccount(newAccount)) {
          throw Object.assign(
            new Error(managedAccountErrorMessage(undefined)),
            { safeManagedMessage: true },
          );
        }
        const accountEmail = managed ? newAccount.email : accountData.email;
        const accountProvider: EmailAccount["provider"] = managed
          ? newAccount.provider
          : accountData.provider;
        const displayName =
          (managed
            ? accountData.senderName
            : accountData.displayName
          )?.trim() ||
          (managed
            ? `${accountData.localPart}@${accountData.domain}`
            : accountData.email);
        const [firstName, ...restName] = displayName.split(/\s+/);
        const lastName = restName.join(" ");

        // Never fabricate a clock-based account id: a millisecond-epoch value
        // is not a real account row, so every messages/get/{id} request 404s.
        // Require a valid server id and fail loudly otherwise.
        const resolvedAccountId = resolveServerAccountId(newAccount.id);
        if (resolvedAccountId === null) {
          throw new Error(
            "Account was created but the server did not return a valid account id. Please refresh.",
          );
        }

        // Create account object with proper structure
        const accountToAdd: EmailAccount = {
          id: resolvedAccountId,
          label: newAccount.first_name || firstName || displayName,
          email: accountEmail,
          provider: accountProvider,
          icon:
            PROVIDER_ICONS[accountProvider as keyof typeof PROVIDER_ICONS] ||
            PROVIDER_ICONS.default,
          isActive: true,
          first_name: newAccount.first_name || firstName || undefined,
          last_name: newAccount.last_name || (lastName ? lastName : undefined),
          name: newAccount.name || displayName,
        };

        // Show success feedback BEFORE updating accounts state.
        // setAccounts triggers MessagesProvider effects that start IMAP loading,
        // which can fail and show error toasts. Queue the success toast first.
        appMessage(
          __(
            "Account added. Initial sync is running in the background.",
            "pressedmail",
          ),
          "success",
        );
        setIsAddAccount(false);

        setAccounts((prev) => {
          // The user's first account auto-becomes their default (mirrors the
          // server's ensure_default_for_user). Optimistic so the badge/scope
          // are correct before the next /accounts/get refresh.
          const preferredDefaultId =
            prev.length === 0 ? resolvedAccountId : defaultAccountId;
          const nextState = stampDefaultAccountState(
            [...prev, accountToAdd],
            preferredDefaultId,
          );

          if (prev.length === 0) {
            setDefaultAccountId(nextState.defaultAccountId);
          }

          return nextState.accounts;
        });

        // Ensure user state reflects setup completion and persists WP data
        setUser((previous) => {
          const wpUser =
            typeof window !== "undefined"
              ? window.pressedmailPlugin?.userInfo
              : undefined;

          if (!previous) {
            return {
              id: newAccount.user_id || wpUser?.userId || Date.now(),
              name: wpUser?.displayName || wpUser?.username || displayName,
              email:
                wpUser?.email ||
                (managed
                  ? `${accountData.localPart}@${accountData.domain}`
                  : accountData.email),
              hasCompletedSetup: true,
              avatar: wpUser?.avatar,
              username: wpUser?.username,
            };
          }

          if (previous.hasCompletedSetup) {
            return previous;
          }

          return {
            ...previous,
            hasCompletedSetup: true,
          };
        });

        return accountToAdd;
      } catch (err: any) {
        console.error("Error adding account:", err);
        setError(
          managed
            ? err?.safeManagedMessage === true
              ? err.message
              : managedAccountErrorMessage(undefined)
            : err.message || "Failed to add account",
        );
        appMessage("Failed to add account", "error");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultAccountId, setUser, setAccounts, setDefaultAccountId],
  );

  // Clear selected message
  const clearSelectedMessage = React.useCallback(() => {
    setSelectedMessage(null);
  }, []);

  // Remove an account
  const removeAccount = React.useCallback(
    async (accountId: string | number): Promise<void> => {
      setIsLoading(true);
      setError(null);
      const formData = new FormData();
      formData.append("id", accountId.toString());

      try {
        const response = await apiForm(accountRemoveROuteApi, formData);

        if ((response as any).status !== "success") {
          appMessage("Failed to remove account", "error");
          return;
        }

        setAccounts((prev) => {
          const nextState = stampDefaultAccountState(
            prev.filter((account) => account.id !== accountId),
            defaultAccountId,
          );
          setDefaultAccountId(nextState.defaultAccountId);
          return nextState.accounts;
        });
        setSelectedAccount(null);
        if ((response as any)?.message || (response as any)?.data?.message) {
          appMessage(
            (response as any)?.message || (response as any)?.data?.message,
            "success",
          );
        }
      } catch (err: any) {
        console.error("Error removing account:", err);
        appMessage("Failed to remove account", "error");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [defaultAccountId, setAccounts, setDefaultAccountId, setSelectedAccount],
  );

  const onComplete = React.useCallback(
    async (formData: AccountData): Promise<EmailAccount> => {
      try {
        const newAccount = await addAccount(formData);
        return newAccount;
      } catch (error) {
        console.error("Error completing setup:", error);
        throw error;
      }
    },
    [addAccount],
  );

  const removeSelectedAccount = React.useCallback(
    async (selectedAccountEmail: string): Promise<void> => {
      if (!selectedAccountEmail) return;
      const accountToRemove = accounts.find(
        (account) => account.email?.toString() === selectedAccountEmail,
      );
      if (!accountToRemove) return;
      await removeAccount(accountToRemove.id);
    },
    [accounts, removeAccount],
  );

  // Update an account
  const updateAccount = React.useCallback(
    async (
      accountId: string | number,
      updates: AccountUpdateInput,
    ): Promise<any> => {
      setIsLoading(true);
      setError(null);

      try {
        if (updates.managed === true) {
          const managedForm = new FormData();
          managedForm.append("id", accountId.toString());
          managedForm.append("managed", "true");
          managedForm.append("localPart", updates.localPart);
          managedForm.append("domain", updates.domain);
          managedForm.append("senderName", updates.senderName);
          if (updates.imapPassword !== undefined) {
            managedForm.append("imapPassword", updates.imapPassword);
            managedForm.append("smtpPassword", updates.smtpPassword);
          } else {
            managedForm.append("password", updates.password);
          }

          const managedResponse = await apiForm(
            accountUpdateRouteApi,
            managedForm,
          );
          if ((managedResponse as any)?.status !== "success") {
            throw Object.assign(
              new Error(
                managedAccountErrorMessage(
                  (managedResponse as any)?.code ??
                    (managedResponse as any)?.data?.code,
                ),
              ),
              { safeManagedMessage: true },
            );
          }

          await reloadAccountsRef.current();
          appMessage("Account updated successfully", "success");
          return managedResponse;
        }

        const accountBeforeUpdate = accounts.find(
          (account) => account.id === accountId,
        );
        const formData = new FormData();
        formData.append("id", accountId.toString());

        if (updates.firstName !== undefined) {
          formData.append("firstName", updates.firstName);
        }

        if (updates.lastName !== undefined) {
          formData.append("lastName", updates.lastName);
        }

        if (updates.email !== undefined) {
          formData.append("email", updates.email);
        }

        if (updates.provider !== undefined) {
          formData.append("provider", updates.provider);
        }

        if (updates.appPassword) {
          formData.append("appPassword", updates.appPassword);
        }

        if (updates.useSeparateCredentials !== undefined) {
          formData.append(
            "useSeparateCredentials",
            String(updates.useSeparateCredentials),
          );
        }

        if (updates.useOAuth !== undefined) {
          formData.append("useOAuth", String(updates.useOAuth));
        }

        if (updates.imapHost !== undefined) {
          formData.append("imapHost", updates.imapHost);
        }

        if (updates.imapPort !== undefined) {
          formData.append("imapPort", String(updates.imapPort));
        }

        if (updates.imapSecurity !== undefined) {
          formData.append("imapSecurity", updates.imapSecurity);
        }

        if (updates.imapUsername !== undefined) {
          formData.append("imapUsername", updates.imapUsername);
        }

        if (updates.imapPassword) {
          formData.append("imapPassword", updates.imapPassword);
        }

        if (updates.smtpHost !== undefined) {
          formData.append("smtpHost", updates.smtpHost);
        }

        if (updates.smtpPort !== undefined) {
          formData.append("smtpPort", String(updates.smtpPort));
        }

        if (updates.smtpSecurity !== undefined) {
          formData.append("smtpSecurity", updates.smtpSecurity);
        }

        if (updates.smtpUsername !== undefined) {
          formData.append("smtpUsername", updates.smtpUsername);
        }

        if (updates.smtpPassword) {
          formData.append("smtpPassword", updates.smtpPassword);
        }

        const response = await apiForm(accountUpdateRouteApi, formData);

        if ((response as any)?.status !== "success") {
          const message =
            (response as any)?.message || "Failed to update account";
          throw new Error(message);
        }

        setAccounts((prev) =>
          prev.map((account) => {
            if (account.id !== accountId) {
              return account;
            }

            const updatedFirst = updates.firstName ?? account.first_name;
            const updatedLast = updates.lastName ?? account.last_name;

            return {
              ...account,
              email: updates.email ?? account.email,
              provider: updates.provider ?? account.provider,
              first_name: updatedFirst,
              last_name: updatedLast,
              label: updatedFirst || account.label,
              name:
                [updatedFirst, updatedLast].filter(Boolean).join(" ") ||
                account.name ||
                account.email,
              imapHost: updates.imapHost ?? account.imapHost,
              imapPort: updates.imapPort ?? account.imapPort,
              imapSecurity:
                (updates.imapSecurity as any) ?? account.imapSecurity,
              imapUsername: updates.imapUsername ?? account.imapUsername,
              smtpHost: updates.smtpHost ?? account.smtpHost,
              smtpPort: updates.smtpPort ?? account.smtpPort,
              smtpSecurity:
                (updates.smtpSecurity as any) ?? account.smtpSecurity,
              smtpUsername: updates.smtpUsername ?? account.smtpUsername,
              useSeparateCredentials:
                updates.useSeparateCredentials ??
                account.useSeparateCredentials,
            };
          }),
        );

        if (updates.email && accountBeforeUpdate?.email) {
          const nextEmail = updates.email;
          setSelectedAccount((current) =>
            current && current === accountBeforeUpdate.email
              ? nextEmail
              : current,
          );
        }

        const successMessage =
          (response as any)?.message || "Account updated successfully";
        appMessage(successMessage, "success");

        return response;
      } catch (err: any) {
        console.error("Error updating account:", err);
        const message =
          updates.managed === true
            ? err?.safeManagedMessage === true
              ? err.message
              : managedAccountErrorMessage(undefined)
            : err?.message || "Failed to update account";
        setError(message);
        appMessage(message, "error");
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [accounts, setAccounts, setSelectedAccount],
  );

  // Set the user's default account. Optimistically updates context, persists to
  // the server, then refreshes the accounts list so per-account is_default flags
  // stay authoritative. Reverts the optimistic value on failure.
  const setDefaultAccount = React.useCallback(
    async (accountId: number | string): Promise<void> => {
      const numericId = Number(accountId);
      if (!Number.isInteger(numericId) || numericId <= 0) {
        return;
      }

      const previousDefaultId = defaultAccountId;
      const previousAccounts = accounts;
      const optimisticState = stampDefaultAccountState(accounts, numericId);
      setDefaultAccountId(optimisticState.defaultAccountId);
      setAccounts(optimisticState.accounts);

      try {
        const response = await apiFetch(accountSetDefaultRouteApi, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ account_id: numericId }),
        });

        const result = await response.json().catch(() => null);

        if (!response.ok || result?.status === "error") {
          throw new Error(
            result?.message ||
              result?.data?.message ||
              `HTTP error! status: ${response.status}`,
          );
        }

        const confirmedId = Number(result?.data?.default_account_id);
        const requestedDefaultId =
          Number.isInteger(confirmedId) && confirmedId > 0
            ? confirmedId
            : numericId;
        const confirmedState = stampDefaultAccountState(
          optimisticState.accounts,
          requestedDefaultId,
        );
        setDefaultAccountId(confirmedState.defaultAccountId);
        setAccounts(confirmedState.accounts);

        appMessage(__("Default account updated.", "pressedmail"), "success");
      } catch (err) {
        console.error("Error setting default account:", err);
        setDefaultAccountId(previousDefaultId);
        setAccounts(previousAccounts);
        appMessage(
          __("Failed to update default account.", "pressedmail"),
          "error",
        );
        throw err;
      }
    },
    [accounts, defaultAccountId, setAccounts, setDefaultAccountId],
  );

  const loadAccounts = React.useCallback(
    async (signal?: AbortSignal): Promise<void> => {
      setIsLoading(true);
      setError(null);

      try {
        const response = await apiFetch(accountsLoadRouteApi, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
          signal,
        });

        if (signal?.aborted) return;

        if (response.status === 404) {
          setAccounts([]);
          return;
        }

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const accountsData = await response.json();

        if (signal?.aborted) return;

        const accountsLoaded =
          accountsData?.data?.accounts || accountsData?.accounts;

        if (!Array.isArray(accountsLoaded) || accountsLoaded.length === 0) {
          setAccounts([]);
          setDefaultAccountId(null);
          return;
        }

        // Sync the server's default-account pointer: prefer the explicit
        // top-level field, else derive it from the per-account is_default flag.
        const serverDefaultId =
          accountsData?.data?.default_account_id ??
          accountsData?.default_account_id ??
          null;

        const mappedAccounts = accountsLoaded.map((account: any) => ({
          ...account,
          label: account.first_name || account.name || account.email,
          imapHost: account.imap_host || account.imapHost,
          imapPort: account.imap_port || account.imapPort,
          imapSecurity: account.imap_security || account.imapSecurity,
          imapUsername: account.imap_username || account.imapUsername,
          smtpHost: account.smtp_host || account.smtpHost,
          smtpPort: account.smtp_port || account.smtpPort,
          smtpSecurity: account.smtp_security || account.smtpSecurity,
          smtpUsername: account.smtp_username || account.smtpUsername,
          useSeparateCredentials:
            account.use_separate_credentials === true ||
            account.use_separate_credentials === 1 ||
            account.use_separate_credentials === "1" ||
            account.useSeparateCredentials === true,
          icon:
            PROVIDER_ICONS[account.provider as keyof typeof PROVIDER_ICONS] ||
            PROVIDER_ICONS.default,
        }));

        const nextState = stampDefaultAccountState(
          mappedAccounts,
          serverDefaultId,
        );
        setDefaultAccountId(nextState.defaultAccountId);
        setAccounts(nextState.accounts);
      } catch (err) {
        if (signal?.aborted) return;
        console.error("[AppProvider] Error loading accounts:", err);
        setError("Failed to load accounts");
        // Surface the failure instead of silently rendering the empty/setup
        // state. Existing accounts are intentionally left intact here, only an
        // explicit 404/empty response clears them, so a transient auth/network
        // failure does not look like "no accounts".
        appMessage("Failed to load accounts", "error");
      } finally {
        if (!signal?.aborted) {
          setIsLoading(false);
        }
      }
    },
    [setAccounts, setDefaultAccountId, setError],
  );

  const reloadAccounts = React.useCallback(
    async (): Promise<void> => loadAccounts(),
    [loadAccounts],
  );
  reloadAccountsRef.current = reloadAccounts;

  // Load accounts on mount (abort controller prevents StrictMode double-fetch)
  React.useEffect(() => {
    const abortController = new AbortController();

    void loadAccounts(abortController.signal);
    return () => {
      abortController.abort();
    };
  }, [loadAccounts]);

  // Auto-select first account when accounts load and none is selected,
  // or reset if selectedAccount doesn't match any current account (stale localStorage).
  // "all" is the consolidated inbox sentinel used by combined inbox views.
  React.useEffect(() => {
    const first = accounts[0];
    if (!first) return;

    if (!selectedAccount) {
      setSelectedAccount((current) => current || first.email);
      return;
    }

    if (selectedAccount === "all") {
      return;
    }

    const isValid = accounts.some((a) => a.email === selectedAccount);
    if (!isValid) {
      setSelectedAccount(first.email);
    }
  }, [accounts, selectedAccount, setSelectedAccount]);

  // Reconcile persisted client state whenever the account list changes. When an
  // account disappears from the server (removed, or removed + re-added with a
  // NEW database id), purge its stale per-account state, sync tokens, caches,
  // folder selection, the first-sync gate, so it can never poison the mailbox
  // (the "clearing localStorage fixes sync" symptom). Also drop dead ids from
  // the consolidated-inbox selection.
  const prevAccountsRef = React.useRef<EmailAccount[] | null>(null);
  React.useEffect(() => {
    const prev = prevAccountsRef.current;
    prevAccountsRef.current = accounts;
    if (!prev || prev === accounts) {
      return;
    }

    const removed = reconcileRemovedAccounts(prev, accounts);
    if (removed.length === 0) {
      return;
    }

    const survivingIds = new Set(accounts.map((account) => String(account.id)));
    setSelectedConsolidatedAccountIds((ids) =>
      ids.filter((id) => survivingIds.has(String(id))),
    );
  }, [accounts, setSelectedConsolidatedAccountIds]);

  // Legacy createAccount function (kept for backward compatibility)
  const createAccount = React.useCallback(() => {
    console.warn("createAccount is deprecated, use addAccount instead");
  }, []);

  const values = React.useMemo<AppContextType>(
    () => ({
      // User state
      user,
      setUser,

      // Account management
      accounts,
      setAccounts,
      addAccount,
      removeAccount,
      removeSelectedAccount,
      updateAccount,
      reloadAccounts,

      // UI state
      isLoading,
      error,
      setError,

      // Setup state
      hasCompletedSetup,

      onComplete,
      createAccount,
      isAddAccount,
      setIsAddAccount,
      editingAccount,
      setEditingAccount,
      selectedAccount,
      setSelectedAccount,
      selectedConsolidatedAccountIds,
      setSelectedConsolidatedAccountIds,
      defaultAccountId,
      setDefaultAccount,
      selectedMessage,
      setSelectedMessage,
      clearSelectedMessage,
      setNumberOfMessages,
      numberOfMessages,
    }),
    [
      // State values that change:
      user,
      accounts,
      isLoading,
      error,
      hasCompletedSetup,
      isAddAccount,
      editingAccount,
      selectedAccount,
      selectedConsolidatedAccountIds,
      defaultAccountId,
      selectedMessage,
      numberOfMessages,
      // Callbacks with changing deps:
      removeSelectedAccount,
      updateAccount,
      reloadAccounts,
      setDefaultAccount,
      onComplete,
      // Stable refs (included for eslint correctness, never actually change):
      setUser,
      setAccounts,
      addAccount,
      removeAccount,
      setError,
      createAccount,
      setIsAddAccount,
      setEditingAccount,
      setSelectedAccount,
      setSelectedConsolidatedAccountIds,
      setSelectedMessage,
      clearSelectedMessage,
      setNumberOfMessages,
    ],
  );

  return (
    <AppContext.Provider value={values}>
      <PhishingProvider>{children}</PhishingProvider>
    </AppContext.Provider>
  );
}
