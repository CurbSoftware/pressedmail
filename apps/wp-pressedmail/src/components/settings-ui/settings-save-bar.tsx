import type { ReactNode } from "react";

import { __ } from "@wordpress/i18n";
import { Button, cn } from "@kit/ui/plugin";

interface SettingsSaveBarProps {
  dirty: boolean;
  onReset: () => void;
  onSave: () => void;
  saving?: boolean;
  resetLabel?: string;
  saveLabel?: string;
  status?: ReactNode;
  className?: string;
}

export function SettingsSaveBar({
  dirty,
  onReset,
  onSave,
  saving = false,
  resetLabel = __("Reset", "pressedmail"),
  saveLabel = __("Save changes", "pressedmail"),
  status,
  className,
}: SettingsSaveBarProps) {
  if (!dirty) {
    return null;
  }

  return (
    <div
      className={cn(
        "sticky bottom-0 z-20 mt-4 flex flex-wrap items-center justify-end gap-2 rounded-lg border bg-card/95 px-4 py-3 shadow-lg backdrop-blur supports-[backdrop-filter]:bg-card/90",
        className,
      )}
      aria-live="polite"
      data-test="settings-save-bar"
      data-testid="settings-save-bar">
      {status ? (
        <div className="mr-auto text-xs text-muted-foreground">{status}</div>
      ) : null}
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11 @3xl/preferences-nav:min-h-8"
        onClick={onReset}
        disabled={saving}>
        {resetLabel}
      </Button>
      <Button
        type="button"
        size="sm"
        className="min-h-11 @3xl/preferences-nav:min-h-8"
        onClick={onSave}
        disabled={saving}>
        {saving ? __("Saving...", "pressedmail") : saveLabel}
      </Button>
    </div>
  );
}
