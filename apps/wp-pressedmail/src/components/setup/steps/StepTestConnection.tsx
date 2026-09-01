import { __ } from "@wordpress/i18n";
import {
  AlertCircle,
  CheckCircle,
  Circle,
  Loader2,
  XCircle,
} from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@kit/ui/plugin";

import { PROVIDERS } from "@/components/setup/providers";
import type {
  ConnectionStatus,
  ConnectionTestState,
  ProviderKey,
  SetupFormData,
  SetupFormErrors,
} from "../types";

export interface StepTestConnectionProps {
  formData: SetupFormData;
  errors: SetupFormErrors;
  loading: boolean;
  testState: ConnectionTestState;
  connectionStatus: ConnectionStatus | null;
  onTestConnection: () => void;
}

export function StepTestConnection({
  formData,
  errors,
  loading,
  testState,
  connectionStatus,
  onTestConnection,
}: StepTestConnectionProps) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <CheckCircle className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">
          {__("Test Connection", "pressedmail")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {__("Verify your settings before completing setup", "pressedmail")}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{__("Account Summary", "pressedmail")}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {__("Provider:", "pressedmail")}
            </span>
            <span className="font-medium">
              {formData.provider &&
                PROVIDERS[formData.provider as ProviderKey]?.name}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {__("Email:", "pressedmail")}
            </span>
            <span className="font-medium">{formData.email}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">
              {__("Display Name:", "pressedmail")}
            </span>
            <span className="font-medium">{formData.displayName}</span>
          </div>
          {formData.provider === "custom" && (
            <>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {__("IMAP Server:", "pressedmail")}
                </span>
                <span className="font-medium">
                  {formData.imapHost}:{formData.imapPort}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {__("SMTP Server:", "pressedmail")}
                </span>
                <span className="font-medium">
                  {formData.smtpHost}:{formData.smtpPort}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">
                  {__("Credentials:", "pressedmail")}
                </span>
                <span className="font-medium">
                  {formData.useSeparateCredentials
                    ? __("Separate IMAP/SMTP logins", "pressedmail")
                    : __("Same for both servers", "pressedmail")}
                </span>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {(loading || testState.imapStatus !== "pending") && (
        <Card>
          <CardHeader>
            <CardTitle>{__("Connection Status", "pressedmail")}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-3">
              {testState.imapStatus === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {testState.imapStatus === "testing" && (
                <Loader2 className="h-5 w-5 animate-spin text-info" />
              )}
              {testState.imapStatus === "success" && (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              {testState.imapStatus === "error" && (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {__("IMAP (Receiving)", "pressedmail")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testState.imapMessage ||
                    `${formData.imapHost}:${formData.imapPort}`}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {testState.smtpStatus === "pending" && (
                <Circle className="h-5 w-5 text-muted-foreground" />
              )}
              {testState.smtpStatus === "testing" && (
                <Loader2 className="h-5 w-5 animate-spin text-success" />
              )}
              {testState.smtpStatus === "success" && (
                <CheckCircle className="h-5 w-5 text-success" />
              )}
              {testState.smtpStatus === "error" && (
                <XCircle className="h-5 w-5 text-destructive" />
              )}
              <div className="flex-1">
                <p className="font-medium">
                  {__("SMTP (Sending)", "pressedmail")}
                </p>
                <p className="text-sm text-muted-foreground">
                  {testState.smtpMessage ||
                    `${formData.smtpHost}:${formData.smtpPort}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        <Button
          onClick={onTestConnection}
          disabled={loading}
          className="w-full"
          variant={connectionStatus?.success ? "secondary" : "default"}>
          {loading
            ? __("Testing Connection...", "pressedmail")
            : connectionStatus?.success
              ? __("Connection Tested", "pressedmail")
              : __("Test Connection", "pressedmail")}
        </Button>

        {connectionStatus && !loading && (
          <Alert variant={connectionStatus.success ? "default" : "destructive"}>
            {connectionStatus.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription className="space-y-1">
              <p>{connectionStatus.message}</p>
              {!connectionStatus.success && connectionStatus.suggestion && (
                <p>{connectionStatus.suggestion}</p>
              )}
            </AlertDescription>
          </Alert>
        )}

        {errors.test && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.test}</AlertDescription>
          </Alert>
        )}

        {errors.submit && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.submit}</AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
