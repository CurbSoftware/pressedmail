import { type Dispatch, type SetStateAction } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  Alert,
  AlertDescription,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";
import {
  AlertCircle,
  ArrowDownToDot,
  BookOpen,
  CheckCircle,
  ChevronDown,
  Circle,
  Loader2,
  Server,
  XCircle,
} from "lucide-react";
import { EmailSendIcon } from "@/components/icons/MailActionIcons";
import { sensitiveInputProps } from "@/lib/sensitive-input-props";

import { ProtonBridgePanel } from "../ProtonBridgePanel";
import {
  isAdvancedProvider,
  PROVIDERS,
} from "@/components/setup/providers";
import type {
  ConnectionStatus,
  ConnectionTestState,
  ProviderKey,
  SetupFormData,
  SetupFormErrors,
} from "../types";

export interface StepServerSettingsProps {
  isEditing?: boolean;
  formData: SetupFormData;
  setFormData: Dispatch<SetStateAction<SetupFormData>>;
  errors: SetupFormErrors;
  loading?: boolean;
  testState?: ConnectionTestState;
  connectionStatus?: ConnectionStatus | null;
  onTestConnection?: () => void;
  onAddEmail?: () => void;
}

const pendingTestState: ConnectionTestState = {
  imapStatus: "pending",
  imapMessage: "",
  smtpStatus: "pending",
  smtpMessage: "",
};

const statusIconClassName = "h-10 w-10 shrink-0";

function StatusIcon({
  status,
  tone,
}: {
  status: ConnectionTestState["imapStatus"];
  tone: "info" | "success";
}) {
  if (status === "testing") {
    return (
      <Loader2
        className={`${statusIconClassName} animate-spin ${
          tone === "info" ? "text-info" : "text-success"
        }`}
      />
    );
  }

  if (status === "success") {
    return <CheckCircle className={`${statusIconClassName} text-success`} />;
  }

  if (status === "error") {
    return <XCircle className={`${statusIconClassName} text-destructive`} />;
  }

  return <Circle className={`${statusIconClassName} text-muted-foreground`} />;
}

