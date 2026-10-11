/**
 * ComposerFooter: the composer's status line. "Draft saved" and the pending
 * image upload used to sit in the header beside the mode label; the header is
 * now the From row, so they read here, at the footer's left.
 *
 * The draft has a standing line of its own: Saving, Saved with the time, or
 * Could not save with a Retry. It stays up between saves, so a person who has
 * stopped typing can still see whether the last words reached the server.
 *
 * @since 2.0.0
 */

import { __, sprintf } from "@wordpress/i18n";

import { formatCalendarTime } from "@/components/calendar/calendar-intl";
import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";
import { cn } from "@/lib/utils";

interface ComposerFooterProps {
  form: Pick<UseComposeFormReturn, "isDraftSaved" | "pendingInlineImageUploads"> &
    Partial<Pick<UseComposeFormReturn, "draftSaveStatus" | "handleSaveDraft">>;
}

export function ComposerFooter({ form }: ComposerFooterProps) {
  const uploading = (form.pendingInlineImageUploads ?? 0) > 0;
  const status = form.draftSaveStatus ?? { state: "idle" as const };
  const savedText =
    status.state === "saved"
      ? sprintf(
          /* translators: %s: the time the draft was last saved, such as 10:42. */
          __("Saved at %s", "pressedmail"),
          formatCalendarTime(new Date(status.at)),
        )
      : "";
  const hasStatus =
    Boolean(form.isDraftSaved) || uploading || status.state !== "idle";
  // What a screen reader hears. "Saving" is left out: it comes every few
  // seconds while someone types, and the result follows it anyway.
  const announcement = uploading
    ? __("Uploading image...", "pressedmail")
    : status.state === "error"
      ? __("Could not save draft.", "pressedmail")
      : savedText;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-x-3 text-xs font-medium text-muted-foreground",
        // Padding only when there is something to read, so an idle footer
        // takes no height; the live region below is always mounted.
        hasStatus && "border-t border-border px-4 py-1.5",
      )}
      data-test="composer-status-group">
      {/* A caller with no standing status keeps the two-second line. */}
      {form.isDraftSaved && status.state === "idle" && (
        <span className="truncate">{__("Draft saved", "pressedmail")}</span>
      )}
      {status.state === "saving" && (
        <span aria-hidden="true" className="truncate">
          {__("Saving draft...", "pressedmail")}
        </span>
      )}
      {status.state === "saved" && (
        <span aria-hidden="true" className="truncate">
          {savedText}
        </span>
      )}
      {status.state === "error" && (
        <>
          <span aria-hidden="true" className="truncate text-destructive">
            {__("Could not save draft.", "pressedmail")}
          </span>
          {form.handleSaveDraft ? (
            <button
              type="button"
              className="shrink-0 underline underline-offset-2 hover:text-foreground"
              onClick={() => void form.handleSaveDraft?.()}>
              {__("Retry", "pressedmail")}
            </button>
          ) : null}
        </>
      )}
      {uploading && (
        <span aria-hidden="true" className="truncate">
          {__("Uploading image...", "pressedmail")}
        </span>
      )}
      {/* Always mounted: a live region that appears with its text already
          inside is often not announced. */}
      <span aria-live="polite" className="sr-only">
        {announcement}
      </span>
    </div>
  );
}
