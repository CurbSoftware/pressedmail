import { ExternalLink, KeyRound } from "lucide-react";

import type { ProviderGuidanceEntry } from "./provider-guidance";

export interface ProviderGuidanceProps {
  guidance: ProviderGuidanceEntry;
}

/**
 * Renders per-provider credential guidance: title, numbered app-password
 * walkthrough, provider deep link, and a "not your normal password" warning.
 */
export function ProviderGuidance({ guidance }: ProviderGuidanceProps) {
  return (
    <div
      data-test="provider-requirement"
      className="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm text-foreground space-y-2">
      <div className="flex items-center gap-2 font-medium">
        <KeyRound className="h-4 w-4 text-primary" aria-hidden="true" />
        <span>{guidance.title}</span>
      </div>

      {guidance.steps.length > 0 && (
        <ol className="list-decimal space-y-1 pl-5">
          {guidance.steps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      )}

      {guidance.note && (
        <p className="text-muted-foreground">{guidance.note}</p>
      )}

      {guidance.link && (
        <a
          href={guidance.link.href}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-medium text-primary underline underline-offset-2">
          {guidance.link.label}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
        </a>
      )}

      {guidance.warning && (
        <p
          data-test="provider-guidance-warning"
          className="font-medium text-warning">
          {guidance.warning}
        </p>
      )}
    </div>
  );
}
