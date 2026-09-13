import { __, sprintf } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import { Alert, AlertDescription, Badge } from "@kit/ui/plugin";
import {
  SettingsEmptyState,
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

type ExtensionInfo = {
  name: string;
  required: boolean;
  loaded: boolean;
  description: string;
  install_cmd: string;
};

type SyncScheduleInfo = {
  mode?: "scheduled" | "manual";
  intervalMinutes?: number;
  nextRun?: number;
  lastRun?: number;
  overdue?: boolean;
};

type CronWorkerInfo = {
  hook: string;
  nextRun: number;
  intervalSeconds: number;
  events: number;
  overdue?: boolean;
  lastRun?: number;
};

type CronHealthInfo = {
  workers?: CronWorkerInfo[];
  wpCronDisabled?: boolean;
  serverCronCommand?: string;
};

type PhpLimitsInfo = {
  memory_usage?: string;
  memory_limit?: string;
  execution_time?: string;
  max_execution_time?: string;
  post_max_size?: string;
  upload_max_filesize?: string;
};

type VersionLookupState = "loading" | "available" | "unavailable" | "wporg";

function HealthRow({
  label,
  value,
  ok,
  recommended = false,
}: {
  label: string;
  value: string;
  ok?: boolean;
  recommended?: boolean;
}) {
  const normalized = value.replace(/^(\d+(?:\.\d+)?)\s*([KMG])$/i, "$1 $2B");
  return (
    <div
      className="flex min-w-0 items-start justify-between gap-3 border-b border-border py-3 text-sm last:border-b-0"
      data-test="system-health-row"
      data-testid="system-health-row">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd className="flex shrink-0 flex-col items-end gap-1 text-right">
        <span>{normalized}</span>
        {ok !== undefined ? (
          <span
            className={
              ok
                ? "text-success"
                : recommended
                  ? "text-warning"
                  : "text-destructive"
            }>
            {ok
              ? __("Good", "pressedmail")
              : recommended
                ? __("Recommended", "pressedmail")
                : __("Critical", "pressedmail")}
          </span>
        ) : null}
      </dd>
    </div>
  );
}

function PluginStatusRow({
  label,
  value,
  destructive = false,
}: {
  label: string;
  value: string;
  destructive?: boolean;
}) {
  return (
    <div className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 text-sm">
      <dt className="min-w-0 text-muted-foreground">{label}</dt>
      <dd>
        <Badge variant={destructive ? "destructive" : "outline"}>{value}</Badge>
      </dd>
    </div>
  );
}

/**
 * Whether this build owns its own update checks.
 *
 * The flag crosses into JS through wp_localize_script(), which stringifies
 * everything: true becomes "1" and false becomes "". Comparing it to a boolean
 * is always false, so accept every spelling the runtime can produce.
 */
function ownsItsUpdates(value: unknown): boolean {
  return value === true || value === "1" || value === 1;
}

/** Human label for a worker cadence. 0 means a one-shot single event. */
function formatInterval(seconds: number): string {
  if (seconds <= 0) {
    return __("Once", "pressedmail");
  }
  if (seconds < 60) {
    return sprintf(__("Every %d s", "pressedmail"), String(seconds));
  }
  if (seconds < 3600) {
    return sprintf(__("Every %d min", "pressedmail"), String(Math.round(seconds / 60)));
  }
  if (seconds < 86400) {
    return sprintf(__("Every %d h", "pressedmail"), String(Math.round(seconds / 3600)));
  }
  return sprintf(__("Every %d d", "pressedmail"), String(Math.round(seconds / 86400)));
}

export function SystemDiagnostics() {
  const [latestVersion, setLatestVersion] = useState<string | null>(null);
  const [versionLookupState, setVersionLookupState] =
    useState<VersionLookupState>("loading");
  const diagnostics = window.pressedmailPlugin?.systemDiagnostics;
  const { extensions, imapDriver, phpVersion, wpVersion, memory } =
    diagnostics ?? {};
  const phpLimits = (diagnostics as { phpLimits?: PhpLimitsInfo } | undefined)
    ?.phpLimits;
  const imapExtension = extensions?.imap as ExtensionInfo | undefined;
  const currentVersion =
    window.pressedmailPlugin?.version ?? __("Unknown", "pressedmail");
  const isPro =
    window.pressedmailPlugin?.isPro === true ||
    window.pressedmailPlugin?.isPro === "1";
  const latestReleaseLabel = isPro
    ? __("Latest release version (Pro)", "pressedmail")
    : __("Latest release version (Free)", "pressedmail");

  // Check if IMAP native extension is missing
  const imapMissing = imapExtension && !imapExtension.loaded;
  const syncSchedule = (
    diagnostics as { syncSchedule?: SyncScheduleInfo } | undefined
  )?.syncSchedule;
  const cronHealth = (
    diagnostics as { cronHealth?: CronHealthInfo } | undefined
  )?.cronHealth;
  const cronWorkers = cronHealth?.workers ?? [];
  const syncOverdue = syncSchedule?.overdue === true;
  const syncLabel = !syncSchedule
    ? __("Unknown", "pressedmail")
    : syncSchedule.mode === "manual"
      ? __("Manual only", "pressedmail")
      : syncOverdue
        ? __("Overdue", "pressedmail")
        : sprintf(
            __("Scheduled · every %d min", "pressedmail"),
            String(syncSchedule.intervalMinutes ?? 0),
          );
  const siteHealthUrl = window.pressedmailPlugin?.adminAjaxUrl
    ? new URL(
        "site-health.php",
        new URL(window.pressedmailPlugin.adminAjaxUrl, window.location.href),
      ).href
    : undefined;
  // "Managed by WordPress.org" is a statement about where the edition gets its
  // updates, so it follows the edition. Pro updates come from the licence
  // server; if that lookup cannot run, say "Unavailable" rather than claim
  // something about this build that is not true.
  const latestVersionLabel =
    versionLookupState === "loading"
      ? __("Checking...", "pressedmail")
      : versionLookupState === "wporg"
        ? isPro
          ? __("Unavailable", "pressedmail")
          : __("Managed by WordPress.org", "pressedmail")
        : latestVersion || __("Unavailable", "pressedmail");

  useEffect(() => {
    let cancelled = false;
    const apiUrl = window.pressedmailPlugin?.apiUrl;
    const nonce = window.pressedmailPlugin?.wpApiSettings?.nonce;

    // The route only exists where the plugin owns its own updates, so an
    // absent or false flag means there is nothing to call. What the flag does
    // NOT tell us is who distributes this edition, which is why the label
    // above reads `isPro` instead of this.
    //
    // wp_localize_script() casts every value to a string, so this arrives as
    // "1", never boolean true. A strict `!== true` therefore matched on every
    // build, and Pro silently skipped the lookup it was entitled to make. The
    // isPro check above already accepts both spellings; this one has to as well.
    if (!ownsItsUpdates(window.pressedmailPlugin?.useCustomUpdates)) {
      setVersionLookupState("wporg");
      setLatestVersion(null);
      return;
    }

    if (!apiUrl || !nonce) {
      setVersionLookupState("unavailable");
      setLatestVersion(null);
      return;
    }

    setVersionLookupState("loading");

    apiFetch(`${apiUrl}${getRuntimeRestNamespace()}/updates/check`, {
      method: "POST",
    })
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Update lookup failed: ${response.status}`);
        }

        return (await response.json()) as {
          latest_version?: string;
          current_version?: string;
        };
      })
      .then((data) => {
        if (cancelled) return;
        setLatestVersion(data.latest_version || currentVersion);
        setVersionLookupState("available");
      })
      .catch(() => {
        if (cancelled) return;
        setLatestVersion(null);
        setVersionLookupState("unavailable");
      });

    return () => {
      cancelled = true;
    };
  }, [currentVersion]);

  // The boot payload carries the diagnostics. If it is missing, say so rather
  // than rendering a blank tab under the header.
  if (!diagnostics) {
    return (
      <SettingsEmptyState
        title={__("Diagnostics unavailable", "pressedmail")}
        description={__(
          "PressedMail could not read this site's system information. Reload the page to try again.",
          "pressedmail",
        )}
      />
    );
  }

  return (
    <div className="space-y-4">
      <SettingsSectionCard
        title={__("System Health", "pressedmail")}
        description={__(
          "Server environment and PHP extension status",
          "pressedmail",
        )}
        tooltip={settingsInfoTooltips.systemHealth}
        docHref={settingsInfoDocHrefs.systemHealth}
        actions={
          siteHealthUrl ? (
            <a className="text-sm text-primary underline" href={siteHealthUrl}>
              {__("Open WordPress Site Health", "pressedmail")}
            </a>
          ) : null
        }>
        <dl className="divide-y divide-border">
          <HealthRow
            label={__("PHP", "pressedmail")}
            value={phpVersion?.current || __("Unknown", "pressedmail")}
            ok={phpVersion?.is_met !== false}
          />
          <HealthRow
            label={__("WordPress", "pressedmail")}
            value={wpVersion?.current || __("Unknown", "pressedmail")}
            ok={wpVersion?.is_met !== false}
          />
          <HealthRow
            label={__("Email driver", "pressedmail")}
            value={imapDriver?.driver || __("Unknown", "pressedmail")}
          />
          <HealthRow
            label={__("PHP IMAP extension", "pressedmail")}
            value={
              imapExtension?.loaded
                ? __("Loaded", "pressedmail")
                : __("Missing", "pressedmail")
            }
            ok={imapExtension?.loaded}
            recommended
          />
          {phpLimits?.memory_usage ? (
            <HealthRow
              label={__("Memory usage", "pressedmail")}
              value={phpLimits.memory_usage}
            />
          ) : null}
          {phpLimits?.memory_limit || memory ? (
            <HealthRow
              label={__("Max memory", "pressedmail")}
              value={phpLimits?.memory_limit || memory?.current || ""}
              ok={memory?.is_adequate !== false}
            />
          ) : null}
          {phpLimits?.execution_time ? (
            <HealthRow
              label={__("Execution time", "pressedmail")}
              value={phpLimits.execution_time}
            />
          ) : null}
          {phpLimits?.max_execution_time ? (
            <HealthRow
              label={__("Max execution time", "pressedmail")}
              value={phpLimits.max_execution_time}
            />
          ) : null}
          {phpLimits?.post_max_size ? (
            <HealthRow
              label={__("Max post size", "pressedmail")}
              value={phpLimits.post_max_size}
            />
          ) : null}
          {phpLimits?.upload_max_filesize ? (
            <HealthRow
              label={__("Max upload size", "pressedmail")}
              value={phpLimits.upload_max_filesize}
            />
          ) : null}
        </dl>
      </SettingsSectionCard>

      <SettingsSectionCard
        title={__("Plugin Status", "pressedmail")}
        dataTest="plugin-status-diagnostics"
        contentClassName="space-y-3">
        <dl className="divide-y divide-border">
          <PluginStatusRow
            label={__("Current installed version", "pressedmail")}
            value={currentVersion}
          />
          <PluginStatusRow
            label={latestReleaseLabel}
            value={latestVersionLabel}
          />
          <PluginStatusRow
            label={__("Email driver", "pressedmail")}
            value={imapDriver?.driver || __("Unknown", "pressedmail")}
          />
          {syncSchedule ? (
            <PluginStatusRow
              label={__("Background sync", "pressedmail")}
              value={syncLabel}
              destructive={syncOverdue}
            />
          ) : null}
        </dl>

        {currentVersion.includes("-beta.") ? (
          <p className="text-xs text-muted-foreground">
            {__(
              "This is a Beta build. Its version can be newer than the latest published release.",
              "pressedmail",
            )}
          </p>
        ) : null}
        {syncSchedule && syncSchedule.mode === "scheduled" ? (
          <div
            className="text-xs text-muted-foreground"
            data-test="sync-schedule-detail"
            data-testid="sync-schedule-detail">
            {syncSchedule.lastRun
              ? sprintf(
                  __("Last sync run: %s", "pressedmail"),
                  new Date(syncSchedule.lastRun * 1000).toLocaleString(),
                )
              : __("Last sync run: not yet", "pressedmail")}
            {syncSchedule.nextRun
              ? ` · ${sprintf(
                  __("Next run: %s", "pressedmail"),
                  new Date(syncSchedule.nextRun * 1000).toLocaleString(),
                )}`
              : ""}
          </div>
        ) : null}

        {imapMissing ? (
          <Alert className="bg-muted/50 border-muted">
            <Info className="h-4 w-4" />
            <AlertDescription className="text-sm">
              <span className="font-medium">
                {__("IMAP PHP extension not installed.", "pressedmail")}
              </span>{" "}
              {__(
                "A socket-based fallback driver is active. For optimal performance, consider installing the PHP IMAP extension.",
                "pressedmail",
              )}
            </AlertDescription>
          </Alert>
        ) : null}

        {imapMissing ? (
          <div className="rounded-lg border bg-muted/30 p-4 text-sm">
            <p className="font-medium">
              {__("Recommended fix", "pressedmail")}
            </p>
            {imapExtension.install_cmd ? (
              <code className="mt-2 block rounded bg-background p-2 text-xs">
                {imapExtension.install_cmd}
              </code>
            ) : (
              <p className="mt-1 text-muted-foreground">
                {__(
                  "Install the PHP IMAP extension for your server distribution.",
                  "pressedmail",
                )}
              </p>
            )}
          </div>
        ) : null}
      </SettingsSectionCard>

      {cronWorkers.length > 0 || cronHealth?.wpCronDisabled ? (
        <SettingsSectionCard
          title={__("Scheduled work", "pressedmail")}
          description={__(
            "Background workers with something scheduled right now. Workers without a scheduled event are omitted.",
            "pressedmail",
          )}
          dataTest="scheduled-work-diagnostics">
          {cronHealth?.wpCronDisabled ? (
            <Alert className="bg-muted/50 border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {__(
                  "WP-Cron is disabled on this site (DISABLE_WP_CRON), so WordPress will not run scheduled work on page loads. A server cron entry below is required for scheduled mail and rules to fire on time.",
                  "pressedmail",
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {cronWorkers.length > 0 ? (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              data-test="cron-worker-table"
              data-testid="cron-worker-table">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="py-2 pr-3 font-medium">
                    {__("Worker", "pressedmail")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {__("Repeats", "pressedmail")}
                  </th>
                  <th className="py-2 pr-3 font-medium">
                    {__("Next run", "pressedmail")}
                  </th>
                  <th className="py-2 font-medium">
                    {__("Last run", "pressedmail")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {cronWorkers.map((worker) => (
                  <tr
                    key={worker.hook}
                    className="border-b border-border align-top last:border-b-0"
                    data-test={`cron-worker-${worker.hook}`}>
                    <td className="py-2 pr-3">
                      <span className="break-all font-mono text-xs">
                        {worker.hook}
                      </span>
                      {worker.events > 1 ? (
                        <span className="ml-2 text-xs text-muted-foreground">
                          {sprintf(__("%d jobs", "pressedmail"), String(worker.events))}
                        </span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 whitespace-nowrap">
                      {formatInterval(worker.intervalSeconds)}
                    </td>
                    <td className="py-2 pr-3">
                      {worker.overdue ? (
                        <Badge variant="destructive" className="mb-1 mr-2">
                          {__("Overdue", "pressedmail")}
                        </Badge>
                      ) : null}
                      <span className="whitespace-nowrap">
                        {worker.nextRun
                          ? new Date(worker.nextRun * 1000).toLocaleString()
                          : __("Unknown", "pressedmail")}
                      </span>
                    </td>
                    <td className="py-2 whitespace-nowrap">
                      {worker.lastRun
                        ? new Date(worker.lastRun * 1000).toLocaleString()
                        : __("Not recorded", "pressedmail")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          ) : null}

          {cronHealth?.serverCronCommand ? (
            <div
              className="rounded-lg border bg-muted/30 p-4 text-sm"
              data-test="server-cron-hint"
              data-testid="server-cron-hint">
              <p className="font-medium">{__("Server cron", "pressedmail")}</p>
              <p className="mt-1 text-muted-foreground">
                {__(
                  "For exact timing on a busy or low-traffic site, add this line to the server crontab. It is safe alongside WordPress's own cron: the two coordinate through a database lock.",
                  "pressedmail",
                )}
              </p>
              <code className="mt-2 block overflow-x-auto rounded bg-background p-2 text-xs whitespace-nowrap">
                {cronHealth?.serverCronCommand}
              </code>
              <p className="mt-1 text-xs text-muted-foreground">
                {__(
                  "Use the full path to your wp-cli binary if cron cannot find wp.",
                  "pressedmail",
                )}
              </p>
            </div>
          ) : null}
        </SettingsSectionCard>
      ) : null}

      <div className="grid gap-4">
        <SettingsSectionCard
          title={__("PHP Extensions", "pressedmail")}
          description={__("Required server extensions", "pressedmail")}
          dataTest="php-extensions-card">
          <div
            data-test="php-extensions-grid"
            data-testid="php-extensions-grid"
            className="grid gap-2 sm:grid-cols-2">
            {Object.entries(extensions || {}).map(([key, value]) => {
              if (key === "imap") return null;

              const ext = value as ExtensionInfo;

              return (
                <div
                  key={key}
                  data-test={`php-extension-${key}`}
                  data-testid={`php-extension-${key}`}
                  className="flex min-w-0 items-center gap-2 rounded-md border p-3 text-sm">
                  {ext.loaded ? (
                    <CheckCircle
                      data-test="php-extension-status-icon"
                      data-testid="php-extension-status-icon"
                      className="h-4 w-4 shrink-0 text-success"
                    />
                  ) : ext.required ? (
                    <AlertTriangle
                      data-test="php-extension-status-icon"
                      data-testid="php-extension-status-icon"
                      className="h-4 w-4 shrink-0 text-destructive"
                    />
                  ) : (
                    <Info
                      data-test="php-extension-status-icon"
                      data-testid="php-extension-status-icon"
                      className="h-4 w-4 shrink-0 text-muted-foreground"
                    />
                  )}
                  <span className="min-w-0 flex-1 truncate text-muted-foreground">
                    {ext.name}
                  </span>
                  {!ext.loaded && !ext.required ? (
                    <Badge variant="outline" className="shrink-0">
                      {__("Optional", "pressedmail")}
                    </Badge>
                  ) : null}
                </div>
              );
            })}
          </div>
        </SettingsSectionCard>
      </div>

      {memory && !memory.is_adequate && (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            {sprintf(
              __(
                "PHP memory limit (%1$s) is below the recommended %2$s. This may affect performance.",
                "pressedmail",
              ),
              memory.current,
              memory.recommended,
            )}
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}
