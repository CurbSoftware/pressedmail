"use client";

/**
 * Rule activity: what rules did lately.
 *
 * Runs you started (Run now, a sweep) are listed one by one. Rules that run
 * as mail arrives run once per message, so those are summed over the last
 * week, with the runs that matched something or failed listed below.
 */

import * as React from "react";
import { AlertCircle, ChevronRight, RefreshCw } from "lucide-react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { Badge, Button, Skeleton } from "@kit/ui/plugin";
import type {
  FilterRuleRunHistory,
  FilterRuleRunHistoryItem,
} from "@/types/filter-rules";
import { runTriggerLabel } from "@/types/filter-rules";
import { fetchFilterRuleRuns, fetchFilterRules } from "@/services/filter-rules.service";
import { getCalendarLocale } from "@/components/calendar/calendar-intl";
import { proTriggerLabel } from "@/components/settings/filter-rules/pro-rule-options.active";

function statusLabel(status: FilterRuleRunHistoryItem["status"]): string {
  switch (status) {
    case "completed":
      return __("Done", "pressedmail");
    case "failed":
      return __("Failed", "pressedmail");
    case "cancelled":
      return __("Stopped", "pressedmail");
    case "syncing":
      return __("Syncing", "pressedmail");
    default:
      return __("Running", "pressedmail");
  }
}

/** Run timestamps are UTC without a zone marker. */
function runDate(value: string | undefined): Date | null {
  if (!value) return null;
  const date = new Date(value.replace(" ", "T") + "Z");
  return Number.isNaN(date.getTime()) ? null : date;
}

/** "5 minutes ago", in the plugin's locale; the exact time is the tooltip. */
function relativeWhen(date: Date): string {
  const seconds = Math.round((date.getTime() - Date.now()) / 1000);
  const relative = new Intl.RelativeTimeFormat(getCalendarLocale(), { numeric: "auto" });
  const abs = Math.abs(seconds);
  if (abs < 60) return relative.format(0, "second");
  if (abs < 3600) return relative.format(Math.round(seconds / 60), "minute");
  if (abs < 86400) return relative.format(Math.round(seconds / 3600), "hour");
  return relative.format(Math.round(seconds / 86400), "day");
}

function startedBy(trigger: string): string {
  // A sweep is something you started, the same as Run now.
  if (trigger === "manual" || trigger === "sweep") return __("You", "pressedmail");
  return runTriggerLabel(trigger) || proTriggerLabel(trigger) || trigger;
}

/** Which rule ran: its name, "Sweep" for a sweep's one-off rules, or a count. */
const ruleIdsOf = (run: FilterRuleRunHistoryItem): string[] => run.ruleIds ?? [];

function ruleText(run: FilterRuleRunHistoryItem, names: Map<string, string>): string {
  const ids = ruleIdsOf(run);
  if (run.trigger === "sweep" || (ids.length > 0 && ids.every((id) => id.startsWith("sweep-")))) {
    return __("Sweep", "pressedmail");
  }
  if (ids.length === 1) {
    return names.get(ids[0]!) ?? __("A deleted rule", "pressedmail");
  }
  if (ids.length > 1) {
    return sprintf(
      /* translators: %d: number of rules in one run. */
      _n("%d rule", "%d rules", ids.length, "pressedmail"),
      ids.length,
    );
  }
  // A run with no rule ids still says so, not a blank cell under "Rule".
  return __("No rule", "pressedmail");
}

/** A rule name that is not a real, current rule reads muted, so it is not mistaken for one. */
function ruleIsPlaceholder(run: FilterRuleRunHistoryItem, names: Map<string, string>): boolean {
  const ids = ruleIdsOf(run);
  if (run.trigger === "sweep" || (ids.length > 0 && ids.every((id) => id.startsWith("sweep-")))) {
    return false;
  }
  return ids.length === 0 || (ids.length === 1 && !names.has(ids[0]!));
}

/* One column grid for both tables, so their columns line up. On a phone each
   row becomes a small card instead of a squeezed table: the rule in bold with
   its status beside it, then when and who in one muted line, then the result. */
const CELL = "max-sm:py-0.5 max-sm:pr-0";
const COLUMNS = ["w-[14%]", "w-[24%]", "w-[22%]", "w-[12%]", "w-[28%]"];

