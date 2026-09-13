import type { Dispatch, SetStateAction } from "react";
import { __ } from "@wordpress/i18n";
import { AlertCircle, CheckCircle, Loader2, Mail } from "lucide-react";

import {
  Alert,
  AlertDescription,
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";
import { sensitiveInputProps } from "@/lib/sensitive-input-props";
import type { ManagedDomainSetupRuntime } from "@/types/domain-policy";

import type {
  ConnectionStatus,
  ManagedSetupFormData,
  ManagedSetupFormErrors,
} from "./types";

interface ManagedDomainCredentialsStepProps {
  domains: ManagedDomainSetupRuntime["domains"];
  formData: ManagedSetupFormData;
  setFormData: Dispatch<SetStateAction<ManagedSetupFormData>>;
  errors: ManagedSetupFormErrors;
  loading: boolean;
  connectionStatus: ConnectionStatus | null;
  onTestConnection: () => void;
  onAddEmail: () => void;
  onCredentialChange: () => void;
}

export function ManagedDomainCredentialsStep({
  domains,
  formData,
  setFormData,
  errors,
  loading,
  connectionStatus,
  onTestConnection,
  onAddEmail,
  onCredentialChange,
}: ManagedDomainCredentialsStepProps) {
  const separate = formData.credentialMode === "separate";

  return (
    <div className="space-y-5">
      <div className="space-y-1.5 text-center">
        <Mail className="mx-auto h-9 w-9 text-primary" />
        <h2 className="text-xl font-semibold">
          {__("Connect your email", "pressedmail")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {__(
            "Enter the mailbox details supplied by your site administrator.",
            "pressedmail",
          )}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="managed-local-part">
            {__("Email prefix", "pressedmail")}
          </Label>
          <Input
            id="managed-local-part"
            data-test="managed-local-part"
            data-testid="managed-local-part"
            autoComplete="off"
            value={formData.localPart}
            onChange={(event) =>
              setFormData((previous) => ({
                ...previous,
                localPart: event.target.value,
              }))
            }
            className={errors.localPart ? "border-destructive" : ""}
          />
          {errors.localPart && (
            <p className="text-xs text-destructive">{errors.localPart}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{__("Email domain", "pressedmail")}</Label>
          <Select
            value={formData.domain}
            onValueChange={(domain) => {
              const selected = domains.find((entry) => entry.domain === domain);
              setFormData((previous) => ({
                ...previous,
                domain,
                credentialMode: selected?.credential_mode ?? "shared",
                password: "",
                imapPassword: "",
                smtpPassword: "",
              }));
            }}>
            <SelectTrigger
              data-test="managed-domain"
              data-testid="managed-domain">
              <SelectValue placeholder={__("Select a domain", "pressedmail")} />
            </SelectTrigger>
            <SelectContent>
              {domains.map((entry) => (
                <SelectItem key={entry.domain} value={entry.domain}>
                  @{entry.domain}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.domain && (
            <p className="text-xs text-destructive">{errors.domain}</p>
          )}
        </div>
      </div>

      <div className="space-y-1.5">
        <Label htmlFor="managed-sender-name">
          {__("Sender name", "pressedmail")}
        </Label>
        <Input
          id="managed-sender-name"
          data-test="managed-sender-name"
          data-testid="managed-sender-name"
          autoComplete="off"
          value={formData.senderName}
          onChange={(event) =>
            setFormData((previous) => ({
              ...previous,
              senderName: event.target.value,
            }))
          }
          className={errors.senderName ? "border-destructive" : ""}
        />
        {errors.senderName && (
          <p className="text-xs text-destructive">{errors.senderName}</p>
        )}
      </div>

      {separate ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label htmlFor="managed-imap-password">
              {__("Incoming password", "pressedmail")}
            </Label>
            <Input
              {...sensitiveInputProps("mail-account-password")}
              type="password"
              id="managed-imap-password"
              data-test="managed-imap-password"
              data-testid="managed-imap-password"
              value={formData.imapPassword}
              onChange={(event) => {
                onCredentialChange();
                setFormData((previous) => ({
                  ...previous,
                  imapPassword: event.target.value,
                }));
              }}
              className={errors.imapPassword ? "border-destructive" : ""}
            />
            {errors.imapPassword && (
              <p className="text-xs text-destructive">{errors.imapPassword}</p>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="managed-smtp-password">
              {__("Outgoing password", "pressedmail")}
            </Label>
            <Input
              {...sensitiveInputProps("mail-account-password")}
              type="password"
              id="managed-smtp-password"
              data-test="managed-smtp-password"
              data-testid="managed-smtp-password"
              value={formData.smtpPassword}
              onChange={(event) => {
                onCredentialChange();
                setFormData((previous) => ({
                  ...previous,
                  smtpPassword: event.target.value,
                }));
              }}
              className={errors.smtpPassword ? "border-destructive" : ""}
            />
            {errors.smtpPassword && (
              <p className="text-xs text-destructive">{errors.smtpPassword}</p>
            )}
          </div>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Label htmlFor="managed-password">
            {__("Mailbox password", "pressedmail")}
          </Label>
          <Input
            {...sensitiveInputProps("mail-account-password")}
            type="password"
            id="managed-password"
            data-test="managed-password"
            data-testid="managed-password"
            value={formData.password}
            onChange={(event) => {
              onCredentialChange();
              setFormData((previous) => ({
                ...previous,
                password: event.target.value,
              }));
            }}
            className={errors.password ? "border-destructive" : ""}
          />
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password}</p>
          )}
        </div>
      )}

      <div className="space-y-3">
        <Button
          data-test="test-connection-button"
          data-testid="test-connection-button"
          onClick={onTestConnection}
          disabled={loading}
          className="w-full"
          variant={connectionStatus?.success ? "secondary" : "default"}>
          {loading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {__("Testing connection...", "pressedmail")}
            </>
          ) : connectionStatus?.success ? (
            __("Connection tested", "pressedmail")
          ) : (
            __("Test connection", "pressedmail")
          )}
        </Button>

        {connectionStatus && !loading && (
          <Alert
            role="alert"
            variant={connectionStatus.success ? "default" : "destructive"}>
            {connectionStatus.success ? (
              <CheckCircle className="h-4 w-4" />
            ) : (
              <AlertCircle className="h-4 w-4" />
            )}
            <AlertDescription>{connectionStatus.message}</AlertDescription>
          </Alert>
        )}

        {(errors.test || errors.submit) && (
          <Alert role="alert" variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{errors.test || errors.submit}</AlertDescription>
          </Alert>
        )}

        <Button
          data-test="add-email-button"
          data-testid="add-email-button"
          onClick={onAddEmail}
          disabled={loading || !connectionStatus?.success}
          className="w-full">
          {__("Save account", "pressedmail")}
        </Button>
      </div>
    </div>
  );
}
