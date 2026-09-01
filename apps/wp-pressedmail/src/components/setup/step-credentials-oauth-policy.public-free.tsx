import { __ } from "@wordpress/i18n";

import type { StepCredentialsOAuthPolicy } from "./step-credentials-oauth-policy.types";

const NoPrivacyNotice = () => null;

export const publicFreeStepCredentialsOAuthPolicy: StepCredentialsOAuthPolicy = {
  resolveProvider: (provider) =>
    provider === "outlook" ? "microsoft" : null,
  PrivacyNotice: NoPrivacyNotice,
  signInDescription: () =>
    __("Sign in with Microsoft. No password stored.", "pressedmail"),
  useOAuthLabel: () =>
    __("Use Microsoft sign-in instead", "pressedmail"),
};

export const stepCredentialsOAuthPolicy = publicFreeStepCredentialsOAuthPolicy;
