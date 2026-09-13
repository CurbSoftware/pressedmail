import { ChevronRight, type LucideIcon } from "lucide-react";

export function SettingsListRow({
  label,
  description,
  icon: Icon,
  onSelect,
}: {
  label: string;
  description?: string;
  icon: LucideIcon;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 px-3 py-3 text-left text-foreground active:bg-muted">
      <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
        <Icon className="h-5 w-5" aria-hidden="true" />
      </span>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-sm font-medium">{label}</span>
        {description ? (
          <span className="text-xs text-muted-foreground">{description}</span>
        ) : null}
      </span>
      <ChevronRight
        className="h-4 w-4 shrink-0 text-muted-foreground"
        aria-hidden="true"
      />
    </button>
  );
}
