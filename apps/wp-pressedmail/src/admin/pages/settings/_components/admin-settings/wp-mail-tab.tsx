import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { AlertCircle, Lock, RotateCw } from "lucide-react";

import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
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
  SettingsEmptyState,
  SettingsSaveBar,
  SettingsSectionCard,
  useSettingsNavigationGuard,
  type SettingsDraftHandle,
} from "@/components/settings-ui";
import { WpMailConnectionsPanel } from "@/admin/pages/settings/_components/admin-settings/wp-mail-connections-panel.active";
import { WpMailDefaultSmtp } from "@/admin/pages/settings/_components/admin-settings/wp-mail-default-smtp.active";
import { WooEmailsPanel } from "@/admin/pages/settings/_components/admin-settings/woo-emails-panel.active";
import {
  WordPressNotificationTemplates,
  sectionDraftBar,
} from "@/admin/pages/settings/_components/admin-settings/wordpress-notification-templates.active";
import {
  pluginMessageOf,
  smtpHealthCopy,
} from "@/components/wp-mail/smtp-health-copy";
import { WpMailRoutingCard } from "@/components/wp-mail/WpMailRoutingCard";
import { WpMailLogTable } from "./wp-mail-log-table";
import { WpMailSkeleton } from "./wp-mail-skeleton";
import {
  fetchWpMailState,
  saveWpMailSettings,
  type WpMailSettingsView,
  type WpMailState,
} from "@/lib/wp-mail-api";
import { PermissionError } from "@/lib/api-client";
import { usesExternalConnections } from "@/lib/wp-mail-connections";

const RETENTION_CHOICES = [0, 30, 60, 90];

/**
 * The halves of this page. One decides what WordPress sends its own mail
 * through, the other holds the servers it can send through. Both panels are
 * commonly needed at once, so neither reading order is the wrong one.
 *
 * Pro splits the decision in two and names the panels for what they hold:
 * SMTP Accounts (`mail-servers`), Default SMTP (`default-smtp`, where the
 * master switch lives) and System Emails (`system-emails`, the per-email
 * choices and the delivery log). Once another plugin provides a connection
 * type, the first two are Connections and Default connection. Pro also offers `woo`, the WooCommerce
 * emails panel, whenever the Woo Bridge companion is active. Free keeps the
 * two it has always had. The internal ids are the same in both, so nothing
 * that names a panel by id cares which edition it is running in.
 */