/** One chip shape for every status; only the colour says which. */
function statusClass(status: FilterRuleRunHistoryItem["status"]): string {
  switch (status) {
    case "completed":
      return "border-success/40 bg-success/10 text-success";
    case "failed":
      return "border-destructive/40 bg-destructive/10 text-destructive";
    default:
      return "border-border bg-muted text-muted-foreground";
  }
}

function RunRow({
  run,
  names,
}: {
  run: FilterRuleRunHistoryItem;
  names: Map<string, string>;
}) {
  const date = runDate(run.createdAt);
  return (
    <tr
      className="border-t border-border align-top max-sm:flex max-sm:flex-wrap max-sm:items-center max-sm:gap-x-2 max-sm:py-2"
      data-test={`rule-run-history-row-${run.id}`}
      data-testid={`rule-run-history-row-${run.id}`}>
      <td className={`py-2 pr-3 whitespace-nowrap max-sm:order-3 max-sm:text-xs max-sm:text-muted-foreground ${CELL}`}>
        {date ? (
          <time dateTime={date.toISOString()} title={date.toLocaleString()}>
            {relativeWhen(date)}
          </time>
        ) : (
          run.createdAt
        )}
      </td>
      <td
        className={`py-2 pr-3 max-sm:order-1 ${
          ruleIsPlaceholder(run, names)
            ? "italic text-muted-foreground"
            : "font-medium text-foreground"
        } ${CELL}`}>
        {ruleText(run, names)}
      </td>
      <td className={`py-2 pr-3 text-xs text-muted-foreground max-sm:order-4 ${CELL}`}>
        <span className="sm:hidden">{__("Started by:", "pressedmail")} </span>
        {startedBy(run.trigger)}
      </td>
      <td className={`py-2 pr-3 max-sm:order-2 ${CELL}`}>
        <Badge
          variant="outline"
          className={`text-xs ${statusClass(run.status)}`}
          data-status={run.status}>
          {statusLabel(run.status)}
        </Badge>
      </td>
      <td className={`py-2 text-xs text-muted-foreground max-sm:order-5 max-sm:basis-full ${CELL}`}>
        {sprintf(
          /* translators: 1: messages matched, 2: messages checked, 3: messages changed. */
          __("%1$d of %2$d matched, %3$d changed", "pressedmail"),
          run.matchedCount ?? 0,
          run.processedCount ?? 0,
          run.changedCount ?? 0,
        )}
        {run.errorMessage ? (
          <span className="mt-0.5 block text-destructive">{run.errorMessage}</span>
        ) : null}
      </td>
    </tr>
  );
}

function RunTable({
  runs,
  caption,
  names,
}: {
  runs: FilterRuleRunHistoryItem[];
  caption: string;
  names: Map<string, string>;
}) {
  return (
    <table className="mt-2 w-full table-fixed text-left text-sm max-sm:block">
      <caption className="sr-only">{caption}</caption>
      <colgroup>
        {COLUMNS.map((width) => (
          <col key={width} className={width} />
        ))}
      </colgroup>
      <thead className="text-xs text-muted-foreground max-sm:sr-only">
        <tr>
          <th scope="col" className="pb-1 pr-3 font-medium">
            {__("When", "pressedmail")}
          </th>
          <th scope="col" className="pb-1 pr-3 font-medium">
            {__("Rule", "pressedmail")}
          </th>
          <th scope="col" className="pb-1 pr-3 font-medium">
            {__("Started by", "pressedmail")}
          </th>
          <th scope="col" className="pb-1 pr-3 font-medium">
            {__("Status", "pressedmail")}
          </th>
          <th scope="col" className="pb-1 font-medium">
            {__("Result", "pressedmail")}
          </th>
        </tr>
      </thead>
      <tbody className="max-sm:block">
        {runs.map((run) => (
          <RunRow key={run.id} run={run} names={names} />
        ))}
      </tbody>
    </table>
  );
}

