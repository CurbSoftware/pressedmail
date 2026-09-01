import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __ } from "@wordpress/i18n";
import { AlertCircle, Loader2 } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Checkbox,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

import {
  SettingsSaveBar,
  SettingsSectionCard,
  useSettingsNavigationGuard,
  type SettingsDraftHandle,
} from "@/components/settings-ui";
import { WpMailConnectionsPanel } from "@/admin/pages/settings/_components/admin-settings/wp-mail-connections-panel.active";
import { WpMailLogTable } from "./wp-mail-log-table";
import {
  fetchWpMailState,
  saveWpMailSettings,
  type WpMailSettingsView,
  type WpMailState,
} from "@/lib/wp-mail-api";

const RETENTION_CHOICES = [0, 30, 60, 90];

/**
 * Settings tab for the SMTP server WordPress uses to send its own email.
 *
 * Site-wide and administrator-only, which is why it lives in the Admin group
 * rather than beside a user's personal mailboxes. It ships in both editions;
 * everything edition-specific comes from the server's `capabilities`.
 *
 * Connections save individually through their own editor, so this component
 * owns only the two site-wide settings: the runtime switch and log retention.
 */
export function WpMailTab() {
  const [state, setState] = useState<WpMailState | null>(null);
  const [draft, setDraft] = useState<WpMailSettingsView | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const settingsSaveInFlight = useRef(false);
  const [error, setError] = useState("");
  // Connection forms save themselves, but their unsaved edits still have to
  // reach the navigation guard or leaving the tab drops them silently.
  const [connectionDrafts, setConnectionDrafts] = useState<
    Record<string, SettingsDraftHandle>
  >({});

  const registerConnectionDraft = useCallback(
    (key: string, draft: SettingsDraftHandle | null) => {
      setConnectionDrafts((current) => {
        if (!draft) {
          if (!(key in current)) {
            return current;
          }

          const next = { ...current };
          delete next[key];
          return next;
        }

        if (current[key] === draft) {
          return current;
        }

        return { ...current, [key]: draft };
      });
    },
    [],
  );

  const connectionDraftList = useMemo(
    () => Object.values(connectionDrafts),
    [connectionDrafts],
  );
  const connectionsDirty = connectionDraftList.some((entry) => entry.dirty);
  const connectionsSaving = connectionDraftList.some((entry) => entry.saving);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const next = await fetchWpMailState();
      setState(next);
      setDraft(next.settings);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : __("Could not load WordPress email settings.", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty =
    state !== null &&
    draft !== null &&
    (draft.enabled !== state.settings.enabled ||
      draft.logRetentionDays !== state.settings.logRetentionDays);

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (!draft) {
      return true;
    }
    if (settingsSaveInFlight.current || connectionsSaving) {
      return false;
    }

    settingsSaveInFlight.current = true;
    setSaving(true);
    setError("");
    try {
      const result = await saveWpMailSettings({
        enabled: draft.enabled,
        logRetentionDays: draft.logRetentionDays,
      });

      if (!result.ok) {
        setError(
          result.message ??
            __("Could not save WordPress email settings.", "pressedmail"),
        );
        return false;
      }

      if (result.state) {
        setState(result.state);
        setDraft(result.state.settings);
      }
      return true;
    } catch (saveError) {
      setError(
        saveError instanceof Error
          ? saveError.message
          : __("Could not save WordPress email settings.", "pressedmail"),
      );
      return false;
    } finally {
      settingsSaveInFlight.current = false;
      setSaving(false);
    }
  }, [connectionsSaving, draft]);

  // The guard covers the whole tab: the two site-wide settings plus every
  // connection form still holding unsaved edits.
  const saveEverything = useCallback(async (): Promise<boolean> => {
    for (const entry of connectionDraftList) {
      if (entry.dirty && !(await entry.save())) {
        return false;
      }
    }

    if (dirty && !(await handleSave())) {
      return false;
    }

    return true;
  }, [connectionDraftList, dirty, handleSave]);

  useSettingsNavigationGuard({
    dirty: dirty || connectionsDirty,
    onSave: saveEverything,
    saving: saving || connectionsSaving,
  });

  const handleStateChange = (next: WpMailState) => {
    setState(next);
    setDraft((previous) => {
      if (!previous) {
        return next.settings;
      }

      // A connection response also carries the whole option. Preserve a local
      // master-switch edit instead of replacing it with that response snapshot.
      const enabledDirty = previous.enabled !== state?.settings.enabled;
      return enabledDirty
        ? previous
        : { ...previous, enabled: next.settings.enabled };
    });
  };

  if (loading) {
    return (
      <div
        className="flex justify-center py-10"
        data-test="wp-mail-loading"
        data-testid="wp-mail-loading">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!state || !draft) {
    return (
      <Alert variant="destructive">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {error ||
            __("Could not load WordPress email settings.", "pressedmail")}
        </AlertDescription>
      </Alert>
    );
  }

  const hasConnection = state.connections.length > 0;
  const hasUsableDefault = state.connections.some(
    (connection) =>
      connection.isDefault && connection.enabled && connection.isUsable,
  );
  return (
    <div
      className="space-y-4"
      data-test="wp-mail-tab"
      data-testid="wp-mail-tab">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {state.health.map((health) => (
        <Alert
          key={health.connectionId}
          variant="destructive"
          data-test="wp-mail-health-warning">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <span className="font-medium">
              {__("WordPress email needs attention", "pressedmail")}
            </span>
            <span className="ml-1">
              {health.connectionLabel ? `${health.connectionLabel}: ` : ""}
              {health.message ||
                __(
                  "A recent message could not be sent. Review the mail server and send a test email.",
                  "pressedmail",
                )}
            </span>
          </AlertDescription>
        </Alert>
      ))}

      {state.configurationIssues.length > 0 ? (
        <Alert variant="destructive" data-test="wp-mail-configuration-issues">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-1">
            {state.configurationIssues.map((issue) => (
              <p key={issue}>{issue}</p>
            ))}
          </AlertDescription>
        </Alert>
      ) : null}

      <SettingsSectionCard
        title={__("WordPress email", "pressedmail")}
        description={__(
          "Send WordPress system email through your own SMTP server instead of the server's default PHP mailer. That covers password resets, new user notices, WooCommerce order mail, form notifications, and anything else a plugin or theme sends. This is separate from your PressedMail inboxes.",
          "pressedmail",
        )}>
        <div className="space-y-3">
          <Label
            htmlFor="wp-mail-enabled"
            className="flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium">
            <Checkbox
              id="wp-mail-enabled"
              data-test="wp-mail-enabled"
              checked={draft.enabled}
              disabled={
                saving ||
                connectionsSaving ||
                (!draft.enabled && !hasUsableDefault)
              }
              onCheckedChange={(checked) =>
                setDraft({ ...draft, enabled: checked === true })
              }
            />
            <span>
              {__("Send WordPress email through SMTP", "pressedmail")}
            </span>
          </Label>
          {!hasConnection ? (
            <p className="text-xs text-muted-foreground">
              {__(
                "Add a mail server below first, then turn this on.",
                "pressedmail",
              )}
            </p>
          ) : !hasUsableDefault ? (
            <p className="text-xs text-muted-foreground">
              {__(
                "Choose an enabled, complete default mail server before turning this on.",
                "pressedmail",
              )}
            </p>
          ) : null}
        </div>
      </SettingsSectionCard>

      <WpMailConnectionsPanel
        state={state}
        onStateChange={handleStateChange}
        registerDraft={registerConnectionDraft}
        disabled={saving}
      />

      <SettingsSectionCard
        title={__("Delivery log", "pressedmail")}
        description={__(
          "Records genuine WordPress mail so delivery failures can be diagnosed. PressedMail new-mail notification copies are excluded. Content, headers, and attachments are never recorded.",
          "pressedmail",
        )}>
        <div className="space-y-4">
          <div className="max-w-xs space-y-1">
            <Label
              htmlFor="wp-mail-retention-select"
              className="text-xs font-medium">
              {__("Keep entries for", "pressedmail")}
            </Label>
            <Select
              value={String(draft.logRetentionDays)}
              disabled={saving || connectionsSaving}
              onValueChange={(value) =>
                setDraft({ ...draft, logRetentionDays: Number(value) })
              }>
              <SelectTrigger
                id="wp-mail-retention-select"
                data-test="wp-mail-retention-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RETENTION_CHOICES.map((days) => (
                  <SelectItem key={days} value={String(days)}>
                    {days === 0
                      ? __("Do not log", "pressedmail")
                      : /* translators: %d: number of days. */
                        __("%d days", "pressedmail").replace(
                          "%d",
                          String(days),
                        )}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <WpMailLogTable retentionDays={state.settings.logRetentionDays} />
        </div>
      </SettingsSectionCard>

      <SettingsSaveBar
        dirty={dirty}
        saving={saving || connectionsSaving}
        onReset={() => setDraft(state.settings)}
        onSave={() => void handleSave()}
      />
    </div>
  );
}

export default WpMailTab;
