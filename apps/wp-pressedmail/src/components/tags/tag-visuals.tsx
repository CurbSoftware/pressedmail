import * as React from "react";

import {
  fallbackFlagColor,
  withAlpha,
} from "@/components/contacts/flag-colors";
import { cn } from "@/lib/utils";

export const EMAIL_TAG_ICON_PATH =
  "M5.5 7A1.5 1.5 0 0 1 4 5.5A1.5 1.5 0 0 1 5.5 4A1.5 1.5 0 0 1 7 5.5A1.5 1.5 0 0 1 5.5 7m15.91 4.58l-9-9C12.05 2.22 11.55 2 11 2H4c-1.11 0-2 .89-2 2v7c0 .55.22 1.05.59 1.41l8.99 9c.37.36.87.59 1.42.59s1.05-.23 1.41-.59l7-7c.37-.36.59-.86.59-1.41c0-.56-.23-1.06-.59-1.42";

export const emailTagSoftBadgeClassName =
  "inline-flex max-w-full items-center gap-1 rounded-md border px-1.5 py-0.5 text-xs font-medium leading-none text-foreground";

interface TagVisualModel {
  id: string | number;
  name: string;
  color?: string | null;
}

export function resolveEmailTagColor(tag: TagVisualModel): string {
  const raw = (tag.color ?? "").trim();
  if (raw) return raw;

  return fallbackFlagColor(tag.name);
}

export function getEmailTagBadgeStyle(
  tag: TagVisualModel,
): React.CSSProperties {
  const accent = resolveEmailTagColor(tag);

  if (accent.includes("var(")) {
    return {
      "--pm-email-tag-accent": accent,
      "--pm-email-tag-bg": `color-mix(in srgb, ${accent} 14%, transparent)`,
      "--pm-email-tag-border": `color-mix(in srgb, ${accent} 36%, transparent)`,
      backgroundColor: "var(--pm-email-tag-bg)",
      borderColor: "var(--pm-email-tag-border)",
    } as React.CSSProperties;
  }

  return {
    "--pm-email-tag-accent": accent,
    backgroundColor: withAlpha(accent, 0.14),
    borderColor: withAlpha(accent, 0.36),
  } as React.CSSProperties;
}

export function EmailTagVisualIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      className={cn("h-3 w-3 shrink-0", className)}
      style={{
        color: "var(--pm-email-tag-accent)",
        fill: "var(--pm-email-tag-accent)",
      }}
      aria-hidden="true">
      <path fill="currentColor" d={EMAIL_TAG_ICON_PATH} />
    </svg>
  );
}
