"use client";

/**
 * Manual saved-rule runner.
 *
 * Starts a server-side Email Rules job for selected saved rules. The job uses
 * the mailbox mirror and syncs first when needed, so it is not limited to the
 * messages currently loaded in the inbox UI.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  Button,
  Checkbox,
  Dialog,
} from "@kit/ui/plugin";
import { AlertTriangle, CheckCircle2, Loader2, Play, X } from "lucide-react";

import { useInbox } from "@/context/InboxContext";
import {
  cancelFilterRuleRun,
  fetchFilterRules,
  fetchFilterRuleRun,
  previewFilterRuleRun,
  startFilterRuleRun,
} from "@/services/filter-rules.service";
import type { FilterRule, FilterRuleRunJob } from "@/types/filter-rules";
import { ruleCanRunManually } from "@/types/filter-rules";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";

interface RunRulesNowButtonProps {
  /**
   * Account to run rules for. `null` means "load all saved rules and run over
   * all accounts"; `undefined` falls back to the inbox's selected account.
   */
  accountId?: number | null;
  /**
   * How many rules the caller is showing.
   *
   * The control was only ever disabled while loading or running, so with no
   * rules saved it opened a picker that could say nothing but "No enabled
   * rules available". `undefined` means the caller does not know, and the
   * control stays available.
   */
  ruleCount?: number;
}

const FINAL_RUN_STATUSES = new Set<FilterRuleRunJob["status"]>([
  "completed",
  "failed",
  "cancelled",
]);

// Polling survives a hiccup, but not a run that is gone for good (expired
// session, deleted row). Without this the button spun on "Running..." forever.
const MAX_POLL_FAILURES = 5;

