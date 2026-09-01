import { __ } from "@wordpress/i18n";

import {
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Textarea,
} from "@kit/ui/plugin";

import { sensitiveInputProps } from "@/lib/sensitive-input-props";

import {
  SINGLE_CONNECTION_CAPABILITIES,
  type SmtpConnectionCapabilities,
  type SmtpConnectionFormErrors,
  type SmtpConnectionValue,
} from "./types";

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
}

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
}: SmtpConnectionFormProps) {
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

  const showLabel = capabilities.routing || capabilities.fallback;

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
            <Input
              id={id("password")}
              data-test={id("password-input")}
              type="password"
              placeholder={
                hasPassword ? __("•••••••• (saved)", "pressedmail") : undefined
              }
              value={value.password}
              disabled={disabled}
              {...errorAttributes(
                "password",
                errors.password,
                hasPassword ? [id("password-saved-hint")] : [],
              )}
              onChange={(e) => patch({ password: e.target.value })}
              {...sensitiveInputProps("sending-api-key")}
            />
            {hasPassword && (
              <p
                id={id("password-saved-hint")}
                className="text-xs text-muted-foreground">
                {__("Leave blank to keep the saved password.", "pressedmail")}
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
          <Input
            autoComplete="off"
            id={id("from-email")}
            data-test={id("from-email-input")}
            type="email"
            placeholder={__("wordpress@example.com", "pressedmail")}
            value={value.fromEmail}
            disabled={disabled}
            {...errorAttributes("from-email", errors.fromEmail)}
            onChange={(e) => patch({ fromEmail: e.target.value })}
            className={errors.fromEmail ? "border-destructive" : ""}
          />
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
        <div className="space-y-1">
          <Label htmlFor={id("from-addresses")} className="text-xs font-medium">
            {__("Send these From addresses through this server", "pressedmail")}
          </Label>
          <Textarea
            autoComplete="off"
            id={id("from-addresses")}
            data-test={id("from-addresses-input")}
            rows={3}
            placeholder={"orders@example.com\nbilling@example.com"}
            value={(value.fromAddresses ?? []).join("\n")}
            disabled={disabled}
            {...errorAttributes(
              "from-addresses",
              errors.fromAddresses,
              errors.fromAddresses ? [] : [id("from-addresses-help")],
            )}
            onChange={(e) =>
              patch({
                fromAddresses: e.target.value
                  .split("\n")
                  .map((line) => line.trim())
                  .filter((line) => line !== ""),
              })
            }
            className={errors.fromAddresses ? "border-destructive" : ""}
          />
          {errors.fromAddresses ? (
            <p
              id={id("from-addresses-error")}
              className="text-xs text-destructive">
              {errors.fromAddresses}
            </p>
          ) : (
            <p
              id={id("from-addresses-help")}
              className="text-xs text-muted-foreground">
              {__(
                "One address per line. Mail sent from an address listed here uses this connection; everything else uses the default connection.",
                "pressedmail",
              )}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
