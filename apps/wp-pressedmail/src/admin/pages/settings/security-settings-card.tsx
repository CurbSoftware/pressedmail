import { __ } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import {
  Shield,
  Loader2,
  AlertCircle,
  Lock,
  UserX,
  Eye,
  Database,
  Trash2,
  CheckCircle2,
} from "lucide-react";
import {
  getUserPreferencesSnapshot,
  useUserPreferences,
} from "@/hooks/useUserPreferences";
import {
  notifyAutosaveError,
  notifyAutosaveSuccess,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import { useCanShowExternalImages } from "@/context/admin-settings";
import {
  SettingsSaveState,
  useSettingsHeaderAction,
  SettingsSkeleton,
  SettingsSectionCard,
} from "@/components/settings-ui";
import {
  Alert,
  AlertDescription,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";
import {
  setMailboxLockStatus,
  type MailboxLockRuntimeStatus,
} from "@/lib/mailbox-lock";
import { sensitiveInputProps } from "@/lib/sensitive-input-props";
import { LockShareNote } from "@/components/sharing";

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

// The switch stays on the label's row at every width, so on a phone it is not
// stranded under the description.
const securityTileClass =
  "grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-lg border bg-muted/30 p-4";

// A hover step you can see: the palette's --primary-hover sits a few points
// from --primary, so the on track moves toward the text colour instead, which is
// darker in light mode and lighter in dark, so hover always adds contrast.
// Fading toward the tile read as disabled in dark mode. Focus and the off look
// are global (tailwind-base.css), like every other control's.
// The visible switch is 32x18; the kit's own ::after hit area makes the tap
// target 56x34, and 56x48 on a phone, so no extra padding is needed here.
const securitySwitchClass =
  "hover:data-checked:bg-[color-mix(in_oklch,var(--primary)_70%,var(--foreground))]";

// Every status line in the storage tile: one 14px icon slot, one indent.
const cacheStatusLineClass = "flex items-center gap-1.5 text-xs";

// The kit's light outline hover is about 1.06:1 against rest; a darker edge
// makes hover visible. Used by both outline buttons in the storage flow.
const cacheOutlineHoverClass = "hover:border-muted-foreground hover:bg-muted";

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
  // A clear is running. Both clears (the dialog's and the button's) show the
  // same status line, spinner plus "Clearing stored email...", in the live region.
  const [cacheClearing, setCacheClearing] = useState(false);
  // The running clear came from the button, which then stays put (same label,
  // same width) so focus is not lost.
  const [cacheRetrying, setCacheRetrying] = useState(false);
  // One inline outcome for the stored-content flow: no toasts, so a failure is
  // never reported twice, and never under a stale message from the last try.
  const [cacheOutcome, setCacheOutcome] = useState<
    "idle" | "purge-failed" | "save-failed"
  >("idle");
  // Set by a successful clear and kept through a later failed save, so the
  // clear button never comes back for content that is already gone.
  const [cacheCleared, setCacheCleared] = useState(false);
  const cacheRetryRef = useRef<HTMLButtonElement>(null);

  // --- Lock setup / management state (immediate actions, not draft-saved) ---
  const [setupPassphrase, setSetupPassphrase] = useState("");
  const [setupConfirm, setSetupConfirm] = useState("");
  const [setupFieldError, setSetupFieldError] = useState<string | null>(null);
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
    }),
    [preferences.auto_show_images, lockStatus?.timeout_seconds],
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
    draft.lock_timeout_seconds !== baselineDraft.lock_timeout_seconds;

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
    setSetupFieldError(null);

    if (setupPassphrase === "") {
      setSetupFieldError(
        __("Enter a passphrase to turn the lock on.", "pressedmail"),
      );
      return;
    }

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
  // An earlier purge the server never finished (it may have run in the
  // background), so some stored content may still be on the site.
  const cachePurgePending = preferences.body_purge_pending === true;

  const enableEmailCache = useCallback(async () => {
    setCacheBusy(true);
    setCacheOutcome("idle");
    const ok = await updatePreference("cache_email_body_content", true);
    setCacheBusy(false);

    if (ok) {
      // Storage is on again and refills in the background: nothing is "cleared" now.
      setCacheCleared(false);
      notifyAutosaveSuccess("user-email-cache");
    } else {
      setCacheOutcome("save-failed");
    }
  }, [updatePreference]);

  const clearStoredEmailContent = useCallback(async (retry = false) => {
    setCacheBusy(true);
    setCacheClearing(true);
    setCacheRetrying(retry);
    // A retry starts clean: the old failure must not sit next to the new attempt.
    setCacheOutcome("idle");
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

      setCacheCleared(true);
    } catch (error) {
      console.error("Failed to purge cached email bodies:", error);
      setCacheOutcome("purge-failed");
    } finally {
      setCacheBusy(false);
      setCacheClearing(false);
      setCacheRetrying(false);
    }
  }, []);

  const confirmDisableEmailCache = useCallback(async () => {
    setCacheBusy(true);
    setCacheClearing(true);
    setCacheOutcome("idle");
    const ok = await updatePreference("cache_email_body_content", false);
    setCacheClearing(false);
    if (!ok) {
      // The server saves the setting before it deletes, so a failure with the
      // setting now off is the delete. If the save itself failed, the store put
      // the switch back on: say that, or the dialog would just close silently.
      setCacheOutcome(
        getUserPreferencesSnapshot().cache_email_body_content
          ? "save-failed"
          : "purge-failed",
      );
      setCacheBusy(false);
      setCacheConfirmOpen(false);
      return;
    }
    setCacheConfirmOpen(false);
    setCacheCleared(true);
    setCacheBusy(false);
  }, [updatePreference]);

  // Keyboard users land back where they were, not on <body>: the dialog opens
  // from the switch without a Trigger, so it has nothing to return to itself.
  const cacheSwitchFocusTarget = useCallback(
    () =>
      document.querySelector<HTMLElement>(
        '[data-test="cache-email-body-toggle"]',
      ),
    [],
  );

  // A clear started from the dialog that then fails: move focus from the
  // switch to the retry button, the one thing left to do.
  useEffect(() => {
    if (
      cacheOutcome === "purge-failed" &&
      document.activeElement === cacheSwitchFocusTarget()
    ) {
      cacheRetryRef.current?.focus();
    }
  }, [cacheOutcome, cacheSwitchFocusTarget]);

  const handleEmailCacheToggle = useCallback(
    (next: boolean) => {
      // Not disabled while busy, so it keeps focus and full contrast; a change
      // mid-request is simply ignored.
      if (cacheBusy) {
        return;
      }
      if (next) {
        void enableEmailCache();
      } else {
        // A new attempt: the last one's error must not sit under the dialog.
        setCacheOutcome("idle");
        setCacheConfirmOpen(true);
      }
    },
    [cacheBusy, enableEmailCache],
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
      <SettingsSkeleton
        label={__("Loading security settings...", "pressedmail")}
        dataTest="user-security-settings-card"
        rows={3}
      />
    );
  }

  const lockEnabled = lockStatus?.enabled === true;

  return (
    <>
      <SettingsSectionCard
        title={__("Mailbox privacy", "pressedmail")}
        actions={<SettingsSaveState status={saveStatus} />}
        contentClassName="space-y-4"
        dataTest="user-security-settings-card">
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
                "Lock your mail, contacts, calendar, and sending with a passphrase in each browser. Background sync keeps running.",
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
                  id="security-lock-setup-passphrase"
                  aria-label={__("New passphrase", "pressedmail")}
                  aria-invalid={setupFieldError ? true : undefined}
                  aria-describedby={
                    setupFieldError
                      ? "security-lock-setup-passphrase-error"
                      : undefined
                  }
                  {...sensitiveInputProps("mailbox-lock-passphrase")}
                  placeholder={__(
                    "New passphrase (min. 8 characters)",
                    "pressedmail",
                  )}
                  value={setupPassphrase}
                  onChange={(e) => {
                    setSetupPassphrase(e.target.value);
                    setSetupFieldError(null);
                  }}
                  disabled={lockBusy}
                  data-test="security-lock-setup-passphrase"
                />
                <Input
                  type="password"
                  {...sensitiveInputProps("mailbox-lock-passphrase-confirm")}
                  aria-label={__("Repeat new passphrase", "pressedmail")}
                  placeholder={__("Repeat passphrase", "pressedmail")}
                  value={setupConfirm}
                  onChange={(e) => setSetupConfirm(e.target.value)}
                  disabled={lockBusy}
                  data-test="security-lock-setup-confirm"
                />
              </div>
              {setupFieldError ? (
                <p
                  id="security-lock-setup-passphrase-error"
                  role="alert"
                  className="text-xs text-destructive"
                  data-test="security-lock-setup-error"
                  data-testid="security-lock-setup-error">
                  {setupFieldError}
                </p>
              ) : null}
              <div className="flex flex-wrap items-center gap-2">
                <Label
                  htmlFor="security-lock-setup-timeout"
                  className="text-xs text-muted-foreground">
                  {__("Lock after inactivity:", "pressedmail")}
                </Label>
                <Select
                  value={String(setupTimeout)}
                  onValueChange={(value) => setSetupTimeout(Number(value))}
                  disabled={lockBusy}>
                  <SelectTrigger
                    id="security-lock-setup-timeout"
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
                  disabled={lockBusy}
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
                <Label
                  htmlFor="security-lock-timeout"
                  className="text-xs text-muted-foreground">
                  {__("Lock after inactivity:", "pressedmail")}
                </Label>
                <Select
                  value={String(draft.lock_timeout_seconds)}
                  onValueChange={(value) =>
                    updateDraft("lock_timeout_seconds", Number(value))
                  }
                  disabled={lockBusy}>
                  <SelectTrigger
                    id="security-lock-timeout"
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

          <details className="text-xs text-muted-foreground pt-2 border-t">
            <summary className="cursor-pointer font-medium">
              {__("What the lock protects", "pressedmail")}
            </summary>
            <p className="pt-2">
              {__(
                "PressedMail Lock protects access through the normal WordPress and PressedMail interfaces: switched admin sessions, open sessions on shared devices, and stolen browser sessions. It does not additionally encrypt your data, and it cannot protect against an administrator or hosting operator who can modify website code, database contents, or server configuration.",
                "pressedmail",
              )}
            </p>
            <LockShareNote />
          </details>
        </div>

        <div className="grid gap-3" data-test="user-security-settings-grid">
          <div
            className="flex items-start gap-3 rounded-lg border bg-muted/30 p-4"
            role="note"
            data-test="security-impersonation-tile">
            <div className="flex min-w-0 gap-3">
              <UserX className="h-5 w-5 mt-0.5 shrink-0 text-muted-foreground" />
              <div className="space-y-1">
                <p className="text-sm font-medium leading-5">
                  {__("Your mailbox stays private", "pressedmail")}
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {__("Always on", "pressedmail")}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  {__(
                    "WordPress administrators and switched sessions cannot open your mailbox. Sign in with your own account to read your email.",
                    "pressedmail",
                  )}
                </p>
                {impersonationStatus?.is_user_switching && (
                  <p className="text-xs text-warning mt-2 font-medium">
                    {__(
                      "You are in a switched session. Sign out and use your own login to open your mailbox.",
                      "pressedmail",
                    )}
                  </p>
                )}
              </div>
            </div>
          </div>

          {canShowExternalImages && (
            <div
              className={securityTileClass}
              data-test="security-remote-images-tile">
              {/* Same grid as the storage tile below: title beside the switch,
                  text under both on phones. */}
              <div className="flex min-w-0 gap-3">
                <Eye className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
                <Label
                  id="auto-show-images-label"
                  htmlFor="auto-show-images"
                  className="text-sm font-medium leading-5 cursor-pointer">
                  {__("Automatically load remote images", "pressedmail")}
                </Label>
              </div>
              <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
                {saveStatus === "saving" && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
                <Switch
                  id="auto-show-images"
                  aria-labelledby="auto-show-images-label"
                  className={securitySwitchClass}
                  checked={draft.auto_show_images}
                  onCheckedChange={(checked) =>
                    updateDraft("auto_show_images", checked)
                  }
                  disabled={prefsLoading}
                  data-test="auto-show-images-toggle"
                  data-testid="auto-show-images-toggle"
                />
              </div>
              <div className="col-span-2 -mt-2 space-y-2 pl-8 sm:col-span-1">
                <p className="text-xs text-muted-foreground">
                  {__(
                    "When enabled, external images in emails load automatically without clicking 'Show images' each time.",
                    "pressedmail",
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {__(
                    "This may expose your activity to email senders via tracking pixels.",
                    "pressedmail",
                  )}
                </p>
              </div>
            </div>
          )}

          <div
            className={securityTileClass}
            data-test="security-email-cache-tile">
            {/* Title row beside the switch; the text below spans the full width on
                phones instead of wrapping in a narrow column next to it. The tag
                sits outside the label, so the switch's name is just the title. */}
            <div className="flex min-w-0 gap-3">
              <Database className="h-5 w-5 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-sm font-medium leading-5">
                <Label
                  id="cache-email-body-content-label"
                  htmlFor="cache-email-body-content"
                  className="inline cursor-pointer text-sm font-medium leading-5">
                  {__("Store email on this site", "pressedmail")}
                </Label>
                <span className="ml-2 whitespace-nowrap text-xs font-normal text-muted-foreground">
                  {__("Recommended", "pressedmail")}
                </span>
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-2 sm:pt-0.5">
              {/* The spinner's slot is always there, so the text never reflows. It
                  shows a save; a delete says so in words below. */}
              <span
                className="flex size-4 items-center justify-center"
                aria-hidden="true">
                {cacheBusy && !cacheClearing && (
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </span>
              <Switch
                id="cache-email-body-content"
                aria-labelledby="cache-email-body-content-label"
                aria-describedby="cache-email-body-content-description"
                className={securitySwitchClass}
                data-test="cache-email-body-toggle"
                checked={isEmailCacheOn}
                onCheckedChange={handleEmailCacheToggle}
                disabled={prefsLoading}
                aria-busy={cacheBusy || undefined}
              />
            </div>
            <div className="col-span-2 -mt-2 space-y-2 pl-8 sm:col-span-1">
              <p
                id="cache-email-body-content-description"
                className="text-xs text-muted-foreground">
                {isEmailCacheOn
                  ? __(
                      "Stores messages, bodies and metadata from all your mail folders for fast access. Attachment files load when you open them. Stored messages have no automatic expiry.",
                      "pressedmail",
                    )
                  : __(
                      "Messages load directly from IMAP and will be slower. Views and rules that need stored email are unavailable.",
                      "pressedmail",
                    )}
              </p>
              {/* One polite region for every status line: an assertive role=alert
                  inside it made some screen readers announce errors twice. */}
              <div aria-live="polite" className="space-y-2 empty:hidden">
                {cacheClearing && !cacheRetrying && (
                  <p
                    className={cacheStatusLineClass + " text-muted-foreground"}>
                    <Loader2
                      className="size-3.5 shrink-0 animate-spin"
                      aria-hidden="true"
                    />
                    {__("Deleting stored email\u2026", "pressedmail")}
                  </p>
                )}
                {cacheOutcome === "save-failed" && (
                  <p className={cacheStatusLineClass + " text-destructive"}>
                    <AlertCircle
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {__(
                      "Couldn't save this setting. Use the switch to try again.",
                      "pressedmail",
                    )}
                  </p>
                )}
                {!isEmailCacheOn && cacheOutcome === "purge-failed" && (
                  <p className={cacheStatusLineClass + " text-destructive"}>
                    <AlertCircle
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {__(
                      "Couldn't delete stored email. It's still on this site.",
                      "pressedmail",
                    )}
                  </p>
                )}
                {!isEmailCacheOn &&
                  cachePurgePending &&
                  !cacheCleared &&
                  !cacheClearing &&
                  cacheOutcome === "idle" && (
                    <p
                      className={
                        cacheStatusLineClass + " text-muted-foreground"
                      }>
                      <AlertCircle
                        className="size-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      {__(
                        "An earlier delete didn't finish, so some stored email may still be on this site.",
                        "pressedmail",
                      )}
                    </p>
                  )}
                {!isEmailCacheOn && cacheCleared && cacheOutcome === "idle" && (
                  <p
                    className={
                      cacheStatusLineClass + " font-medium text-success"
                    }>
                    <CheckCircle2
                      className="size-3.5 shrink-0"
                      aria-hidden="true"
                    />
                    {__("Stored email deleted.", "pressedmail")}
                  </p>
                )}
                {/* Only when something may be left to delete: a delete that failed
                    now, one that never finished (from an earlier visit or the
                    background), or the retry running on this button, which then
                    shows its own spinner instead of a second status line. */}
                {!isEmailCacheOn &&
                  !cacheCleared &&
                  (cacheOutcome === "purge-failed" ||
                    cacheRetrying ||
                    (cachePurgePending && !cacheClearing)) && (
                    <Button
                      ref={cacheRetryRef}
                      type="button"
                      variant="outline"
                      className={
                        cacheOutlineHoverClass +
                        " max-sm:min-h-11 aria-disabled:cursor-wait"
                      }
                      aria-disabled={cacheBusy || undefined}
                      onClick={() => {
                        if (!cacheBusy) {
                          void clearStoredEmailContent(true);
                        }
                      }}>
                      {cacheRetrying && (
                        <Loader2
                          className="size-3.5 animate-spin"
                          aria-hidden="true"
                        />
                      )}
                      {__("Delete stored email", "pressedmail")}
                    </Button>
                  )}
              </div>
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
      </SettingsSectionCard>

      {/* Change passphrase dialog */}
      <AlertDialog open={changeOpen} onOpenChange={setChangeOpen}>
        <PressedAlertDialogContent size="paletteForm">
          <PressedAlertDialogHeader
            title={__("Change your passphrase", "pressedmail")}
            icon={Lock}
            description={__(
              "Changing the passphrase locks every other browser session; only this one stays unlocked.",
              "pressedmail",
            )}
          />
          <PressedOverlayBody className="space-y-2">
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
              aria-label={__("Current passphrase", "pressedmail")}
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
              aria-label={__("New passphrase", "pressedmail")}
              data-test="security-lock-change-new"
            />
            <Input
              type="password"
              {...sensitiveInputProps("mailbox-lock-passphrase-new-confirm")}
              placeholder={__("Repeat new passphrase", "pressedmail")}
              value={newConfirm}
              onChange={(e) => setNewConfirm(e.target.value)}
              disabled={lockBusy}
              aria-label={__("Repeat new passphrase", "pressedmail")}
              data-test="security-lock-change-new-confirm"
            />
          </PressedOverlayBody>
          <PressedOverlayFooter>
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
          </PressedOverlayFooter>
        </PressedAlertDialogContent>
      </AlertDialog>

      {/* Disable lock dialog */}
      <AlertDialog open={disableOpen} onOpenChange={setDisableOpen}>
        <PressedAlertDialogContent size="confirmation">
          <PressedAlertDialogHeader
            title={__("Turn off PressedMail Lock?", "pressedmail")}
            icon={Lock}
            tone="destructive"
            description={__(
              "Your mailbox will open without a passphrase in any logged-in WordPress session. Enter your passphrase to confirm.",
              "pressedmail",
            )}
          />
          <PressedOverlayBody className="space-y-2">
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
              aria-label={__("Passphrase", "pressedmail")}
              data-test="security-lock-disable-passphrase"
            />
          </PressedOverlayBody>
          <PressedOverlayFooter>
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
          </PressedOverlayFooter>
        </PressedAlertDialogContent>
      </AlertDialog>

      {/* Email-cache confirm dialog */}
      <AlertDialog open={cacheConfirmOpen} onOpenChange={setCacheConfirmOpen}>
        <PressedAlertDialogContent
          size="confirmation"
          onCloseAutoFocus={(event) => {
            const target = cacheSwitchFocusTarget();
            if (target) {
              event.preventDefault();
              target.focus();
            }
          }}
          data-test="cache-email-body-confirm"
          data-testid="cache-email-body-confirm">
          <PressedAlertDialogHeader
            title={__("Stop storing email on this site?", "pressedmail")}
            icon={Trash2}
            tone="destructive"
            description={__(
              "This removes cached messages, bodies, headers, snippets, search data and AI reports from this site and browser. Your settings, templates and authored drafts stay. Messages load directly from IMAP and will be slower. Combined inboxes, local search, threads and rules that need stored email will be unavailable.",
              "pressedmail",
            )}
          />
          <PressedOverlayFooter>
            {/* A kit Button, so Cancel gets the same height, focus ring and
                data-slot rules as the action beside it. Radix focuses Cancel on
                open, so a stray Enter never deletes anything. */}
            <AlertDialogCancel asChild>
              <Button
                type="button"
                variant="outline"
                onClick={() => setCacheConfirmOpen(false)}
                disabled={cacheBusy}
                // mt-0: the kit's Cancel adds mt-2 for its own stacked footer; this
                // footer already spaces its buttons with a gap.
                className={cacheOutlineHoverClass + " mt-0"}
                data-test="cache-email-body-confirm-cancel"
                data-testid="cache-email-body-confirm-cancel">
                {__("Cancel", "pressedmail")}
              </Button>
            </AlertDialogCancel>
            <Button
              type="button"
              disabled={cacheBusy}
              // Solid, like every other irreversible delete in PressedMail (the
              // tag and signature dialogs): the committing action is the loudest.
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-test="cache-email-body-confirm-accept"
              data-testid="cache-email-body-confirm-accept"
              onClick={(event) => {
                event.preventDefault();
                void confirmDisableEmailCache();
              }}>
              {__("Turn off and delete", "pressedmail")}
            </Button>
          </PressedOverlayFooter>
        </PressedAlertDialogContent>
      </AlertDialog>
    </>
  );
}
