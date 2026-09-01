import { __, sprintf } from "@wordpress/i18n";
import { apiFetch } from "@/lib/api-client";
import { useEffect, useState } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@kit/ui/plugin";
import {
  SettingsEmptyState,
  SettingsInfoTooltip,
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
  ok = true,
}: {
  label: string;
  value: string;
  ok?: boolean;
}) {
  return (
    <div
      className="flex min-w-0 items-center justify-between gap-3 rounded-md border p-3 text-sm"
      data-test="system-health-row"
      data-testid="system-health-row">
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <Badge variant={ok ? "outline" : "destructive"}>{value}</Badge>
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
      <span className="min-w-0 text-muted-foreground">{label}</span>
      <Badge variant={destructive ? "destructive" : "outline"}>{value}</Badge>
    </div>
  );
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
  const extensionEntries = Object.entries(extensions || {}).filter(
    ([key]) => key !== "imap",
  );
  const latestVersionLabel =
    versionLookupState === "loading"
      ? __("Checking...", "pressedmail")
      : versionLookupState === "wporg"
        ? __("Managed by WordPress.org", "pressedmail")
        : latestVersion || __("Unavailable", "pressedmail");

  useEffect(() => {
    let cancelled = false;
    const apiUrl = window.pressedmailPlugin?.apiUrl;
    const nonce = window.pressedmailPlugin?.wpApiSettings?.nonce;

    // WordPress.org builds do not register /updates/check. Core's update
    // system owns the version there, so the lookup would only 404. Only an
    // explicit true opts into the lookup: an absent flag (older PHP runtime
    // data) must not trigger a request to a route that may not exist.
    if (window.pressedmailPlugin?.useCustomUpdates !== true) {
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

    apiFetch(`${apiUrl}${getRuntimeRestNamespace()}/updates/check`)
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
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <div>
              <CardTitle className="flex items-center gap-1.5">
                <span>{__("System Health", "pressedmail")}</span>
                <SettingsInfoTooltip
                  tooltip={settingsInfoTooltips.systemHealth}
                  docHref={settingsInfoDocHrefs.systemHealth}
                />
              </CardTitle>
              <CardDescription>
                {__(
                  "Server environment and PHP extension status",
                  "pressedmail",
                )}
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 lg:grid-cols-2">
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
              ok={imapExtension?.loaded !== false}
            />
            {extensionEntries.map(([key, value]) => {
              const extension = value as ExtensionInfo;
              return (
                <HealthRow
                  key={key}
                  label={extension.name}
                  value={
                    extension.loaded
                      ? __("Loaded", "pressedmail")
                      : __("Missing", "pressedmail")
                  }
                  ok={extension.loaded || !extension.required}
                />
              );
            })}
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
          </div>
        </CardContent>
      </Card>

      <Card
        data-test="plugin-status-diagnostics"
        data-testid="plugin-status-diagnostics"
        className="rounded-lg border">
        <CardHeader>
          <CardTitle className="text-sm">
            {__("Plugin Status", "pressedmail")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid gap-2 lg:grid-cols-2">
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
          </div>

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
        </CardContent>
      </Card>

      <div className="grid gap-4">
        <Card
          data-test="php-extensions-card"
          data-testid="php-extensions-card"
          className="h-full rounded-lg border">
          <CardHeader>
            <CardTitle className="text-sm">
              {__("PHP Extensions", "pressedmail")}
            </CardTitle>
            <CardDescription>
              {__("Required server extensions", "pressedmail")}
            </CardDescription>
          </CardHeader>
          <CardContent>
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
          </CardContent>
        </Card>
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
