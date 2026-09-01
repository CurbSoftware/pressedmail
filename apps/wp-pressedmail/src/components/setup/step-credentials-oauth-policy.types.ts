import type { ComponentType } from "react";

import type { ProviderKey } from "./types";
import type { OAuthConnectProvider } from "./oauth-connect-provider-types";

export interface StepCredentialsOAuthPolicy {
  resolveProvider: (provider: ProviderKey) => OAuthConnectProvider | null;
  PrivacyNotice: ComponentType<{ provider: OAuthConnectProvider }>;
  signInDescription: (provider: OAuthConnectProvider) => string;
  useOAuthLabel: (provider: OAuthConnectProvider) => string;
}
