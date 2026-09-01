"use client";

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Check, Copy, Loader2, Sparkles } from "lucide-react";

import { useEmailSummaries } from "@/context/email-summary";
import { cn } from "@/lib/utils";
import type { EmailMessage } from "@/types";
import { EmailSummaryMarkdown } from "./EmailSummaryMarkdown";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTitleRow,
  DialogTrigger,
} from "@kit/ui/plugin";

/**
 * Copies the raw markdown summary and flips to a "Copied" confirmation for a
 * couple of seconds (same pattern as ContactDetailView's copy fields).
 */
function CopySummaryButton({ summary }: { summary: string }) {
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 2000);
    return () => window.clearTimeout(timer);
  }, [copied]);

  if (typeof navigator.clipboard?.writeText !== "function") {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      data-test="email-summary-copy"
      data-testid="email-summary-copy"
      onClick={() => {
        void navigator.clipboard
          .writeText(summary)
          .then(() => setCopied(true))
          .catch(() => setCopied(false));
      }}>
      {copied ? (
        <Check className="h-3.5 w-3.5 text-success" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {copied ? __("Copied", "pressedmail") : __("Copy summary", "pressedmail")}
    </Button>
  );
}

interface EmailSummaryButtonProps {
  message: EmailMessage;
  className?: string;
}

function SummaryMailIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="1em"
      height="1em"
      viewBox="0 0 24 24"
      className={className}
      aria-hidden="true">
      <g fill="none" stroke="currentColor" strokeWidth={2}>
        <path
          strokeLinecap="square"
          d="M8 8h4.5M8 12h8m-8 4h5m7.5-4v9.5h-17v-19h9"
        />
        <path d="m19 2.75l.7 1.55l1.55.7l-1.55.7l-.7 1.55l-.7-1.55l-1.55-.7l1.55-.7z" />
      </g>
    </svg>
  );
}

export function EmailSummaryButton({
  message,
  className,
}: EmailSummaryButtonProps) {
  const { getSummary } = useEmailSummaries();
  const record = getSummary(message);

  const subject = message.subject || __("email", "pressedmail");

  // No summary requested for this email yet, show nothing.
  if (!record) {
    return null;
  }

  // In flight: show a spinner indicator the moment summarize starts, so the
  // card reflects pending state (parity with the phishing indicator) and fills
  // in once the AI response arrives.
  if (record.status === "pending") {
    return (
      <span
        data-test="email-summary-pending"
        data-testid="email-summary-pending"
        className={cn(
          "inline-flex items-center justify-center text-muted-foreground",
          className,
        )}
        aria-busy="true"
        aria-label={sprintf(__("Summarizing %s…", "pressedmail"), subject)}>
        <Loader2 className="h-4 w-4 animate-spin" />
      </span>
    );
  }

  if (record.status !== "success" || !record.summary) {
    return null;
  }

  const label = sprintf(__("Open summary for %s", "pressedmail"), subject);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className={className}
          data-test="email-summary-open"
          data-testid="email-summary-open"
          aria-label={label}
          onClick={(event) => event.stopPropagation()}>
          <SummaryMailIcon className="h-4 w-4 text-primary" />
        </Button>
      </DialogTrigger>
      <DialogContent
        className="sm:max-w-lg"
        onClick={(event) => event.stopPropagation()}>
        <DialogHeader>
          <DialogTitle>
            <DialogTitleRow>
              <Sparkles />
              <span>{__("Email summary", "pressedmail")}</span>
            </DialogTitleRow>
          </DialogTitle>
          <DialogDescription>{subject}</DialogDescription>
        </DialogHeader>
        <div
          data-test="email-summary-body"
          data-testid="email-summary-body"
          className="max-h-[60vh] overflow-y-auto rounded-lg border border-primary/20 bg-muted/40 p-4">
          <EmailSummaryMarkdown markdown={record.summary} />
        </div>
        <DialogFooter>
          <CopySummaryButton summary={record.summary} />
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default EmailSummaryButton;
