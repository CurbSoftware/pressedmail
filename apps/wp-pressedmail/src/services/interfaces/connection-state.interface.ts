/**
 * Connection State Service Interface
 *
 * Tracks per-account IMAP connection health.
 * Implements circuit breaker pattern to prevent cascading failures
 * when authentication or connection errors occur.
 *
 * @since 2.5.0
 */

/**
 * Server-reported account auth status, tracked SEPARATELY from the transport
 * circuit breaker. `auth_failed`/`config_error` are permanent failures the
 * backend already knows about (bad/expired credentials, broken config); the UI
 * surfaces them as a banner WITHOUT gating the always-available DB-mirror reads.
 */
export type AuthStatus = "ok" | "auth_failed" | "config_error";

/**
 * Per-account connection health state.
 */
export interface ConnectionHealth {
  /** Current connection status */
  status: "unknown" | "healthy" | "unhealthy";
  /** Timestamp of last health check */
  lastChecked: number;
  /** Last error message (if unhealthy) */
  lastError?: string;
  /** Consecutive failure count */
  failureCount: number;
  /** HTTP status code of last failure */
  httpStatus?: number;
  /** Timestamp until which requests are blocked (exponential backoff) */
  cooldownUntil?: number;
  /**
   * Server-reported account auth status, INDEPENDENT of the transport breaker.
   * Fed by applyServerHealth() from the folder-payload health so the banner can
   * show an auth failure even though the mirror read still succeeds. Absent =
   * never reported (assumed ok).
   */
  authStatus?: AuthStatus;
  /** Human-readable reason for a non-ok authStatus. */
  authMessage?: string;
}

/**
 * Error thrown when circuit breaker is open (account unhealthy).
 */
export class CircuitBreakerError extends Error {
  readonly accountId: string;
  readonly health: ConnectionHealth;

  constructor(accountId: string, health: ConnectionHealth) {
    super(
      `Circuit breaker open for account ${accountId}: ${health.lastError ?? "authentication failed"}`,
    );
    this.name = "CircuitBreakerError";
    this.accountId = accountId;
    this.health = health;
  }
}

/**
 * HTTP status codes that indicate authentication failure (non-retryable).
 */
export const AUTH_ERROR_STATUSES = new Set([401, 403]);

/**
 * Error message patterns that indicate authentication failure.
 */
export const AUTH_ERROR_PATTERNS = [
  "authentication failed",
  "authenticationfailed",
  "invalid credentials",
  "login failed",
  "unauthorized",
  "access denied",
  "auth_failed",
  "oauth",
] as const;

/**
 * IConnectionStateService Interface
 *
 * Circuit breaker for IMAP connections. After an auth failure,
 * blocks subsequent requests for the same account until cooldown
 * expires or user manually retries.
 */
export interface IConnectionStateService {
  /** Map of account ID → connection health */
  readonly healthStates: ReadonlyMap<string, ConnectionHealth>;

  /**
   * Check if an account's connection is considered healthy enough to attempt.
   * Returns false if account is unhealthy AND still within cooldown period.
   */
  isHealthy(accountId: string): boolean;

  /**
   * Mark an account connection as unhealthy after a failure.
   * Sets exponential backoff cooldown (60s, 120s, 240s).
   */
  markUnhealthy(accountId: string, reason: string, httpStatus?: number): void;

  /**
   * Mark an account connection as healthy after a successful operation.
   * Resets failure count and clears cooldown.
   */
  markHealthy(accountId: string): void;

  /**
   * Get the current health state for an account.
   */
  getHealth(accountId: string): ConnectionHealth;

  /**
   * Reset health state for an account (user-initiated retry).
   * Sets status to "unknown" and clears cooldown, allowing the next request.
   */
  resetHealth(accountId: string): void;

  /**
   * Apply a server-reported account connection_health so the client agrees with
   * the backend WITHOUT waiting for a failed request. This records a per-account
   * auth STATUS ONLY. It MUST NOT open the transport circuit breaker. IMAP auth
   * state never gates the DB-mirror reads (the mirror needs no IMAP): the breaker
   * is exclusively for OBSERVED transport failures. `auth_failed`/`config_error`
   * set the auth status (surfaced by the banner); `ok` clears it. Unknown/missing
   * values leave the current status untouched. Idempotent per poll.
   */
  applyServerHealth(accountId: string, health?: string | null): void;

  /**
   * Current server-reported auth status for an account (`ok` when never reported
   * a failure). Read by the connection banner so an auth failure surfaces even
   * while the mirror read succeeds.
   */
  getAuthStatus(accountId: string): AuthStatus;

  /**
   * Record a 409 CREDENTIALS_REQUIRED conflict for an account (no usable stored
   * mailbox secret). Kept OUTSIDE the health map: it must survive the accounts
   * poll (`applyServerHealth("degraded")` is exactly what a secret-less account
   * reports) and must never open the transport circuit breaker. Surfaced by the
   * connection banner as a persistent "update credentials" prompt. Cleared by
   * `resetHealth`, `applyServerHealth("ok")`, or `clearCredentialsRequired`.
   */
  markCredentialsRequired(accountId: string, message: string): void;

  /** Withdraw a recorded credentials-required prompt for an account. */
  clearCredentialsRequired(accountId: string): void;

  /** The recorded credentials-required message for an account, or `null`. */
  getCredentialsRequired(accountId: string): string | null;

  /**
   * Set a SESSION-WIDE error (not tied to one account) surfaced by the in-app sync
   * driver: an expired login/nonce that no request could heal (`SessionExpiredError` /
   * a permission `403`), or repeated advance failures. Idempotent for the same reason so
   * it will not re-notify every poll. Consumed by the connection banner as a fallback when
   * there is no per-account error.
   */
  markSessionError(reason: string): void;

  /** Clear the session-wide error (a successful advance/refresh). */
  clearSessionError(): void;

  /** Current session-wide error reason, or `null`. */
  getSessionError(): string | null;

  /**
   * Set an INFO-level "background sync delayed" hint (NOT an error). Surfaced by the sync
   * driver when the server is slow-but-working (repeated advance timeouts) or the background
   * queue is backing up (a starved wp-cron loopback), the app is still making progress in the
   * foreground, so this must never be a session error and never gate reads. Idempotent per
   * reason so a sustained condition does not re-notify each poll.
   */
  markSyncDelayed(reason: string): void;

  /** Clear the "background sync delayed" hint (the delay condition recovered). */
  clearSyncDelayed(): void;

  /** Current "background sync delayed" hint reason, or `null`. */
  getSyncDelayed(): string | null;

  /**
   * Wrap an async operation with circuit breaker logic.
   * - If account is unhealthy + in cooldown: throws CircuitBreakerError immediately
   * - On success: marks account healthy
   * - On auth error: marks account unhealthy
   * - On other errors: rethrows without marking unhealthy
   */
  withCircuitBreaker<T>(
    accountId: string,
    operation: () => Promise<T>,
  ): Promise<T>;

  // useSyncExternalStore support
  subscribe(listener: () => void): () => void;
  getSnapshot(): number;
}
