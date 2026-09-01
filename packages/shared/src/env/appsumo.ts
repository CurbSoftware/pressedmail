export interface AppSumoOAuthEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  licensingApiBaseUrl: string;
}

export interface AppSumoWebhookEnv {
  apiKey: string;
}

function readNonEmptyEnv(name: string): string | null {
  const value = process.env[name]?.trim();

  return value ? value : null;
}

/**
 * The single shared secret AppSumo issues per product. The Partner Portal calls
 * it the "private key" and it does double duty: the HMAC key for webhook
 * signatures and the bearer token for Licensing API calls.
 *
 * `APPSUMO_PARTNERS_PRIVATE_KEY` is the deployed name and matches the portal's
 * own label; `APPSUMO_API_KEY` is accepted as a fallback so an environment set
 * up under the older name keeps working.
 */
export function readAppSumoSharedSecret(): string | null {
  return (
    readNonEmptyEnv('APPSUMO_PARTNERS_PRIVATE_KEY') ??
    readNonEmptyEnv('APPSUMO_API_KEY')
  );
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

export function readAppSumoOAuthEnv(): AppSumoOAuthEnv | null {
  const clientId = readNonEmptyEnv('APPSUMO_OAUTH_CLIENT_ID');
  const clientSecret = readNonEmptyEnv('APPSUMO_OAUTH_CLIENT_SECRET');
  const redirectUri = readUrlEnv('APPSUMO_OAUTH_REDIRECT_URI');
  const licensingApiBaseUrl =
    readUrlEnv('APPSUMO_LICENSING_API_BASE_URL') ?? 'https://appsumo.com/';

  if (!clientId || !clientSecret || !redirectUri) {
    return null;
  }

  return {
    clientId,
    clientSecret,
    redirectUri,
    licensingApiBaseUrl,
  };
}

export function readAppSumoWebhookEnv(): AppSumoWebhookEnv | null {
  const apiKey = readAppSumoSharedSecret();

  if (!apiKey) {
    return null;
  }

  return { apiKey };
}

export function isAppSumoTestDispatchEnabled(): boolean {
  return process.env.APPSUMO_ALLOW_TEST_DISPATCH === 'true';
}