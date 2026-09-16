import { __, _n, sprintf } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Button,
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@kit/ui/plugin";
import { getCalendarLocale } from "@/components/calendar/calendar-intl";
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

/**
 * The plugin's own wp-cron entry, as the Diagnostics panel reports it.
 *
 * `nextRun` of 0 means no recurrence is armed; `lastRun` of 0 means it has not
 * completed a pass yet. Both are unix seconds, from the server.
 */
type CronDispatchInfo = {
  lastRun?: number;
  nextRun?: number;
};

type CronHealthInfo = {
  workers?: CronWorkerInfo[];
  wpCronDisabled?: boolean;
  dispatch?: CronDispatchInfo;
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
    return sprintf(
      __("Every %d min", "pressedmail"),
      String(Math.round(seconds / 60)),
    );
  }
  if (seconds < 86400) {
    return sprintf(
      __("Every %d h", "pressedmail"),
      String(Math.round(seconds / 3600)),
    );
  }
  return sprintf(
    __("Every %d d", "pressedmail"),
    String(Math.round(seconds / 86400)),
  );
}

/**
 * A dispatcher pass runs every minute, so three missed passes is where calling
 * it healthy would be a lie rather than a rounding error.
 */
const DISPATCH_STALE_SECONDS = 180;

/**
 * How long ago a unix-seconds stamp was, in the plugin's own locale.
 *
 * Minutes and seconds here, not days: the whole point of the row is to show a
 * live heartbeat, and `Intl.RelativeTimeFormat` is what words "38 seconds ago"
 * in the reader's language.
 */
function formatSince(timestamp: number, nowSeconds: number): string {
  const seconds = Math.max(0, nowSeconds - timestamp);
  const relative = new Intl.RelativeTimeFormat(getCalendarLocale(), {
    numeric: "auto",
    style: "long",
  });
  if (seconds < 60) return relative.format(-seconds, "second");
  if (seconds < 3600)
    return relative.format(-Math.floor(seconds / 60), "minute");
  if (seconds < 86400)
    return relative.format(-Math.floor(seconds / 3600), "hour");
  return relative.format(-Math.floor(seconds / 86400), "day");
}

/**
 * How often the heartbeat is re-measured.
 *
 * The dispatcher runs once a minute, so anything finer is noise. 0 means the
 * clock has not been read yet, which the caller renders as an absolute time.
 */
const HEARTBEAT_TICK_MS = 15_000;

