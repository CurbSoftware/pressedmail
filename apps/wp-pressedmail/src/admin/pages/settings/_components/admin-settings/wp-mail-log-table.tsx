import { Fragment, useCallback, useEffect, useState } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { ChevronDown, Loader2, RotateCw, Trash2 } from "lucide-react";

import {
  Badge,
  Button,
  cn,
  Label,
  NativeSelect,
  NativeSelectOption,
} from "@kit/ui/plugin";

import { SettingsEmptyState } from "@/components/settings-ui";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import { CellLabel } from "@/components/ui/cell-label";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { formatHealthTime, reportOverdue } from "@/components/wp-mail/smtp-health-copy";
import { proRouteLabel } from "@/components/wp-mail/smtp-pro-copy.active";
import { withValue } from "@/lib/with-value";
import {
  clearWpMailLog,
  fetchWpMailLog,
  type WpMailLogEntry,
  type WpMailLogStatus,
} from "@/lib/wp-mail-api";

const PER_PAGE = 25;

/**
 * The log's columns once its container is wide enough (the System Emails
 * table's breakpoint). Narrower, each entry is a card: when, the result, then
 * To, Subject and Connection as labelled lines.
 *
 * Every track is fixed or a share of what is left (minmax(0, ...)), never
 * sized by its content: the header and each entry are grids of their own, and
 * only fixed tracks resolve to the same widths in all of them, so every column
 * starts where its heading does.
 */
export const LOG_GRID =
  "grid gap-x-3 @4xl:grid-cols-[9.5rem_11rem_minmax(0,1fr)_minmax(0,1.4fr)_minmax(0,1fr)]";

/** The log's result filter: every row, or one result. */
type ResultFilter = "all" | WpMailLogStatus;

const RESULTS: readonly ResultFilter[] = ["all", "sent", "failed", "queued", "unknown"];

function resultLabel(filter: ResultFilter): string {
  switch (filter) {
    case "sent":
      return __("Sent", "pressedmail");
    case "failed":
      return __("Failed", "pressedmail");
    case "queued":
      return __("Queued", "pressedmail");
    case "unknown":
      return __("Outcome unknown", "pressedmail");
    default:
      return __("All results", "pressedmail");
  }
}

/** One look for every result, so the column reads at a glance. */
const RESULT_TONE: Record<WpMailLogStatus, StatusTone> = {
  sent: "pass",
  failed: "fail",
  queued: "info",
  unknown: "warning",
};

/**
 * A queued message the service has not reported on for a day. It is still
 * queued: only the words and the tone change, so a late report settles it.
 */
const overdue = (entry: WpMailLogEntry): boolean =>
  entry.status === "queued" && reportOverdue(entry.createdAt);

/**
 * How a message that did not go through SMTP left the site. A message that did,
 * and a row written before this was recorded, say nothing: SMTP is what the
 * Server column already names.
 *
 * `native` is everything PressedMail did not send and cannot name: PHP mail(),
 * or a transport another mail plugin owns. Calling it "PHP mail" would claim
 * more than is known, so it says only what is true.
 */
function routeLabel(route: WpMailLogEntry["route"]): string {
  switch (route) {
    case "native":
      return __("Not sent by PressedMail", "pressedmail");
    case "paused":
      return __("Paused", "pressedmail");
    default:
      // A route only several connections can produce, worded by Pro.
      return proRouteLabel(route);
  }
}

/**
 * The service's id for a message, in its translated sentence, set in a
 * monospace face so it reads as the token it is.
 */
function ServiceReference({ reference }: { reference: string }) {
  return (
    <span className="block">
      {withValue(
        /* translators: %s: the id the service that sends for a connection gave the message. */
        __("Service reference: %s", "pressedmail"),
        <span className="font-mono">{reference}</span>,
      )}
    </span>
  );
}

/**
 * What the log draws while it loads: three entries in the log's own grid, so the
 * columns, the card layout on a phone and the height the rows land at are the
 * ones the rows will have. The page's live region says what is loading.
 */
function LogSkeleton() {
  const bar = "h-3 rounded bg-muted";

  return (
    <div aria-hidden="true" className="@container w-full min-w-0">
      <div className="animate-pulse space-y-2 motion-reduce:animate-none @4xl:space-y-0">
        {[0, 1, 2].map((row) => (
          <div
            key={row}
            className={cn(
              LOG_GRID,
              "items-start gap-y-2 rounded-lg border p-3 @4xl:gap-y-0 @4xl:rounded-none @4xl:border-0 @4xl:border-b @4xl:px-0 @4xl:py-2 @4xl:last:border-b-0",
            )}>
            <div className={cn(bar, "w-28")} />
            <div className="h-[1.375rem] w-20 rounded-full bg-muted" />
            <div className={cn(bar, "w-40 max-w-full")} />
            <div className={cn(bar, "w-3/4")} />
            <div className={cn(bar, "w-24")} />
          </div>
        ))}
      </div>
    </div>
  );
}

