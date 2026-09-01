import type { ReactNode } from "react";

import { ChevronDown } from "lucide-react";
import { cn } from "@kit/ui/plugin";

interface SettingsAdvancedSectionProps {
  title: ReactNode;
  description?: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  className?: string;
}

export function SettingsAdvancedSection({
  title,
  description,
  children,
  defaultOpen = false,
  className,
}: SettingsAdvancedSectionProps) {
  return (
    <details
      className={cn(
        "group overflow-hidden rounded-lg border bg-card/95 shadow-sm",
        className,
      )}
      open={defaultOpen}
      data-test="settings-advanced-section"
      data-testid="settings-advanced-section">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-foreground hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
        <span className="min-w-0">
          <span>{title}</span>
          {description ? (
            <span className="mt-0.5 block text-xs font-normal leading-5 text-muted-foreground">
              {description}
            </span>
          ) : null}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-open:rotate-180" />
      </summary>
      <div className="border-t bg-background/40 px-4 py-4">{children}</div>
    </details>
  );
}
