import { __, sprintf } from "@wordpress/i18n";
import { Lightbulb, Shield } from "lucide-react";

import { Button, Input, Label } from "@kit/ui/plugin";

import { sensitiveInputProps } from "@/lib/sensitive-input-props";
import { OAuthConnectButton } from "../OAuthConnectButton";
import { stepCredentialsOAuthPolicy } from "@/components/setup/step-credentials-oauth-policy.active";
import type { StepCredentialsOAuthPolicy } from "../step-credentials-oauth-policy.types";
import { getProviderGuidance } from "../provider-guidance";
import { ProviderGuidance } from "../ProviderGuidance";
import {
  detectProviderFromEmail,
  PROVIDERS,
} from "@/components/setup/providers";
import type { ProviderKey, SetupFormData, SetupFormErrors } from "../types";

export interface MicrosoftOAuthWiring {
  /** OAuth mail sign-in feature available (both editions). */
  available: boolean;
  /** The popup flow finished and pending tokens are waiting server-side. */
  connected: boolean;
  /** Auth method the user picked for OAuth-capable providers. */
  method: "oauth" | "password";
  onMethodChange: (method: "oauth" | "password") => void;
  /** Existing account id for reconnect flows. */
  accountId?: number;
  /** Receives the provider-verified mailbox address ('' when unknown). */
  onConnected: (email: string) => void;
  onError?: (message: string) => void;
}

export interface StepCredentialsProps {
  isEditing: boolean;
  isCustomDomainMode: boolean;
  formData: SetupFormData;
  setFormData: React.Dispatch<React.SetStateAction<SetupFormData>>;
  errors: SetupFormErrors;
  onEmailChange: (email: string) => void;
  /** Switches the wizard to a detected preset provider (refreshes server settings). */
  onSwitchProvider?: (provider: ProviderKey) => void;
  /** Admin allow-list; empty/undefined means every provider is allowed. */
  allowedProviders?: string[];
  /** Microsoft OAuth flow wiring (outlook provider only). */
  microsoftOAuth?: MicrosoftOAuthWiring;
}

function getSuggestedProvider(
  formData: SetupFormData,
  isEditing: boolean,
  allowedProviders: string[] | undefined,
  onSwitchProvider: ((provider: ProviderKey) => void) | undefined,
): ProviderKey | null {
  if (!onSwitchProvider || isEditing) {
    return null;
  }
  const detected = detectProviderFromEmail(formData.email);
  if (!detected || detected === formData.provider) {
    return null;
  }
  if (
    allowedProviders &&
    allowedProviders.length > 0 &&
    !allowedProviders.includes(detected)
  ) {
    return null;
  }
  return detected;
}

