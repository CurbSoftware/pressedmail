import { __ } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield,
  Loader2,
  AlertCircle,
  Lock,
  UserX,
  Eye,
  Database,
  Trash2,
} from "lucide-react";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import {
  notifyAutosaveError,
  notifyAutosaveSuccess,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import { useCanShowExternalImages } from "@/context/admin-settings";
import {
  SettingsSaveState,
  useSettingsHeaderAction,
} from "@/components/settings-ui";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@kit/ui/plugin";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";
import {
  setMailboxLockStatus,
  type MailboxLockRuntimeStatus,
} from "@/lib/mailbox-lock";
import { sensitiveInputProps } from "@/lib/sensitive-input-props";

interface ImpersonationStatus {
  protection_enabled: boolean;
  is_legitimate: boolean;
  access_allowed: boolean;
  blocked_reason: string | null;
  blocked_message: string;
  is_user_switching: boolean;
}

interface LockStatus {
  enabled: boolean;
  locked: boolean;
  timeout_seconds: number;
  migration_prompt: boolean;
}

interface LockActionResponse {
  status?: string;
  message?: string;
  code?: string;
  retry_after?: number;
  lock?: MailboxLockRuntimeStatus;
}

interface Message {
  type: "success" | "error" | "info";
  text: string;
}

const getApiUrl = (): string => {
  return (window as any).pressedmailPlugin?.apiUrl || "";
};

const securityTileClass =
  "grid gap-3 rounded-lg border bg-muted/30 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start";

const TIMEOUT_OPTIONS: { value: number; label: () => string }[] = [
  { value: 0, label: () => __("Never", "pressedmail") },
  { value: 900, label: () => __("15 minutes", "pressedmail") },
  { value: 1800, label: () => __("30 minutes", "pressedmail") },
  { value: 3600, label: () => __("1 hour", "pressedmail") },
  { value: 14400, label: () => __("4 hours", "pressedmail") },
];

function normalizeLock(
  status: MailboxLockRuntimeStatus | undefined,
): LockStatus {
  return {
    enabled: status?.enabled === true,
    locked: status?.locked === true,
    timeout_seconds:
      typeof status?.timeout_seconds === "number" ? status.timeout_seconds : 0,
    migration_prompt: status?.migration_prompt === true,
  };
}

export function SecuritySettingsCard() {
  const [lockStatus, setLockStatus] = useState<LockStatus | null>(null);
  const [impersonationStatus, setImpersonationStatus] =
    useState<ImpersonationStatus | null>(null);
  const {
    preferences,
    loading: prefsLoading,
    updatePreference,
  } = useUserPreferences();
  // Admin "Allow remote images" is the source of truth. When it is OFF, the
  // per-user "Automatically load remote images" toggle is hidden entirely.
  const canShowExternalImages = useCanShowExternalImages();
  const [isLoading, setIsLoading] = useState(true);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [message, setMessage] = useState<Message | null>(null);
  const [cacheConfirmOpen, setCacheConfirmOpen] = useState(false);
  const [cacheBusy, setCacheBusy] = useState(false);

  // --- Lock setup / management state (immediate actions, not draft-saved) ---
  const [setupPassphrase, setSetupPassphrase] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupTimeout, setSetupTimeout] = useState(0);
  const [lockBusy, setLockBusy] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [changeOpen, setChangeOpen] = useState(false);
  const [currentPassphrase, setCurrentPassphrase] = useState("");
  const [newPassphrase, setNewPassphrase] = useState("");
  const [newConfirm, setNewConfirm] = useState("");
  const [disableOpen, setDisableOpen] = useState(false);
  const [disablePassphrase, setDisablePassphrase] = useState("");

  // Draft/dirty pattern for header-saved settings.
  const savedDraft = useMemo(
    () => ({
      auto_show_images: preferences.auto_show_images,
      lock_timeout_seconds: lockStatus?.timeout_seconds ?? 0,
      // Defaults to protected when the status has not loaded, matching the
      // server: absent preference means protection is on.
      impersonation_protection_enabled:
        impersonationStatus?.protection_enabled ?? true,
    }),
    [
      preferences.auto_show_images,
      lockStatus?.timeout_seconds,
      impersonationStatus?.protection_enabled,
    ],
  );
  const [draft, setDraft] = useState(savedDraft);
  const [lastSavedDraft, setLastSavedDraft] = useState<
    typeof savedDraft | null
  >(null);

  useEffect(() => {
    setLastSavedDraft(savedDraft);
    setDraft(savedDraft);
  }, [savedDraft]);

  const baselineDraft = lastSavedDraft ?? savedDraft;
  const dirty =
    draft.auto_show_images !== baselineDraft.auto_show_images ||
    draft.lock_timeout_seconds !== baselineDraft.lock_timeout_seconds ||
    draft.impersonation_protection_enabled !==
      baselineDraft.impersonation_protection_enabled;

  const fetchSettings = useCallback(async () => {
    try {
      const [lockRes, impersonationRes] = await Promise.all([
        apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/security/lock/status`,
        ),
        apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/security/impersonation-status`,
        ),
      ]);

      const lockData = await lockRes.json();
      const impersonationData = await impersonationRes.json();

      if (lockData.status === "success") {
        setLockStatus(normalizeLock(lockData.lock));
      }

      if (impersonationData.status === "success") {
        setImpersonationStatus({
          protection_enabled: impersonationData.protection_enabled,
          is_legitimate: impersonationData.is_legitimate,
          access_allowed: impersonationData.access_allowed,
          blocked_reason: impersonationData.blocked_reason,
          blocked_message: impersonationData.blocked_message,
          is_user_switching: impersonationData.is_user_switching,
        });
      }
    } catch (error) {
      console.error("Failed to fetch security settings:", error);
      setMessage({
        type: "error",
        text: __("Failed to load security settings", "pressedmail"),
      });
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const applyLockResponse = useCallback(
    (data: LockActionResponse | null): boolean => {
      if (data?.status === "success") {
        setLockStatus(normalizeLock(data.lock));
        setMailboxLockStatus(data.lock);
        return true;
      }
      return false;
    },
    [],
  );

  const postLock = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown> = {},
    ): Promise<LockActionResponse | null> => {
      const res = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/security/lock/${endpoint}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      return (await res.json().catch(() => null)) as LockActionResponse | null;
    },
    [],
  );

  const runLockAction = useCallback(
    async (
      endpoint: string,
      body: Record<string, unknown>,
      onSuccess?: () => void,
    ) => {
      setLockBusy(true);
      setLockError(null);
      try {
        const data = await postLock(endpoint, body);
        if (applyLockResponse(data)) {
          onSuccess?.();
          notifyAutosaveSuccess("user-security-settings");
        } else {
          setLockError(
            data?.message ||
              __("The lock settings could not be saved.", "pressedmail"),
          );
        }
      } catch (error) {
        console.error("Mailbox lock action failed:", error);
        setLockError(
          __("The lock settings could not be saved.", "pressedmail"),
        );
      } finally {
        setLockBusy(false);
      }
    },
    [applyLockResponse, postLock],
  );

  const handleSetup = useCallback(async () => {
    if (setupPassphrase !== setupConfirm) {
      setLockError(__("The passphrases don’t match.", "pressedmail"));
      return;
    }
    await runLockAction(
      "setup",
      { passphrase: setupPassphrase, timeout_seconds: setupTimeout },
      () => {
        setSetupPassphrase("");
        setSetupConfirm("");
      },
    );
  }, [runLockAction, setupConfirm, setupPassphrase, setupTimeout]);

  const handleChangePassphrase = useCallback(async () => {
    if (newPassphrase !== newConfirm) {
      setLockError(__("The new passphrases don’t match.", "pressedmail"));
      return;
    }
    await runLockAction(
      "update",
      { current_passphrase: currentPassphrase, new_passphrase: newPassphrase },
      () => {
        setChangeOpen(false);
        setCurrentPassphrase("");
        setNewPassphrase("");
        setNewConfirm("");
      },
    );
  }, [currentPassphrase, newConfirm, newPassphrase, runLockAction]);

  const handleDisable = useCallback(async () => {
    await runLockAction("disable", { passphrase: disablePassphrase }, () => {
      setDisableOpen(false);
      setDisablePassphrase("");
    });
  }, [disablePassphrase, runLockAction]);

  const updateDraft = useCallback(
    <K extends keyof typeof savedDraft>(
      key: K,
      value: (typeof savedDraft)[K],
    ) => {
      setDraft((current) => ({ ...current, [key]: value }));
      setSaveStatus("dirty");
      setMessage(null);
    },
    [],
  );

  const cancelChanges = useCallback(() => {
    setDraft(baselineDraft);
    setSaveStatus("idle");
    setMessage(null);
  }, [baselineDraft]);

  const isEmailCacheOn = preferences.cache_email_body_content;

  const enableEmailCache = useCallback(async () => {
    setCacheBusy(true);
    const ok = await updatePreference("cache_email_body_content", true);
    setCacheBusy(false);

    if (ok) {
      notifyAutosaveSuccess("user-email-cache");
    } else {
      notifyAutosaveError();
    }
  }, [updatePreference]);

  const confirmDisableEmailCache = useCallback(async () => {
    setCacheBusy(true);

    const ok = await updatePreference("cache_email_body_content", false);
    if (!ok) {
      setCacheBusy(false);
      setCacheConfirmOpen(false);
      notifyAutosaveError();
      return;
    }

    // Preference is now off, so stop new body persistence and purge bodies
    // already cached for this user.
    try {
      const response = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/performance/clear-body-cache`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
      const data = await response.json();

      if (data.status !== "success") {
        throw new Error(data.message || "purge failed");
      }

      notifyAutosaveSuccess("user-email-cache");
    } catch (error) {
      console.error("Failed to purge cached email bodies:", error);
      notifyAutosaveError();
    } finally {
      setCacheBusy(false);
      setCacheConfirmOpen(false);
    }
  }, [updatePreference]);

  const handleEmailCacheToggle = useCallback(
    (next: boolean) => {
      if (next) {
        void enableEmailCache();
      } else {
        setCacheConfirmOpen(true);
      }
    },
    [enableEmailCache],
  );

  const saveChanges = useCallback(async () => {
    if (!dirty || saveStatus === "saving") {
      return true;
    }

    const previousDraft = baselineDraft;
    const nextDraft = draft;
    setSaveStatus("saving");
    setMessage(null);

    try {
      if (
        nextDraft.lock_timeout_seconds !== previousDraft.lock_timeout_seconds
      ) {
        const data = await postLock("update", {
          timeout_seconds: nextDraft.lock_timeout_seconds,
        });
        if (!applyLockResponse(data)) {
          throw new Error(
            data?.message ||
              __("Failed to update the lock timeout", "pressedmail"),
          );
        }
      }

      if (
        nextDraft.impersonation_protection_enabled !==
        previousDraft.impersonation_protection_enabled
      ) {
        const response = await apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/security/impersonation-protection`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              enabled: nextDraft.impersonation_protection_enabled,
            }),
          },
        );
        const data = await response.json();

        if (data.status !== "success") {
          throw new Error(
            data.message ||
              __("Failed to update switched-user protection", "pressedmail"),
          );
        }

        // Seed from the server's read-back, not the draft: savedDraft depends
        // on this value, so a disagreement would visibly bounce the switch.
        setImpersonationStatus((previous) =>
          previous
            ? {
                ...previous,
                protection_enabled: data.protection_enabled === true,
              }
            : previous,
        );
      }

      if (nextDraft.auto_show_images !== previousDraft.auto_show_images) {
        const didSave = await updatePreference(
          "auto_show_images",
          nextDraft.auto_show_images,
        );

        if (!didSave) {
          throw new Error(
            __("Failed to update remote image settings", "pressedmail"),
          );
        }
      }

      setLastSavedDraft(nextDraft);
      setDraft(nextDraft);
      setSaveStatus("saved");
      notifyAutosaveSuccess("user-security-settings");
      return true;
    } catch (error) {
      console.error("Failed to update security settings:", error);
      // Snap back to the last known-good state. Unlike a text form, these are
      // switches the server just refused: leaving one showing "on" would claim
      // a protection is active when it is not.
      setDraft(previousDraft);
      setSaveStatus("error");
      setMessage({
        type: "error",
        // Surface the server's own words. A switched-in session is refused with
        // a specific 403 message, and a generic string would hide why the
        // switch just snapped back.
        text:
          error instanceof Error && error.message
            ? error.message
            : __("Failed to update security settings", "pressedmail"),
      });
      notifyAutosaveError();
      return false;
    }
  }, [
    applyLockResponse,
    baselineDraft,
    dirty,
    draft,
    postLock,
    saveStatus,
    updatePreference,
  ]);

  const headerActions = useMemo(
    () =>
      dirty ? (
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={saveStatus === "saving"}
            onClick={cancelChanges}>
            {__("Cancel", "pressedmail")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={saveStatus === "saving"}
            onClick={() => void saveChanges()}>
            {saveStatus === "saving"
              ? __("Saving...", "pressedmail")
              : __("Save", "pressedmail")}
          </Button>
        </div>
      ) : null,
    [cancelChanges, dirty, saveChanges, saveStatus],
  );

  useSettingsHeaderAction("user-security:save", headerActions, 0);

  if (isLoading) {
    return (
      <Card data-test="user-security-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>{__("Security Settings", "pressedmail")}</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            <span>{__("Loading security settings...", "pressedmail")}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const lockEnabled = lockStatus?.enabled === true;

  return (
    <>
      <Card data-test="user-security-settings-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <span>{__("Security Settings", "pressedmail")}</span>
            <SettingsSaveState status={saveStatus} />
          </CardTitle>
          <CardDescription>
            {__(
              "Protect access to your mailbox and control how message content is handled.",
              "pressedmail",
            )}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Message Display */}
          {message && (
            <Alert
              variant={message.type === "error" ? "destructive" : "default"}
              className={
                message.type === "success"
                  ? "bg-primary/10 border-primary/20"
                  : ""
              }>
              {message.type === "error" && <AlertCircle className="h-4 w-4" />}
              {message.type === "info" && <AlertCircle className="h-4 w-4" />}
              <AlertDescription
                className={
                  message.type === "success" ? "text-muted-foreground" : ""
                }>
                {message.text}
              </AlertDescription>
            </Alert>
          )}

          {/* PressedMail Lock */}
          <div
            className="rounded-lg border bg-muted/30 p-4 space-y-3"
            data-test="security-mailbox-lock-tile">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Lock className="h-5 w-5 shrink-0 text-muted-foreground" />
                <p className="text-sm font-medium">
                  {__("PressedMail Lock", "pressedmail")}
                  {lockEnabled && (
                    <span className="ml-2 text-xs font-normal text-primary">
                      {__("Enabled", "pressedmail")}
                    </span>
                  )}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {__(
                  "An optional passphrase that locks your inbox, contacts, calendars, and sending in this browser. Each browser unlocks separately; logging out of WordPress or opening a new browser locks it again. Background mail sync keeps running while locked.",
                  "pressedmail",
                )}
              </p>
            </div>

            {lockError && (
              <Alert variant="destructive" data-test="security-lock-error">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lockError}</AlertDescription>
              </Alert>
            )}

            {!lockEnabled ? (
              <div className="space-y-2" data-test="security-lock-setup">
                <div className="grid gap-2 md:grid-cols-2">
                  <Input
                    type="password"
                    {...sensitiveInputProps("mailbox-lock-passphrase")}
                    placeholder={__(
                      "New passphrase (min. 8 characters)",
                      "pressedmail",
                    )}
                    value={setupPassphrase}
                    onChange={(e) => setSetupPassphrase(e.target.value)}
                    disabled={lockBusy}
                    data-test="security-lock-setup-passphrase"
                  />
                  <Input
                    type="password"
                    {...sensitiveInputProps("mailbox-lock-passphrase-confirm")}
                    placeholder={__("Repeat passphrase", "pressedmail")}
                    value={setupConfirm}
                    onChange={(e) => setSetupConfirm(e.target.value)}
                    disabled={lockBusy}
                    data-test="security-lock-setup-confirm"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {__("Lock after inactivity:", "pressedmail")}
                  </Label>
                  <Select
                    value={String(setupTimeout)}
                    onValueChange={(value) => setSetupTimeout(Number(value))}
                    disabled={lockBusy}>
                    <SelectTrigger
                      className="w-36"
                      data-test="security-lock-setup-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}>
                          {option.label()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => void handleSetup()}
                    disabled={lockBusy || setupPassphrase === ""}
                    data-test="security-lock-setup-submit">
                    {lockBusy && (
                      <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                    )}
                    {__("Enable PressedMail Lock", "pressedmail")}
                  </Button>
                </div>
              </div>
            ) : (
              <div className="space-y-2" data-test="security-lock-manage">
                <div className="flex flex-wrap items-center gap-2">
                  <Label className="text-xs text-muted-foreground">
                    {__("Lock after inactivity:", "pressedmail")}
                  </Label>
                  <Select
                    value={String(draft.lock_timeout_seconds)}
                    onValueChange={(value) =>
                      updateDraft("lock_timeout_seconds", Number(value))
                    }
                    disabled={lockBusy}>
                    <SelectTrigger
                      className="w-36"
                      data-test="security-lock-timeout">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEOUT_OPTIONS.map((option) => (
                        <SelectItem
                          key={option.value}
                          value={String(option.value)}>
                          {option.label()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void runLockAction("lock", {})}
                    disabled={lockBusy}
                    data-test="security-lock-now">
                    {__("Lock now", "pressedmail")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => void runLockAction("lock-all", {})}
                    disabled={lockBusy}
                    data-test="security-lock-all">
                    {__("Lock all sessions", "pressedmail")}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setLockError(null);
                      setChangeOpen(true);
                    }}
                    disabled={lockBusy}
                    data-test="security-lock-change">
                    {__("Change passphrase", "pressedmail")}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-destructive hover:text-destructive"
                    onClick={() => {
                      setLockError(null);
                      setDisableOpen(true);
                    }}
                    disabled={lockBusy}
                    data-test="security-lock-disable">
                    {__("Turn off", "pressedmail")}
                  </Button>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground/80 pt-2 border-t">
              {__(
                "PressedMail Lock protects access through the normal WordPress and PressedMail interfaces: switched admin sessions, open sessions on shared devices, and stolen browser sessions. It does not additionally encrypt your data, and it cannot protect against an administrator or hosting operator who can modify website code, database contents, or server configuration.",
                "pressedmail",
              )}
            </p>
          </div>

          <div className="grid gap-3" data-test="user-security-settings-grid">
            <div
              className={securityTileClass}
              data-test="security-impersonation-tile">
              <div className="flex min-w-0 gap-3">
                <UserX className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <Label
                    htmlFor="impersonation-protection"
                    className="text-sm font-medium cursor-pointer">
                    {__("Block admin impersonation access", "pressedmail")}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {__(
                      "When enabled, WordPress admins using user-switching plugins cannot access your email accounts. If you use PressedMail Lock, your passphrase is still required as well.",
                      "pressedmail",
                    )}
                  </p>
                  {impersonationStatus?.is_user_switching && (
                    <p className="text-xs text-warning mt-2 font-medium">
                      {__(
                        "You are in a switched session. This setting can only be changed from your own login.",
                        "pressedmail",
                      )}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                {saveStatus === "saving" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="impersonation-protection"
                  data-test="security-impersonation-toggle"
                  checked={draft.impersonation_protection_enabled}
                  onCheckedChange={(checked) =>
                    updateDraft("impersonation_protection_enabled", checked)
                  }
                  // Presentation only. A switched session is refused by the
                  // endpoint with a 403; that is the actual control.
                  disabled={impersonationStatus?.is_user_switching === true}
                />
              </div>
            </div>

            {canShowExternalImages && (
              <div
                className={securityTileClass}
                data-test="security-remote-images-tile">
                <div className="flex min-w-0 gap-3">
                  <Eye className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                  <div className="space-y-1">
                    <Label
                      htmlFor="auto-show-images"
                      className="text-sm font-medium cursor-pointer">
                      {__("Automatically load remote images", "pressedmail")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {__(
                        "When enabled, external images in emails load automatically without clicking 'Show images' each time.",
                        "pressedmail",
                      )}
                    </p>
                    <p className="text-xs text-muted-foreground/80 mt-2">
                      {__(
                        "This may expose your activity to email senders via tracking pixels.",
                        "pressedmail",
                      )}
                    </p>
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                  {saveStatus === "saving" && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                  <Switch
                    id="auto-show-images"
                    checked={draft.auto_show_images}
                    onCheckedChange={(checked) =>
                      updateDraft("auto_show_images", checked)
                    }
                    disabled={prefsLoading}
                    data-test="auto-show-images-toggle"
                    data-testid="auto-show-images-toggle"
                  />
                </div>
              </div>
            )}

            <div
              className={securityTileClass}
              data-test="security-email-cache-tile">
              <div className="flex min-w-0 gap-3">
                <Database className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <div className="space-y-1">
                  <Label
                    htmlFor="cache-email-body-content"
                    className="text-sm font-medium cursor-pointer">
                    {__(
                      "Cache email content in DB (Recommended)",
                      "pressedmail",
                    )}
                  </Label>
                  <p className="text-xs text-muted-foreground">
                    {__(
                      "Recommended. Caches the full content of emails you open so they reopen instantly, including across sessions and devices.",
                      "pressedmail",
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground/80 mt-2">
                    {__(
                      "Turning this off can make opening emails slower, since each message is downloaded live from your mail server.",
                      "pressedmail",
                    )}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                {cacheBusy && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="cache-email-body-content"
                  data-test="cache-email-body-toggle"
                  checked={isEmailCacheOn}
                  onCheckedChange={handleEmailCacheToggle}
                  disabled={prefsLoading || cacheBusy}
                />
              </div>
            </div>
          </div>

          {/* Security Note */}
          <div className="text-xs text-muted-foreground/70 pt-2 border-t">
            <p>
              <strong>{__("Note:", "pressedmail")}</strong>{" "}
              {__(
                "Your email credentials are always stored encrypted on this site, whether or not PressedMail Lock is enabled.",
                "pressedmail",
              )}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Change passphrase dialog */}
      <AlertDialog open={changeOpen} onOpenChange={setChangeOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow>
                <Lock />
                <span>{__("Change your passphrase", "pressedmail")}</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "Changing the passphrase locks every other browser session; only this one stays unlocked.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {lockError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lockError}</AlertDescription>
              </Alert>
            )}
            <Input
              type="password"
              {...sensitiveInputProps("mailbox-lock-passphrase")}
              placeholder={__("Current passphrase", "pressedmail")}
              value={currentPassphrase}
              onChange={(e) => setCurrentPassphrase(e.target.value)}
              disabled={lockBusy}
              data-test="security-lock-change-current"
            />
            <Input
              type="password"
              {...sensitiveInputProps("mailbox-lock-passphrase-new")}
              placeholder={__(
                "New passphrase (min. 8 characters)",
                "pressedmail",
              )}
              value={newPassphrase}
              onChange={(e) => setNewPassphrase(e.target.value)}
              disabled={lockBusy}
              data-test="security-lock-change-new"
            />
            <Input
              type="password"
              {...sensitiveInputProps("mailbox-lock-passphrase-new-confirm")}
              placeholder={__("Repeat new passphrase", "pressedmail")}
              value={newConfirm}
              onChange={(e) => setNewConfirm(e.target.value)}
              disabled={lockBusy}
              data-test="security-lock-change-new-confirm"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lockBusy}>
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={
                lockBusy || currentPassphrase === "" || newPassphrase === ""
              }
              onClick={(event) => {
                event.preventDefault();
                void handleChangePassphrase();
              }}>
              {__("Change passphrase", "pressedmail")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable lock dialog */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <AlertDialogContent className="sm:max-w-md">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow variant="destructive">
                <Lock />
                <span>{__("Turn off PressedMail Lock?", "pressedmail")}</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "Your mailbox will open without a passphrase in any logged-in WordPress session. Enter your passphrase to confirm.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            {lockError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{lockError}</AlertDescription>
              </Alert>
            )}
            <Input
              type="password"
              {...sensitiveInputProps("mailbox-lock-passphrase")}
              placeholder={__("Passphrase", "pressedmail")}
              value={disablePassphrase}
              onChange={(e) => setDisablePassphrase(e.target.value)}
              disabled={lockBusy}
              data-test="security-lock-disable-passphrase"
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={lockBusy}>
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={lockBusy || disablePassphrase === ""}
              onClick={(event) => {
                event.preventDefault();
                void handleDisable();
              }}>
              {__("Turn off", "pressedmail")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Email-cache confirm dialog */}
      <AlertDialog open={cacheConfirmOpen} onOpenChange={setCacheConfirmOpen}>
        <AlertDialogContent
          className="sm:max-w-md"
          data-test="cache-email-body-confirm"
          data-testid="cache-email-body-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow variant="destructive">
                <Trash2 />
                <span>
                  {__("Turn off email content caching?", "pressedmail")}
                </span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "Turning this off deletes the email content already cached for your account and loads each message live from your mail server. This can make opening emails slower. You can turn it back on at any time.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setCacheConfirmOpen(false)}
              disabled={cacheBusy}
              data-test="cache-email-body-confirm-cancel"
              data-testid="cache-email-body-confirm-cancel">
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cacheBusy}
              data-test="cache-email-body-confirm-accept"
              data-testid="cache-email-body-confirm-accept"
              onClick={(event) => {
                event.preventDefault();
                void confirmDisableEmailCache();
              }}>
              {__("Turn off and clear cache", "pressedmail")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
