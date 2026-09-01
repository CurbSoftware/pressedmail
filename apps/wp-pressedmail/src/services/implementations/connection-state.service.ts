/**
 * Connection State Service Implementation
 *
 * Circuit breaker for IMAP connections. Tracks per-account health
 * and blocks requests when authentication has failed, preventing
 * cascading failures.
 *
 * @since 2.5.0
 */

import type {
  IConnectionStateService,
  ConnectionHealth,
  AuthStatus,
} from "../interfaces/connection-state.interface";
import {
  CircuitBreakerError,
  AUTH_ERROR_STATUSES,
  AUTH_ERROR_PATTERNS,
} from "../interfaces/connection-state.interface";
import {
  CREDENTIALS_REQUIRED_FALLBACK_MESSAGE,
  subscribeCredentialsRequired,
} from "@/lib/credentials-required-events";

/** Base cooldown after first failure (60 seconds). */
const BASE_COOLDOWN_MS = 60_000;

/** Maximum cooldown cap (5 minutes). */
const MAX_COOLDOWN_MS = 300_000;

/**
 * Default health state for unknown accounts.
 */
function createDefaultHealth(): ConnectionHealth {
  return {
    status: "unknown",
    lastChecked: 0,
    failureCount: 0,
  };
}

/**
 * Check if an error message indicates an authentication failure.
 */
export function isAuthError(errorMessage?: string | null): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return AUTH_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

/**
 * Check if an HTTP status indicates an authentication failure.
 */
export function isAuthStatus(status?: number | null): boolean {
  if (!status) return false;
  return AUTH_ERROR_STATUSES.has(status);
}

/**
 * Connection error patterns that indicate the server is unreachable
 * (not an auth problem, but a transient/network issue).
 */
const CONNECTION_ERROR_PATTERNS = [
  "unable to connect",
  "cannot connect",
  "connection refused",
  "econnrefused",
  "econnreset",
  "etimedout",
  "timeout",
  "timed out",
  "network error",
  "failed to connect",
  "connection failed",
  "circuit breaker open",
  "temporarily unavailable",
  // Host resolution / DNS: real reasons now surfaced by the IMAP driver.
  "could not resolve",
  "host not found",
  "no such host",
  "name or service not known",
  "getaddrinfo",
  "network is unreachable",
  "unreachable",
  // Certificate verification failures (not auth, but the server is reachable).
  "certificate",
] as const;

/**
 * Check if an error message indicates a connection/network failure.
 */
export function isConnectionError(errorMessage?: string | null): boolean {
  if (!errorMessage) return false;
  const lower = errorMessage.toLowerCase();
  return CONNECTION_ERROR_PATTERNS.some((pattern) => lower.includes(pattern));
}

/** Shorter cooldown for transient connection errors (15 seconds). */
const TRANSIENT_COOLDOWN_MS = 15_000;

/**
 * Connection State Service
 */
export class ConnectionStateService implements IConnectionStateService {
  private _healthStates = new Map<string, ConnectionHealth>();
  private _listeners = new Set<() => void>();
  private _version = 0;
  private _sessionError: string | null = null;
  private _syncDelayed: string | null = null;
  private _credentialsRequired = new Map<string, string>();

  // ============== State Accessors ==============

  get healthStates(): ReadonlyMap<string, ConnectionHealth> {
    return this._healthStates;
  }

  // ============== Health Checks ==============

  isHealthy(accountId: string): boolean {
    const health = this._healthStates.get(accountId);

    // Unknown accounts are assumed healthy (first attempt)
    if (!health || health.status === "unknown") return true;
    if (health.status === "healthy") return true;

    // Unhealthy: check if cooldown has expired
    if (health.cooldownUntil && Date.now() >= health.cooldownUntil) {
      // Cooldown expired, allow retry but don't reset status
      return true;
    }

    return false;
  }

  markUnhealthy(accountId: string, reason: string, httpStatus?: number): void {
    const existing = this._healthStates.get(accountId) ?? createDefaultHealth();
    const failureCount = existing.failureCount + 1;

    // Exponential backoff: 60s, 120s, 240s, capped at 5min
    const cooldownMs = Math.min(
      BASE_COOLDOWN_MS * Math.pow(2, failureCount - 1),
      MAX_COOLDOWN_MS,
    );

    this._healthStates.set(accountId, {
      status: "unhealthy",
      lastChecked: Date.now(),
      lastError: reason,
      failureCount,
      httpStatus,
      cooldownUntil: Date.now() + cooldownMs,
    });

    this.notify();
  }

