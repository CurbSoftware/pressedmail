/**
 * ComposerFooter: the composer's status line. "Draft saved" and the pending
 * image upload used to sit in the header beside the mode label; the header is
 * now the From row, so they read here, at the footer's left.
 *
 * @since 2.0.0
 */

import { __ } from "@wordpress/i18n";

import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";
import { cn } from "@/lib/utils";

interface ComposerFooterProps {
  form: Pick<UseComposeFormReturn, "isDraftSaved" | "pendingInlineImageUploads">;
}

export function ComposerFooter({ form }: ComposerFooterProps) {
  const uploading = (form.pendingInlineImageUploads ?? 0) > 0;
  const hasStatus = Boolean(form.isDraftSaved) || uploading;

  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-x-3 text-xs font-medium text-muted-foreground",
        // Padding only when there is something to read, so an idle footer
        // takes no height; the live region below is always mounted.
        hasStatus && "border-t border-border px-4 py-1.5",
      )}
      data-test="composer-status-group">
      {form.isDraftSaved && (
        <span className="truncate">{__("Draft saved", "pressedmail")}</span>
      )}
      {uploading && (
        <span aria-hidden="true" className="truncate">
          {__("Uploading image...", "pressedmail")}
        </span>
      )}
      {/* Always mounted: a live region that appears with its text already
          inside is often not announced. */}
      <span aria-live="polite" className="sr-only">
        {uploading ? __("Uploading image...", "pressedmail") : ""}
      </span>
    </div>
  );
}