export function RunRulesNowButton({
  accountId,
  ruleCount,
}: RunRulesNowButtonProps = {}) {
  const { selectedAccountId } = useInbox();
  const [open, setOpen] = useState(false);
  const [rules, setRules] = useState<FilterRule[]>([]);
  const [selectedRuleIds, setSelectedRuleIds] = useState<Set<string>>(
    new Set(),
  );
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);
  const [lastMessage, setLastMessage] = useState<string | null>(null);
  const [activeRunId, setActiveRunId] = useState<number | null>(null);
  const [runReport, setRunReport] = useState<FilterRuleRunJob | null>(null);
  const [reportOpen, setReportOpen] = useState(false);
  const [pickerError, setPickerError] = useState<string | null>(null);
  const [stopping, setStopping] = useState(false);
  const pollFailures = useRef(0);

  const effectiveAccountId =
    accountId === null
      ? 0
      : typeof accountId === "number"
        ? accountId
        : typeof selectedAccountId === "number"
          ? selectedAccountId
          : 0;
  const fetchAccountId = accountId === null ? null : effectiveAccountId;

  const applyRunUpdate = useCallback((run: FilterRuleRunJob) => {
    if (FINAL_RUN_STATUSES.has(run.status)) {
      setActiveRunId(null);
      setRunning(false);
      setRunReport(run);
      setLastMessage(null);
    }
  }, []);

  const pollRun = useCallback(
    async (runId: number) => {
      try {
        const run = await fetchFilterRuleRun(runId);
        pollFailures.current = 0;
        applyRunUpdate(run);
      } catch (error) {
        pollFailures.current += 1;
        if (pollFailures.current < MAX_POLL_FAILURES) {
          setLastMessage(
            __("Still waiting on the rule run status", "pressedmail"),
          );
          return;
        }

        pollFailures.current = 0;
        setActiveRunId(null);
        setRunning(false);
        setLastMessage(
          error instanceof Error
            ? error.message
            : __("Lost track of the rule run", "pressedmail"),
        );
      }
    },
    [applyRunUpdate],
  );

  useEffect(() => {
    if (activeRunId === null) return;

    const intervalId = window.setInterval(() => {
      void pollRun(activeRunId);
    }, 2000);

    return () => window.clearInterval(intervalId);
  }, [activeRunId, pollRun]);

  const openPicker = async () => {
    setLoading(true);
    setPickerError(null);
    setOpen(true);
    try {
      const fetched = await fetchFilterRules(fetchAccountId);
      const enabled = fetched.filter(
        (rule) => rule.enabled && ruleCanRunManually(rule),
      );
      setRules(enabled);
      // Deliberately empty. Opened from Settings this picker has no account to
      // scope to, so a run covers every connected mailbox and every enabled
      // rule, including the ones a sweep generated. Preselecting them all made
      // "Run rules now" one click away from a mass mutation nobody asked for.
      setSelectedRuleIds(new Set());
    } catch (error) {
      // Without this the dialog claimed "No enabled rules available", which is
      // a different problem with a different fix.
      setRules([]);
      setSelectedRuleIds(new Set());
      setPickerError(
        error instanceof Error
          ? error.message
          : __("Could not load your rules", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  };

  const stopRun = async () => {
    if (activeRunId === null) return;

    setStopping(true);
    try {
      const run = await cancelFilterRuleRun(activeRunId);
      applyRunUpdate(run);
      if (!FINAL_RUN_STATUSES.has(run.status)) {
        setLastMessage(__("Stopping the rule run", "pressedmail"));
      }
    } catch (error) {
      setLastMessage(
        error instanceof Error
          ? error.message
          : __("Could not stop the rule run", "pressedmail"),
      );
    } finally {
      setStopping(false);
    }
  };

  const toggleRule = (ruleId: string) => {
    setSelectedRuleIds((current) => {
      const next = new Set(current);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  const runSelected = async () => {
    const ruleIds = rules
      .filter((rule) => selectedRuleIds.has(rule.id))
      .map((rule) => rule.id);
    if (ruleIds.length === 0) {
      setLastMessage(__("Select at least one rule", "pressedmail"));
      return;
    }

    setRunning(true);
    try {
      setRunReport(null);
      const request = {
        ruleIds,
        scope: {
          mode: "view" as const,
          accountId: effectiveAccountId,
          folder: "INBOX",
          syncFirst: true,
        },
      };
      const preview = await previewFilterRuleRun(request);
      if (preview.supportedRuleIds.length === 0) {
        setLastMessage(
          __("No selected rules can run over the inbox mirror", "pressedmail"),
        );
        setRunning(false);
        return;
      }
      // A partial skip used to be invisible: pick three rules, one of them
      // matching on body, and the run quietly applied two. The mirror holds a
      // truncated snippet, not the body, so that rule can only run in the
      // browser through Organize. Say which ones, and say where they do run.
      const skipped = preview.unsupportedRules ?? [];
      const startedMessage =
        skipped.length > 0
          ? sprintf(
              /* translators: %s: comma-separated rule names. */
              __(
                "Rule run started. Skipped here, use Organize instead: %s",
                "pressedmail",
              ),
              skipped.map((rule) => rule.name).join(", "),
            )
          : __("Rule run started", "pressedmail");

      const run = await startFilterRuleRun(request);
      setOpen(false);
      if (FINAL_RUN_STATUSES.has(run.status)) {
        applyRunUpdate(run);
        if (skipped.length > 0) {
          setLastMessage(startedMessage);
        }
      } else {
        setActiveRunId(run.id);
        setLastMessage(startedMessage);
        void pollRun(run.id);
      }
    } catch (error) {
      setRunning(false);
      setLastMessage(
        error instanceof Error
          ? error.message
          : __("Could not start the rule run", "pressedmail"),
      );
    }
  };

  const reportStatusLabel =
    runReport?.status === "completed"
      ? __("Completed", "pressedmail")
      : runReport?.status === "failed"
        ? __("Failed", "pressedmail")
        : runReport?.status === "cancelled"
          ? __("Cancelled", "pressedmail")
          : "";
  const reportHasFailures = (runReport?.failedCount ?? 0) > 0;
  const reportAccountId = getRunScopeAccountId(runReport);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => {
          void openPicker();
        }}
        disabled={loading || running || ruleCount === 0}
        title={
          ruleCount === 0
            ? __("Create a rule before running one.", "pressedmail")
            : undefined
        }
        data-test="run-rules-now"
        data-testid="run-rules-now">
        {loading || running ? (
          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
        ) : (
          <Play className="h-4 w-4 mr-2" />
        )}
        {running
          ? __("Running...", "pressedmail")
          : __("Run rules now", "pressedmail")}
      </Button>
      {activeRunId !== null && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          disabled={stopping}
          onClick={() => {
            void stopRun();
          }}
          data-test="run-rules-stop"
          data-testid="run-rules-stop">
          <X className="h-4 w-4 mr-2" />
          {__("Stop", "pressedmail")}
        </Button>
      )}
      {lastMessage !== null && (
        <span
          className="text-sm text-muted-foreground"
          data-test="run-rules-result"
          data-testid="run-rules-result">
          {lastMessage}
        </span>
      )}
      {runReport !== null && (
        <div className="flex items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-test="run-rules-report-button"
            data-testid="run-rules-report-button"
            onClick={() => setReportOpen(true)}
            className="gap-2">
            {reportHasFailures || runReport.status === "failed" ? (
              <AlertTriangle className="h-4 w-4 text-warning" />
            ) : (
              <CheckCircle2 className="h-4 w-4 text-success" />
            )}
            <span>{reportStatusLabel}</span>
            <span className="text-muted-foreground">
              {sprintf(
                /* translators: %d: number of messages changed by the run. */
                _n(
                  "%d changed",
                  "%d changed",
                  runReport.changedCount ?? 0,
                  "pressedmail",
                ),
                runReport.changedCount ?? 0,
              )}
            </span>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            data-test="run-rules-report-dismiss"
            data-testid="run-rules-report-dismiss"
            aria-label={__("Dismiss rule run report", "pressedmail")}
            onClick={() => {
              setRunReport(null);
              setReportOpen(false);
            }}
            className="h-8 w-8 p-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}
      <Dialog open={open} onOpenChange={setOpen}>
        <PressedDialogContent size="compactForm">
          <PressedDialogHeader
            title={__("Run saved rules", "pressedmail")}
            icon={Play}
            description={__(
              "Choose saved rules to run across the selected inbox scope.",
              "pressedmail",
            )}
          />
          <PressedOverlayBody
            data-test="run-rules-picker-body"
            data-testid="run-rules-picker-body"
            className="max-h-72 space-y-2 overflow-y-auto">
            {loading ? (
              <p className="text-sm text-muted-foreground">
                {__("Loading rules...", "pressedmail")}
              </p>
            ) : pickerError !== null ? (
              <p
                className="text-sm text-destructive"
                data-test="run-rules-picker-error"
                data-testid="run-rules-picker-error">
                {pickerError}
              </p>
            ) : rules.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {__("No enabled rules available", "pressedmail")}
              </p>
            ) : (
              rules.map((rule) => (
                <label
                  key={rule.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted/50">
                  <Checkbox
                    checked={selectedRuleIds.has(rule.id)}
                    onCheckedChange={() => toggleRule(rule.id)}
                    aria-label={rule.name}
                  />
                  <span>{rule.name}</span>
                </label>
              ))
            )}
          </PressedOverlayBody>
          <PressedOverlayFooter
            data-test="run-rules-picker-footer"
            data-testid="run-rules-picker-footer">
            <Button
              type="button"
              variant="outline"
              disabled={running}
              onClick={() => setOpen(false)}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="button"
              disabled={running || loading || selectedRuleIds.size === 0}
              onClick={() => {
                void runSelected();
              }}>
              {running && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {__("Run selected rules", "pressedmail")}
            </Button>
          </PressedOverlayFooter>
        </PressedDialogContent>
      </Dialog>
      <AlertDialog open={reportOpen} onOpenChange={setReportOpen}>
        <AlertDialogContent
          role="dialog"
          data-test="run-rules-report-modal"
          data-testid="run-rules-report-modal">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow>
                <CheckCircle2 />
                <span>{__("Rule run results", "pressedmail")}</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {__(
                "Aggregate results for the last manual rule run.",
                "pressedmail",
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {runReport && (
            <div className="space-y-4 text-sm">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                <ResultMetric
                  label={__("Candidates", "pressedmail")}
                  value={runReport.candidateCount ?? 0}
                />
                <ResultMetric
                  label={__("Processed", "pressedmail")}
                  value={runReport.processedCount ?? 0}
                />
                <ResultMetric
                  label={__("Matched", "pressedmail")}
                  value={runReport.matchedCount ?? 0}
                />
                <ResultMetric
                  label={__("Changed", "pressedmail")}
                  value={runReport.changedCount ?? 0}
                />
                <ResultMetric
                  label={__("Failed", "pressedmail")}
                  value={sprintf(
                    /* translators: %d: number of messages that failed. */
                    _n(
                      "%d failed",
                      "%d failed",
                      runReport.failedCount ?? 0,
                      "pressedmail",
                    ),
                    runReport.failedCount ?? 0,
                  )}
                />
                <ResultMetric
                  label={__("Skipped actions", "pressedmail")}
                  value={runReport.skippedCount ?? 0}
                />
                <ResultMetric
                  label={__("Status", "pressedmail")}
                  value={reportStatusLabel}
                />
              </div>
              <div className="rounded-md border border-border p-3">
                <div className="font-medium">
                  {__("Account scope", "pressedmail")}
                </div>
                <div className="text-muted-foreground">
                  {reportAccountId === 0
                    ? __("All accounts", "pressedmail")
                    : sprintf(
                        /* translators: %d: internal account id. */
                        __("Account %d", "pressedmail"),
                        reportAccountId,
                      )}
                </div>
              </div>
              {runReport.unsupportedRules &&
                runReport.unsupportedRules.length > 0 && (
                  <div className="rounded-md border border-warning/40 bg-warning/10 p-3">
                    <div className="font-medium">
                      {__("Unsupported rules", "pressedmail")}
                    </div>
                    <div className="text-muted-foreground">
                      {runReport.unsupportedRules.length}
                    </div>
                  </div>
                )}
              {runReport.errorMessage && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-destructive">
                  {runReport.errorMessage}
                </div>
              )}
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>{__("Close", "pressedmail")}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function getRunScopeAccountId(run: FilterRuleRunJob | null): number {
  if (!run?.scope) return 0;
  const scope = run.scope as FilterRuleRunJob["scope"] & {
    account_id?: number;
  };
  return Number(scope.accountId ?? scope.account_id ?? 0);
}

function ResultMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-md border border-border p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className="mt-1 font-medium">{value}</div>
    </div>
  );
}

export default RunRulesNowButton;