  /**
   * Mark account as temporarily unhealthy due to connection errors.
   * Uses a fixed short cooldown (15s) with no exponential backoff,
   * since transient network issues typically resolve quickly.
   */
  markUnhealthyTransient(accountId: string, reason: string): void {
    this._healthStates.set(accountId, {
      status: "unhealthy",
      lastChecked: Date.now(),
      lastError: reason,
      failureCount: 1,
      cooldownUntil: Date.now() + TRANSIENT_COOLDOWN_MS,
    });

    this.notify();
  }

  markHealthy(accountId: string): void {
    const existing = this._healthStates.get(accountId);

    // Only notify if state actually changed
    if (existing?.status === "healthy" && existing.failureCount === 0) return;

    this._healthStates.set(accountId, {
      status: "healthy",
      lastChecked: Date.now(),
      failureCount: 0,
    });

    this.notify();
  }

  getHealth(accountId: string): ConnectionHealth {
    return this._healthStates.get(accountId) ?? createDefaultHealth();
  }

  resetHealth(accountId: string): void {
    this._healthStates.set(accountId, {
      status: "unknown",
      lastChecked: Date.now(),
      failureCount: 0,
    });
    // A user-initiated retry withdraws the credentials prompt; the next
    // secret-less write re-announces it via the api-client event.
    this._credentialsRequired.delete(accountId);

    this.notify();
  }

  applyServerHealth(accountId: string, health?: string | null): void {
    // IMAP auth state must NEVER gate the DB-mirror reads (the mirror needs no
    // IMAP). So a server-reported health records a per-account auth STATUS only,
    // it must not open the transport circuit breaker. The breaker stays reserved
    // for OBSERVED transport failures (see withCircuitBreaker). Idempotent per
    // poll: a no-op change never re-notifies.
    const current = this.getHealth(accountId);

    let nextAuthStatus: ConnectionHealth["authStatus"];
    let nextAuthMessage: string | undefined;

    switch (health) {
      case "auth_failed":
      case "config_error":
        nextAuthStatus = health;
        nextAuthMessage = `account ${health}`;
        break;
      case "ok":
        // A clean bill of health means the credentials work again; withdraw
        // any standing credentials-required prompt. `degraded` must NOT clear
        // it, that is exactly what the server reports while the secret is
        // missing, and clearing here would hide the prompt on the next poll.
        if (this._credentialsRequired.delete(accountId)) {
          this.notify();
        }
        nextAuthStatus = "ok";
        break;
      case "degraded":
        // A reachable-but-degraded account is not an auth failure; treat it as ok
        // for auth-status purposes (transient transport issues surface via the
        // breaker on an actual observed failure, not here).
        nextAuthStatus = "ok";
        break;
      default:
        // Unknown / missing health, leave the current auth status untouched.
        return;
    }

    if (
      current.authStatus === nextAuthStatus &&
      current.authMessage === nextAuthMessage
    ) {
      return;
    }

    this._healthStates.set(accountId, {
      ...current,
      authStatus: nextAuthStatus,
      ...(nextAuthMessage !== undefined
        ? { authMessage: nextAuthMessage }
        : { authMessage: undefined }),
    });
    this.notify();
  }

  getAuthStatus(accountId: string): AuthStatus {
    return this._healthStates.get(accountId)?.authStatus ?? "ok";
  }

  // ============== Credentials required (409 CREDENTIALS_REQUIRED) ==============

  markCredentialsRequired(accountId: string, message: string): void {
    // Recorded OUTSIDE the health map: it must survive applyServerHealth
    // (which reports `degraded` for a secret-less account) and must never
    // open the transport circuit breaker, DB-mirror reads need no IMAP.
    // Idempotent per message so repeated failed writes don't re-notify.
    if (this._credentialsRequired.get(accountId) === message) return;
    this._credentialsRequired.set(accountId, message);
    this.notify();
  }

  clearCredentialsRequired(accountId: string): void {
    if (this._credentialsRequired.delete(accountId)) {
      this.notify();
    }
  }

  getCredentialsRequired(accountId: string): string | null {
    return this._credentialsRequired.get(accountId) ?? null;
  }

