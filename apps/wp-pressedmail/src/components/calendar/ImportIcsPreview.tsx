import { parseCalendarDate, getAllDayDisplayEnd } from "./calendar-timezone";
import { calendarFormatter } from "./calendar-intl";
import { useEffect, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { CalendarPlus, MapPin, Users } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@kit/ui/plugin";

import { appMessage } from "@/context/toast";
import {
  importIcsFile,
  importMessageIcs,
  previewMessageIcs,
  type IcsImportResult,
  type IcsPreviewEvent,
  type MessageAttachmentRef,
} from "@/services/ics-import.service";

export type IcsImportSource =
  | { kind: "file"; file: File; localCalendarId?: number }
  | {
      kind: "attachment";
      attachment: MessageAttachmentRef;
      localCalendarId?: number;
    };

export interface ImportIcsPreviewProps {
  source: IcsImportSource | null;
  onClose: () => void;
  onImported?: (result: IcsImportResult) => void | Promise<void>;
}

function formatRange(event: IcsPreviewEvent): string {
  const start = parseCalendarDate(event.start_datetime, event.all_day);
  const rawEnd = parseCalendarDate(event.end_datetime, event.all_day);
  const end = event.all_day ? getAllDayDisplayEnd(start, rawEnd) : rawEnd;
  if (Number.isNaN(start.getTime())) return event.start_datetime;

  const formatter = calendarFormatter({
    dateStyle: "medium",
    ...(event.all_day ? {} : { timeStyle: "short" }),
  });
  if (
    Number.isNaN(end.getTime()) ||
    start.getTime() === end.getTime() ||
    (event.all_day && start.toDateString() === end.toDateString())
  ) {
    return formatter.format(start);
  }
  return formatter.formatRange(start, end);
}

async function requestPreview(
  source: IcsImportSource,
): Promise<IcsImportResult> {
  const calendarId = source.localCalendarId ?? 0;
  return source.kind === "file"
    ? importIcsFile(source.file, calendarId, true)
    : previewMessageIcs(source.attachment, calendarId);
}

async function requestImport(
  source: IcsImportSource,
): Promise<IcsImportResult> {
  const calendarId = source.localCalendarId ?? 0;
  return source.kind === "file"
    ? importIcsFile(source.file, calendarId, false)
    : importMessageIcs(source.attachment, calendarId);
}

export function ImportIcsPreview({
  source,
  onClose,
  onImported,
}: ImportIcsPreviewProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<IcsImportResult | null>(null);

  useEffect(() => {
    if (!source) {
      setPreview(null);
      setError(null);
      return;
    }

    let active = true;
    setLoading(true);
    setPreview(null);
    setError(null);

    requestPreview(source)
      .then((result) => {
        if (!active) return;
        if (!result.success || !result.dryRun) {
          setError(
            result.error ??
              __(
                "This calendar invitation could not be previewed.",
                "pressedmail",
              ),
          );
          return;
        }
        setPreview(result);
        if (result.method.toUpperCase() === "CANCEL") {
          setError(
            __(
              "A cancelled invitation cannot be added to your calendar.",
              "pressedmail",
            ),
          );
        }
      })
      .catch((failure: unknown) => {
        if (!active) return;
        setError(
          failure instanceof Error
            ? failure.message
            : __(
                "This calendar invitation could not be previewed.",
                "pressedmail",
              ),
        );
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [source]);

  const events = preview?.events ?? [];
  const importableEvents = events.filter((event) => !event.duplicate);
  const canImport =
    preview?.dryRun === true &&
    preview.method.toUpperCase() !== "CANCEL" &&
    importableEvents.length > 0 &&
    !error;

  const handleAdd = async () => {
    if (!source || !canImport) return;
    setSaving(true);
    try {
      const result = await requestImport(source);
      if (!result.success || result.dryRun) {
        appMessage(
          result.error ?? __("The calendar import failed.", "pressedmail"),
          "error",
        );
        return;
      }

      await onImported?.(result);
      appMessage(
        result.imported > 0
          ? sprintf(
              /* translators: %d: number of imported calendar events. */
              __("Added %d event(s) to your calendar.", "pressedmail"),
              result.imported,
            )
          : __("Every event is already on your calendar.", "pressedmail"),
        result.imported > 0 ? "success" : "info",
      );
      onClose();
    } catch (failure) {
      appMessage(
        failure instanceof Error
          ? failure.message
          : __("The calendar import failed.", "pressedmail"),
        "error",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={source !== null}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}>
      <DialogContent
        data-test="ics-preview-dialog"
        data-testid="ics-preview-dialog">
        <DialogHeader>
          <DialogTitle>{__("Add to calendar", "pressedmail")}</DialogTitle>
          <DialogDescription>
            {__(
              "Review what will be saved before adding it to your calendar.",
              "pressedmail",
            )}
          </DialogDescription>
        </DialogHeader>

        {loading ? (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-muted-foreground text-sm">
            {__("Reading invitation…", "pressedmail")}
          </p>
        ) : error ? (
          <p
            role="alert"
            className="text-destructive text-sm"
            data-test="ics-preview-error"
            data-testid="ics-preview-error">
            {error}
          </p>
        ) : events.length === 0 ? (
          <p
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="text-muted-foreground text-sm">
            {__("No importable events were found.", "pressedmail")}
          </p>
        ) : (
          <>
            <p
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="sr-only">
              {sprintf(
                /* translators: %d: number of calendar events in the preview. */
                __("Preview ready: %d event(s).", "pressedmail"),
                events.length,
              )}
            </p>
            <ul className="divide-border m-0 max-h-72 list-none divide-y overflow-y-auto p-0">
              {events.map((event, index) => (
                <li key={`${event.uid}:${index}`} className="grid gap-1 py-3">
                  <span className="text-sm font-semibold">{event.title}</span>
                  <span className="text-muted-foreground text-sm">
                    {formatRange(event)}
                  </span>
                  {event.location ? (
                    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <MapPin className="h-3.5 w-3.5" />
                      {event.location}
                    </span>
                  ) : null}
                  {event.attendees.length > 0 ? (
                    <span className="text-muted-foreground flex items-center gap-1.5 text-sm">
                      <Users className="h-3.5 w-3.5" />
                      {sprintf(
                        /* translators: %d: number of event attendees. */
                        __("%d guest(s)", "pressedmail"),
                        event.attendees.length,
                      )}
                    </span>
                  ) : null}
                  {event.duplicate ? (
                    <span className="text-muted-foreground text-xs">
                      {__(
                        "Already on your calendar. It will be skipped.",
                        "pressedmail",
                      )}
                    </span>
                  ) : null}
                </li>
              ))}
            </ul>
          </>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            {__("Cancel", "pressedmail")}
          </Button>
          {canImport ? (
            <Button onClick={handleAdd} disabled={saving}>
              <CalendarPlus className="mr-2 h-4 w-4" />
              {__("Add to calendar", "pressedmail")}
            </Button>
          ) : null}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ImportIcsPreview;
