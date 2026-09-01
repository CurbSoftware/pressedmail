"use client";

import * as React from "react";
import { Maximize } from "lucide-react";

import { cn } from "@/lib/utils";

export type FullscreenPromptValue = "prompt" | "always" | "never";

export interface MobileFullscreenPromptProps {
  value: FullscreenPromptValue;
  onChoose: (next: FullscreenPromptValue) => void;
  onEnterFullscreen: () => void;
  className?: string;
}

/**
 * One-time banner that asks the user whether to auto-enter fullscreen on
 * phones. Rendered only when the user's persisted preference is "prompt".
 * Persisting the choice and toggling fullscreen are owned by the parent.
 */
export function MobileFullscreenPrompt({
  value,
  onChoose,
  onEnterFullscreen,
  className,
}: MobileFullscreenPromptProps) {
  if (value !== "prompt") return null;
  return (
    <div
      role="dialog"
      aria-labelledby="pm-fullscreen-prompt-title"
      data-pm-fullscreen-prompt
      className={cn(
        "pointer-events-auto fixed bottom-0 left-0 right-0 z-50 mx-auto w-full max-w-md rounded-t-2xl border border-border bg-card p-4 shadow-lg",
        "pm-safe-pb pm-safe-pl pm-safe-pr",
        className,
      )}>
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <Maximize className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2
            id="pm-fullscreen-prompt-title"
            className="text-sm font-semibold text-foreground">
            Run PressedMail fullscreen?
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">
            Hide the WordPress chrome for a native-app feel. You can change this
            from settings any time.
          </p>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        <button
          type="button"
          onClick={() => {
            onEnterFullscreen();
            onChoose("always");
          }}
          className="pm-touch-target pm-no-tap-highlight inline-flex items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground active:bg-primary/90">
          Enter fullscreen
        </button>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onChoose("prompt")}
            className="pm-touch-target pm-no-tap-highlight flex-1 rounded-lg border border-border bg-card text-sm text-foreground active:bg-muted">
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => onChoose("never")}
            className="pm-touch-target pm-no-tap-highlight flex-1 rounded-lg border border-border bg-card text-sm text-muted-foreground active:bg-muted">
            Don&apos;t ask again
          </button>
        </div>
      </div>
    </div>
  );
}

export default MobileFullscreenPrompt;