  // ============== Session-wide error (sync driver) ==============

  markSessionError(reason: string): void {
    // Idempotent per reason so repeated advance failures don't re-notify each poll.
    if (this._sessionError === reason) return;
    this._sessionError = reason;
    this.notify();
  }

  clearSessionError(): void {
    if (this._sessionError === null) return;
    this._sessionError = null;
    this.notify();
  }

  getSessionError(): string | null {
    return this._sessionError;
  }

  // ============== Background-sync delayed hint (info, not error) ==============

  markSyncDelayed(reason: string): void {
    // Idempotent per reason so a sustained delay does not re-notify each poll.
    if (this._syncDelayed === reason) return;
    this._syncDelayed = reason;
    this.notify();
  }

  clearSyncDelayed(): void {
    if (this._syncDelayed === null) return;
    this._syncDelayed = null;
    this.notify();
  }

  getSyncDelayed(): string | null {
    return this._syncDelayed;
  }

  // ============== Circuit Breaker ==============

  async withCircuitBreaker<T>(
    accountId: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    // Check circuit breaker before attempting operation
    if (!this.isHealthy(accountId)) {
      const health = this.getHealth(accountId);
      throw new CircuitBreakerError(accountId, health);
    }

    try {
      const result = await operation();
      this.markHealthy(accountId);
      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      // Extract HTTP status if available
      const httpStatus = this.extractHttpStatus(error);

      // Mark unhealthy for auth errors (long cooldown with backoff)
      if (isAuthError(errorMessage) || isAuthStatus(httpStatus)) {
        this.markUnhealthy(accountId, errorMessage, httpStatus ?? undefined);
      }
      // Mark unhealthy for connection errors (short 15s cooldown)
      else if (isConnectionError(errorMessage)) {
        this.markUnhealthyTransient(accountId, errorMessage);
      }

      throw error;
    }
  }

  // ============== useSyncExternalStore ==============

  subscribe(listener: () => void): () => void {
    this._listeners.add(listener);
    return () => {
      this._listeners.delete(listener);
    };
  }

  getSnapshot(): number {
    return this._version;
  }

  // ============== Private ==============

  private notify(): void {
    this._version++;
    this._listeners.forEach((l) => l());
  }

  /**
   * Try to extract HTTP status from various error shapes.
   */
  private extractHttpStatus(error: unknown): number | null {
    if (error && typeof error === "object") {
      // Check for status property (common in API error objects)
      if (
        "status" in error &&
        typeof (error as { status: unknown }).status === "number"
      ) {
        return (error as { status: number }).status;
      }
      // Check for httpStatus property
      if (
        "httpStatus" in error &&
        typeof (error as { httpStatus: unknown }).httpStatus === "number"
      ) {
        return (error as { httpStatus: number }).httpStatus;
      }
    }

    // Try to extract from error message (e.g., "HTTP error! status: 401")
    if (error instanceof Error) {
      const match = error.message.match(/status:\s*(\d{3})/);
      if (match) {
        return parseInt(match[1]!, 10);
      }
    }

    return null;
  }
}

// ============== Singleton ==============

let connectionStateInstance: ConnectionStateService | null = null;

/**
 * Get the shared ConnectionStateService instance.
 */
export function getConnectionStateService(): ConnectionStateService {
  if (!connectionStateInstance) {
    connectionStateInstance = new ConnectionStateService();
  }
  return connectionStateInstance;
}

/**
 * Reset the connection state service (for testing or full account reset).
 */
export function resetConnectionStateService(): void {
  connectionStateInstance = null;
}

// The api-client announces a 409 CREDENTIALS_REQUIRED as a window event (an
// event rather than an import, to avoid a client→store cycle, same reasoning
// as MAILBOX_LOCKED_EVENT). Record it here so the connection banner can
// surface a persistent reconnect prompt. Resolved through the getter at
// dispatch time so a reset service still receives later events.
if (typeof window !== "undefined") {
  subscribeCredentialsRequired((detail) => {
    const accountId = Number(detail?.accountId);
    if (!Number.isInteger(accountId) || accountId <= 0) {
      return;
    }
    getConnectionStateService().markCredentialsRequired(
      String(accountId),
      typeof detail?.message === "string" && detail.message !== ""
        ? detail.message
        : CREDENTIALS_REQUIRED_FALLBACK_MESSAGE,
    );
  });
}
