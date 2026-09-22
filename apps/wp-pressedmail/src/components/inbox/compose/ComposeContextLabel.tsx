import { __ } from "@wordpress/i18n";

import type { ComposeMode } from "@/hooks/compose/v2/useSignatureBinding";

/**
 * The label cell of the From row: the mode word (New, Reply, Forward) stacked
 * over "From". It replaces both the old header's mode label and the From
 * field's own label, so the composer opens with one row of context instead of
 * two. The mode word is the primary context; "From" reads as a smaller,
 * secondary label under it. `data-test="compose-mode-label"` stays on the
 * mode word for the QA states that watch it.
 */
export function ComposeContextLabel({ mode }: { mode: ComposeMode }) {
  const word =
    mode === "forward"
      ? __("Forward", "pressedmail")
      : mode === "new"
        ? __("New", "pressedmail")
        : __("Reply", "pressedmail");

  return (
    <div className="flex flex-col leading-tight">
      <span
        data-test="compose-mode-label"
        className="text-xs font-medium text-muted-foreground">
        {word}
      </span>
      <span className="text-2xs font-normal text-muted-foreground/70">
        {__("From", "pressedmail")}
      </span>
    </div>
  );
}