export function RuleRunHistory() {
  const [history, setHistory] = React.useState<FilterRuleRunHistory | null>(
    null,
  );
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [names, setNames] = React.useState<Map<string, string>>(new Map());

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    // Names only label the rows; activity still shows without them.
    void fetchFilterRules(null)
      .then((rules) => setNames(new Map(rules.map((rule) => [String(rule.id), rule.name]))))
      .catch(() => undefined);
    try {
      setHistory(await fetchFilterRuleRuns());
    } catch (err) {
      // The server's words go in a disclosure; the user gets a plain sentence.
      setError(err instanceof Error ? err.message : "");
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    void load();
  }, [load]);

  const summary = history?.automaticSummary;

  return (
    <div
      className="space-y-4"
      data-test="rule-run-history"
      data-testid="rule-run-history">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          {__("What your rules did lately.", "pressedmail")}
        </p>
        {/* Always here, so the page does not shift when a load fails; it is
            also the retry. */}
        <Button
          type="button"
          variant="outline"
          onClick={() => void load()}
          disabled={loading}
          className="max-sm:min-h-11"
          data-test="rule-run-history-refresh"
          data-testid="rule-run-history-refresh">
          <RefreshCw className={`mr-2 h-4 w-4${loading ? " animate-spin" : ""}`} aria-hidden="true" />
          {error !== null ? __("Try again", "pressedmail") : __("Refresh", "pressedmail")}
        </Button>
      </div>

      {error !== null ? (
        <div
          role="alert"
          className="flex flex-wrap items-start gap-2 rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive"
          data-test="rule-run-history-error"
          data-testid="rule-run-history-error">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p>
              {history
                ? __("Couldn't load the latest activity. Showing what we had.", "pressedmail")
                : __("Couldn't load rule activity.", "pressedmail")}
            </p>
            {error ? (
              <details className="group mt-1 text-xs">
                {/* The plugin's chevron, not the browser's triangle. */}
                <summary className="flex w-fit cursor-pointer list-none items-center gap-1 [&::-webkit-details-marker]:hidden">
                  <ChevronRight
                    className="h-3.5 w-3.5 transition-transform group-open:rotate-90"
                    aria-hidden="true"
                  />
                  {__("Details", "pressedmail")}
                </summary>
                <p className="mt-1 break-words">{error}</p>
              </details>
            ) : null}
          </div>
        </div>
      ) : null}

      {loading && !history ? (
        <div className="space-y-2" aria-hidden="true">
          {/* A step lighter than muted, so the bars show in dark mode too. */}
          <Skeleton className="h-4 w-40 bg-muted-foreground/15" />
          {[1, 2, 3].map((row) => (
            <Skeleton key={row} className="h-8 bg-muted-foreground/15" />
          ))}
        </div>
      ) : null}

      {history ? (
        <>
          <section
            className="space-y-1.5"
            aria-labelledby="rule-history-automatic">
            <h3 id="rule-history-automatic" className="text-sm font-semibold">
              {__("Automatic, last 7 days", "pressedmail")}
            </h3>
            <p
              className={summary && summary.runs > 0 ? "text-sm" : "text-sm text-muted-foreground"}
              data-test="rule-run-history-summary"
              data-testid="rule-run-history-summary">
              {summary && summary.runs > 0
                ? sprintf(
                    /* translators: 1: automatic rule runs, 2: messages matched, 3: changed, 4: failed. */
                    _n(
                      "%1$d run: %2$d messages matched, %3$d changed, %4$d failed.",
                      "%1$d runs: %2$d messages matched, %3$d changed, %4$d failed.",
                      summary.runs,
                      "pressedmail",
                    ),
                    summary.runs,
                    summary.matched,
                    summary.changed,
                    summary.failed,
                  )
                : __(
                    "Nothing yet. Rules that run on their own show up here after they match something.",
                    "pressedmail",
                  )}
            </p>
            {summary && summary.runs > history.automatic.length && history.automatic.length > 0 ? (
              <p className="pt-1 text-xs text-muted-foreground">
                {__("Listed below: the runs that matched something or failed.", "pressedmail")}
              </p>
            ) : null}
            {history.automatic.length > 0 ? (
              <RunTable
                runs={history.automatic}
                names={names}
                caption={__("Automatic rule runs that matched or failed", "pressedmail")}
              />
            ) : null}
          </section>

          <section
            className="space-y-1.5"
            aria-labelledby="rule-history-manual">
            <h3 id="rule-history-manual" className="text-sm font-semibold">
              {__("Runs you started", "pressedmail")}
            </h3>
            {history.runs.length > 0 ? (
              <RunTable
                runs={history.runs}
                names={names}
                caption={__("Rule runs you started", "pressedmail")}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                {__(
                  "You have not run rules by hand yet. Use Run rules now, or a sweep from the inbox.",
                  "pressedmail",
                )}
              </p>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}

export default RuleRunHistory;
