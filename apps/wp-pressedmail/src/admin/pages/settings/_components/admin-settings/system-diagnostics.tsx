import { __, sprintf } from "@wordpress/i18n";
import { useState } from "react";
import { CheckCircle, AlertTriangle, Info } from "lucide-react";
import {
  Alert,
  AlertDescription,
  Badge,
} from "@kit/ui/plugin";
import {
  SettingsEmptyState,
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { useLatestRelease } from "@/admin/pages/settings/_components/admin-settings/use-latest-release";

type ExtensionInfo = {
  name: string;
  required: boolean;
  loaded: boolean;
  description: string;
  install_cmd: string;
};

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

export function SystemDiagnostics() {
  const diagnostics = window.pressedmailPlugin?.systemDiagnostics;
  const {
    extensions,
    imapDriver,
    phpVersion,
    wpVersion,
    memory,
    phpLimits,
    syncSchedule,
  } = diagnostics ?? {};
  const imapExtension = extensions?.imap as ExtensionInfo | undefined;
  const currentVersion =
    window.pressedmailPlugin?.version ?? __("Unknown", "pressedmail");
  // Which update channel this edition follows, and its latest release. Pro
  // asks the licence server; Free reports WordPress.org without a request.
  const latestRelease = useLatestRelease(currentVersion);

  // Check if IMAP native extension is missing
  const imapMissing = imapExtension && !imapExtension.loaded;
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
            label={latestRelease.label}
            value={latestRelease.value}
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