export function StepServerSettings({
  isEditing = false,
  formData,
  setFormData,
  errors,
  loading = false,
  testState = pendingTestState,
  connectionStatus = null,
  onTestConnection,
  onAddEmail,
}: StepServerSettingsProps) {
  const hasConnectionActivity =
    loading ||
    testState.imapStatus !== "pending" ||
    testState.smtpStatus !== "pending" ||
    connectionStatus !== null;

  return (
    <div className="space-y-4">
      <div className="space-y-1.5 text-center">
        <Server className="mx-auto h-9 w-9 text-primary" />
        <h2 className="text-xl font-semibold">
          {__("Server Configuration", "pressedmail")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {__(
            "Configure and test the account before adding it to your inbox.",
            "pressedmail",
          )}
        </p>
      </div>

      {formData.provider !== "custom" &&
      !isAdvancedProvider(formData.provider) ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            {sprintf(
              __(
                "Server settings have been automatically configured for %s.",
                "pressedmail",
              ),
              (formData.provider &&
                PROVIDERS[formData.provider as ProviderKey]?.name) ||
                "",
            )}
          </AlertDescription>
        </Alert>
      ) : (
        <div className="space-y-3">
          {formData.provider === "protonmail" && <ProtonBridgePanel />}
          <div
            data-test="server-settings-grid"
            data-testid="server-settings-grid"
            className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card data-test="imap-server-card">
              <CardHeader className="space-y-1 pb-2">
                <div className="flex items-center gap-2">
                  <ArrowDownToDot className="h-4 w-4 text-info" />
                  <CardTitle className="text-base font-semibold">
                    {__("IMAP", "pressedmail")}
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  {__("Receiving mail", "pressedmail")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <div className="space-y-1 md:col-span-3">
                    <Label htmlFor="imapHost" className="text-xs font-medium">
                      {__("Server", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="imapHost"
                      data-test="imap-host-input"
                      placeholder={__("imap.example.com", "pressedmail")}
                      value={formData.imapHost}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          imapHost: e.target.value,
                        }))
                      }
                      className={errors.imapHost ? "border-destructive" : ""}
                    />
                    {errors.imapHost && (
                      <p className="text-xs text-destructive">
                        {errors.imapHost}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label htmlFor="imapPort" className="text-xs font-medium">
                      {__("Port", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="imapPort"
                      data-test="imap-port-input"
                      type="number"
                      value={formData.imapPort}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          imapPort: parseInt(e.target.value),
                        }))
                      }
                      className={errors.imapPort ? "border-destructive" : ""}
                    />
                    {errors.imapPort && (
                      <p className="text-xs text-destructive">
                        {errors.imapPort}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs font-medium">
                      {__("Security", "pressedmail")}
                    </Label>
                    <Select
                      value={formData.imapSecurity}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          imapSecurity: value,
                        }))
                      }>
                      <SelectTrigger data-test="imap-security-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="SSL/TLS">
                          {__("SSL/TLS (Port 993)", "pressedmail")}
                        </SelectItem>
                        <SelectItem value="STARTTLS">
                          {__("STARTTLS (Port 143)", "pressedmail")}
                        </SelectItem>
                        <SelectItem value="None">
                          {__("None (Not Recommended)", "pressedmail")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-2">
                  <div className="space-y-1">
                    <Label
                      htmlFor="imapUsername"
                      className="text-xs font-medium">
                      {__("Username", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="imapUsername"
                      data-test="imap-username-input"
                      placeholder={__("your-email@example.com", "pressedmail")}
                      value={
                        formData.useSeparateCredentials
                          ? formData.imapUsername
                          : formData.email
                      }
                      onChange={(e) => {
                        if (formData.useSeparateCredentials) {
                          setFormData((prev) => ({
                            ...prev,
                            imapUsername: e.target.value,
                          }));
                        }
                      }}
                      disabled={!formData.useSeparateCredentials}
                      className={
                        !formData.useSeparateCredentials ? "bg-muted" : ""
                      }
                    />
                    {!formData.useSeparateCredentials && (
                      <p className="text-xs text-muted-foreground">
                        {__("Using email address", "pressedmail")}
                      </p>
                    )}
                    {errors.imapUsername && formData.useSeparateCredentials && (
                      <p className="text-xs text-destructive">
                        {errors.imapUsername}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="imapPassword"
                      className="text-xs font-medium">
                      {__("Password", "pressedmail")}
                    </Label>
                    <Input
                      id="imapPassword"
                      data-test="imap-password-input"
                      type="password"
                      name="pressedmail-imap-account-password"
                      placeholder={__(
                        "App password or account password",
                        "pressedmail",
                      )}
                      {...sensitiveInputProps("mail-account-password")}
                      value={
                        formData.useSeparateCredentials
                          ? formData.imapPassword
                          : formData.password
                      }
                      onChange={(e) => {
                        if (formData.useSeparateCredentials) {
                          setFormData((prev) => ({
                            ...prev,
                            imapPassword: e.target.value,
                          }));
                        } else {
                          setFormData((prev) => ({
                            ...prev,
                            password: e.target.value,
                          }));
                        }
                      }}
                      className={
                        errors.imapPassword || errors.password
                          ? "border-destructive"
                          : ""
                      }
                    />
                    {(errors.imapPassword || errors.password) && (
                      <p className="text-xs text-destructive">
                        {errors.imapPassword || errors.password}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Checkbox
                    id="sameCredentials"
                    data-test="same-credentials-checkbox"
                    checked={!formData.useSeparateCredentials}
                    onCheckedChange={(checked) => {
                      setFormData((prev) => ({
                        ...prev,
                        useSeparateCredentials: !checked,
                        ...(checked && {
                          imapUsername: "",
                          imapPassword: "",
                          smtpUsername: "",
                          smtpPassword: "",
                        }),
                      }));
                    }}
                  />
                  <Label
                    htmlFor="sameCredentials"
                    className="cursor-pointer text-xs font-medium">
                    {__("Use same credentials for SMTP", "pressedmail")}
                  </Label>
                </div>
              </CardContent>
            </Card>

            <Card
              data-test="smtp-server-card"
              className={
                !formData.useSeparateCredentials ? "opacity-95" : undefined
              }>
              <CardHeader className="space-y-1 pb-2">
                <div className="flex items-center gap-2">
                  <EmailSendIcon className="h-4 w-4 text-success" />
                  <CardTitle className="text-base font-semibold">
                    {__("SMTP", "pressedmail")}
                  </CardTitle>
                </div>
                <p className="text-xs text-muted-foreground">
                  {__("Sending mail", "pressedmail")}
                </p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
                  <div className="space-y-1 md:col-span-3">
                    <Label htmlFor="smtpHost" className="text-xs font-medium">
                      {__("Server", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="smtpHost"
                      data-test="smtp-host-input"
                      placeholder={__("smtp.example.com", "pressedmail")}
                      value={formData.smtpHost}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smtpHost: e.target.value,
                        }))
                      }
                      className={errors.smtpHost ? "border-destructive" : ""}
                    />
                    {errors.smtpHost && (
                      <p className="text-xs text-destructive">
                        {errors.smtpHost}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-1">
                    <Label htmlFor="smtpPort" className="text-xs font-medium">
                      {__("Port", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="smtpPort"
                      data-test="smtp-port-input"
                      type="number"
                      value={formData.smtpPort}
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smtpPort: parseInt(e.target.value),
                        }))
                      }
                      className={errors.smtpPort ? "border-destructive" : ""}
                    />
                    {errors.smtpPort && (
                      <p className="text-xs text-destructive">
                        {errors.smtpPort}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1 md:col-span-2">
                    <Label className="text-xs font-medium">
                      {__("Security", "pressedmail")}
                    </Label>
                    <Select
                      value={formData.smtpSecurity}
                      onValueChange={(value) =>
                        setFormData((prev) => ({
                          ...prev,
                          smtpSecurity: value,
                        }))
                      }>
                      <SelectTrigger data-test="smtp-security-select">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="STARTTLS">
                          {__("STARTTLS (Port 587)", "pressedmail")}
                        </SelectItem>
                        <SelectItem value="SSL/TLS">
                          {__("SSL/TLS (Port 465)", "pressedmail")}
                        </SelectItem>
                        <SelectItem value="None">
                          {__("None (Port 25, Not Recommended)", "pressedmail")}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div
                  className={`grid grid-cols-1 gap-3 border-t pt-3 md:grid-cols-2 ${
                    !formData.useSeparateCredentials ? "opacity-60" : ""
                  }`}>
                  <div className="space-y-1">
                    <Label
                      htmlFor="smtpUsername"
                      className="text-xs font-medium">
                      {__("Username", "pressedmail")}
                    </Label>
                    <Input autoComplete="off"
                      id="smtpUsername"
                      data-test="smtp-username-input"
                      placeholder={__("your-email@example.com", "pressedmail")}
                      value={
                        formData.useSeparateCredentials
                          ? formData.smtpUsername
                          : formData.email
                      }
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smtpUsername: e.target.value,
                        }))
                      }
                      disabled={!formData.useSeparateCredentials}
                      className={
                        !formData.useSeparateCredentials ? "bg-muted" : ""
                      }
                    />
                    {errors.smtpUsername && formData.useSeparateCredentials && (
                      <p className="text-xs text-destructive">
                        {errors.smtpUsername}
                      </p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <Label
                      htmlFor="smtpPassword"
                      className="text-xs font-medium">
                      {__("Password", "pressedmail")}
                    </Label>
                    <Input
                      id="smtpPassword"
                      data-test="smtp-password-input"
                      type="password"
                      name="pressedmail-smtp-account-password"
                      placeholder={__("SMTP password", "pressedmail")}
                      {...sensitiveInputProps("mail-account-password")}
                      value={
                        formData.useSeparateCredentials
                          ? formData.smtpPassword
                          : formData.password
                      }
                      onChange={(e) =>
                        setFormData((prev) => ({
                          ...prev,
                          smtpPassword: e.target.value,
                        }))
                      }
                      disabled={!formData.useSeparateCredentials}
                      className={
                        !formData.useSeparateCredentials ? "bg-muted" : ""
                      }
                    />
                    {errors.smtpPassword && formData.useSeparateCredentials && (
                      <p className="text-xs text-destructive">
                        {errors.smtpPassword}
                      </p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Alert className="bg-muted/50">
            <BookOpen className="h-4 w-4" />
            <AlertDescription>
              {__(
                'Using different services? Uncheck "Use same credentials" and enter the SMTP provider settings in the SMTP card.',
                "pressedmail",
              )}
            </AlertDescription>
          </Alert>
        </div>
      )}

      {hasConnectionActivity && (
        <Card data-test="connection-status-card">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold">
              {__("Connection Status", "pressedmail")}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-3">
              <StatusIcon status={testState.imapStatus} tone="info" />
              <div className="min-w-0">
                <p className="font-medium">
                  {__("IMAP (Receiving)", "pressedmail")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {testState.imapMessage ||
                    `${formData.imapHost}:${formData.imapPort}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <StatusIcon status={testState.smtpStatus} tone="success" />
              <div className="min-w-0">
                <p className="font-medium">
                  {__("SMTP (Sending)", "pressedmail")}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {testState.smtpMessage ||
                    `${formData.smtpHost}:${formData.smtpPort}`}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
          <Button
            type="button"
            data-test="test-connection-button"
            onClick={onTestConnection}
            disabled={loading || !onTestConnection}
            className="w-full sm:w-auto"
            variant={connectionStatus?.success ? "secondary" : "default"}>
            {loading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                {__("Working...", "pressedmail")}
              </>
            ) : connectionStatus?.success ? (
              __("Retest Connection", "pressedmail")
            ) : (
              __("Test Connection", "pressedmail")
            )}
          </Button>

          {connectionStatus?.success && (
            <Button
              type="button"
              data-test="complete-setup-button"
              onClick={onAddEmail}
              disabled={loading || !onAddEmail}
              className="w-full sm:w-auto">
              {isEditing
                ? __("Save Changes", "pressedmail")
                : __("Add Email", "pressedmail")}
            </Button>
          )}
        </div>

        {connectionStatus && !loading && !connectionStatus.success && (
          <Alert
            data-test="connection-error"
            variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription className="space-y-1">
              <p>{connectionStatus.message}</p>
              {connectionStatus.suggestion && (
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
