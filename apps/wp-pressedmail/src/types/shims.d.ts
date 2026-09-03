import type { EffectiveWhitelabelRuntime } from "./whitelabel";
import type { ManagedDomainSetupRuntime } from "./domain-policy";

declare module "tailwindcss/types/config" {
  export interface Config {
    [key: string]: unknown;
  }

  export type TailwindConfig = Config;

  const config: Config;
  export default config;
}

declare module "tailwindcss/types/generated/default-theme" {
  export interface DefaultTheme {
    [key: string]: unknown;
  }

  const theme: DefaultTheme;
  export default theme;
}

declare module "lodash" {
  export type DebouncedFunc<
    T extends (...args: any[]) => any = (...args: any[]) => any,
  > = (...args: Parameters<T>) => ReturnType<T>;

  const lodash: any;
  export default lodash;
}

// SVG types are declared in src/vite-env.d.ts

interface PressedMailPluginGlobal {
  apiUrl?: string;
  adminAjaxUrl?: string;
  restNamespace?: string;
  assetsUrl?: string;
  developer?: string;
  /** Effective plugin-scoped UI locale ('' on first run → browser detect). */
  locale?: string;
  /** WordPress site timezone used for shared notification policy. */
  siteTimezone?: string;
  isAdmin?: boolean;
  canManageSettings?: boolean;
  canAccessPressedMail?: boolean;
  isPro?: boolean | string;
  isLicensed?: boolean;
  /** Server-resolved custom_themes entitlement for the theme provider. */
  customThemesEnabled?: boolean | string;
  /**
   * Synchronous security-block status (admin user-switching / impersonation).
   * Injected by PHP at boot so the SPA can render a graceful notice and load
   * no folders instead of cascading IMAP-backed 403/404/500s. `access_allowed`
   * already folds in the user's protection setting.
   */
  impersonation?: {
    access_allowed?: boolean;
    is_user_switching?: boolean;
    blocked_reason?: string | null;
    blocked_message?: string;
  };
  /**
   * Synchronous PressedMail Lock status for the CURRENT browser session.
   * Injected by PHP at boot so a locked session renders the LockGate on
   * first paint (no flash, no status round-trip).
   */
  lock?: {
    enabled?: boolean;
    locked?: boolean;
    timeout_seconds?: number;
    migration_prompt?: boolean;
  };
  licenseStatus?: "active" | "inactive" | "expired" | "no_license";
  /**
   * Why the license is currently invalid (server reason code + message),
   * persisted when a signed rejection deactivates the license. Empty object
   * or absent while licensed.
   */
  licenseReason?: {
    code?: string;
    message?: string;
  };
  version?: string;
  userInfo?: {
    username: string;
    avatar: string;
    userId: number;
    displayName: string;
    email: string;
  };
  wpApiSettings?: {
    root: string;
    nonce: string;
  };
  userCapabilities?: string[];
  whitelabel?: EffectiveWhitelabelRuntime | null;
  aiEnabled?: boolean;
  aiApiKeyConfigured?: boolean;
  useCustomUpdates?: boolean;
  managedDomainSetup?: ManagedDomainSetupRuntime;
  providerGate?: {
    gmailOAuth?: boolean;
    comingSoonProviders?: string[];
  };
  systemDiagnostics?: {
    warnings: string[];
    imapDriver: {
      driver: string;
      native_available: boolean;
      description: string;
    };
    extensions: Record<
      string,
      {
        name: string;
        required: boolean;
        loaded: boolean;
        description: string;
        install_cmd: string;
      }
    >;
    phpVersion: {
      current: string;
      required: string;
      is_met: boolean;
    };
    wpVersion: {
      current: string;
      required: string;
      is_met: boolean;
    };
    memory: {
      current: string;
      recommended: string;
      is_adequate: boolean;
    };
  };
}

interface PressedMailFrontendGlobal {
  apiUrl?: string;
  nonce?: string;
  user_id?: number;
  routePrefix?: string;
  isRTL?: boolean;
  locale?: string;
  i18n?: Record<string, unknown>;
  isPro?: boolean | string;
}

declare global {
  interface Window {
    pressedmailPlugin?: PressedMailPluginGlobal;
    pressedmail?: PressedMailFrontendGlobal;
    /** Server-injected Jed locale-data for the active plugin locale. */
    pressedmailLocaleData?: Record<string, unknown>;
  }
}

export {};
