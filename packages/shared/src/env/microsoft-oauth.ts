export interface MicrosoftOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** HMAC secret for relay state tokens; falls back to the client secret. */
  stateSecret: string;
}

export interface OAuthRelayEnvNames {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  stateSecret: string;
}

function readNonEmptyEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

function readUrlEnv(name: string): string | null {
  const value = readNonEmptyEnv(name);

  if (!value) {
    return null;
  }

  try {
    return new URL(value).toString();
  } catch {
    return null;
  }
}

/**
 * Microsoft Entra app credentials for the pressedmail.com OAuth relay.
 * Returns null when the relay is not configured (routes respond 503).
 */
export function readMicrosoftOAuthEnv(): MicrosoftOAuthEnv | null {
  return readOAuthRelayEnv({
    clientId: 'MICROSOFT_OAUTH_CLIENT_ID',
    clientSecret: 'MICROSOFT_OAUTH_CLIENT_SECRET',
    redirectUri: 'MICROSOFT_OAUTH_REDIRECT_URI',
    stateSecret: 'MICROSOFT_OAUTH_STATE_SECRET',
  });
}

/**
 * Read one relay's credentials from caller-selected environment names.
 * Provider-specific names stay with the application that enables the provider.
 */
export function readOAuthRelayEnv(
  names: OAuthRelayEnvNames,
): MicrosoftOAuthEnv | null {
  const clientId = readNonEmptyEnv(names.clientId);
  const clientSecret = readNonEmptyEnv(names.clientSecret);
  const redirectUri = readUrlEnv(names.redirectUri);

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    stateSecret: readNonEmptyEnv(names.stateSecret) ?? clientSecret,
  };
}
