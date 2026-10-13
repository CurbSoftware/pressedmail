import * as React from "react";

import { Button } from "@kit/ui/plugin";

/** An icon button for the dialog's toolbar. The label is its name for assistive technology and its tooltip. */
export function ToolbarButton({
  label,
  ...props
}: React.ComponentProps<typeof Button> & { label: string }) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={label}
      title={label}
      className="pointer-coarse:size-11"
      {...props}
    />
  );
}
