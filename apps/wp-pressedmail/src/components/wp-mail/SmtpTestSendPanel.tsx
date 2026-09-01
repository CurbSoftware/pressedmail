import { __ } from "@wordpress/i18n";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";

import { Alert, AlertDescription, Button, Input, Label } from "@kit/ui/plugin";

import type { SmtpStatusMessage, SmtpTestPanelErrors } from "./types";

export interface SmtpTestSendPanelProps {
  testRecipient: string;
  onTestRecipientChange: (value: string) => void;
  onTest: () => void;
  /** Omitted where the surrounding surface owns saving (a settings save bar). */
  onSave?: () => void;
  errors?: SmtpTestPanelErrors;
  status?: SmtpStatusMessage | null;
  saving?: boolean;
  testing?: boolean;
  disabled?: boolean;
  idPrefix?: string;
}

/**
 * Test-recipient field, the send/save actions, and the resulting status.
 *
 * Kept separate from the connection form so a surface that saves through a
 * settings save bar can reuse the test action without inheriting a second Save
 * button.
 */
export function SmtpTestSendPanel({
  testRecipient,
  onTestRecipientChange,
  onTest,
  onSave,
  errors = {},
  status = null,
  saving = false,
  testing = false,
  disabled = false,
  idPrefix = "global-smtp",
}: SmtpTestSendPanelProps) {
  const id = (suffix: string) => `${idPrefix}-${suffix}`;
  const busy = disabled || saving || testing;
  const recipientErrorId = id("test-recipient-error");

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label htmlFor={id("test-recipient")} className="text-xs font-medium">
          {__("Test recipient email", "pressedmail")}
        </Label>
        <Input
          autoComplete="off"
          id={id("test-recipient")}
          data-test={id("test-recipient-input")}
          type="email"
          placeholder={__("recipient@example.com", "pressedmail")}
          value={testRecipient}
          onChange={(event) => onTestRecipientChange(event.target.value)}
          aria-invalid={Boolean(errors.testRecipient)}
          aria-describedby={errors.testRecipient ? recipientErrorId : undefined}
          className={errors.testRecipient ? "border-destructive" : ""}
        />
        {errors.testRecipient && (
          <p id={recipientErrorId} className="text-xs text-destructive">
            {errors.testRecipient}
          </p>
        )}
      </div>
      <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
        <Button
          type="button"
          variant="secondary"
          data-test={id("test-button")}
          onClick={onTest}
          disabled={busy}
          className="w-full sm:w-auto">
          {testing ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {__("Sending test...", "pressedmail")}
            </>
          ) : (
            __("Send Test Email", "pressedmail")
          )}
        </Button>
        {onSave && (
          <Button
            type="button"
            data-test={id("save-button")}
            onClick={onSave}
            disabled={busy}
            className="w-full sm:w-auto">
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {__("Saving...", "pressedmail")}
              </>
            ) : (
              __("Save Settings", "pressedmail")
            )}
          </Button>
        )}
      </div>

      {status && !busy && (
        <Alert
          data-test={id("status")}
          variant={status.kind === "error" ? "destructive" : "default"}>
          {status.kind === "error" ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <CheckCircle2 className="h-4 w-4" />
          )}
          <AlertDescription>{status.message}</AlertDescription>
        </Alert>
      )}

      {errors.submit && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{errors.submit}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}
