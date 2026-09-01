import React, { useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { useLocation, useNavigate } from "react-router-dom";
import { __, sprintf } from "@wordpress/i18n";

import { ArrowLeft, ArrowRight } from "lucide-react";

import {
  testConnectionROuteApi,
} from "./Strings";
import { appMessage } from "./toast";
import { useAppContext } from "./AppProvider";
// IMPORTANT: must be the aliased specifier, the free build swaps
// @/context/features/FeaturesContext to FeaturesContext.free.tsx via a vite
// alias that only matches the aliased form. A relative import bundles the PRO
// context module into the free build, whose context identity never matches
// the mounted free provider, so useFeaturesOptional() silently returns
// undefined (this hid the free Outlook OAuth button).
import { useFeaturesOptional } from "@/context/features/FeaturesContext";
import type { AccountData, EmailAccount } from "@/types";
import type {
  ManagedDomainAccountInput,
  ManagedDomainSetupRuntime,
} from "@/types/domain-policy";

import {
  isAdvancedProvider,
  normalizeProvider,
  PROVIDERS,
} from "@/components/setup/providers";
import type {
  ConnectionStatus,
  ConnectionTestState,
  ManagedSetupFormData,
  ManagedSetupFormErrors,
  ProviderConfig,
  ProviderKey,
  SetupFormData,
  SetupFormErrors,
} from "@/components/setup/types";
import { ManagedDomainCredentialsStep } from "@/components/setup/managed-domain-credentials-step";
import {
  StepCredentials,
  StepProviderSelect,
  StepServerSettings,
} from "@/components/setup/steps";
import { useIsMobileOrTablet } from "@/hooks/useMobile";
import {
  MobileScreen,
  MobileScreenHeader,
  useMobileShellFlag,
} from "@/components/mobile-shell";

import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Progress,
} from "@kit/ui/plugin";
import { useUnsavedChangesGuard } from "@/components/settings-ui";
import {
  getComingSoonProviders,
  isGmailOAuthEnabled,
} from "@/lib/provider-gate";
import { BrandedProductMark } from "@/components/branding/BrandedProductMark";
import { useWhitelabelTheme } from "@/layouts/shared/hooks/useWhitelabelTheme";

interface SetupWizardProps {
  onComplete?: (formData: AccountData) => Promise<EmailAccount | void>;
  isLoading?: boolean;
}

interface ConnectionTestErrorPayload {
  code: string;
  field: string;
  message: string;
  suggestion: string;
}

const getAccountDisplayName = (account: EmailAccount): string => {
  const name = [account.first_name, account.last_name]
    .filter(Boolean)
    .join(" ");
  return name || account.name || account.label || account.email;
};

function createPendingConnectionTestState(): ConnectionTestState {
  return {
    imapStatus: "pending",
    imapMessage: "",
    smtpStatus: "pending",
    smtpMessage: "",
  };
}

function createInitialSetupFormData(
  editingAccount: EmailAccount | null,
): SetupFormData {
  const provider = normalizeProvider(editingAccount?.provider);
  const providerConfig = provider ? PROVIDERS[provider] : null;

  return {
    provider,
    email: editingAccount?.email ?? "",
    password: "",
    displayName: editingAccount ? getAccountDisplayName(editingAccount) : "",
    imapHost:
      editingAccount?.imapHost ??
      editingAccount?.imap_host ??
      providerConfig?.imap.host ??
      "",
    imapPort:
      editingAccount?.imapPort ??
      editingAccount?.imap_port ??
      providerConfig?.imap.port ??
      993,
    imapSecurity:
      editingAccount?.imapSecurity ??
      editingAccount?.imap_security ??
      providerConfig?.imap.security ??
      "SSL/TLS",
    imapUsername:
      editingAccount?.imapUsername ?? editingAccount?.imap_username ?? "",
    imapPassword: "",
    smtpHost:
      editingAccount?.smtpHost ??
      editingAccount?.smtp_host ??
      providerConfig?.smtp.host ??
      "",
    smtpPort:
      editingAccount?.smtpPort ??
      editingAccount?.smtp_port ??
      providerConfig?.smtp.port ??
      587,
    smtpSecurity:
      editingAccount?.smtpSecurity ??
      editingAccount?.smtp_security ??
      providerConfig?.smtp.security ??
      "STARTTLS",
    smtpUsername:
      editingAccount?.smtpUsername ?? editingAccount?.smtp_username ?? "",
    smtpPassword: "",
    useSeparateCredentials: Boolean(editingAccount?.useSeparateCredentials),
    useOAuth: false,
    testConnection: false,
    outgoingProviderType:
      (editingAccount?.outgoing_provider_type as
        | "smtp"
        | "sendgrid"
        | undefined) ?? "smtp",
    outgoingProviderConfig: {},
  };
}

const getSetupReturnTo = (state: unknown): string | null => {
  if (!state || typeof state !== "object") {
    return null;
  }

  const setupReturnTo = (state as { setupReturnTo?: unknown }).setupReturnTo;

  return typeof setupReturnTo === "string" && setupReturnTo.startsWith("/")
    ? setupReturnTo
    : null;
};

const getString = (value: unknown): string =>
  typeof value === "string" ? value : "";

const extractConnectionTestError = (
  result: unknown,
): ConnectionTestErrorPayload => {
  const response = result && typeof result === "object" ? result : {};
  const data =
    "data" in response && response.data && typeof response.data === "object"
      ? response.data
      : {};
  const details =
    "details" in data && data.details && typeof data.details === "object"
      ? data.details
      : {};

  return {
    code: getString(
      ("code" in data && data.code) || ("code" in response && response.code),
    ),
    field: getString(
      ("field" in data && data.field) ||
        ("field" in response && response.field),
    ),
    message: getString(
      ("message" in data && data.message) ||
        ("message" in response && response.message),
    ),
    suggestion: getString(
      ("suggestion" in details && details.suggestion) ||
        ("suggestion" in data && data.suggestion) ||
        ("suggestion" in response && response.suggestion),
    ),
  };
};