export interface WpMailLogTableProps {
  /** Retention in days. 0 means logging is off. */
  retentionDays: number;
  /**
   * The site has connections another plugin provides, whose messages can wait
   * as Queued and end as Outcome unknown, so the log offers a result filter.
   */
  transportStatuses?: boolean;
}

/**
 * Paged view of the delivery log.
 *
 * Deliberately shows only metadata, because that is all the server stores: no
 * message body, headers, or attachments are ever recorded.
 */
export function WpMailLogTable({
  retentionDays,
  transportStatuses = false,
}: WpMailLogTableProps) {
  const [filter, setFilter] = useState<ResultFilter>("all");
  const [entries, setEntries] = useState<WpMailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const status = transportStatuses && filter !== "all" ? filter : "";
  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWpMailLog(nextPage, PER_PAGE, status);
      setEntries(result.entries);
      setTotal(result.total);
      setPage(result.page);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : __("Could not load the delivery log.", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  }, [status]);

  useEffect(() => {
    void load(1);
  }, [load]);

  const handleClear = async () => {
    setClearing(true);
    setError("");
    try {
      // The helper answers false for a server-side refusal instead of throwing,
      // so both paths have to be handled or the wipe looks like it worked.
      const cleared = await clearWpMailLog().catch(() => false);
      if (!cleared) {
        setError(__("Could not clear the delivery log.", "pressedmail"));
        return;
      }
      await load(1);
    } finally {
      setClearing(false);
      setConfirmClear(false);
    }
  };

  const lastPage = Math.max(1, Math.ceil(total / PER_PAGE));
  const connectionHeading = transportStatuses
    ? __("Connection", "pressedmail")
    : __("Server", "pressedmail");
  const emptyTitle =
    status !== ""
      ? __("No entries with this result", "pressedmail")
      : retentionDays === 0
        ? __("Delivery logging is off", "pressedmail")
        : __("Nothing logged yet", "pressedmail");
  const emptyDescription =
    status !== ""
      ? __("Choose All results to see every entry.", "pressedmail")
      : retentionDays === 0
        ? __(
            "Choose a retention period above to start recording genuine WordPress mail.",
            "pressedmail",
          )
        : __(
            "Genuine WordPress mail appears here after WordPress sends it. PressedMail new-mail notification copies are excluded.",
            "pressedmail",
          );
  const waiting = entries.some(
    (entry) => entry.status === "queued" || entry.status === "unknown",
  );
  // Nothing loaded and the load failed: say so with a way to try again, not
  // an empty log nobody could read.
  const unreadable = error !== "" && !loading && entries.length === 0;
  const unreadableFallback = __("Could not load the delivery log.", "pressedmail");

  return (
    <div
      className="space-y-3"
      data-test="wp-mail-log"
      data-testid="wp-mail-log">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          {retentionDays > 0
            ? sprintf(
                /* translators: %d: number of days. */
                __(
                  "Recording genuine WordPress mail for %d days. PressedMail new-mail notification copies are excluded. Existing rows remain until retention removes them or you clear the log.",
                  "pressedmail",
                ),
                retentionDays,
              )
            : __(
                "Logging is off. Choose a retention period above to start recording genuine WordPress mail.",
                "pressedmail",
              )}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {transportStatuses ? (
            <div className="flex items-center gap-2">
              <Label htmlFor="wp-mail-log-result" className="text-xs font-medium">
                {__("Show", "pressedmail")}
              </Label>
              {/* Native: a popup list would hide the rest of the plugin from
                  assistive technology while its controls stay focusable. */}
              <NativeSelect
                id="wp-mail-log-result"
                className="w-44"
                value={filter}
                disabled={loading || clearing}
                onChange={(event) => setFilter(event.target.value as ResultFilter)}>
                {RESULTS.map((choice) => (
                  <NativeSelectOption key={choice} value={choice}>
                    {resultLabel(choice)}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
          ) : null}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            data-test="wp-mail-log-refresh"
            onClick={() => void load(page)}
            disabled={loading || clearing}>
            <RotateCw className="me-2 h-4 w-4" />
            {__("Refresh", "pressedmail")}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11 text-destructive hover:text-destructive"
            data-test="wp-mail-log-clear"
            data-testid="wp-mail-log-clear"
            onClick={() => setConfirmClear(true)}
            // A result filter that matches nothing still leaves rows to clear,
            // and Clear log removes every one of them.
            disabled={loading || clearing || (status === "" && total === 0)}>
            {clearing ? (
              <Loader2 className="me-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="me-2 h-4 w-4" />
            )}
            {__("Clear log", "pressedmail")}
          </Button>
        </div>
      </div>

      {error && !unreadable ? (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <ConfirmationPanel
        open={confirmClear}
        onOpenChange={setConfirmClear}
        variant="destructive"
        loading={clearing}
        title={__("Clear the delivery log?", "pressedmail")}
        description={__(
          "Every recorded delivery attempt is deleted. There is no way to get them back.",
          "pressedmail",
        )}
        confirmText={__("Clear it", "pressedmail")}
        cancelText={__("Keep it", "pressedmail")}
        onConfirm={handleClear}
      />

      {/* Said once per change, not the whole table again: what the list now holds. */}
      <span role="status" aria-live="polite" className="sr-only">
        {loading
          ? __("Loading delivery log", "pressedmail")
          : unreadable
            ? ""
            : entries.length === 0
              ? emptyTitle
              : sprintf(
                  /* translators: %d: number of delivery log entries. */
                  _n("%d entry", "%d entries", total, "pressedmail"),
                  total,
                )}
      </span>

      {loading ? (
        <LogSkeleton />
      ) : unreadable ? (
        <div role="alert" data-test="wp-mail-log-load-error">
          <SettingsEmptyState
            title={__("Could not load the delivery log", "pressedmail")}
            description={error !== unreadableFallback ? error : undefined}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="min-h-11"
                onClick={() => void load(page)}>
                <RotateCw className="me-2 h-4 w-4" />
                {__("Try again", "pressedmail")}
              </Button>
            }
          />
        </div>
      ) : entries.length === 0 ? (
        <SettingsEmptyState title={emptyTitle} description={emptyDescription} />
      ) : (
        <div className="space-y-2">
          <div
            role="table"
            aria-label={__("Delivery log", "pressedmail")}
            className="@container w-full min-w-0 text-start text-xs">
            <div role="rowgroup" className="hidden @4xl:block">
              <div role="row" className={cn(LOG_GRID, "border-b py-2 text-muted-foreground")}>
                <div role="columnheader" className="text-start font-medium">
                  {__("When", "pressedmail")}
                </div>
                {/* Second, so the result is the first thing after the time. */}
                <div role="columnheader" className="text-start font-medium">
                  {__("Result", "pressedmail")}
                </div>
                <div role="columnheader" className="text-start font-medium">
                  {__("To", "pressedmail")}
                </div>
                <div role="columnheader" className="text-start font-medium">
                  {__("Subject", "pressedmail")}
                </div>
                <div role="columnheader" className="text-start font-medium">
                  {connectionHeading}
                </div>
              </div>
            </div>
            <div role="rowgroup" className="space-y-2 @4xl:space-y-0">
              {entries.map((entry) => {
                const reference = entry.reference ?? "";
                const rowId = `wp-mail-log-${entry.id}`;
                const detailsId = `wp-mail-log-details-${entry.id}`;
                const open = expanded === entry.id;

                return (
                  <Fragment key={entry.id}>
                    <div
                      role="row"
                      className={cn(
                        LOG_GRID,
                        "items-start gap-y-2 rounded-lg border p-3 @4xl:gap-y-0 @4xl:rounded-none @4xl:border-0 @4xl:border-b @4xl:px-0 @4xl:py-2 @4xl:last:border-b-0",
                        open && "@4xl:border-b-0",
                      )}
                      data-test="wp-mail-log-row"
                      data-testid="wp-mail-log-row">
                      <div role="cell" className="text-muted-foreground">
                        <time id={`${rowId}-time`} dateTime={entry.createdAt}>
                          {formatHealthTime(entry.createdAt) || entry.createdAt}
                        </time>
                      </div>
                      <div role="cell" className="min-w-0">
                        {/* Under the result, so Details sits in the same place on
                            every row whatever the pill's width. */}
                        <div className="flex flex-col items-start gap-1">
                          <StatusPill
                            tone={overdue(entry) ? "warning" : (RESULT_TONE[entry.status] ?? "info")}
                            label={
                              overdue(entry)
                                ? __("No report yet", "pressedmail")
                                : resultLabel(entry.status)
                            }
                          />
                          {/* What went wrong, and the service's id for a
                              message it took, open on request. */}
                          {entry.error || reference ? (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="-ms-2 h-7 gap-1 px-2 text-xs pointer-coarse:min-h-11"
                              aria-expanded={open}
                              aria-controls={detailsId}
                              // Which entry: a log of twenty says "Details" twenty times.
                              aria-describedby={`${rowId}-subject ${rowId}-time`}
                              onClick={() => setExpanded(open ? null : entry.id)}
                              data-test="wp-mail-log-error-toggle"
                              data-testid="wp-mail-log-error-toggle">
                              {__("Details", "pressedmail")}
                              <ChevronDown
                                aria-hidden="true"
                                className={cn(
                                  "size-3.5 motion-safe:transition-transform",
                                  open && "rotate-180",
                                )}
                              />
                            </Button>
                          ) : null}
                        </div>
                      </div>
                      <div role="cell" className="grid min-w-0 gap-0.5 @4xl:block">
                        <CellLabel>{__("To", "pressedmail")}</CellLabel>
                        <span>
                          {/* break-words: an address wraps only when it must, never mid-word beside spare room. */}
                          <bdi className="break-words">{entry.toSummary}</bdi>
                          {entry.recipientCount > 1 ? (
                            <span className="ms-1 text-muted-foreground">
                              {sprintf(
                                /* translators: %d: number of additional recipients. */
                                __("+%d more", "pressedmail"),
                                entry.recipientCount - 1,
                              )}
                            </span>
                          ) : null}
                        </span>
                      </div>
                      <div role="cell" className="grid min-w-0 gap-0.5 @4xl:block">
                        <CellLabel>{__("Subject", "pressedmail")}</CellLabel>
                        {/* In a span, as To and Connection are: a bdi that is itself the
                            grid item takes its own direction, and an Arabic site's
                            Latin subject would sit flush left under a right-aligned label. */}
                        <span>
                          <bdi id={`${rowId}-subject`} className="break-words">
                            {entry.subject}
                          </bdi>
                        </span>
                      </div>
                      <div role="cell" className="grid min-w-0 gap-0.5 @4xl:block">
                        <CellLabel>{connectionHeading}</CellLabel>
                        <span>
                          <bdi className="break-words">
                            {entry.connectionLabel || "-"}
                          </bdi>
                          {entry.attempt > 1 ? (
                            <Badge variant="outline" className="ms-1">
                              {__("Fallback", "pressedmail")}
                            </Badge>
                          ) : null}
                          {routeLabel(entry.route) ? (
                            <Badge
                              variant="outline"
                              className="ms-1"
                              data-test={`wp-mail-log-route-${entry.id}`}>
                              {routeLabel(entry.route)}
                            </Badge>
                          ) : null}
                        </span>
                      </div>
                    </div>
                    {/* What went wrong, and the service's id, on a line of its
                        own under the entry, so opening it never moves a column. */}
                    {open ? (
                      <div
                        role="row"
                        className="px-3 @4xl:border-b @4xl:px-0 @4xl:pb-2 @4xl:last:border-b-0">
                        <div
                          role="cell"
                          aria-colspan={5}
                          id={detailsId}
                          className="max-w-prose space-y-1 break-words text-xs text-muted-foreground">
                          {/* Spans, not paragraphs: WordPress sizes every admin <p>. */}
                          {entry.error ? <span className="block">{entry.error}</span> : null}
                          {reference ? <ServiceReference reference={reference} /> : null}
                        </div>
                      </div>
                    ) : null}
                  </Fragment>
                );
              })}
            </div>
          </div>
          {waiting ? (
            <p className="text-xs text-muted-foreground">
              {__(
                "Queued means the sending service took the message and hasn't reported back. No report yet means it has been quiet for over a day. Outcome unknown means it couldn't say whether the message went out. Open Details for its reference, if it gave one, then check that service's records.",
                "pressedmail",
              )}
            </p>
          ) : null}
        </div>
      )}

      {lastPage > 1 ? (
        <div className="flex items-center justify-end gap-2">
          <span className="text-xs text-muted-foreground">
            {sprintf(
              /* translators: 1: current page, 2: total pages. */
              __("Page %1$d of %2$d", "pressedmail"),
              page,
              lastPage,
            )}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={page <= 1 || loading}
            onClick={() => void load(page - 1)}>
            {__("Previous", "pressedmail")}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="min-h-11"
            disabled={page >= lastPage || loading}
            onClick={() => void load(page + 1)}>
            {__("Next", "pressedmail")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}
