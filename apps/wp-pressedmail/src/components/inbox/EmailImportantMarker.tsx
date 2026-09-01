import { __ } from "@wordpress/i18n";

import { cn } from "@/lib/utils";
import {
  EmailImportantIcon,
  EmailImportantOutlineIcon,
} from "@/components/icons/MailActionIcons";

export interface EmailImportantMarkerProps {
  important?: boolean;
  large?: boolean;
  className?: string;
  testId?: string;
  ariaHidden?: boolean;
}

export function EmailImportantMarker({
  important = false,
  large = false,
  className,
  testId,
  ariaHidden = false,
}: EmailImportantMarkerProps) {
  const Icon = important ? EmailImportantIcon : EmailImportantOutlineIcon;
  const label = important
    ? __("Important", "pressedmail")
    : __("Not important", "pressedmail");

  return (
    <Icon
      className={cn(
        "shrink-0",
        important ? "text-primary" : "text-muted-foreground/45",
        large ? "h-4 w-4" : "h-3.5 w-3.5",
        className,
      )}
      aria-hidden={ariaHidden ? true : undefined}
      aria-label={ariaHidden ? undefined : label}
      data-important={important ? "true" : undefined}
      data-test={testId}
      data-testid={testId}
    />
  );
}
