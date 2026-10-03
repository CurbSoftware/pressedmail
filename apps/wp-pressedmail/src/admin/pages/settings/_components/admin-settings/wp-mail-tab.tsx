import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { AlertCircle } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kit/ui/plugin";

import {
  SettingsSaveBar,
  SettingsSectionCard,
  useSettingsNavigationGuard,
  SettingsSkeleton,
  type SettingsDraftHandle,
} from "@/components/settings-ui";
import { WpMailConnectionsPanel } from "@/admin/pages/settings/_components/admin-settings/wp-mail-connections-panel.active";
import { WpMailDefaultSmtp } from "@/admin/pages/settings/_components/admin-settings/wp-mail-default-smtp.active";
import {
  WordPressNotificationTemplates,
  sectionDraftBar,
} from "@/admin/pages/settings/_components/admin-settings/wordpress-notification-templates.active";
import { smtpHealthCopy } from "@/components/wp-mail/smtp-health-copy";
import { WpMailRoutingCard } from "@/components/wp-mail/WpMailRoutingCard";
import { WpMailLogTable } from "./wp-mail-log-table";
import {
  fetchWpMailState,
  saveWpMailSettings,
  type WpMailSettingsView,
  type WpMailState,
} from "@/lib/wp-mail-api";

const RETENTION_CHOICES = [0, 30, 60, 90];

/**
 * The halves of this page. One decides what WordPress sends its own mail
 * through, the other holds the servers it can send through. Both panels are
 * commonly needed at once, so neither reading order is the wrong one.
 *
 * Pro splits the decision in two and names the panels for what they hold:
 * SMTP Accounts (`mail-servers`), Default SMTP (`default-smtp`, where the
 * master switch lives) and System Emails (`system-emails`, the per-email
 * choices and the delivery log). Free keeps the two it has always had. The
 * internal ids are the same in both, so nothing that names a panel by id cares
 * which edition it is running in.
 */
type WpMailPanel = "system-emails" | "mail-servers" | "default-smtp";

/**
 * Settings tab for the SMTP server WordPress uses to send its own email.
 *
 * Site-wide and administrator-only, which is why it lives in the Admin group
 * rather than beside a user's personal mailboxes. It ships in both editions;
 * everything edition-specific comes from the server's `capabilities`.
 *
 * Split into two panels: the system-email settings and the mail servers they
 * send through. Connections save individually through their own editor, so this
 * component owns only the two site-wide settings: the runtime switch and log
 * retention.
 */