export function SystemDiagnostics() {
  // Reading the clock during render is impure, so the heartbeat is measured
  // after mount and re-measured on a timer. A settings tab left open would
  // otherwise keep claiming a pass that happened an hour ago.
  const [nowSeconds, setNowSeconds] = useState(0);
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
  const overdueWorkers = cronWorkers.filter(
    (worker) => worker.overdue === true,
  );

  // PressedMail's own wp-cron entry. This replaced a printed crontab line: the
  // command was install-specific and most administrators cannot run it, so the
  // panel reports whether background work is actually happening instead.
  const dispatch = cronHealth?.dispatch;
  const dispatchLastRun = dispatch?.lastRun ?? 0;
  const dispatchNextRun = dispatch?.nextRun ?? 0;
  const dispatchStale =
    nowSeconds > 0 &&
    dispatchLastRun > 0 &&
    nowSeconds - dispatchLastRun > DISPATCH_STALE_SECONDS;
  const dispatchState: "disabled" | "missing" | "never" | "stale" | "ok" =
    cronHealth?.wpCronDisabled
      ? "disabled"
      : dispatchNextRun === 0
        ? "missing"
        : dispatchLastRun === 0
          ? "never"
          : dispatchStale
            ? "stale"
            : "ok";
  // The disabled case is the one explanation the panel owes a reader even when
  // the server sends no dispatch block at all: it is the reason nothing runs,
  // and the card exists to say so. Every other note describes a heartbeat, so
  // it is only shown once there is one to describe.
  const showDispatchNote =
    dispatchState === "disabled" || dispatch !== undefined;
  const dispatchBadge = {
    disabled: {
      label: __("Not running", "pressedmail"),
      variant: "destructive" as const,
    },
    // The recurrence re-arms on the next request, so this is usually a
    // snapshot of a moment rather than a lasting fault.
    missing: {
      label: __("Not scheduled", "pressedmail"),
      variant: "destructive" as const,
    },
    never: {
      label: __("Waiting for first run", "pressedmail"),
      variant: "secondary" as const,
    },
    stale: {
      label: __("Delayed", "pressedmail"),
      variant: "destructive" as const,
    },
    ok: {
      label: __("Running normally", "pressedmail"),
      variant: "success" as const,
    },
  }[dispatchState];
  const dispatchNote = {
    disabled: __(
      "WP-Cron is switched off on this site (DISABLE_WP_CRON), so WordPress runs no scheduled work at all. Background mail will not start until it is switched back on.",
      "pressedmail",
    ),
    missing: __(
      "No background task is scheduled right now. PressedMail re-arms it on the next page load; if this line stays, WordPress cron itself is not running.",
      "pressedmail",
    ),
    never: __(
      "No background pass has completed yet. The first one runs within a minute of any visit to the site, and this line updates after it.",
      "pressedmail",
    ),
    stale: __(
      "The last background pass was over three minutes ago, so scheduled work is not running on time. A site with little traffic is the usual cause: any visit lets WordPress catch up.",
      "pressedmail",
    ),
    ok: null,
  }[dispatchState];

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
    const tick = () => setNowSeconds(Math.floor(Date.now() / 1000));
    tick();
    const timer = window.setInterval(tick, HEARTBEAT_TICK_MS);
    return () => window.clearInterval(timer);
  }, []);

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
            // `inline-flex min-h-6` is the 24px target floor. A bare inline
            // anchor at text-sm measures 22px tall, which the craft gate fails
            // as HF-TARGET and which is genuinely awkward to hit with a mouse.
            <a
              className="inline-flex min-h-6 items-center text-sm text-primary underline"
              href={siteHealthUrl}>
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

      {cronWorkers.length > 0 || cronHealth?.wpCronDisabled || dispatch ? (
        <SettingsSectionCard
          title={__("Background tasks", "pressedmail")}
          description={__(
            "Scheduled mail work: sends, reminders, rules and mailbox sync.",
            "pressedmail",
          )}
          dataTest="scheduled-work-diagnostics">
          {/*
            Guarded on `dispatch` itself, not on the derived numbers. A partial
            upgrade (new admin bundle beside an older server payload) sends no
            dispatch block, and defaulting that to zero would render "Not
            scheduled" for a site that is running fine.
          */}
          {dispatch ? (
            <div
              className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm"
              data-test="background-task-summary"
              data-testid="background-task-summary">
              <Badge variant={dispatchBadge.variant}>
                {dispatchBadge.label}
              </Badge>
              <p className="text-muted-foreground">
                {__("Last check", "pressedmail")}{" "}
                <span className="text-foreground">
                  {dispatchLastRun === 0
                    ? __("Not yet", "pressedmail")
                    : nowSeconds > 0
                      ? formatSince(dispatchLastRun, nowSeconds)
                      : new Date(dispatchLastRun * 1000).toLocaleTimeString()}
                </span>
              </p>
              <p className="text-muted-foreground">
                {__("Next check", "pressedmail")}{" "}
                <span className="text-foreground">
                  {dispatchNextRun > 0
                    ? new Date(dispatchNextRun * 1000).toLocaleTimeString()
                    : __("Not scheduled", "pressedmail")}
                </span>
              </p>
            </div>
          ) : null}

          {overdueWorkers.length > 0 ? (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {sprintf(
                  _n(
                    "%d background task is overdue.",
                    "%d background tasks are overdue.",
                    overdueWorkers.length,
                    "pressedmail",
                  ),
                  String(overdueWorkers.length),
                )}
              </AlertDescription>
            </Alert>
          ) : null}

          {showDispatchNote && dispatchNote ? (
            <Alert className="bg-muted/50 border-muted">
              <Info className="h-4 w-4" />
              <AlertDescription className="text-sm">
                {dispatchNote}
              </AlertDescription>
            </Alert>
          ) : null}

          {cronWorkers.length > 0 ? (
            <Collapsible>
              <CollapsibleTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2">
                  {sprintf(
                    /* translators: %d: number of scheduled background workers. */
                    _n(
                      "Show %d worker",
                      "Show %d workers",
                      cronWorkers.length,
                      "pressedmail",
                    ),
                    String(cronWorkers.length),
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
                                {sprintf(
                                  __("%d jobs", "pressedmail"),
                                  String(worker.events),
                                )}
                              </span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 whitespace-nowrap">
                            {formatInterval(worker.intervalSeconds)}
                          </td>
                          <td className="py-2 pr-3">
                            {worker.overdue ? (
                              <Badge
                                variant="destructive"
                                className="mb-1 mr-2">
                                {__("Overdue", "pressedmail")}
                              </Badge>
                            ) : null}
                            <span className="whitespace-nowrap">
                              {worker.nextRun
                                ? new Date(
                                    worker.nextRun * 1000,
                                  ).toLocaleString()
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
              </CollapsibleContent>
            </Collapsible>
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
