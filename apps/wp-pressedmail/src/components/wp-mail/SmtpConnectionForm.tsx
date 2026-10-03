import { useState } from "react";
import { __ } from "@wordpress/i18n";
import { AlertCircle, CheckCircle2, Info, Loader2, Plus } from "lucide-react";

import {
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

import { buildSenderProbeReport } from "./test-status";
import {
  SINGLE_CONNECTION_CAPABILITIES,
  SMTP_AUTH_TYPES,
  type SmtpConnectionCapabilities,
  type SmtpConnectionFormErrors,
  type SmtpConnectionValue,
  type SmtpSenderTest,
} from "./types";

/**
 * Per-address sender testing for a SAVED connection.
 *
 * Only a stored connection can be probed, because the probe logs in with that
 * connection's own credentials, so the surrounding editor turns the buttons off
 * while the form has unsaved edits or no id yet.
 */
export interface SmtpSenderTesting {
  test: (address: string) => void;
  /** The outcome per address, keyed by the lowercased address. */
  results: Record<string, SmtpSenderTest>;
  /** The address being probed right now, or "". */
  pending: string;
  /** Why Test is off. Empty when it is available. */
  disabledReason: string;
}

export interface SmtpConnectionFormProps {
  value: SmtpConnectionValue;
  onChange: (next: SmtpConnectionValue) => void;
  errors?: SmtpConnectionFormErrors;
  /** A password is already stored server-side (never echoed back). */
  hasPassword: boolean;
  capabilities?: SmtpConnectionCapabilities;
  /**
   * Scopes every DOM id and `data-test` attribute. Several connections render on
   * one page in Pro, so ids must not collide.
   */
  idPrefix?: string;
  disabled?: boolean;
  /** Absent where there is nothing to probe against. */
  senderTesting?: SmtpSenderTesting;
}

/**
 * Automatic's display token.
 *
 * The stored spelling of Automatic is the empty string, but Radix refuses a
 * `SelectItem` whose value is empty and throws, taking the whole editor down
 * with it. The wire value stays ""; only the control speaks this token, and it
 * is translated back on the way out.
 */
const AUTH_AUTO_VALUE = "auto";

/**
 * The chip tone per verdict. A verdict that is not a pass is not automatically a
 * failure: "inconclusive" and "unreachable" say nothing about the address, and
 * painting either red is how a working sender gets deleted.
 */
const SENDER_TONE = {
  success: "text-success",
  destructive: "text-destructive",
  info: "text-muted-foreground",
} as const;

/**
 * The SMTP connection fields, without any surrounding card or action buttons.
 *
 * Purely presentational and fully controlled: it fetches nothing and saves
 * nothing, so it can back the single Free connection, one row of the Pro
 * connection list, and a connection test without any of them diverging.
 */
export function SmtpConnectionForm({
  value,
  onChange,
  errors = {},
  hasPassword,
  capabilities = SINGLE_CONNECTION_CAPABILITIES,
  idPrefix = "global-smtp",
  disabled = false,
  senderTesting,
}: SmtpConnectionFormProps) {
  const [changingPassword, setChangingPassword] = useState(false);
  const id = (suffix: string) => `${idPrefix}-${suffix}`;
  const patch = (changes: Partial<SmtpConnectionValue>) =>
    onChange({ ...value, ...changes });
  const errorAttributes = (
    field: string,
    error?: string,
    descriptions: string[] = [],
  ) => {
    const describedBy = [
      ...descriptions,
      ...(error ? [id(`${field}-error`)] : []),
    ];

    return {
      "aria-invalid": Boolean(error),
      "aria-describedby":
        describedBy.length > 0 ? describedBy.join(" ") : undefined,
    };
  };

  const showLabel = capabilities.routing;
  // Row 0 is the connection's own default sender; the rest are the addresses
  // routed through it, which are also senders a template may choose.
  const alternates = value.fromAddresses ?? [];
  const addressesLabelId = id("from-addresses-label");
  const addressesHelpId = id("from-addresses-help");
  const testing = capabilities.routing ? senderTesting : undefined;
  const testingOff =
    Boolean(testing?.pending) || Boolean(testing?.disabledReason);

  const setAddress = (index: number, address: string) => {
    if (index === 0) {
      patch({ fromEmail: address });
      return;
    }
    const next = [...(value.fromAddresses ?? [])];
    next[index - 1] = address;
    patch({ fromAddresses: next });
  };

  /**
   * One sender: the address field, its Test button when probing is on offer, and
   * whatever the last test said.
   */
  const senderRow = (index: number, address: string) => {
    const first = index === 0;
    const error = first ? errors.fromEmail : errors.fromAddresses;
    const test = address ? testing?.results[address.toLowerCase()] : undefined;
    const report =
      test?.state === "done" ? buildSenderProbeReport(test.probe) : null;
    const resultTestId = id(`sender-${index}-result`);

    return (
      // Keyed by position: a row is an address, and two rows may both be empty.
      <div key={index} className="space-y-1">
        <div className="flex items-center gap-2">
          <Input
            autoComplete="off"
            id={first ? id("from-email") : id(`from-address-${index}`)}
            data-test={
              first ? id("from-email-input") : id(`from-address-${index}-input`)
            }
            type="email"
            placeholder={__("wordpress@example.com", "pressedmail")}
            aria-labelledby={first ? undefined : addressesLabelId}
            value={address}
            disabled={disabled}
            {...errorAttributes(
              first ? "from-email" : "from-addresses",
              error,
              first || error ? [] : [addressesHelpId],
            )}
            onChange={(event) => setAddress(index, event.target.value)}
            className={`min-w-0 flex-1 ${error ? "border-destructive" : ""}`}
          />
          {testing ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              data-test={id(`sender-${index}-test`)}
              disabled={disabled || testingOff || address === ""}
              onClick={() => testing.test(address)}>
              {testing.pending === address.toLowerCase() ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : null}
              {__("Test", "pressedmail")}
            </Button>
          ) : null}
        </div>

        {test?.state === "testing" ? (
          <p
            role="status"
            data-test={resultTestId}
            data-testid={resultTestId}
            className={`flex items-center gap-1.5 text-xs ${SENDER_TONE.info}`}>
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden="true" />
            {__("Testing...", "pressedmail")}
          </p>
        ) : null}

        {report ? (
          <div
            role="status"
            data-test={resultTestId}
            data-testid={resultTestId}
            data-tone={report.tone}
            className={`text-xs ${SENDER_TONE[report.tone]}`}>
            <p className="flex items-center gap-1.5 font-medium">
              {report.tone === "success" ? (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : report.tone === "destructive" ? (
                <AlertCircle
                  className="h-3.5 w-3.5 shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Info className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              )}
              {report.label}
            </p>
            <p className="text-muted-foreground">{report.message}</p>
            {report.detail ? (
              <p className="break-words font-mono text-muted-foreground">
                {report.detail}
              </p>
            ) : null}
          </div>
        ) : null}

        {test?.state === "error" ? (
          <p
            role="status"
            data-test={resultTestId}
            data-testid={resultTestId}
            className="flex items-start gap-1.5 text-xs text-destructive">
            <AlertCircle
              className="mt-0.5 h-3.5 w-3.5 shrink-0"
              aria-hidden="true"
            />
            {test.message}
          </p>
        ) : null}
      </div>
    );
  };

  return (
    <div className="space-y-3">
      {showLabel && (
        <div className="space-y-1">
          <Label htmlFor={id("label")} className="text-xs font-medium">
            {__("Connection name", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id={id("label")}
            data-test={id("label-input")}
            placeholder={__("Store mail", "pressedmail")}
            value={value.label ?? ""}
            disabled={disabled}
            {...errorAttributes("label", errors.label)}
            onChange={(e) => patch({ label: e.target.value })}
            className={errors.label ? "border-destructive" : ""}
          />
          {errors.label && (
            <p id={id("label-error")} className="text-xs text-destructive">
              {errors.label}
            </p>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-6">
        <div className="space-y-1 md:col-span-3">
          <Label htmlFor={id("host")} className="text-xs font-medium">
            {__("SMTP host", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id={id("host")}
            data-test={id("host-input")}
            placeholder={__("smtp.example.com", "pressedmail")}
            value={value.host}
            disabled={disabled}
            {...errorAttributes("host", errors.host)}
            onChange={(e) => patch({ host: e.target.value })}
            className={errors.host ? "border-destructive" : ""}
          />
          {errors.host && (
            <p id={id("host-error")} className="text-xs text-destructive">
              {errors.host}
            </p>
          )}
        </div>
        <div className="space-y-1 md:col-span-1">
          <Label htmlFor={id("port")} className="text-xs font-medium">
            {__("Port", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id={id("port")}
            data-test={id("port-input")}
            type="number"
            min={1}
            max={65535}
            value={value.port}
            disabled={disabled}
            {...errorAttributes("port", errors.port)}
            onChange={(e) => patch({ port: Number(e.target.value) })}
            className={errors.port ? "border-destructive" : ""}
          />
          {errors.port && (
            <p id={id("port-error")} className="text-xs text-destructive">
              {errors.port}
            </p>
          )}
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor={id("security")} className="text-xs font-medium">
            {__("Connection security", "pressedmail")}
          </Label>
          <Select
            value={value.security}
            disabled={disabled}
            onValueChange={(next) =>
              patch({ security: next as SmtpConnectionValue["security"] })
            }>
            <SelectTrigger
              id={id("security")}
              data-test={id("security-select")}
              {...errorAttributes("security", errors.security)}
              className={errors.security ? "border-destructive" : ""}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ssl">{__("SSL", "pressedmail")}</SelectItem>
              <SelectItem value="tls">
                {__("TLS (STARTTLS)", "pressedmail")}
              </SelectItem>
              <SelectItem value="none">{__("None", "pressedmail")}</SelectItem>
            </SelectContent>
          </Select>
          {errors.security && (
            <p id={id("security-error")} className="text-xs text-destructive">
              {errors.security}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Checkbox
          id={id("auth")}
          data-test={id("auth")}
          checked={value.auth}
          disabled={disabled}
          onCheckedChange={(checked) => patch({ auth: checked === true })}
        />
        <Label
          htmlFor={id("auth")}
          className="cursor-pointer text-xs font-medium">
          {__("Use SMTP authentication", "pressedmail")}
        </Label>
      </div>

      {value.auth && (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor={id("auth-type")} className="text-xs font-medium">
              {__("Login method", "pressedmail")}
            </Label>
            <Select
              value={value.authType === "" ? AUTH_AUTO_VALUE : value.authType}
              disabled={disabled}
              onValueChange={(next) =>
                patch({
                  authType: (next === AUTH_AUTO_VALUE
                    ? ""
                    : next) as SmtpConnectionValue["authType"],
                })
              }>
              <SelectTrigger
                id={id("auth-type")}
                data-test={id("auth-type-select")}
                {...errorAttributes("authType", errors.authType)}
                className={errors.authType ? "border-destructive" : ""}>
                <SelectValue />
              </SelectTrigger>
              {/* Values are the stored spelling; PHPMailer's names are shown. */}
              <SelectContent>
                {SMTP_AUTH_TYPES.map((method) => (
                  <SelectItem
                    key={method || AUTH_AUTO_VALUE}
                    value={method || AUTH_AUTO_VALUE}>
                    {method === ""
                      ? __("Automatic", "pressedmail")
                      : method.toUpperCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.authType ? (
              <p
                id={id("auth-type-error")}
                className="text-xs text-destructive">
                {errors.authType}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                {__(
                  "Leave on Automatic unless the server rejects the login.",
                  "pressedmail",
                )}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("username")} className="text-xs font-medium">
              {__("Username", "pressedmail")}
            </Label>
            <Input
              id={id("username")}
              data-test={id("username-input")}
              autoComplete="off"
              value={value.username}
              disabled={disabled}
              {...errorAttributes("username", errors.username)}
              onChange={(e) => patch({ username: e.target.value })}
              className={errors.username ? "border-destructive" : ""}
            />
            {errors.username && (
              <p id={id("username-error")} className="text-xs text-destructive">
                {errors.username}
              </p>
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor={id("password")} className="text-xs font-medium">
              {__("Password", "pressedmail")}
            </Label>
            {!hasPassword || changingPassword || errors.password ? (
              <Input
                id={id("password")}
                name={id("smtp-secret")}
                data-test={id("password-input")}
                type="password"
                autoFocus={changingPassword}
                value={value.password}
                disabled={disabled}
                {...errorAttributes(
                  "password",
                  errors.password,
                  hasPassword ? [id("password-saved-hint")] : [],
                )}
                onChange={(e) => {
                  setChangingPassword(true);
                  patch({ password: e.target.value });
                }}
                {...sensitiveInputProps("sending-api-key")}
                autoComplete="new-password"
              />
            ) : (
              <Button
                id={id("password")}
                type="button"
                variant="outline"
                size="sm"
                data-test={id("change-password")}
                aria-label={__("Change password", "pressedmail")}
                aria-describedby={id("password-saved-hint")}
                disabled={disabled}
                onClick={() => setChangingPassword(true)}>
                {__("Change password", "pressedmail")}
              </Button>
            )}
            {hasPassword && (
              <p
                id={id("password-saved-hint")}
                className="text-xs text-muted-foreground">
                {changingPassword || errors.password
                  ? __("Leave blank to keep the saved password.", "pressedmail")
                  : __(
                      "The saved password will be kept unless you change it.",
                      "pressedmail",
                    )}
              </p>
            )}
            {errors.password && (
              <p id={id("password-error")} className="text-xs text-destructive">
                {errors.password}
              </p>
            )}
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor={id("from-email")} className="text-xs font-medium">
            {__("From email", "pressedmail")}
          </Label>
          {senderRow(0, value.fromEmail)}
          {errors.fromEmail && (
            <p id={id("from-email-error")} className="text-xs text-destructive">
              {errors.fromEmail}
            </p>
          )}
        </div>
        <div className="space-y-1">
          <Label htmlFor={id("from-name")} className="text-xs font-medium">
            {__("From name", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id={id("from-name")}
            data-test={id("from-name-input")}
            placeholder={__("WordPress", "pressedmail")}
            value={value.fromName}
            disabled={disabled}
            onChange={(e) => patch({ fromName: e.target.value })}
          />
        </div>
      </div>

      {capabilities.forceFrom && (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Checkbox
              id={id("force-from")}
              data-test={id("force-from")}
              checked={value.forceFrom === true}
              disabled={disabled}
              onCheckedChange={(checked) =>
                patch({ forceFrom: checked === true })
              }
            />
            <Label
              htmlFor={id("force-from")}
              className="cursor-pointer text-xs font-medium">
              {__("Force the From address", "pressedmail")}
            </Label>
          </div>
          <p className="text-xs text-muted-foreground">
            {__(
              "Replace the sender on every message, even when a plugin such as WooCommerce sets its own. Leave off to keep each plugin's own sender and only replace the WordPress default.",
              "pressedmail",
            )}
          </p>
        </div>
      )}

      {capabilities.routing && (
        <div className="space-y-2">
          <p id={addressesLabelId} className="text-xs font-medium">
            {__("Also send as", "pressedmail")}
          </p>
          {/* An emptied row is a removal: it is dropped when the form saves. */}
          {alternates.map((address, offset) => senderRow(offset + 1, address))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-test={id("add-sender")}
            disabled={disabled}
            onClick={() =>
              patch({ fromAddresses: [...(value.fromAddresses ?? []), ""] })
            }>
            <Plus className="mr-1 h-4 w-4" />
            {__("Add sender", "pressedmail")}
          </Button>
          {errors.fromAddresses ? (
            <p
              id={id("from-addresses-error")}
              className="text-xs text-destructive">
              {errors.fromAddresses}
            </p>
          ) : (
            <p id={addressesHelpId} className="text-xs text-muted-foreground">
              {__(
                "Each address here is another sender a template or a system email can choose. Mail sent from one uses this connection; clear an address to remove it.",
                "pressedmail",
              )}
            </p>
          )}
          {testing?.disabledReason ? (
            <p
              role="status"
              data-test={id("sender-testing-hint")}
              data-testid={id("sender-testing-hint")}
              className="text-xs text-muted-foreground">
              {testing.disabledReason}
            </p>
          ) : null}
        </div>
      )}
    </div>
  );
}
