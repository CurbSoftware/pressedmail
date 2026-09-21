import { __ } from "@wordpress/i18n";

import { cn } from "@/lib/utils";
import type { EmailImportanceSource } from "@/types";
import {
  EmailImportantIcon,
  EmailImportantOutlineIcon,
} from "@/components/icons/MailActionIcons";

export interface EmailImportantMarkerProps {
  important?: boolean;
  /** Who set the flag, so the marker can say why it is filled. */
  source?: EmailImportanceSource | null;
  large?: boolean;
  className?: string;
  testId?: string;
  ariaHidden?: boolean;
}

/**
 * The words the marker and its toggle share. A filled chevron can mean three
 * different things, and the sender's own high-priority header is not the same
 * statement as the user's own decision.
 */
export function importantMarkerLabel(
  important: boolean,
  source?: EmailImportanceSource | null,
): string {
  if (!important) return __("Not important", "pressedmail");

  switch (source) {
    case "sender":
      return __("The sender marked this as high priority", "pressedmail");
    case "provider":
      return __("Your email provider marked this as important", "pressedmail");
    case "override":
      return __("You marked this as important", "pressedmail");
    default:
      return __("Important", "pressedmail");
  }
}

export function EmailImportantMarker({
  important = false,
  source,
  large = false,
  className,
  testId,
  ariaHidden = false,
}: EmailImportantMarkerProps) {
  const Icon = important ? EmailImportantIcon : EmailImportantOutlineIcon;
  const label = importantMarkerLabel(important, source);

  return (
    <Icon
      className={cn(
        "shrink-0",
        // Full muted token, not an opacity of it: /45 measured 2.19:1 on the
        // light theme, well under the 3:1 minimum for a meaningful glyph.
        important
          ? "text-[var(--theme-important,var(--primary))]"
          : "text-muted-foreground",
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