export function StepCredentialsWithPolicy({
  oauthPolicy,
  isEditing,
  isCustomDomainMode,
  formData,
  setFormData,
  errors,
  onEmailChange,
  onSwitchProvider,
  allowedProviders,
  microsoftOAuth,
}: StepCredentialsProps & { oauthPolicy: StepCredentialsOAuthPolicy }) {
  const oauthProvider = formData.provider
    ? oauthPolicy.resolveProvider(formData.provider)
    : null;
  const oauthCapable = Boolean(oauthProvider && microsoftOAuth?.available);
  // Either/or: with OAuth chosen, no email/password typing at all, the
  // provider-verified identity fills the address after sign-in.
  const oauthMode = oauthCapable && microsoftOAuth?.method !== "password";
  const showEmailInput = !oauthMode || (microsoftOAuth?.connected ?? false);
  const showPasswordBlock =
    (formData.provider !== "custom" || isCustomDomainMode) &&
    !oauthMode &&
    (!oauthCapable || formData?.useOAuth === false);
  const providerGuidance = getProviderGuidance(
    formData.provider,
    formData.email,
  );
  const suggestedProvider = getSuggestedProvider(
    formData,
    isEditing,
    allowedProviders,
    onSwitchProvider,
  );
  const suggestedProviderName = suggestedProvider
    ? PROVIDERS[suggestedProvider].name
    : "";

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <Shield className="h-12 w-12 text-primary mx-auto" />
        <h2 className="text-2xl font-bold">
          {isEditing
            ? __("Update Account Credentials", "pressedmail")
            : __("Account Credentials", "pressedmail")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {__("Enter your email credentials", "pressedmail")}
        </p>
      </div>

      {formData.provider && providerGuidance && !oauthMode && (
        <ProviderGuidance guidance={providerGuidance} />
      )}

      <div className="space-y-4">
        {showEmailInput && (
          <div className="space-y-2">
            <Label htmlFor="email">{__("Email Address", "pressedmail")}</Label>
            <Input
              autoComplete="off"
              id="email"
              data-test="email-input"
              type="email"
              placeholder={__("your-email@example.com", "pressedmail")}
              value={formData.email}
              readOnly={oauthMode && Boolean(formData.email)}
              onChange={(e) => {
                const email = e.target.value;
                setFormData((prev) => ({ ...prev, email }));
                onEmailChange(email);
              }}
              className={
                errors.email
                  ? "border-destructive"
                  : oauthMode && formData.email
                    ? "bg-muted"
                    : ""
              }
            />
            {oauthMode && formData.email && (
              <p className="text-xs text-muted-foreground">
                {__("Imported from your sign-in", "pressedmail")}
              </p>
            )}
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email}</p>
            )}
            {suggestedProvider && !oauthMode && (
              <div
                data-test="provider-suggestion"
                data-testid="provider-suggestion"
                className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                <Lightbulb
                  className="h-4 w-4 shrink-0 text-primary"
                  aria-hidden="true"
                />
                <span className="flex-1">
                  {sprintf(
                    /* translators: %s: detected email provider name */
                    __(
                      "This looks like a %s address. Use its preset for the right server settings?",
                      "pressedmail",
                    ),
                    suggestedProviderName,
                  )}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  data-test="provider-suggestion-switch"
                  onClick={() => onSwitchProvider?.(suggestedProvider)}>
                  {sprintf(
                    /* translators: %s: detected email provider name */
                    __("Use the %s preset", "pressedmail"),
                    suggestedProviderName,
                  )}
                </Button>
              </div>
            )}
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="displayName">
            {__("Display Name", "pressedmail")}
          </Label>
          <Input
            autoComplete="off"
            id="displayName"
            data-test="display-name-input"
            placeholder={__("Your Name", "pressedmail")}
            value={formData.displayName}
            onChange={(e) =>
              setFormData((prev) => ({
                ...prev,
                displayName: e.target.value,
              }))
            }
            className={errors.displayName ? "border-destructive" : ""}
          />
          {errors.displayName && (
            <p className="text-sm text-destructive">{errors.displayName}</p>
          )}
        </div>

        {oauthMode && oauthProvider && microsoftOAuth && (
          <div
            className="space-y-2"
            data-test="oauth-signin-section"
            data-testid="oauth-signin-section">
            <oauthPolicy.PrivacyNotice provider={oauthProvider} />
            <OAuthConnectButton
              provider={oauthProvider}
              connected={microsoftOAuth.connected}
              email={formData.email}
              accountId={microsoftOAuth.accountId}
              onConnected={microsoftOAuth.onConnected}
              onError={microsoftOAuth.onError}
            />
            <p className="text-xs text-muted-foreground">
              {oauthPolicy.signInDescription(oauthProvider)}
            </p>
            {errors.password && (
              <p role="alert" className="text-sm text-destructive">
                {errors.password}
              </p>
            )}
            {!microsoftOAuth.connected && (
              <button
                type="button"
                data-test="use-password-instead"
                data-testid="use-password-instead"
                className="text-xs font-medium text-primary underline underline-offset-2"
                onClick={() => microsoftOAuth.onMethodChange("password")}>
                {__("Use an email and app password instead", "pressedmail")}
              </button>
            )}
          </div>
        )}

        {oauthCapable && !oauthMode && microsoftOAuth && (
          <button
            type="button"
            data-test="use-oauth-instead"
            data-testid="use-oauth-instead"
            className="text-xs font-medium text-primary underline underline-offset-2"
            onClick={() => microsoftOAuth.onMethodChange("oauth")}>
            {oauthProvider ? oauthPolicy.useOAuthLabel(oauthProvider) : null}
          </button>
        )}

        {showPasswordBlock && (
          <div className="space-y-2">
            <Label htmlFor="password">
              {__("Password / App Password", "pressedmail")}
            </Label>
            <Input
              id="password"
              data-test="password-input"
              type="password"
              name="pressedmail-mail-account-password"
              placeholder={__(
                "Your password or app-specific password",
                "pressedmail",
              )}
              {...sensitiveInputProps("mail-account-password")}
              value={formData.password}
              onChange={(e) =>
                setFormData((prev) => ({
                  ...prev,
                  password: e.target.value,
                }))
              }
              className={errors.password ? "border-destructive" : ""}
            />
            {errors.password && (
              <p className="text-sm text-destructive">{errors.password}</p>
            )}
            <p className="text-xs text-muted-foreground">
              {isCustomDomainMode
                ? __("Enter your email account password", "pressedmail")
                : __(
                    "For Gmail/Outlook, use an app-specific password instead of your regular password",
                    "pressedmail",
                  )}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export function StepCredentials(props: StepCredentialsProps) {
  return (
    <StepCredentialsWithPolicy
      {...props}
      oauthPolicy={stepCredentialsOAuthPolicy}
    />
  );
}
