import { __ } from "@wordpress/i18n";

import type {
  OAuthConnectProvider,
  OAuthConnectProviderLabels,
} from "./oauth-connect-provider-types";

const MICROSOFT_LABELS: OAuthConnectProviderLabels = {
  connect: __("Connect Microsoft Account", "pressedmail"),
  connected: __("Microsoft account connected", "pressedmail"),
  waiting: __("Waiting for Microsoft sign-in…", "pressedmail"),
};

export function getOAuthConnectProviderLabels(
  provider: OAuthConnectProvider,
): OAuthConnectProviderLabels | null {
  return provider === "microsoft" ? MICROSOFT_LABELS : null;
}
