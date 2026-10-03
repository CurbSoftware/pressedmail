import { __, _n, sprintf } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import {
  useCallback,
  useMemo,
  useState,
  useEffect,
  type ReactNode,
} from "react";
import { Info } from "lucide-react";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Input,
  Label,
  Switch,
} from "@kit/ui/plugin";
import { useFeatures } from "@/context/features";
import { DangerZoneCard } from "./danger-zone-card";
import {
  SettingsSaveState,
  SettingsRow,
  SettingsSectionCard,
  useSettingsHeaderAction,
  useSettingsNavigationGuard,
  SettingsSkeleton,
} from "@/components/settings-ui";
import {
  notifyAutosaveError,
  notifyAutosaveSuccess,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import {
  ACCESS_VIEW_PARAMS,
  AccessControlTabs,
  accessSavedMessage,
} from "./access-control-tabs";
import type { AccessControlDraftHandle } from "./access-tab";
import { useRetryFocus } from "./use-retry-focus";
import {
  getRuntimeRestNamespace,
  getRuntimeRestRoot,
} from "@/lib/runtime-config";

interface AdminSecuritySettings {
  allow_external_images: boolean;
  allow_user_attachment_uploads: boolean;
  allow_media_library_attachments: boolean;
  allow_user_attachment_downloads: boolean;
  max_attachment_size_mb: number;
  php_max_upload_mb: number;
  purge_data_on_uninstall: boolean;
  sync_interval_minutes: number;
  timed_wake_enabled: boolean;
  // Pro: who may reach the Templates page. Pro's own settings filters add
  // them to the payload; Free never sends them, so the defaults stand.
  allow_templates_admin: boolean;
  allow_templates_user: boolean;
}

const DEFAULT_SETTINGS: AdminSecuritySettings = {
  allow_external_images: true,
  allow_user_attachment_uploads: true,
  allow_media_library_attachments: true,
  allow_user_attachment_downloads: true,
  max_attachment_size_mb: 10,
  php_max_upload_mb: 128,
  purge_data_on_uninstall: false,
  sync_interval_minutes: 5,
  timed_wake_enabled: true,
  allow_templates_admin: true,
  allow_templates_user: true,
};

const getApiUrl = (): string => {
  return getRuntimeRestRoot();
};

export function SecurityAccessTab({
  section = "access",
}: { section?: "access" | "sync" | "data" } = {}) {
  const { loading: featuresLoading } = useFeatures();
  const [settings, setSettings] =
    useState<AdminSecuritySettings>(DEFAULT_SETTINGS);
  const [savedSettings, setSavedSettings] =
    useState<AdminSecuritySettings>(DEFAULT_SETTINGS);
  const [externalDrafts, setExternalDrafts] = useState<
    Record<string, AccessControlDraftHandle>
  >({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reloadToken, setReloadToken] = useState(0);
  // The alert stays up while Retry asks again, and the cursor goes to the page
  // once it is back, so a keyboard user is not dropped at the top of wp-admin.
  const results = useRetryFocus<HTMLDivElement>(isLoading, loadFailed);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  // Read-only, from the settings payload: every settings manager gets it, not
  // only administrators (who alone receive the diagnostics global).
  const [wakeReachability, setWakeReachability] =
    useState<TimedWakeReachability>();

  // JUSTIFICATION: useEffect needed to fetch plugin settings after features context resolves
  useEffect(() => {
    const fetchSettings = async () => {
      if (featuresLoading) {
        return;
      }

      setIsLoading(true);

      try {
        const response = await apiFetch(
          `${getApiUrl()}${getRuntimeRestNamespace()}/plugin/settings`,
        );

        const data = await response.json();

        if (response.ok && data.status === "success") {
          const nextSettings = {
            allow_external_images:
              data.settings.allow_external_images ??
              DEFAULT_SETTINGS.allow_external_images,
            allow_user_attachment_uploads:
              data.settings.allow_user_attachment_uploads ??
              DEFAULT_SETTINGS.allow_user_attachment_uploads,
            allow_media_library_attachments:
              data.settings.allow_media_library_attachments ??
              DEFAULT_SETTINGS.allow_media_library_attachments,
            allow_user_attachment_downloads:
              data.settings.allow_user_attachment_downloads ??
              DEFAULT_SETTINGS.allow_user_attachment_downloads,
            max_attachment_size_mb:
              data.settings.max_attachment_size_mb ??
              DEFAULT_SETTINGS.max_attachment_size_mb,
            php_max_upload_mb:
              data.settings.php_max_upload_mb ??
              DEFAULT_SETTINGS.php_max_upload_mb,
            purge_data_on_uninstall:
              data.settings.purge_data_on_uninstall ??
              DEFAULT_SETTINGS.purge_data_on_uninstall,
            sync_interval_minutes:
              data.settings.sync_interval_minutes ??
              DEFAULT_SETTINGS.sync_interval_minutes,
            timed_wake_enabled:
              data.settings.timed_wake_enabled ??
              DEFAULT_SETTINGS.timed_wake_enabled,
            allow_templates_admin:
              data.settings.allow_templates_admin ??
              DEFAULT_SETTINGS.allow_templates_admin,
            allow_templates_user:
              data.settings.allow_templates_user ??
              DEFAULT_SETTINGS.allow_templates_user,
          };
          setSettings(nextSettings);
          setSavedSettings(nextSettings);
          setWakeReachability(data.settings.timed_wake_reachability);
          // Cleared only now, so the alert holding a pressed Retry stays up while it retries.
          setLoadFailed(false);
        } else {
          throw new Error(
            typeof data?.message === "string"
              ? data.message
              : "Plugin settings request was not successful",
          );
        }
      } catch (error) {
        console.error("Failed to fetch security settings:", error);
        // Leaving DEFAULT_SETTINGS on screen presented "remote images allowed,
        // uploads allowed, downloads allowed" as though they had been read from
        // the site, and Save then wrote those defaults over whatever was
        // actually stored. A setting that cannot be read is an error state, not
        // a value.
        setLoadFailed(true);
      } finally {
        setIsLoading(false);
      }
    };

    fetchSettings();
  }, [featuresLoading, reloadToken]);

  const registerExternalDraft = useCallback(
    (key: string, draft: AccessControlDraftHandle | null) => {
      setExternalDrafts((current) => {
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

        return {
          ...current,
          [key]: draft,
        };
      });
    },
    [],
  );

  const updateSetting = <K extends keyof AdminSecuritySettings>(
    key: K,
    value: AdminSecuritySettings[K],
  ) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
    setSaveStatus("dirty");
  };

  const changedSettings = useMemo(() => {
    const changes: Partial<AdminSecuritySettings> = {};

    (Object.keys(settings) as Array<keyof AdminSecuritySettings>).forEach(
      (key) => {
        if (settings[key] !== savedSettings[key]) {
          changes[key] = settings[key] as never;
        }
      },
    );

    return changes;
  }, [settings, savedSettings]);
  const coreDirty = Object.keys(changedSettings).length > 0;
  // One fixed order, roles before people, whichever tab was edited last. A draft
  // re-registers each time it changes, which moves its key to the end of the
  // object, so the object's own order would make Save's partial result depend on
  // edit order. Roles go first because they are the wider change.
  const externalDraftList = useMemo(
    () =>
      Object.entries(externalDrafts)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([, draft]) => draft),
    [externalDrafts],
  );
  const externalDirty = externalDraftList.some((draft) => draft.dirty);
  const externalSaving = externalDraftList.some((draft) => draft.saving);
  const dirty = coreDirty || externalDirty;
  const isSaving = saveStatus === "saving" || externalSaving;
  // Every staged change on the page, in every tab, so the Save bar says how
  // much a click on Save is about to apply.
  const stagedCount =
    Object.keys(changedSettings).length +
    externalDraftList.reduce(
      (sum, draft) => sum + (draft.dirty ? Math.max(1, draft.count ?? 1) : 0),
      0,
    );

  const saveCoreSettings = useCallback(async (): Promise<boolean> => {
    if (!coreDirty) {
      return true;
    }

    setSaveStatus("saving");

    try {
      const response = await apiFetch(
        `${getApiUrl()}${getRuntimeRestNamespace()}/plugin/settings`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(changedSettings),
        },
      );

      const data = await response.json();

      if (response.ok && data.status === "success") {
        const canonicalSettings = {
          ...settings,
          ...(data.settings ?? changedSettings),
        };
        setSettings(canonicalSettings);
        setSavedSettings(canonicalSettings);
        setSaveStatus("saved");
        // The toast is saveChanges's to show, once, when every part has saved.
        return true;
      }

      throw new Error(
        data.message || __("Could not save settings", "pressedmail"),
      );
    } catch (error) {
      console.error("Failed to save security settings:", error);
      // Keep the draft. Resetting to the last saved values here threw away
      // everything the admin had just typed, at the exact moment they needed
      // it to retry.
      setSaveStatus("error");
      notifyAutosaveError(__("Could not save settings", "pressedmail"));
      return false;
    }
  }, [changedSettings, coreDirty, settings]);

  const cancelChanges = useCallback(() => {
    setSettings(savedSettings);
    setSaveStatus("idle");
    externalDraftList.forEach((draft) => draft.cancel());
  }, [externalDraftList, savedSettings]);

  const saveChanges = useCallback(async (): Promise<boolean> => {
    if (!dirty || isSaving) {
      return true;
    }

    // Anything a draft wants confirmed is asked before the first write, so
    // "keep editing" leaves the whole page as it was and nothing half saved.
    const childDrafts = externalDraftList.filter((draft) => draft.dirty);
    for (const draft of childDrafts) {
      if (draft.beforeSave && !(await draft.beforeSave())) {
        return false;
      }
    }
    // A save that only changed roles and people says how many of each, as
    // their tabs count them. Anything saved alongside it (the General settings)
    // is not about access, so that keeps the plain wording. Folded away with the
    // tabs in the one-seat build, which has neither.
    const peopleDraft = externalDrafts["access-users"];
    const rolesDraft = externalDrafts["access-roles"];
    const staged = (draft: AccessControlDraftHandle | undefined) =>
      draft && childDrafts.includes(draft) ? Math.max(1, draft.count ?? 1) : 0;
    const savedMessage =
      !__SINGLE_SEAT__ &&
      !coreDirty &&
      childDrafts.every((draft) => draft === peopleDraft || draft === rolesDraft)
        ? accessSavedMessage({
            people: staged(peopleDraft),
            roles: staged(rolesDraft),
          })
        : undefined;

    const coreSaved = await saveCoreSettings();
    if (!coreSaved) {
      return false;
    }

    for (const draft of childDrafts) {
      const saved = await draft.save();
      if (!saved) {
        return false;
      }
    }

    if (!coreDirty && childDrafts.length === 0) {
      setSaveStatus("idle");
    }

    // Once, and only when all of it saved: a save that one part refused says so
    // in that part's own words, not "saved" from the parts that got through.
    notifyAutosaveSuccess("admin-settings", savedMessage);

    return true;
  }, [
    coreDirty,
    dirty,
    externalDraftList,
    externalDrafts,
    isSaving,
    saveCoreSettings,
  ]);

  const headerActions = useMemo(
    () =>
      dirty ? (
        <div className="flex items-center gap-2">
          {/* Not a live region: it appears along with the buttons, which is too
              late for one to announce it. The panels that stage changes keep
              a region in the page for that. */}
          <span
            className="text-xs text-muted-foreground"
            data-test="admin-security-access-staged">
            {sprintf(
              _n(
                "%d unsaved change",
                "%d unsaved changes",
                stagedCount,
                "pressedmail",
              ),
              stagedCount,
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isSaving}
            onClick={cancelChanges}>
            {__("Cancel", "pressedmail")}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={isSaving}
            onClick={() => void saveChanges()}>
            {isSaving
              ? __("Saving...", "pressedmail")
              : __("Save", "pressedmail")}
          </Button>
        </div>
      ) : null,
    [cancelChanges, dirty, isSaving, saveChanges, stagedCount],
  );

  useSettingsHeaderAction("admin-security-access:save", headerActions, 0);

  // Without this, switching tabs or closing the browser dropped staged edits,
  // including an armed "delete plugin data on uninstall", without a word. The
  // Access Control tabs keep their drafts mounted, so moving between them is
  // no exit, and only this page says so: a page whose view parameter drops a
  // draft stays guarded. The condition is the one below, spelled out the same
  // way so the one-seat build folds it away with the tabs.
  useSettingsNavigationGuard({
    dirty,
    saving: isSaving,
    onSave: saveChanges,
    viewParams:
      !__SINGLE_SEAT__ && window.pressedmailPlugin?.canManageAccess
        ? ACCESS_VIEW_PARAMS
        : undefined,
  });

  const effectiveAttachmentSize = Math.min(
    settings.max_attachment_size_mb,
    settings.php_max_upload_mb,
  );

  if (isLoading && !loadFailed) {
    return (
      <SettingsSkeleton
        label={__("Loading access control settings", "pressedmail")}
        dataTest="admin-security-access-loading"
        rows={4}
      />
    );
  }

  if (loadFailed) {
    return (
      <Alert
        role="alert"
        variant="destructive"
        data-test="admin-security-access-load-error"
        data-testid="admin-security-access-load-error">
        <Info className="h-4 w-4" />
        <AlertTitle>
          {__("These settings could not be loaded", "pressedmail")}
        </AlertTitle>
        <AlertDescription className="space-y-3">
          <p>
            {__(
              "PressedMail could not read this site's permission settings, so none of them are shown. Nothing has been changed.",
              "pressedmail",
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            // Aria-disabled, not disabled, so the button that has the cursor keeps it.
            aria-disabled={isLoading || undefined}
            onClick={() => {
              if (!isLoading) {
                results.retry(() => setReloadToken((token) => token + 1));
              }
            }}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            data-test="admin-security-access-retry"
            data-testid="admin-security-access-retry">
            {isLoading
              ? __("Retrying...", "pressedmail")
              : __("Retry", "pressedmail")}
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  // What the page shows once it has loaded, in one element that can take the
  // cursor when a Retry works, whichever section this is.
  const inResults = (children: ReactNode) => (
    <div
      ref={results.target}
      tabIndex={-1}
      className="outline-none"
      data-test="admin-security-access-page"
      data-testid="admin-security-access-page">
      {children}
    </div>
  );

  if (section === "sync") {
    return inResults(
      <SettingsSectionCard
        title={__("Background sync", "pressedmail")}
        description={__(
          "Choose how often connected mailboxes check for new messages.",
          "pressedmail",
        )}>
        <SettingsRow
          title={__("Email sync frequency", "pressedmail")}
          description={
            __IS_PRO__
              ? __(
                  "How often PressedMail checks connected mailboxes for new mail in the background. Set to 0 to disable automatic background sync. Manual refresh works any time.",
                  "pressedmail",
                )
              : __(
                  "How often PressedMail checks for new mail while it is open or when someone visits WordPress admin. Set to 0 to check only when you refresh.",
                  "pressedmail",
                )
          }
          control={
            <div className="flex flex-col items-end gap-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="sync-interval-minutes" className="sr-only">
                  {__("Email sync frequency", "pressedmail")}
                </Label>
                <Input
                  autoComplete="off"
                  id="sync-interval-minutes"
                  data-test="sync-interval-minutes"
                  type="number"
                  min={0}
                  max={60}
                  value={settings.sync_interval_minutes}
                  onChange={(e) => {
                    const val = Math.max(
                      0,
                      Math.min(Number(e.target.value) || 0, 60),
                    );
                    updateSetting("sync_interval_minutes", val);
                  }}
                  className="w-20 text-center"
                />
                <span className="text-xs text-muted-foreground">
                  {__("minutes", "pressedmail")}
                </span>
              </div>
              <span className="text-xs text-muted-foreground">
                {settings.sync_interval_minutes === 0
                  ? __(
                      "Auto-sync disabled · Manual refresh available",
                      "pressedmail",
                    )
                  : __("0 = manual sync only", "pressedmail")}
              </span>
            </div>
          }
        />
        {__IS_PRO__ ? (
          <TimedWakeRow
            checked={settings.timed_wake_enabled}
            reachability={wakeReachability}
            onChange={(checked) => updateSetting("timed_wake_enabled", checked)}
          />
        ) : null}
      </SettingsSectionCard>,
    );
  }
  if (section === "data") {
    return inResults(
      <div>
        {" "}
        <DangerZoneCard
          purgeEnabled={settings.purge_data_on_uninstall}
          onPurgeChange={(enabled) =>
            updateSetting("purge_data_on_uninstall", enabled)
          }
        />
      </div>,
    );
  }

  const general = (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <SettingsSectionCard
          title={
            <span className="inline-flex items-center gap-2">
              <span role="heading" aria-level={2}>
                {__("File Attachments", "pressedmail")}
              </span>
              <SettingsSaveState status={saveStatus} />
            </span>
          }
          description={__(
            "Control how users send, select, and download email attachments.",
            "pressedmail",
          )}
          contentClassName="space-y-1">
          <SettingsRow
            inline
            title={__("Allow uploads", "pressedmail")}
            description={__(
              "Users can attach local files to outgoing emails.",
              "pressedmail",
            )}
            control={
              <>
                <Label htmlFor="allow-uploads" className="sr-only">
                  {__("Allow uploads", "pressedmail")}
                </Label>
                <Switch
                  id="allow-uploads"
                  aria-label={__("Allow uploads", "pressedmail")}
                  checked={settings.allow_user_attachment_uploads}
                  onCheckedChange={(checked) =>
                    updateSetting("allow_user_attachment_uploads", checked)
                  }
                />
              </>
            }
          />
          <SettingsRow
            inline
            title={__("Allow Media Library files", "pressedmail")}
            description={__(
              "Users can attach existing files from the WordPress Media Library.",
              "pressedmail",
            )}
            control={
              <>
                <Label
                  htmlFor="allow-media-library-attachments"
                  className="sr-only">
                  {__("Allow Media Library files", "pressedmail")}
                </Label>
                <Switch
                  id="allow-media-library-attachments"
                  aria-label={__("Allow Media Library files", "pressedmail")}
                  checked={settings.allow_media_library_attachments}
                  onCheckedChange={(checked) =>
                    updateSetting("allow_media_library_attachments", checked)
                  }
                />
              </>
            }
          />
          <SettingsRow
            inline
            title={__("Allow downloads", "pressedmail")}
            description={__(
              "Users can download attachments from received messages.",
              "pressedmail",
            )}
            control={
              <>
                <Label htmlFor="allow-downloads" className="sr-only">
                  {__("Allow downloads", "pressedmail")}
                </Label>
                <Switch
                  id="allow-downloads"
                  aria-label={__("Allow downloads", "pressedmail")}
                  checked={settings.allow_user_attachment_downloads}
                  onCheckedChange={(checked) =>
                    updateSetting("allow_user_attachment_downloads", checked)
                  }
                />
              </>
            }
          />
          <SettingsRow
            title={__("Max attachment size", "pressedmail")}
            description={
              <span className="space-y-1">
                <span className="block">
                  {__("Maximum file size per attachment.", "pressedmail")}
                </span>
                <span className="block">
                  {sprintf(
                    __("Server limit: %d MB", "pressedmail"),
                    settings.php_max_upload_mb,
                  )}
                </span>
                <span className="block">
                  {sprintf(
                    __("Effective limit: %d MB", "pressedmail"),
                    effectiveAttachmentSize,
                  )}
                </span>
              </span>
            }
            control={
              <div className="flex items-center gap-2">
                <Label htmlFor="max-attachment-size" className="sr-only">
                  {__("Max attachment size", "pressedmail")}
                </Label>
                <Input
                  autoComplete="off"
                  id="max-attachment-size"
                  type="number"
                  min={1}
                  max={settings.php_max_upload_mb}
                  value={Math.min(
                    settings.max_attachment_size_mb,
                    settings.php_max_upload_mb,
                  )}
                  onChange={(e) => {
                    const val = Math.max(
                      1,
                      Math.min(
                        Number(e.target.value) || 1,
                        settings.php_max_upload_mb,
                      ),
                    );
                    updateSetting("max_attachment_size_mb", val);
                  }}
                  className="w-20 text-center"
                />
                <span className="text-xs text-muted-foreground">
                  {__("MB", "pressedmail")}
                </span>
              </div>
            }
          />

          {(!settings.allow_user_attachment_uploads ||
            !settings.allow_media_library_attachments ||
            !settings.allow_user_attachment_downloads) && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {__("Restrictions Active", "pressedmail")}
              </AlertTitle>
              <AlertDescription>
                {!settings.allow_user_attachment_uploads &&
                  !settings.allow_media_library_attachments &&
                  !settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users cannot attach files from their computer, attach files from the Media Library, or download attachments from received emails.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {!settings.allow_user_attachment_uploads &&
                  settings.allow_media_library_attachments &&
                  settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users cannot attach files from their computer, but can still attach files from the Media Library and download attachments from received emails.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {settings.allow_user_attachment_uploads &&
                  !settings.allow_media_library_attachments &&
                  settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users can attach files from their computer, but Media Library attachments are disabled.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {settings.allow_user_attachment_uploads &&
                  settings.allow_media_library_attachments &&
                  !settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users can attach files when composing emails, but cannot download attachments from received emails.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {!settings.allow_user_attachment_uploads &&
                  !settings.allow_media_library_attachments &&
                  settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users cannot attach files from their computer or from the Media Library, but can still download attachments from received emails.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {!settings.allow_user_attachment_uploads &&
                  settings.allow_media_library_attachments &&
                  !settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users cannot attach files from their computer and cannot download received attachments, but can still attach files from the Media Library.",
                        "pressedmail",
                      )}
                    </span>
                  )}
                {settings.allow_user_attachment_uploads &&
                  !settings.allow_media_library_attachments &&
                  !settings.allow_user_attachment_downloads && (
                    <span>
                      {__(
                        "Users can attach files from their computer, but Media Library attachments and attachment downloads are disabled.",
                        "pressedmail",
                      )}
                    </span>
                  )}
              </AlertDescription>
            </Alert>
          )}
        </SettingsSectionCard>

        <SettingsSectionCard
          title={
            <span role="heading" aria-level={2}>
              {__("Email Display", "pressedmail")}
            </span>
          }
          description={__(
            "Control whether remote content can be revealed inside received emails.",
            "pressedmail",
          )}
          contentClassName="space-y-1">
          <SettingsRow
            inline
            title={__("Allow remote images", "pressedmail")}
            description={__(
              "When disabled, remote images stay blocked across the inbox.",
              "pressedmail",
            )}
            control={
              <>
                <Label htmlFor="allow-external-images" className="sr-only">
                  {__("Allow remote images", "pressedmail")}
                </Label>
                <Switch
                  id="allow-external-images"
                  aria-label={__("Allow remote images", "pressedmail")}
                  data-test="allow-external-images-toggle"
                  data-testid="allow-external-images-toggle"
                  checked={settings.allow_external_images}
                  onCheckedChange={(checked) =>
                    updateSetting("allow_external_images", checked)
                  }
                />
              </>
            }
          />

          {!settings.allow_external_images && (
            <Alert>
              <Info className="h-4 w-4" />
              <AlertTitle>
                {__("Remote Images Blocked", "pressedmail")}
              </AlertTitle>
              <AlertDescription>
                {__(
                  "Users will still see a notice when a message contains remote images, but the reveal action is disabled until this setting is turned back on.",
                  "pressedmail",
                )}
              </AlertDescription>
            </Alert>
          )}
        </SettingsSectionCard>
      </div>
    </div>
  );

  // Choosing who may open PressedMail, by role or by person, only means
  // something when more than one person can. A one-seat build answers that by
  // ownership, so the Roles and Users tabs are dropped from the bundle rather
  // than shown empty or disabled: the define folds this branch away. They are
  // also administrator-only, because their routes are guarded by manage_options
  // and a delegated settings manager would only ever see them fail.
  if (!__SINGLE_SEAT__ && window.pressedmailPlugin?.canManageAccess) {
    return inResults(
      <AccessControlTabs
        general={general}
        drafts={externalDrafts}
        registerDraft={registerExternalDraft}
        coreFailed={saveStatus === "error"}
      />,
    );
  }

  return inResults(general);
}

/**
 * Why a wake is off, from TimedWake::reachability()'s reason. 'environment' is
 * decided by WP_ENVIRONMENT_TYPE alone, so the site may well be public.
 */
export function timedWakeBlockedReason(reason: string | undefined): string {
  if (reason === "environment") {
    return __(
      "This site is marked as a local or development site (WP_ENVIRONMENT_TYPE), so it can't be woken. Set it to staging or production to turn this on. Timed features run while PressedMail is open.",
      "pressedmail",
    );
  }
  return __(
    "This site isn't reachable from the internet, so it can't be woken. Timed features run while PressedMail is open.",
    "pressedmail",
  );
}

/**
 * Pro: let the CurbSoftware licence server wake this site so scheduled sends,
 * snoozes, timed rules and background sync run without a server cron. A site the
 * internet cannot reach (local, private network, development) cannot be woken.
 */
interface TimedWakeReachability {
  public: boolean;
  reason: string;
}

function TimedWakeRow({
  checked,
  reachability: wake,
  onChange,
}: {
  checked: boolean;
  reachability?: TimedWakeReachability;
  onChange: (checked: boolean) => void;
}) {
  const unreachable = wake ? !wake.public : false;
  return (
    <SettingsRow
      inline
      title={__("Timed functionalities enabled", "pressedmail")}
      description={
        unreachable
          ? timedWakeBlockedReason(wake?.reason)
          : __(
              "The CurbSoftware licence server checks in every few minutes so scheduled sends, snoozes, timed rules and background sync run even when nobody visits the site. It skips the check when visits are already keeping things running.",
              "pressedmail",
            )
      }
      control={
        <Switch
          data-test="timed-wake-enabled"
          aria-label={__("Timed functionalities enabled", "pressedmail")}
          checked={checked && !unreachable}
          disabled={unreachable}
          onCheckedChange={onChange}
        />
      }
    />
  );
}