const inferConnectionTestProtocol = ({
  code,
  field,
  message,
}: ConnectionTestErrorPayload): "imap" | "smtp" | "unknown" => {
  const source = `${code} ${field} ${message}`.toLowerCase();

  if (source.includes("imap") || field === "password") {
    return "imap";
  }

  if (source.includes("smtp")) {
    return "smtp";
  }

  return "unknown";
};

// Pro grid rows: Gmail / Outlook / Custom on row one; Yahoo / iCloud / Proton
// on row two.
const PRO_ROW_ONE_PROVIDERS: ProviderKey[] = ["gmail", "outlook", "custom"];

const getConnectionFingerprint = (data: SetupFormData): string =>
  JSON.stringify({
    provider: data.provider,
    email: data.email,
    password: data.password,
    imapHost: data.imapHost,
    imapPort: data.imapPort,
    imapSecurity: data.imapSecurity,
    imapUsername: data.imapUsername,
    imapPassword: data.imapPassword,
    smtpHost: data.smtpHost,
    smtpPort: data.smtpPort,
    smtpSecurity: data.smtpSecurity,
    smtpUsername: data.smtpUsername,
    smtpPassword: data.smtpPassword,
    useSeparateCredentials: data.useSeparateCredentials,
    useOAuth: data.useOAuth,
    outgoingProviderType: data.outgoingProviderType,
    outgoingProviderConfig: data.outgoingProviderConfig,
  });