type WpMailPanel = "system-emails" | "mail-servers" | "default-smtp" | "woo";

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
/** On body while this page is open: admin/index.css hides the admin notice. */
const NOTICE_HIDDEN_CLASS = "pressedmail-wp-mail-open";

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
  // The server refused the load for lack of permission: trying again cannot help.
  const [denied, setDenied] = useState(false);
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
  // The system email rows and the WooCommerce panel register like connection
  // forms, so the leave prompt covers them, but their edits are not forms of
  // their own: this tab's save bar saves and resets them with the tab's own settings.
  const section = sectionDraftBar(connectionDrafts);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    setDenied(false);
    try {
      const next = await fetchWpMailState();
      setState(next);
      setDraft(next.settings);
    } catch (loadError) {
      setDenied(loadError instanceof PermissionError);
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

  // WordPress's admin notice above the app repeats what this page shows, with
  // a link to this page. PHP cannot see the hash route, so the page hides it
  // while it is open, once it has something to show instead.
  const loaded = state !== null;
  useEffect(() => {
    if (!loaded) {
      return undefined;
    }
    document.body.classList.add(NOTICE_HIDDEN_CLASS);
    return () => document.body.classList.remove(NOTICE_HIDDEN_CLASS);
  }, [loaded]);

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
    return <WpMailSkeleton />;
  }

  if (!state || !draft) {
    if (denied) {
      // Not a failure to retry: this page is for administrators.
      return (
        <div role="alert" data-test="wp-mail-load-denied" data-testid="wp-mail-load-denied">
          <SettingsEmptyState
            icon={<Lock className="h-5 w-5" aria-hidden="true" />}
            title={__("Only administrators can manage WordPress email.", "pressedmail")}
          />
        </div>
      );
    }
    const fallback = __("Could not load WordPress email settings.", "pressedmail");

    return (
      <div role="alert" data-test="wp-mail-load-error" data-testid="wp-mail-load-error">
        <SettingsEmptyState
          icon={<AlertCircle className="h-5 w-5" aria-hidden="true" />}
          title={__("Could not load WordPress email settings", "pressedmail")}
          description={error && error !== fallback ? error : undefined}
          actions={
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="min-h-11"
              onClick={() => void load()}>
              <RotateCw className="me-2 h-4 w-4" aria-hidden="true" />
              {__("Try again", "pressedmail")}
            </Button>
          }
        />
      </div>
    );
  }

  const hasConnection = state.connections.length > 0;
  const hasUsableDefault = state.connections.some(
    (connection) =>
      connection.isDefault && connection.enabled && connection.isUsable,
  );
  // Mail can go through a service another plugin provides, so the page says
  // "connection" where it said "SMTP account".
  const mixed = usesExternalConnections(state);

  // The hints name the tab that holds the connections, and Pro calls it
  // something else. Free's two sentences are exactly what they always were.
  const routingCard = (
    <WpMailRoutingCard
      enabled={draft.enabled}
      onEnabledChange={(enabled) => setDraft({ ...draft, enabled })}
      hasConnection={hasConnection}
      hasUsableDefault={hasUsableDefault}
      disabled={saving || connectionsSaving}
      pressedmailTitle={
        __IS_PRO__ && mixed ? __("PressedMail connection", "pressedmail") : undefined
      }
      pressedmailDescription={
        __IS_PRO__
          ? mixed
            ? __(
                "A connection you set up here. Applies site-wide, to every plugin and theme.",
                "pressedmail",
              )
            : __(
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
          ? mixed
            ? __(
                "Add a connection on the Connections tab to use this.",
                "pressedmail",
              )
            : __(
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
          ? mixed
            ? __(
                "Enable a connection on the Connections tab, finish its settings, and make it the default to use this.",
                "pressedmail",
              )
            : __(
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
      className="w-full min-w-0 max-w-6xl space-y-4"
      data-test="wp-mail-tab"
      data-testid="wp-mail-tab">
      {error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {/* One message for everything that needs attention, each with its fix. */}
      {state.health.length > 0 || state.configurationIssues.length > 0 ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>
            {__("WordPress email needs attention", "pressedmail")}
          </AlertTitle>
          <AlertDescription>
            <ul className="space-y-1">
              {state.health.map((health) => (
                <li key={health.connectionId} data-test="wp-mail-health-warning">
                  {health.errorClass
                    ? smtpHealthCopy(
                        health.errorClass,
                        health.connectionLabel,
                        health.detail ?? "",
                        pluginMessageOf(health),
                      )
                    : // A payload from before failures were classified.
                      `${health.connectionLabel ? `${health.connectionLabel}: ` : ""}${
                        health.message ||
                        __(
                          "A recent message could not be sent. Review the mail server and send a test email.",
                          "pressedmail",
                        )
                      }`}
                </li>
              ))}
              {state.configurationIssues.map((issue) => (
                <li key={issue} data-test="wp-mail-configuration-issues">
                  {issue}
                </li>
              ))}
            </ul>
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
        className="gap-4"
        data-test="wp-mail-panels"
        data-testid="wp-mail-panels">
        <TabsList
          variant="line"
          aria-label={__("WordPress email sections", "pressedmail")}
          className="w-full justify-start rounded-none border-b px-0 max-sm:h-auto! max-sm:flex-nowrap max-sm:overflow-x-auto max-sm:[scrollbar-width:none] max-sm:[&::-webkit-scrollbar]:hidden pointer-coarse:h-auto!">
          {__IS_PRO__ ? (
            <>
              <TabsTrigger
                value="mail-servers"
                className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
                data-test="wp-mail-panel-mail-servers"
                data-testid="wp-mail-panel-mail-servers">
                {mixed
                  ? __("Connections", "pressedmail")
                  : __("SMTP Accounts", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="default-smtp"
                className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
                data-test="wp-mail-panel-default-smtp"
                data-testid="wp-mail-panel-default-smtp">
                {/* Title case, as in the other mode: copy across the plugin
                    names these tabs that way ("the SMTP Accounts tab"). */}
                {mixed
                  ? __("Default Connection", "pressedmail")
                  : __("Default SMTP", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="system-emails"
                className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
                data-test="wp-mail-panel-system-emails"
                data-testid="wp-mail-panel-system-emails">
                {__("System Emails", "pressedmail")}
              </TabsTrigger>
              {window.pressedmailPlugin?.wooBridge?.active ? (
                <TabsTrigger
                  value="woo"
                  className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
                  data-test="wp-mail-panel-woo"
                  data-testid="wp-mail-panel-woo">
                  {__("WooCommerce", "pressedmail")}
                </TabsTrigger>
              ) : null}
            </>
          ) : (
            <>
              <TabsTrigger
                value="system-emails"
                className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
                data-test="wp-mail-panel-system-emails"
                data-testid="wp-mail-panel-system-emails">
                {__("System Emails", "pressedmail")}
              </TabsTrigger>
              <TabsTrigger
                value="mail-servers"
                className="flex-none px-4 max-sm:min-h-11 pointer-coarse:min-h-11 text-muted-foreground dark:text-foreground/70"
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
                transportStatuses={mixed}
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

        {/* The WooCommerce panel only exists while the Woo Bridge companion is
            active; it renders nothing otherwise, and never ships in Free. */}
        {__IS_PRO__ && window.pressedmailPlugin?.wooBridge?.active ? (
          <TabsContent
            value="woo"
            keepMounted
            className="space-y-4"
            data-test="wp-mail-woo-panel">
            <WooEmailsPanel
              connections={state.connections}
              registerDraft={registerConnectionDraft}
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
