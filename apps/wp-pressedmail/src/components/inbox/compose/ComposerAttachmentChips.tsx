import { __, sprintf } from "@wordpress/i18n";
import { FileIcon, X } from "lucide-react";

import { Button } from "@kit/ui/plugin";

import type { EmailAttachment } from "@/types";
import { formatFileSize } from "./compose-utils";

interface ComposerAttachmentChipsProps {
  attachments: Array<File | EmailAttachment>;
  onRemove: (index: number) => void;
  disabled?: boolean;
}

/**
 * Compact, removable attachment chips rendered under the subject row.
 *
 * Replaces the old full-width tray that sat below the editor canvas; chips wrap
 * within the subject block so an added attachment is visible immediately
 * without competing with the subject field for width. `form.attachments` /
 * `form.removeAttachment` remain the single source of truth, this is a
 * presentational component.
 */
export function ComposerAttachmentChips({
  attachments,
  onRemove,
  disabled = false,
}: ComposerAttachmentChipsProps) {
  if (attachments.length === 0) {
    return null;
  }

  return (
    <div
      className="mt-1.5 flex w-full flex-wrap items-center gap-1.5"
      data-test="attachment-tray">
      {attachments.map((file, i) => {
        const isFile = file instanceof File;
        const name = isFile ? file.name : (file.filename ?? "attachment");
        const size = isFile ? file.size : (file.size ?? 0);
        const isMedia = !isFile && file.source === "media-library";
        const key = isFile
          ? `file-${name}-${size}-${i}`
          : `att-${file.id || name}-${i}`;
        const removeLabel = sprintf(
          /* translators: %s: attachment filename. */
          __("Remove %s", "pressedmail"),
          name,
        );

        return (
          <span
            key={key}
            data-test="attachment-chip"
            className="inline-flex max-w-full items-center gap-1 rounded bg-muted/60 px-1.5 py-0.5 text-xs">
            <FileIcon
              className="h-3 w-3 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <span className="truncate" title={name}>
              {name}
            </span>
            <span className="shrink-0 text-[11px] text-muted-foreground">
              {formatFileSize(size)}
            </span>
            {isMedia && (
              <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
                {__("Media", "pressedmail")}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled}
              onClick={() => onRemove(i)}
              className="h-11 w-11 shrink-0 text-muted-foreground hover:text-destructive lg:h-6 lg:w-6"
              aria-label={removeLabel}
              title={removeLabel}>
              <X className="h-3 w-3" />
            </Button>
          </span>
        );
      })}
    </div>
  );
}