const normalizeManagedDomainSetup = (
  value: unknown,
): ManagedDomainSetupRuntime | null => {
  if (!value || typeof value !== "object") return null;
  const runtime = value as Partial<ManagedDomainSetupRuntime>;
  if (runtime.enabled !== true) return null;
  if (
    !Array.isArray(runtime.domains) ||
    typeof runtime.revision !== "string" ||
    !/^[a-f0-9]{64}$/.test(runtime.revision)
  ) {
    return { enabled: true, domains: [], revision: "invalid" };
  }
  const validDomain = (domain: unknown): domain is string => {
    if (typeof domain !== "string") return false;
    const candidate = domain.trim().toLowerCase();
    if (
      candidate !== domain ||
      candidate.length > 253 ||
      !candidate.includes(".") ||
      /[@\s\p{Cc}]/u.test(candidate)
    ) {
      return false;
    }
    return candidate
      .split(".")
      .every((label) => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  };
  const domains = runtime.domains;
  const seen = new Set<string>();
  const valid = domains.every((entry) => {
    if (
      !entry ||
      !validDomain(entry.domain) ||
      (entry.imap_username_format !== "full_email" &&
        entry.imap_username_format !== "local_part") ||
      (entry.smtp_username_format !== "full_email" &&
        entry.smtp_username_format !== "local_part") ||
      (entry.credential_mode !== "shared" &&
        entry.credential_mode !== "separate") ||
      seen.has(entry.domain)
    ) {
      return false;
    }
    seen.add(entry.domain);
    return true;
  });
  if (!valid) {
    return { enabled: true, domains: [], revision: "invalid" };
  }
  return { enabled: true, domains, revision: runtime.revision };
};

const createManagedSetupFormData = (
  runtime: ManagedDomainSetupRuntime | null,
  account: EmailAccount | null,
): ManagedSetupFormData => {
  const [localPart = "", accountDomain = ""] = (account?.email ?? "").split(
    "@",
  );
  const matched = runtime?.domains.find(
    (entry) => entry.domain.toLowerCase() === accountDomain.toLowerCase(),
  );
  const selected = matched ?? runtime?.domains[0];
  return {
    localPart,
    domain: account ? accountDomain : (selected?.domain ?? ""),
    senderName: account
      ? getAccountDisplayName(account)
      : (window.pressedmailPlugin?.userInfo?.displayName ?? ""),
    credentialMode: selected?.credential_mode ?? "shared",
    password: "",
    imapPassword: "",
    smtpPassword: "",
  };
};

const clearManagedPasswords = (
  data: ManagedSetupFormData,
): ManagedSetupFormData => ({
  ...data,
  password: "",
  imapPassword: "",
  smtpPassword: "",
});

const getManagedIdentityFingerprint = (
  data: ManagedSetupFormData,
  runtime: ManagedDomainSetupRuntime | null,
): string =>
  JSON.stringify({
    localPart: data.localPart.trim().toLowerCase(),
    domain: data.domain.trim().toLowerCase(),
    credentialMode: data.credentialMode,
    revision: runtime?.revision ?? "disabled",
    domains:
      runtime?.domains.map((entry) => ({
        domain: entry.domain.trim().toLowerCase(),
        credentialMode: entry.credential_mode,
      })) ?? [],
  });

export default function SetupWizard({
  onComplete,
  isLoading: externalLoading = false,
}: SetupWizardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const {
    accounts,
    isAddAccount,
    setIsAddAccount,
    editingAccount,
    setEditingAccount,
    updateAccount,
  } = useAppContext();
  const isEditing = Boolean(editingAccount);
  const setupReturnTo = getSetupReturnTo(location.state);
  const isMobileOrTablet = useIsMobileOrTablet();
  const mobileShellEnabled = useMobileShellFlag();
  const compactSetupShell = isMobileOrTablet && mobileShellEnabled;
  const { pluginName } = useWhitelabelTheme();
  const managedDomainRuntime = window.pressedmailPlugin?.managedDomainSetup;
  const managedDomainSetup = React.useMemo(
    () => normalizeManagedDomainSetup(managedDomainRuntime),
    [managedDomainRuntime],
  );
  const managedSetupEnabled = managedDomainSetup !== null;
  const managedSetupBlocked =
    managedSetupEnabled &&
    managedDomainSetup.domains.length === 0 &&
    !isEditing;
  const managedSetupMode = managedSetupEnabled && !managedSetupBlocked;

  const [currentStep, setCurrentStep] = useState<number>(
    editingAccount ? 2 : 1,
  );
  const [formData, setFormData] = useState<SetupFormData>(() =>
    createInitialSetupFormData(editingAccount),
  );
  const [managedFormData, setManagedFormData] = useState<ManagedSetupFormData>(
    () => createManagedSetupFormData(managedDomainSetup, editingAccount),
  );
  const [managedErrors, setManagedErrors] = useState<ManagedSetupFormErrors>(
    {},
  );
  const initialManagedFingerprintRef = React.useRef(
    getManagedIdentityFingerprint(managedFormData, managedDomainSetup),
  );
  const successfulManagedPayloadRef =
    React.useRef<ManagedDomainAccountInput | null>(null);
  const initialFormDataRef = React.useRef<SetupFormData | null>(null);
  if (initialFormDataRef.current === null) {
    initialFormDataRef.current = formData;
  }
  const [errors, setErrors] = useState<SetupFormErrors>({});
  const [oauthConnected, setOauthConnected] = useState<boolean>(false);
  // Either/or auth method for OAuth-capable providers (gmail/outlook).
  const [oauthMethod, setOauthMethod] = useState<"oauth" | "password">("oauth");
  // Optional so the wizard stays renderable without a FeaturesProvider (tests).
  // OAuth sign-in ships in BOTH editions; only the runtime flag gates it.
  const featuresContext = useFeaturesOptional();
  const microsoftOAuthAvailable = Boolean(
    featuresContext?.isFeatureAvailable("microsoft_oauth"),
  );
  // Public-distribution gate (pending Google OAuth verification): Gmail OAuth
  // off, some providers "coming soon". Server guards stay authoritative.
  const gmailOAuthEnabled = isGmailOAuthEnabled();
  const comingSoonProviders = getComingSoonProviders();
  const isOAuthCapableProvider =
    formData.provider === "outlook" ||
    (formData.provider === "gmail" && gmailOAuthEnabled);
  const oauthModeActive =
    microsoftOAuthAvailable &&
    isOAuthCapableProvider &&
    oauthMethod === "oauth";
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [connectionStatus, setConnectionStatus] =
    useState<ConnectionStatus | null>(null);
  const [testState, setTestState] = useState<ConnectionTestState>(
    createPendingConnectionTestState,
  );
  const connectionTestAbortRef = React.useRef<AbortController | null>(null);
  const connectionTestTimeoutRef = React.useRef<ReturnType<
    typeof setTimeout
  > | null>(null);
  const connectionTestGenerationRef = React.useRef(0);
  const activeConnectionFingerprintRef = React.useRef<string | null>(null);
  const setupMountedRef = React.useRef(true);
  const successfulConnectionFingerprintRef = React.useRef<string | null>(null);
  const connectionFingerprint = getConnectionFingerprint(formData);
  const ordinaryConnectionChanged =
    connectionFingerprint !==
    getConnectionFingerprint(initialFormDataRef.current ?? formData);
  const managedFingerprint = getManagedIdentityFingerprint(
    managedFormData,
    managedDomainSetup,
  );
  const setupContextClearedRef = React.useRef(false);
  const clearSetupContext = React.useCallback(() => {
    if (setupContextClearedRef.current) {
      return;
    }
    setupContextClearedRef.current = true;
    setEditingAccount(null);
    setIsAddAccount(false);
  }, [setEditingAccount, setIsAddAccount]);
  const invalidateConnectionTest = React.useCallback(() => {
    connectionTestGenerationRef.current += 1;
    connectionTestAbortRef.current?.abort();
    connectionTestAbortRef.current = null;
    if (connectionTestTimeoutRef.current) {
      clearTimeout(connectionTestTimeoutRef.current);
      connectionTestTimeoutRef.current = null;
    }
    successfulConnectionFingerprintRef.current = null;
    successfulManagedPayloadRef.current = null;
    activeConnectionFingerprintRef.current = null;
  }, []);
  const invalidateManagedCredentialTest = React.useCallback(() => {
    if (
      !managedSetupMode ||
      (successfulConnectionFingerprintRef.current === null &&
        activeConnectionFingerprintRef.current === null)
    ) {
      return;
    }

    invalidateConnectionTest();
    setConnectionStatus(null);
    setTestState(createPendingConnectionTestState());
    setFormData((previous) => ({ ...previous, testConnection: false }));
    setIsLoading(false);
  }, [invalidateConnectionTest, managedSetupMode]);
  React.useEffect(() => {
    setupMountedRef.current = true;

    return () => {
      setupMountedRef.current = false;
      invalidateConnectionTest();
    };
  }, [invalidateConnectionTest]);
  React.useEffect(() => {
    if (
      managedSetupMode ||
      !formData.testConnection ||
      (successfulConnectionFingerprintRef.current ??
        activeConnectionFingerprintRef.current) === null ||
      (successfulConnectionFingerprintRef.current ??
        activeConnectionFingerprintRef.current) === connectionFingerprint
    ) {
      return;
    }

    invalidateConnectionTest();
    setConnectionStatus(null);
    setTestState(createPendingConnectionTestState());
    setFormData((previous) => ({ ...previous, testConnection: false }));
    setIsLoading(false);
  }, [
    connectionFingerprint,
    formData.testConnection,
    invalidateConnectionTest,
    managedSetupMode,
  ]);
  React.useEffect(() => {
    if (
      !managedSetupMode ||
      (successfulConnectionFingerprintRef.current ??
        activeConnectionFingerprintRef.current) === null ||
      (successfulConnectionFingerprintRef.current ??
        activeConnectionFingerprintRef.current) === managedFingerprint
    ) {
      return;
    }

    invalidateConnectionTest();
    setConnectionStatus(null);
    setTestState(createPendingConnectionTestState());
    setFormData((previous) => ({ ...previous, testConnection: false }));
    setManagedFormData((previous) => clearManagedPasswords(previous));
    setIsLoading(false);
  }, [managedFingerprint, managedSetupMode, invalidateConnectionTest]);
  const clearPartialSetupState = React.useCallback(() => {
    const initial = createInitialSetupFormData(null);

    invalidateConnectionTest();
    initialFormDataRef.current = initial;
    setFormData(initial);
    const initialManaged = createManagedSetupFormData(managedDomainSetup, null);
    setManagedFormData(initialManaged);
    setManagedErrors({});
    setCurrentStep(1);
    setErrors({});
    setOauthConnected(false);
    setOauthMethod("oauth");
    setConnectionStatus(null);
    setTestState(createPendingConnectionTestState());
    setIsLoading(false);
    clearSetupContext();
  }, [clearSetupContext, invalidateConnectionTest, managedDomainSetup]);

  const { guardedAction, guardDialog } = useUnsavedChangesGuard({
    dirty:
      managedFingerprint !== initialManagedFingerprintRef.current ||
      JSON.stringify(formData) !==
        JSON.stringify(initialFormDataRef.current ?? formData),
    onDiscard: clearPartialSetupState,
  });

  React.useEffect(() => {
    if (!editingAccount) {
      return;
    }

    setCurrentStep(2);
    const nextFormData = createInitialSetupFormData(editingAccount);
    const nextManaged = createManagedSetupFormData(
      managedDomainSetup,
      editingAccount,
    );

    initialFormDataRef.current = nextFormData;
    initialManagedFingerprintRef.current = getManagedIdentityFingerprint(
      nextManaged,
      managedDomainSetup,
    );
    setFormData(() => nextFormData);
    setManagedFormData(nextManaged);
    setManagedErrors({});
    successfulManagedPayloadRef.current = null;
    setConnectionStatus(null);
    setErrors({});
    setTestState(createPendingConnectionTestState());
  }, [editingAccount, managedDomainSetup?.revision]);

  // Use external loading state if provided
  const loading = externalLoading || isLoading;

  const providerEntries = Object.entries(PROVIDERS) as [
    ProviderKey,
    ProviderConfig,
  ][];
  const disabledProviders = comingSoonProviders;

  // Effective allow-list handed to StepCredentials so the email-domain
  // suggestion never proposes a coming-soon provider.
  const suggestionAllowedProviders = comingSoonProviders.length
    ? (Object.keys(PROVIDERS) as ProviderKey[]).filter(
        (key) => !comingSoonProviders.includes(key),
      )
    : undefined;

  const visibleProviders = providerEntries;

  // Pro grid split: row one (Gmail / Outlook / Custom) and row two (Yahoo /
  // iCloud / Proton + the WP Global SMTP card for admins). Free keeps the
  // single-grid layout.
  const proRowOneProviders = providerEntries.filter(([key]) =>
    PRO_ROW_ONE_PROVIDERS.includes(key),
  );
  const proRowTwoProviders = providerEntries.filter(
    ([key]) => !PRO_ROW_ONE_PROVIDERS.includes(key),
  );

  // In custom domain mode: skip provider selection.
  const totalSteps = managedSetupMode ? 2 : 3;
  const entryStep = isEditing ? 2 : 1;
  const progress = (currentStep / totalSteps) * 100;

  React.useEffect(() => {
    if (editingAccount) {
      setCurrentStep(2);
    }
  }, [editingAccount]);

  const managedHasEnteredCredentials = Boolean(
    managedFormData.password ||
    managedFormData.imapPassword ||
    managedFormData.smtpPassword,
  );
  const managedConnectionChanged =
    managedFingerprint !== initialManagedFingerprintRef.current ||
    managedHasEnteredCredentials;

  const validateManagedSetup = (): {
    valid: boolean;
    payload: ManagedDomainAccountInput | null;
  } => {
    const nextErrors: ManagedSetupFormErrors = {};
    const localPart = managedFormData.localPart.trim();
    const domain = managedFormData.domain.trim().toLowerCase();
    const senderName = managedFormData.senderName.trim();
    const selectedDomain = managedDomainSetup?.domains.find(
      (entry) => entry.domain.toLowerCase() === domain,
    );
    const requiresCredentials = !isEditing || managedConnectionChanged;

    if (
      localPart.length < 1 ||
      localPart.length > 64 ||
      /[@\s\p{Cc}]/u.test(localPart)
    ) {
      nextErrors.localPart = __("Enter a valid email prefix", "pressedmail");
    }
    if (!selectedDomain && requiresCredentials) {
      nextErrors.domain = __("Select an allowed email domain", "pressedmail");
    }
    if (!senderName) {
      nextErrors.senderName = __("Sender name is required", "pressedmail");
    }

    if (requiresCredentials && selectedDomain) {
      if (selectedDomain.credential_mode === "separate") {
        if (!managedFormData.imapPassword) {
          nextErrors.imapPassword = __(
            "Incoming password is required",
            "pressedmail",
          );
        }
        if (!managedFormData.smtpPassword) {
          nextErrors.smtpPassword = __(
            "Outgoing password is required",
            "pressedmail",
          );
        }
      } else if (!managedFormData.password) {
        nextErrors.password = __("Mailbox password is required", "pressedmail");
      }
    }

    setManagedErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) {
      return { valid: false, payload: null };
    }
    if (!requiresCredentials) {
      return { valid: true, payload: null };
    }
    if (!selectedDomain) return { valid: false, payload: null };

    const common = { managed: true as const, localPart, domain, senderName };
    return {
      valid: true,
      payload:
        selectedDomain.credential_mode === "separate"
          ? {
              ...common,
              imapPassword: managedFormData.imapPassword,
              smtpPassword: managedFormData.smtpPassword,
            }
          : {
              ...common,
              password: managedFormData.password,
            },
    };
  };

  const validateStep = (step: number): boolean => {
    if (managedSetupMode) {
      if (step === 1) return true;
      return validateManagedSetup().valid;
    }

    const newErrors: SetupFormErrors = {};
    const effective = step;

    switch (effective) {
      case 1:
        if (!formData.provider)
          newErrors.provider = __(
            "Please select an email provider",
            "pressedmail",
          );
        break;
      case 2:
        if (!(oauthModeActive && !oauthConnected)) {
          if (!formData.email)
            newErrors.email = __("Email address is required", "pressedmail");
          else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            newErrors.email = __(
              "Please enter a valid email address",
              "pressedmail",
            );
          }
        }
        if (!formData.displayName)
          newErrors.displayName = __("Display name is required", "pressedmail");
        // Require password for pre-configured providers and custom domain
        // mode. Advanced providers (Proton Bridge) enter credentials with the
        // server settings in the next step, like custom.
        if (oauthModeActive && !oauthConnected) {
          newErrors.password =
            formData.provider === "gmail"
              ? __("Connect your Google account to continue", "pressedmail")
              : __("Connect your Microsoft account to continue", "pressedmail");
        } else if (
          formData.provider !== "custom" &&
          !isAdvancedProvider(formData.provider) &&
          !isEditing &&
          !formData.useOAuth &&
          !formData.password
        ) {
          newErrors.password = __("Password is required", "pressedmail");
        }
        break;
      case 3:
        if (
          formData.provider === "custom" ||
          isAdvancedProvider(formData.provider)
        ) {
          if (!formData.imapHost)
            newErrors.imapHost = __("IMAP server is required", "pressedmail");
          if (!formData.smtpHost)
            newErrors.smtpHost = __("SMTP server is required", "pressedmail");
          if (
            !formData.imapPort ||
            formData.imapPort < 1 ||
            formData.imapPort > 65535
          ) {
            newErrors.imapPort = __(
              "Valid IMAP port is required (1-65535)",
              "pressedmail",
            );
          }
          if (
            !formData.smtpPort ||
            formData.smtpPort < 1 ||
            formData.smtpPort > 65535
          ) {
            newErrors.smtpPort = __(
              "Valid SMTP port is required (1-65535)",
              "pressedmail",
            );
          }
          // Credentials validation for custom providers
          if (isEditing && !ordinaryConnectionChanged) {
            // Existing accounts may be tested using their stored connection.
          } else if (formData.useSeparateCredentials) {
            // Separate credentials mode - validate all four fields
            if (!formData.imapUsername) {
              newErrors.imapUsername = __(
                "IMAP username is required",
                "pressedmail",
              );
            }
            if (!formData.imapPassword) {
              newErrors.imapPassword = __(
                "IMAP password is required",
                "pressedmail",
              );
            }
            if (!formData.smtpUsername) {
              newErrors.smtpUsername = __(
                "SMTP username is required",
                "pressedmail",
              );
            }
            if (!formData.smtpPassword) {
              newErrors.smtpPassword = __(
                "SMTP password is required",
                "pressedmail",
              );
            }
          } else {
            // Unified credentials mode - validate password
            if (!formData.password) {
              newErrors.password = __("Password is required", "pressedmail");
            }
          }
        }
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = (): void => {
    if (validateStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, totalSteps));
    }
  };

  const leaveSetupWizard = (): void => {
    clearSetupContext();

    if (setupReturnTo) {
      navigate(setupReturnTo, { replace: true });
    }
  };

  const handleBack = (): void => {
    successfulManagedPayloadRef.current = null;
    setManagedFormData((previous) => clearManagedPasswords(previous));
    if (setupReturnTo && currentStep <= entryStep) {
      guardedAction(leaveSetupWizard);
      return;
    }

    setCurrentStep((prev) => Math.max(prev - 1, 1));
  };

  const handleProviderSelect = (
    provider: ProviderKey,
    method: "oauth" | "password" = "oauth",
  ): void => {
    const providerConfig = PROVIDERS[provider];
    setOauthConnected(false);
    setOauthMethod(method);
    setFormData((prev) => ({
      ...prev,
      provider,
      imapHost: providerConfig.imap.host,
      imapPort: providerConfig.imap.port,
      imapSecurity: providerConfig.imap.security,
      smtpHost: providerConfig.smtp.host,
      smtpPort: providerConfig.smtp.port,
      smtpSecurity: providerConfig.smtp.security,
      useOAuth: false,
    }));
  };

  // Per-provider auth options for the provider cards. Mirrors the edition +
  // provider-gate matrix used on the credentials step:
  //   Free Gmail   → app password only
  //   Free Outlook → OAuth + app password
  //   Pro  Gmail   → app password + OAuth ("coming soon" while the Google
  //                  relay gate is on in Published; active in Development)
  //   Pro  Outlook → app password + OAuth (active)
  const getProviderAuthOptions = (
    provider: ProviderKey,
  ): { appPassword: boolean; oauth: "active" | "coming-soon" | "none" } => {
    if (provider === "outlook") {
      return {
        appPassword: true,
        oauth: microsoftOAuthAvailable ? "active" : "none",
      };
    }
    if (provider === "gmail") {
      if (__IS_FREE__) {
        return { appPassword: true, oauth: "none" };
      }
      // Pro keeps the Google OAuth button in place but DISABLED ("coming
      // soon") until Google verification completes, app passwords are the
      // supported Gmail path meanwhile. Re-enable by restoring:
      //   microsoftOAuthAvailable && gmailOAuthEnabled ? "active" : "coming-soon"
      return { appPassword: true, oauth: "coming-soon" };
    }
    // Yahoo / iCloud / Proton connect with an app password, and Custom with
    // IMAP/SMTP credentials, on the credentials step. Surface a button on every
    // card so a single click advances the wizard (the bottom Next is optional).
    return { appPassword: true, oauth: "none" };
  };

  const selectProviderWithMethod = (
    provider: ProviderKey,
    method: "oauth" | "password",
  ): void => {
    handleProviderSelect(provider, method);
    // Advance to the credentials step; custom-domain mode keeps step 1 as its
    // credentials step (effectiveStep offset), everything else moves to step 2.
    setCurrentStep(2);
  };

  const testConnection = async (): Promise<void> => {
    const managedValidation = managedSetupMode ? validateManagedSetup() : null;
    if (
      managedValidation ? !managedValidation.valid : !validateStep(currentStep)
    ) {
      setConnectionStatus(null);
      setFormData((prev) => ({ ...prev, testConnection: false }));
      if (managedSetupMode) {
        successfulManagedPayloadRef.current = null;
        setManagedFormData((previous) => clearManagedPasswords(previous));
      }
      return;
    }

    invalidateConnectionTest();
    const testGeneration = connectionTestGenerationRef.current;
    const controller = new AbortController();
    connectionTestAbortRef.current = controller;
    activeConnectionFingerprintRef.current = managedSetupMode
      ? managedFingerprint
      : connectionFingerprint;
    const isCurrentConnectionTest = () =>
      setupMountedRef.current &&
      connectionTestGenerationRef.current === testGeneration;

    setIsLoading(true);
    setConnectionStatus(null);
    setFormData((prev) => ({ ...prev, testConnection: false }));

    // Reset and start testing - both IMAP and SMTP are tested simultaneously by the backend
    setTestState({
      imapStatus: "testing",
      imapMessage: __("Testing connection...", "pressedmail"),
      smtpStatus: "testing",
      smtpMessage: __("Testing connection...", "pressedmail"),
    });

    try {
      const requestData = managedSetupMode
        ? managedValidation?.payload
          ? {
              testMode: isEditing ? "managed_update" : "new_managed",
              ...(isEditing
                ? { accountId: Number(editingAccount?.id ?? 0) }
                : {}),
              ...managedValidation.payload,
            }
          : {
              testMode: "stored_account",
              accountId: Number(editingAccount?.id ?? 0),
            }
        : isEditing && !ordinaryConnectionChanged
          ? {
              testMode: "stored_account",
              accountId: Number(editingAccount?.id ?? 0),
            }
          : {
              accountId: isEditing ? Number(editingAccount?.id ?? 0) : 0,
              provider: formData.provider,
              email: formData.email,
              password: formData.password,
              useOAuth: formData.useOAuth,
              imapHost: formData.imapHost,
              imapPort: formData.imapPort,
              imapSecurity: formData.imapSecurity,
              imapUsername: formData.useSeparateCredentials
                ? formData.imapUsername
                : undefined,
              imapPassword: formData.useSeparateCredentials
                ? formData.imapPassword
                : undefined,
              smtpHost: formData.smtpHost,
              smtpPort: formData.smtpPort,
              smtpSecurity: formData.smtpSecurity,
              smtpUsername: formData.useSeparateCredentials
                ? formData.smtpUsername
                : undefined,
              smtpPassword: formData.useSeparateCredentials
                ? formData.smtpPassword
                : undefined,
              useSeparateCredentials: formData.useSeparateCredentials,
              nonce: window.pressedmailPlugin?.wpApiSettings?.nonce || "",
            };

      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout
      connectionTestTimeoutRef.current = timeoutId;
      const clearRequestTimeout = () => {
        clearTimeout(timeoutId);
        if (connectionTestTimeoutRef.current === timeoutId) {
          connectionTestTimeoutRef.current = null;
        }
      };

      try {
        const response = await apiFetch(testConnectionROuteApi, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestData),
          signal: controller.signal,
        });

        if (!isCurrentConnectionTest()) {
          return;
        }
        clearRequestTimeout();

        let result;
        try {
          result = await response.json();
        } catch {
          throw new Error("Invalid JSON response");
        }
        if (!isCurrentConnectionTest()) {
          return;
        }

        if (response.ok && result.status === "success") {
          // Both succeeded
          setTestState({
            imapStatus: "success",
            imapMessage: __("IMAP connection successful", "pressedmail"),
            smtpStatus: "success",
            smtpMessage: __("SMTP connection successful", "pressedmail"),
          });
          setConnectionStatus({
            success: true,
            message: managedSetupMode
              ? __("Connection successful!", "pressedmail")
              : result.message || __("Connection successful!", "pressedmail"),
          });
          successfulConnectionFingerprintRef.current = managedSetupMode
            ? managedFingerprint
            : connectionFingerprint;
          successfulManagedPayloadRef.current =
            managedValidation?.payload ?? null;
          setFormData((prev) => ({ ...prev, testConnection: true }));
        } else {
          const errorPayload = extractConnectionTestError(result);
          const failureMessage = managedSetupMode
            ? __(
                "Connection failed. Check your mailbox details and try again.",
                "pressedmail",
              )
            : errorPayload.message ||
              __(
                "Connection failed. Please check your settings.",
                "pressedmail",
              );
          const failedProtocol = inferConnectionTestProtocol(errorPayload);
          const isImapError =
            failedProtocol === "imap" || failedProtocol === "unknown";
          const isSmtpError = failedProtocol === "smtp";

          setTestState({
            imapStatus: isImapError ? "error" : "success",
            imapMessage: isImapError
              ? failureMessage
              : __("IMAP connection successful", "pressedmail"),
            smtpStatus: isSmtpError
              ? "error"
              : isImapError
                ? "pending"
                : "success",
            smtpMessage: isSmtpError
              ? failureMessage
              : isImapError
                ? ""
                : __("SMTP connection successful", "pressedmail"),
          });

          setConnectionStatus({
            success: false,
            message: failureMessage,
            suggestion: managedSetupMode
              ? undefined
              : errorPayload.suggestion || undefined,
          });
          setFormData((prev) => ({ ...prev, testConnection: false }));
        }
      } catch (fetchError) {
        clearRequestTimeout();
        if (!isCurrentConnectionTest()) {
          return;
        }

        if (fetchError instanceof Error && fetchError.name === "AbortError") {
          console.error("Connection test timeout - request took too long");
          setTestState({
            imapStatus: "error",
            imapMessage: __("Connection timed out", "pressedmail"),
            smtpStatus: "pending",
            smtpMessage: "",
          });
          setConnectionStatus({
            success: false,
            message: __(
              "Connection test timed out. The server is taking too long to respond. Please try again.",
              "pressedmail",
            ),
          });
          setFormData((prev) => ({ ...prev, testConnection: false }));
        } else {
          throw fetchError; // Re-throw to be caught by outer catch
        }
      }
    } catch (error) {
      if (!isCurrentConnectionTest()) {
        return;
      }
      if (managedSetupMode) {
        console.error("Managed connection test failed.");
      } else {
        console.error("Connection test error:", error);
      }
      setTestState({
        imapStatus: "error",
        imapMessage: __("Connection test failed", "pressedmail"),
        smtpStatus: "pending",
        smtpMessage: "",
      });
      setConnectionStatus({
        success: false,
        message: __(
          "Connection test failed. Please check your network connection and try again.",
          "pressedmail",
        ),
      });
      setFormData((prev) => ({ ...prev, testConnection: false }));
    } finally {
      if (isCurrentConnectionTest() && managedSetupMode) {
        setManagedFormData((previous) => clearManagedPasswords(previous));
      }
      if (isCurrentConnectionTest()) {
        if (connectionTestAbortRef.current === controller) {
          connectionTestAbortRef.current = null;
          activeConnectionFingerprintRef.current = null;
        }
        setIsLoading(false);
      }
    }
  };

  const handleFinish = async (): Promise<void> => {
    if (!formData.testConnection) {
      // Untested credentials must never silently persist, but the block must be
      // LOUD: surface a toast and return the user to the test step (the inline
      // field error alone was invisible, so saves looked like they vanished).
      const blockMessage = __(
        "Please test the connection before finishing",
        "pressedmail",
      );
      setErrors({ test: blockMessage });
      appMessage(blockMessage, "error");
      setCurrentStep(totalSteps);
      return;
    }

    if (!externalLoading) {
      setIsLoading(true);
    }

    try {
      if (managedSetupMode) {
        const testedPayload = successfulManagedPayloadRef.current;
        successfulManagedPayloadRef.current = null;
        const senderName = managedFormData.senderName.trim();

        if (editingAccount) {
          if (testedPayload) {
            await updateAccount(editingAccount.id, {
              ...testedPayload,
              senderName,
            });
          } else {
            const [firstName, ...restName] = senderName
              .split(/\s+/)
              .filter(Boolean);
            await updateAccount(editingAccount.id, {
              firstName: firstName || undefined,
              lastName: restName.join(" ") || undefined,
            });
          }
          setEditingAccount(null);
          setIsAddAccount(false);
          return;
        }

        if (!testedPayload || !onComplete) {
          setManagedErrors({
            submit: __("Please test the connection again.", "pressedmail"),
          });
          return;
        }
        await onComplete({ ...testedPayload, senderName });
        return;
      }

      if (!formData.provider) {
        setErrors({
          provider: __("Please select an email provider", "pressedmail"),
        });
        return;
      }

      const accountPayload: AccountData = {
        email: formData.email,
        displayName: formData.displayName,
        password: formData.useOAuth ? undefined : formData.password,
        provider: formData.provider,
        imapHost: formData.imapHost,
        imapPort: formData.imapPort,
        imapSecurity: formData.imapSecurity,
        imapUsername: formData.useSeparateCredentials
          ? formData.imapUsername
          : undefined,
        imapPassword: formData.useSeparateCredentials
          ? formData.imapPassword
          : undefined,
        smtpHost: formData.smtpHost,
        smtpPort: formData.smtpPort,
        smtpSecurity: formData.smtpSecurity,
        smtpUsername: formData.useSeparateCredentials
          ? formData.smtpUsername
          : undefined,
        smtpPassword: formData.useSeparateCredentials
          ? formData.smtpPassword
          : undefined,
        useSeparateCredentials: formData.useSeparateCredentials,
        useOAuth: formData.useOAuth,
        outgoingProviderType: formData.outgoingProviderType,
        outgoingProviderConfig:
          formData.outgoingProviderType === "smtp"
            ? undefined
            : formData.outgoingProviderConfig,
      };

      if (editingAccount) {
        const [firstName, ...restName] = formData.displayName
          .trim()
          .split(/\s+/)
          .filter(Boolean);

        await updateAccount(editingAccount.id, {
          firstName: firstName || undefined,
          lastName: restName.join(" ") || undefined,
          email: formData.email,
          appPassword: formData.useOAuth ? undefined : formData.password,
          provider: formData.provider,
          imapHost: formData.imapHost,
          imapPort: formData.imapPort,
          imapSecurity: formData.imapSecurity,
          imapUsername: formData.useSeparateCredentials
            ? formData.imapUsername
            : undefined,
          imapPassword: formData.useSeparateCredentials
            ? formData.imapPassword
            : undefined,
          smtpHost: formData.smtpHost,
          smtpPort: formData.smtpPort,
          smtpSecurity: formData.smtpSecurity,
          smtpUsername: formData.useSeparateCredentials
            ? formData.smtpUsername
            : undefined,
          smtpPassword: formData.useSeparateCredentials
            ? formData.smtpPassword
            : undefined,
          useSeparateCredentials: formData.useSeparateCredentials,
          useOAuth: formData.useOAuth,
          outgoingProviderType: formData.outgoingProviderType,
          outgoingProviderConfig:
            formData.outgoingProviderType === "smtp"
              ? undefined
              : formData.outgoingProviderConfig,
        });
        initialFormDataRef.current = formData;
        setEditingAccount(null);
        setIsAddAccount(false);
      } else {
        if (!onComplete) {
          return;
        }
        await onComplete(accountPayload);
        initialFormDataRef.current = formData;
      }
    } catch (error) {
      successfulManagedPayloadRef.current = null;
      if (managedSetupMode) {
        setManagedErrors({
          submit: __(
            "Failed to save account. Please try again.",
            "pressedmail",
          ),
        });
      } else {
        setErrors({
          submit: __(
            "Failed to save account. Please try again.",
            "pressedmail",
          ),
        });
      }
    } finally {
      if (!externalLoading) {
        setIsLoading(false);
      }
    }
  };

  const renderStep = (): React.ReactNode => {
    const effectiveStep = currentStep;

    switch (effectiveStep) {
      case 1:
        if (managedSetupBlocked) {
          return (
            <Alert variant="destructive" role="alert">
              <AlertDescription>
                {__(
                  "Email setup is temporarily unavailable. Contact your site administrator.",
                  "pressedmail",
                )}
              </AlertDescription>
            </Alert>
          );
        }
        return (
          <StepProviderSelect
            isEditing={isEditing}
            formData={formData}
            errors={errors}
            visibleProviders={
              managedSetupMode
                ? providerEntries.filter(([key]) => key === "custom")
                : __IS_PRO__
                  ? proRowOneProviders
                  : visibleProviders
            }
            rowTwoProviders={
              managedSetupMode
                ? undefined
                : __IS_PRO__
                  ? proRowTwoProviders
                  : undefined
            }
            disabledProviders={disabledProviders}
            comingSoonProviders={comingSoonProviders}
            getProviderAuthOptions={getProviderAuthOptions}
            onSelectProviderWithMethod={selectProviderWithMethod}
          />
        );
      case 2:
        if (managedSetupMode && managedDomainSetup) {
          return (
            <ManagedDomainCredentialsStep
              domains={managedDomainSetup.domains}
              formData={managedFormData}
              setFormData={setManagedFormData}
              errors={managedErrors}
              loading={loading}
              connectionStatus={connectionStatus}
              onTestConnection={() => void testConnection()}
              onAddEmail={() => void handleFinish()}
              onCredentialChange={invalidateManagedCredentialTest}
            />
          );
        }
        return (
          <StepCredentials
            isEditing={isEditing}
            isCustomDomainMode={false}
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            onSwitchProvider={handleProviderSelect}
            onEmailChange={() => {}}
            allowedProviders={suggestionAllowedProviders}
            microsoftOAuth={{
              available:
                microsoftOAuthAvailable &&
                (formData.provider !== "gmail" || gmailOAuthEnabled),
              connected: oauthConnected,
              method: oauthMethod,
              onMethodChange: (method) => {
                setOauthMethod(method);
                setErrors((prev) => ({
                  ...prev,
                  password: undefined,
                  email: undefined,
                }));
                if (method === "password") {
                  setFormData((prev) => ({ ...prev, useOAuth: false }));
                }
              },
              accountId: isEditing ? Number(editingAccount?.id ?? 0) : 0,
              onConnected: (identityEmail) => {
                setOauthConnected(true);
                setFormData((prev) => ({
                  ...prev,
                  useOAuth: true,
                  // The provider-verified identity wins over anything typed.
                  email: identityEmail || prev.email,
                }));
                setErrors((prev) => ({
                  ...prev,
                  password: undefined,
                  email: undefined,
                }));
              },
              onError: (message) =>
                setErrors((prev) => ({ ...prev, password: message })),
            }}
          />
        );
      case 3:
        return (
          <StepServerSettings
            isEditing={isEditing}
            formData={formData}
            setFormData={setFormData}
            errors={errors}
            loading={loading}
            testState={testState}
            connectionStatus={connectionStatus}
            onTestConnection={testConnection}
            onAddEmail={handleFinish}
          />
        );
      default:
        return null;
    }
  };
  const stepLabel = sprintf(
    __("Step %1$d of %2$d", "pressedmail"),
    currentStep,
    totalSteps,
  );
  // "Add" implies a list to add to. On a single-mailbox build this wizard is
  // how you fill the one slot, so it says so.
  const setupTitle = isEditing
    ? __("Edit Account", "pressedmail")
    : __SINGLE_MAILBOX__
      ? __("Connect mailbox", "pressedmail")
      : __("Add Account", "pressedmail");
  // Provider-card auth buttons own advancement from the first step. Back is
  // retained for later steps and for settings-launched setup.
  const isProviderSelectStep = currentStep === 1;
  const showNext = !isProviderSelectStep && currentStep < totalSteps;
  const showBack = !isProviderSelectStep || Boolean(setupReturnTo);

  const mobileFooter =
    showNext || showBack ? (
      <div
        data-pm-setup-actions
        className="border-t border-border bg-card p-3 pm-safe-pb pm-safe-pl pm-safe-pr">
        {showNext && (
          <Button
            onClick={handleNext}
            className="pm-touch-target flex w-full items-center justify-center gap-2">
            {__("Next", "pressedmail")}
            <ArrowRight className="h-4 w-4" />
          </Button>
        )}

        {showBack && (
          <Button
            variant="outline"
            onClick={handleBack}
            disabled={currentStep <= entryStep && !setupReturnTo}
            className={`pm-touch-target flex w-full items-center justify-center gap-2 ${showNext ? "mt-2" : ""}`}>
            <ArrowLeft className="h-4 w-4" />
            {__("Back", "pressedmail")}
          </Button>
        )}
      </div>
    ) : undefined;

  if (compactSetupShell) {
    return (
      <MobileScreen
        header={
          <MobileScreenHeader
            title={`${pluginName}: ${setupTitle}`}
            hideBack
            onCancel={
              isAddAccount ? () => guardedAction(leaveSetupWizard) : undefined
            }
            cancelLabel={__("Cancel", "pressedmail")}
          />
        }
        footer={mobileFooter}>
        {guardDialog}
        <div
          data-pm-setup-shell="mobile"
          className="mx-auto flex min-h-full w-full max-w-md flex-col gap-4 px-4 py-4">
          <div className="flex items-center gap-3">
            <Progress value={progress} className="flex-1" />
            <Badge variant="outline" className="shrink-0">
              {stepLabel}
            </Badge>
          </div>

          <div className="min-w-0">{renderStep()}</div>
        </div>
      </MobileScreen>
    );
  }

  return (
    <div
      data-pm-setup-shell="desktop"
      className="bg-background pm-safe-pb pm-safe-pl pm-safe-pr flex h-full min-h-0 items-start justify-center overflow-y-auto p-3 sm:p-5">
      {guardDialog}
      <Card
        data-pm-setup-card
        className="w-full max-w-7xl pm-touch-target shadow-2xl ring-1 ring-gray-900/10 dark:ring-white/10">
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <BrandedProductMark
              testId="setup-branded-product-mark"
              imageClassName="h-8 w-auto max-w-[12rem]"
              nameClassName="hidden text-sm sm:inline"
            />
            <Progress value={progress} className="flex-1" />
            <Badge variant="outline" className="shrink-0">
              {stepLabel}
            </Badge>
            {isAddAccount && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => guardedAction(leaveSetupWizard)}
                className="flex items-center gap-2 shrink-0">
                <ArrowLeft className="h-4 w-4" />
                {__("Cancel", "pressedmail")}
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          {renderStep()}

          {(showBack || showNext) && (
            <div className="flex flex-col gap-3 pt-6 sm:flex-row sm:items-center sm:justify-between">
              {showBack ? (
                <Button
                  variant="outline"
                  onClick={handleBack}
                  disabled={currentStep <= entryStep && !setupReturnTo}
                  className="pm-touch-target flex items-center gap-2">
                  <ArrowLeft className="h-4 w-4" />
                  {__("Back", "pressedmail")}
                </Button>
              ) : (
                <span />
              )}

              <div className="flex items-center gap-2">
                {showNext && (
                  <Button
                    onClick={handleNext}
                    className="pm-touch-target flex items-center gap-2">
                    {__("Next", "pressedmail")}
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
