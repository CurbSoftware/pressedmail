import { __ } from "@wordpress/i18n";
import { cn } from "@kit/ui/plugin";

import type { AutosaveStatus } from "@/hooks/useAutosaveSetting";

interface SettingsSaveStateProps {
  status: AutosaveStatus;
  className?: string;
}

function getStatusText(status: AutosaveStatus): string {
  if (status === "saving") return __("Saving...", "pressedmail");
  if (status === "saved") return __("Saved", "pressedmail");
  if (status === "error") return __("Could not save", "pressedmail");
  return "";
}

export function SettingsSaveState({
  status,
  className,
}: SettingsSaveStateProps) {
  return (
    <span
      aria-live="polite"
      data-test="settings-save-state"
      data-testid="settings-save-state"
      className={cn(
        "inline-flex min-h-5 min-w-20 items-center justify-end text-xs text-muted-foreground",
        status === "error" ? "text-destructive" : null,
        className,
      )}>
      {getStatusText(status)}
    </span>
  );
}
