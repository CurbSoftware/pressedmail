/**
 * The composer's Media Library: core's `wp.media` frame, for inserting images
 * inline and attaching files.
 */
import { __ } from "@wordpress/i18n";
import { currentWpUserId, openMediaFrame } from "@/lib/wp-media-frame";

export const MEDIA_PICKER_CANCELLED = "Media selection cancelled.";

/** One Media Library item the composer inserts (image) or attaches (any type). */
export interface MediaPickerSelection {
  id: number;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
}

export interface OpenMediaPickerOptions {
  /** `image` lists images only; `all` lists every type. */
  mode: "image" | "all";
  multiple?: boolean;
}

/**
 * Open the frame and resolve with the chosen media. Rejects with
 * {@link MEDIA_PICKER_CANCELLED} when nothing was chosen; callers swallow that.
 */
async function openMediaPicker({
  mode,
  multiple,
}: OpenMediaPickerOptions): Promise<MediaPickerSelection[]> {
  const image = mode === "image";
  const chosen = await openMediaFrame({
    title: image
      ? __("Insert image", "pressedmail")
      : __("Attach files", "pressedmail"),
    button: image ? __("Insert", "pressedmail") : __("Attach", "pressedmail"),
    type: image ? "image" : undefined,
    multiple,
    // Only the sender's own uploads: sending refuses an attachment anyone else
    // uploaded (EmailSchedulerService checks post_author), so offering one would
    // only fail later.
    author: currentWpUserId(),
  });
  if (chosen.length === 0) throw new Error(MEDIA_PICKER_CANCELLED);

  return chosen.map((attachment) => ({
    id: attachment.id,
    url: attachment.url ?? "",
    filename: attachment.filename ?? "",
    mimeType: attachment.mime ?? "",
    size: attachment.filesizeInBytes ?? 0,
  }));
}

const PICKER = { openMediaPicker };

export function useMediaLibraryPicker() {
  return PICKER;
}
