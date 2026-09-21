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
  /** Automatic jobs stay paused until an administrator approves this site. */
  automationPaused?: boolean;
  automationReviewUrl?: string;
  apiUrl?: string;
  adminAjaxUrl?: string;
  restNamespace?: string;
  assetsUrl?: string;
  /** Effective plugin-scoped UI locale ('' on first run → browser detect). */
  locale?: string;
  /** WordPress site timezone used for shared notification policy. */
  siteTimezone?: string;
  isAdmin?: boolean;
  canManageSettings?: boolean;
  canAccessPressedMail?: boolean;
  /**
   * True when this browser signed a user out and still holds that session's
   * mailbox data. PHP consumes the marker as it reports it, so this is true on
   * exactly one page load.
   */
  purgeBrowserStorage?: boolean;
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
    /**
     * PHP runtime limits. Every field is optional: the server reports the ones
     * the ini actually sets, and the panel omits a row it has no value for
     * rather than printing a blank one.
     */
    phpLimits?: {
      memory_usage?: string;
      memory_limit?: string;
      execution_time?: string;
      max_execution_time?: string;
      post_max_size?: string;
      upload_max_filesize?: string;
    };
    /**
     * Background-sync cadence. Absent on a partial upgrade (new bundle beside
     * an older server payload), so the panel must render without it.
     */
    syncSchedule?: {
      mode?: "scheduled" | "manual";
      intervalMinutes?: number;
      nextRun?: number;
      lastRun?: number;
      overdue?: boolean;
    };
    /** Per-worker schedule health plus the plugin's own wp-cron heartbeat. */
    cronHealth?: {
      workers?: Array<{
        hook: string;
        nextRun: number;
        intervalSeconds: number;
        events: number;
        overdue?: boolean;
        /** 0 means this worker has no completed run on record. */
        lastRun?: number;
      }>;
      wpCronDisabled?: boolean;
      dispatch?: {
        /** 0 means no pass has completed yet. */
        lastRun?: number;
        /** 0 means no recurrence is armed. */
        nextRun?: number;
        /**
         * Whether the site could reach its own WordPress address, or null when
         * the server had no reason to probe. False is the one state that means
         * wp-cron cannot start on a visit rather than "nobody visited".
         */
        loopback?: boolean | null;
        /** False means the scheduler is intentionally idle until a mailbox is connected. */
        hasMailbox?: boolean;
      };
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
  }
}

export {};