export function WpMailTab() {
  const [state, setState] = useState<WpMailState | null>(null);
  const [draft, setDraft] = useState<WpMailSettingsView | null>(null);
  // Both editions open on System Emails, as they always have. In Pro the master
  // switch now sits one tab over, on Default SMTP.
  const [panel, setPanel] = useState<WpMailPanel>("system-emails");
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
  // The notification section registers like a connection form, so the leave prompt
  // covers it, but its edits are not a form of their own: this tab's save bar
  // saves and resets them with the tab's own settings.
  const section = sectionDraftBar(connectionDrafts);

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

  // A test of a saved connection records its outcome on the server. Look again
  // so the banner and the cards say so, and leave every draft alone: only the
  // state is replaced, not the settings the master switch is being edited in.
  const refreshHealth = useCallback(async () => {
    try {
      setState(await fetchWpMailState());
    } catch {
      // The tab already shows what it last knew. A failed refresh is not news.
    }
  }, []);

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

  // The save bar: the section's rows first, because a refused row should not half-save the tab.
  const saveBar = useCallback(async (): Promise<void> => {
    if (!(await sectionDraftBar(connectionDrafts).save())) {
      return;
    }

    if (dirty) {
      await handleSave();
    }
  }, [connectionDrafts, dirty, handleSave]);

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
      <SettingsSkeleton
        label={__("Loading WordPress email settings", "pressedmail")}
        dataTest="wp-mail-loading"
        rows={2}
      />
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

  // The hints name the tab that holds the connections, and Pro calls it
  // something else. Free's two sentences are exactly what they always were.
  const routingCard = (
    <WpMailRoutingCard
      enabled={draft.enabled}
      onEnabledChange={(enabled) => setDraft({ ...draft, enabled })}
      hasConnection={hasConnection}
      hasUsableDefault={hasUsableDefault}
      disabled={saving || connectionsSaving}
      pressedmailDescription={
        __IS_PRO__
          ? __(
              "An SMTP account you set up here. Applies site-wide, to every plugin and theme.",
              "pressedmail",
            )
          : __(
              "A mail server you set up here. Applies site-wide, to every plugin and theme.",
              "pressedmail",
            )
      }
      noConnectionHint={
        __IS_PRO__
          ? __(
              "Add an SMTP account on the SMTP Accounts tab to use this.",
              "pressedmail",
            )
          : __(
              "Add a mail server on the Mail servers tab to use this.",
              "pressedmail",
            )
      }
      notReadyHint={
        __IS_PRO__
          ? __(
              "Enable an SMTP account on the SMTP Accounts tab, finish its settings, and make it the default to use this.",
              "pressedmail",
            )
          : __(
              "Enable a mail server on the Mail servers tab, finish its settings, and make it the default to use this.",
              "pressedmail",
            )
      }
    />
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
              {health.errorClass
                ? smtpHealthCopy(
                    health.errorClass,
                    health.connectionLabel,
                    health.detail ?? "",
                  )
                : // A payload from before failures were classified.
                  `${health.connectionLabel ? `${health.connectionLabel}: ` : ""}${
                    health.message ||
                    __(
                      "A recent message could not be sent. Review the mail server and send a test email.",
                      "pressedmail",
                    )
                  }`}
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

      {/* Both panels stay mounted, for two reasons that are not cosmetic. A
          half-filled mail server editor holds a typed host name and password,
          and this page's Add mail server (Add SMTP account, in Pro) action is registered from inside the
          panel: replacing either one on a panel switch would drop the draft and
          take the button out of the settings header with it. */}
      <Tabs
        value={panel}
        onValueChange={(value) => setPanel(String(value) as WpMailPanel)}
        data-test="wp-mail-panels"
        data-testid="wp-mail-panels">
        <TabsList aria-label={__("WordPress email sections", "pressedmail")}>
          {__IS_PRO__ ? (
            <>
              <TabsTrigger
                value="mail-servers"
                data-test="wp-mail-panel-mail-servers"
                data-testid="wp-mail-panel-mail-servers">
                {__("SMTP Accounts", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="default-smtp"
                data-test="wp-mail-panel-default-smtp"
                data-testid="wp-mail-panel-default-smtp">
                {__("Default SMTP", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="system-emails"
                data-test="wp-mail-panel-system-emails"
                data-testid="wp-mail-panel-system-emails">
                {__("System Emails", "pressedmail")}
              </TabsTrigger>
            </>
          ) : (
            <>
              <TabsTrigger
                value="system-emails"
                data-test="wp-mail-panel-system-emails"
                data-testid="wp-mail-panel-system-emails">
                {__("System Emails", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="mail-servers"
                data-test="wp-mail-panel-mail-servers"
                data-testid="wp-mail-panel-mail-servers">
                {__("Mail servers", "pressedmail")}
              </TabsTrigger>
            </>
          )}
        </TabsList>

        <TabsContent
          value="system-emails"
          keepMounted
          className="space-y-4"
          data-test="wp-mail-system-emails-panel">
          {/* Pro decides where WordPress sends its email on the Default SMTP
              panel. Free has no such panel, so its System Emails panel keeps
              the switch, as it always has. */}
          {__IS_PRO__ ? null : routingCard}

          <WordPressNotificationTemplates
            registerDraft={registerConnectionDraft}
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
                          : sprintf(
                              /* translators: %d: number of days entries are kept. */
                              _n("%d day", "%d days", days, "pressedmail"),
                              days,
                            )}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <WpMailLogTable
                retentionDays={state.settings.logRetentionDays}
              />
            </div>
          </SettingsSectionCard>
        </TabsContent>

        {__IS_PRO__ ? (
          <TabsContent
            value="default-smtp"
            keepMounted
            className="space-y-4"
            data-test="wp-mail-default-smtp-panel">
            {routingCard}
            <WpMailDefaultSmtp
              state={state}
              onStateChange={handleStateChange}
              disabled={saving || connectionsSaving}
            />
          </TabsContent>
        ) : null}

        <TabsContent
          value="mail-servers"
          keepMounted
          className="space-y-4"
          data-test="wp-mail-mail-servers-panel">
          {/* Rendered in both states of the master switch on the other panel.
              Hiding this while the site is on the WordPress default would hide
              the only way to add the mail server that switch needs, which is
              the state most people arrive in. */}
          <WpMailConnectionsPanel
            state={state}
            onStateChange={handleStateChange}
            registerDraft={registerConnectionDraft}
            disabled={saving}
            onRequestFocus={() => setPanel("mail-servers")}
            onHealthChange={() => void refreshHealth()}
          />
        </TabsContent>
      </Tabs>

      <SettingsSaveBar
        dirty={dirty || section.dirty}
        saving={saving || connectionsSaving}
        onReset={() => {
          setDraft(state.settings);
          section.cancel();
        }}
        onSave={() => void saveBar()}
      />
    </div>
  );
}

export default WpMailTab;
