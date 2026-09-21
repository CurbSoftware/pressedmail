"use client";

import { Calendar } from "lucide-react";
import { __ } from "@wordpress/i18n";

import { AddToCalendarBannerButton } from "@/components/calendar/AddToCalendarButton";
import { CalendarBasicGate } from "@/components/features/BuildTimeFeatureGates";
import type { ITipEvent } from "@/types/itip";

interface ITipBannerProps {
  event: ITipEvent;
  onAddToCalendar?: () => void;
}

function formatRange(start: string, end: string): string {
  // Best-effort human label. Parser already normalises to ISO-ish strings.
  const startLabel = start.replace("T", " ").replace("Z", "");
  if (!end || end === start) {
    return startLabel;
  }
  const endLabel = end.replace("T", " ").replace("Z", "");
  return `${startLabel} → ${endLabel}`;
}

function ITipBannerInner({ event, onAddToCalendar }: ITipBannerProps) {
  if (event.method === "PUBLISH") {
    return null;
  }

  const isCancel = event.method === "CANCEL";
  const isReply = event.method === "REPLY";

  return (
    <div
      className="mb-3 rounded border bg-muted/30 p-3"
      data-test="itip-banner"
      data-method={event.method}>
      <div className="flex items-start gap-3">
        <Calendar className="mt-1 h-4 w-4 flex-shrink-0 text-primary" />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            {isCancel && (
              <span
                className="rounded bg-destructive/10 px-2 py-0.5 text-xs text-destructive"
                data-test="itip-banner-method-cancel">
                {__("Cancelled", "pressedmail")}
              </span>
            )}
            {isReply && (
              <span
                className="rounded bg-success/10 px-2 py-0.5 text-xs text-success"
                data-test="itip-banner-method-reply">
                {__("Reply", "pressedmail")}
              </span>
            )}
            <span className="truncate" data-test="itip-banner-summary">
              {event.summary || __("Calendar event", "pressedmail")}
            </span>
          </div>

          <div
            className="mt-1 text-xs text-muted-foreground"
            data-test="itip-banner-when">
            {formatRange(event.start, event.end)}
          </div>

          {event.location && (
            <div
              className="mt-1 text-xs text-muted-foreground"
              data-test="itip-banner-location">
              {event.location}
            </div>
          )}

          {onAddToCalendar && !isCancel && !isReply ? (
            <AddToCalendarBannerButton onClick={onAddToCalendar} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export const ITipBanner: React.FC<ITipBannerProps> = (props) => (
  <CalendarBasicGate>
    <ITipBannerInner {...props} />
  </CalendarBasicGate>
);

export default ITipBanner;
