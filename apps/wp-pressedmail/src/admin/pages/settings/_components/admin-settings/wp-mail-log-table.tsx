import { useCallback, useEffect, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  RotateCw,
  Trash2,
} from "lucide-react";

import { Badge, Button } from "@kit/ui/plugin";

import { SettingsEmptyState } from "@/components/settings-ui";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import {
  clearWpMailLog,
  fetchWpMailLog,
  type WpMailLogEntry,
} from "@/lib/wp-mail-api";

const PER_PAGE = 25;

export interface WpMailLogTableProps {
  /** Retention in days. 0 means logging is off. */
  retentionDays: number;
}

/**
 * Paged view of the delivery log.
 *
 * Deliberately shows only metadata, because that is all the server stores: no
 * message body, headers, or attachments are ever recorded.
 */
export function WpMailLogTable({ retentionDays }: WpMailLogTableProps) {
  const [entries, setEntries] = useState<WpMailLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState("");
  const [expanded, setExpanded] = useState<number | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async (nextPage: number) => {
    setLoading(true);
    setError("");
    try {
      const result = await fetchWpMailLog(nextPage, PER_PAGE);
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
  }, []);

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
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="min-h-11"
            data-test="wp-mail-log-refresh"
            onClick={() => void load(page)}
            disabled={loading || clearing}>
            <RotateCw className="mr-2 h-4 w-4" />
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
            disabled={loading || clearing || total === 0}>
            {clearing ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {__("Clear log", "pressedmail")}
          </Button>
        </div>
      </div>

      {error ? (
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

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      ) : entries.length === 0 ? (
        <SettingsEmptyState
          title={
            retentionDays === 0
              ? __("Delivery logging is off", "pressedmail")
              : __("Nothing logged yet", "pressedmail")
          }
          description={
            retentionDays === 0
              ? __(
                  "Choose a retention period above to start recording genuine WordPress mail.",
                  "pressedmail",
                )
              : __(
                  "Genuine WordPress mail appears here after WordPress sends it. PressedMail new-mail notification copies are excluded.",
                  "pressedmail",
                )
          }
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[36rem] text-left text-xs">
            <thead className="text-muted-foreground">
              <tr className="border-b">
                <th className="py-2 pr-3 font-medium">
                  {__("When", "pressedmail")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {__("To", "pressedmail")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {__("Subject", "pressedmail")}
                </th>
                <th className="py-2 pr-3 font-medium">
                  {__("Server", "pressedmail")}
                </th>
                <th className="py-2 font-medium">
                  {__("Result", "pressedmail")}
                </th>
              </tr>
            </thead>
            <tbody>
              {entries.map((entry) => (
                <tr
                  key={entry.id}
                  className="border-b align-top last:border-b-0"
                  data-test="wp-mail-log-row"
                  data-testid="wp-mail-log-row">
                  <td className="py-2 pr-3 whitespace-nowrap text-muted-foreground">
                    {entry.createdAt}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="break-all">{entry.toSummary}</span>
                    {entry.recipientCount > 1 ? (
                      <span className="ml-1 text-muted-foreground">
                        {sprintf(
                          /* translators: %d: number of additional recipients. */
                          __("+%d more", "pressedmail"),
                          entry.recipientCount - 1,
                        )}
                      </span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3">
                    <span className="break-words">{entry.subject}</span>
                  </td>
                  <td className="py-2 pr-3">
                    <span className="break-words">
                      {entry.connectionLabel || "-"}
                    </span>
                    {entry.attempt > 1 ? (
                      <Badge variant="outline" className="ml-1">
                        {__("Fallback", "pressedmail")}
                      </Badge>
                    ) : null}
                  </td>
                  <td className="py-2">
                    {entry.status === "sent" ? (
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        {__("Sent", "pressedmail")}
                      </span>
                    ) : (
                      <button
                        type="button"
                        className="flex min-h-11 items-center gap-1 text-left text-destructive underline-offset-2 hover:underline"
                        aria-expanded={expanded === entry.id}
                        aria-controls={
                          entry.error
                            ? `wp-mail-log-error-${entry.id}`
                            : undefined
                        }
                        onClick={() =>
                          setExpanded(expanded === entry.id ? null : entry.id)
                        }
                        data-test="wp-mail-log-error-toggle"
                        data-testid="wp-mail-log-error-toggle">
                        <AlertCircle className="h-3.5 w-3.5" />
                        {__("Failed", "pressedmail")}
                      </button>
                    )}
                    {expanded === entry.id && entry.error ? (
                      <p
                        id={`wp-mail-log-error-${entry.id}`}
                        className="mt-1 max-w-md break-words text-muted-foreground">
                        {entry.error}
                      </p>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
