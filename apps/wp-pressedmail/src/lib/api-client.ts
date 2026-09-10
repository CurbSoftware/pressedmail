import {
  captureRequestPrincipal,
  invalidatePrincipalStorage,
  isRequestPrincipalCurrent,
  type StoragePrincipal,
} from "./principal-storage";
/**
 * Single HTTP layer for every authenticated PressedMail plugin REST call.
 *
 * Responsibilities (the ONE place they live):
 *  - Attach the WordPress REST nonce (`X-WP-Nonce`) from `getRuntimeWpNonce()` at CALL
 *    time, on every verb: GET, POST(JSON), DELETE, and multipart/FormData alike.
 *  - Self-heal a stale nonce: a `rest_cookie_invalid_nonce` 403 mints a fresh nonce via
 *    admin-ajax (`lib/nonce.ts`, single-flight) and retries the request EXACTLY ONCE with
 *    the fresh value. A FormData body is re-sent on that retry; raw streams are not
 *    supported (a consumed `ReadableStream` body cannot be replayed).
 *  - Classify failures visibly: a non-nonce 403 surfaces as `PermissionError`; a heal that
 *    is impossible (mint yields nothing, or the retry is still a nonce 403 → the login
 *    cookie is gone) surfaces as `SessionExpiredError`. Neither is ever swallowed.
 *  - Timeout + relative-URL fallback (absorbed from the three former private
 *    `fetchWithFallback` copies in sync/folder/inbox services): each request is bounded by
 *    a 20s timeout. GET/HEAD network failures against an absolute URL retry once against
 *    the relative path. Mutations never replay after an ambiguous network failure.
 *
 * There is intentionally NO `window.fetch` monkey-patch. Healing is explicit here so it is
 * testable, applies uniformly to every verb, and never double-wraps.
 */

import { getRuntimeWpNonce } from "@/lib/runtime-config";
import { refreshRestNonce } from "@/lib/nonce";
import {
  CREDENTIALS_REQUIRED_FALLBACK_MESSAGE,
  dispatchCredentialsRequired,
  type CredentialsRequiredDetail,
} from "@/lib/credentials-required-events";

// Re-exported so callers keep a single import surface for client-level events
// (mirrors MAILBOX_LOCKED_EVENT below). The constant itself lives in the
// dependency-free events module.
export { CREDENTIALS_REQUIRED_EVENT } from "@/lib/credentials-required-events";
export type { CredentialsRequiredDetail } from "@/lib/credentials-required-events";

/**
 * Default per-request timeout. Shared hosts queue plain admin reads behind the
 * SPA's boot burst: the Pro test ring took over 20 s to answer four settings
 * reads while idle-ish, and the old 20 s limit aborted them client-side into
 * "could not be loaded" cards that a Retry then fixed (PM48). Cloudflare cuts
 * an origin at 100 s, so 60 s still returns the plugin's own error first.
 */
export const REQUEST_TIMEOUT_MS = 60_000;

/** WP REST error code returned when the nonce is stale/expired. */
const INVALID_NONCE_CODE = "rest_cookie_invalid_nonce";

// ============== Typed errors ==============

/**
 * A request was rejected for lack of permission (a non-nonce 403). Distinct from a stale
 * nonce, retrying will not help; the UI should surface it rather than spin.
 */
export class PermissionError extends Error {
  readonly status = 403;
  readonly code?: string;
  /** Structured payload from the REST error, when the endpoint sends one. */
  readonly details?: unknown;

  constructor(
    message = "You do not have permission to perform this action.",
    code?: string,
    details?: unknown,
  ) {
    super(message);
    this.name = "PermissionError";
    this.code = code;
    this.details = details;
  }
}

/**
 * The session (login cookie) is gone: a stale-nonce heal was impossible, admin-ajax minted
 * nothing, or the retry was still a nonce 403. The UI must show a "session expired" banner
 * and prompt a reload/re-login; it is never swallowed.
 */
export class SessionExpiredError extends Error {
  readonly status = 401;

  constructor(
    message = "Your session has expired. Reload the page to sign in again.",
  ) {
    super(message);
    this.name = "SessionExpiredError";
  }
}

const responsePrincipals = new WeakMap<Response, StoragePrincipal>();

function assertCurrentPrincipal(
  principal: StoragePrincipal | null,
): asserts principal is StoragePrincipal {
  if (!isRequestPrincipalCurrent(principal)) throw new SessionExpiredError();
}

function assertResponsePrincipal(response: Response): void {
  assertCurrentPrincipal(responsePrincipals.get(response) ?? null);
}

/**
 * Headers may arrive before a user switch while the private body is still downloading.
 * Keep the native Response and fence every whole-body reader, including cloned readers.
 * Raw `body` streams are intentionally outside this contract: no API caller consumes
 * them. A future streaming caller must fence each chunk before exposing or storing it.
 */
function fenceResponse(
  response: Response,
  principal: StoragePrincipal,
): Response {
  assertCurrentPrincipal(principal);
  if (responsePrincipals.has(response)) {
    if (responsePrincipals.get(response) !== principal) {
      throw new SessionExpiredError();
    }
    return response;
  }
  try {
    if (!(response instanceof Response) || !Object.isExtensible(response)) {
      throw new TypeError("A native, extensible Response is required.");
    }
    // The native getter rejects objects that only imitate the Response prototype.
    const bodyUsed = Object.getOwnPropertyDescriptor(
      Response.prototype,
      "bodyUsed",
    )?.get;
    if (!bodyUsed)
      throw new TypeError("Response body verification is unavailable.");
    Reflect.apply(bodyUsed, response, []);
    const descriptors: PropertyDescriptorMap = {};
    for (const name of [
      "json",
      "text",
      "blob",
      "arrayBuffer",
      "formData",
      "bytes",
    ]) {
      const reader = Reflect.get(Response.prototype, name);
      if (name === "bytes" && typeof reader === "undefined") continue;
      if (typeof reader !== "function")
        throw new TypeError("Response reader is unavailable.");
      descriptors[name] = {
        value: async function (this: Response, ...args: unknown[]) {
          assertCurrentPrincipal(principal);
          if (this !== response) throw new TypeError("Illegal invocation");
          try {
            const result: unknown = await Reflect.apply(reader, this, args);
            assertCurrentPrincipal(principal);
            return result;
          } catch (error) {
            // A revoked body must not become a parser error or an empty error DTO.
            assertCurrentPrincipal(principal);
            throw error;
          }
        },
      };
    }
    const clone = Response.prototype.clone;
    descriptors.clone = {
      value: function (this: Response) {
        assertCurrentPrincipal(principal);
        if (this !== response) throw new TypeError("Illegal invocation");
        return fenceResponse(Reflect.apply(clone, this, []), principal);
      },
    };
    Object.defineProperties(response, descriptors);
    responsePrincipals.set(response, principal);
    return response;
  } catch (error) {
    if (error instanceof SessionExpiredError) throw error;
    // Unsupported/frozen response implementations cannot bypass the body fence.
    throw new SessionExpiredError(
      "The response could not be verified. Reload the page before trying again.",
    );
  }
}

function ignoreMalformedJson(error: unknown): null {
  if (error instanceof SessionExpiredError) throw error;
  return null;
}

/**
 * The mailbox is locked by the user's PressedMail Lock passphrase (HTTP 423 with code
 * `pressedmail_mailbox_locked`). NOT a session/auth failure: the LockGate handles it by
 * showing the unlock screen; data fetches should stop quietly, not surface error banners.
 */
export class MailboxLockedError extends Error {
  readonly status = 423;

  constructor(
    message = "PressedMail is locked. Enter your passphrase to continue.",
  ) {
    super(message);
    this.name = "MailboxLockedError";
  }
}

/**
 * Window event dispatched whenever any plugin REST call answers 423. The mailbox-lock store
 * (`lib/mailbox-lock.ts`) listens and flips the LockGate without a reload. An event,
 * rather than a direct import, keeps this module free of a store→client import cycle.
 */
export const MAILBOX_LOCKED_EVENT = "pressedmail:mailbox-locked";

/** WP REST error code carried by the 423 lock response. */
const MAILBOX_LOCKED_CODE = "pressedmail_mailbox_locked";

async function isMailboxLocked423(response: Response): Promise<boolean> {
  if (response.status !== 423) {
    return false;
  }
  try {
    const body = (await response.clone().json()) as { code?: unknown } | null;
    return body?.code === MAILBOX_LOCKED_CODE;
  } catch (error) {
    ignoreMalformedJson(error);
    return false;
  }
}

function announceMailboxLocked(): void {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(MAILBOX_LOCKED_EVENT));
  }
}

/** DTO error code carried by the 409 credentials conflict. */
const CREDENTIALS_REQUIRED_CODE = "CREDENTIALS_REQUIRED";

async function readCredentialsRequired409(
  response: Response,
): Promise<CredentialsRequiredDetail | null> {
  if (response.status !== 409) {
    return null;
  }
  try {
    const body = (await response.clone().json()) as Record<
      string,
      unknown
    > | null;
    if (!body || typeof body !== "object") {
      return null;
    }
    const fields = normalizeErrorFields(body);
    if (fields.code !== CREDENTIALS_REQUIRED_CODE) {
      return null;
    }
    const details =
      typeof fields.details === "object" && fields.details !== null
        ? (fields.details as Record<string, unknown>)
        : {};
    const accountId = Number(details.account_id);
    return {
      accountId:
        Number.isInteger(accountId) && accountId > 0 ? accountId : null,
      message:
        typeof fields.message === "string" && fields.message !== ""
          ? fields.message
          : CREDENTIALS_REQUIRED_FALLBACK_MESSAGE,
    };
  } catch (error) {
    ignoreMalformedJson(error);
    return null;
  }
}

// ============== API envelope types (formerly context/BaseApi) ==============

// Matches the legacy
// BaseApi envelope contract; callers narrow `data` themselves.
export interface ApiResponse<T = any> {
  status: number | string;
  message?: string;
  data?: T;
  type?: string;
  [key: string]: unknown;
}

export interface ApiErrorResponse {
  status: number | string;
  message?: unknown;
  code?: unknown;
  details?: unknown;
  data?: unknown;
  type?: string;
}

// ============== Network / timeout helpers ==============

/** True for a fetch abort (timeout or caller-cancelled). */
export function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === "AbortError";
}

/** Request exceeded its per-call timeout budget. */
export class RequestTimeoutError extends Error {
  constructor(url: string, timeoutMs: number) {
    super(
      `Request timed out after ${Math.ceil(timeoutMs / 1000)}s for ${url}.`,
    );
    this.name = "RequestTimeoutError";
  }
}

/** True when an error is a {@link RequestTimeoutError} thrown by {@link apiFetch}. */
export function isRequestTimeoutError(
  error: unknown,
): error is RequestTimeoutError {
  return error instanceof RequestTimeoutError;
}

/** True for a network-level fetch failure (TypeError / "Failed to fetch" / load failed). */
export function isNetworkFetchError(error: unknown): boolean {
  if (isAbortError(error)) return false;
  if (error instanceof TypeError) return true;
  if (error instanceof Error) {
    const message = error.message.toLowerCase();
    return (
      message.includes("failed to fetch") ||
      message.includes("networkerror") ||
      message.includes("load failed")
    );
  }
  return false;
}

function toRelativeUrl(url: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    const parsed = new URL(url, window.location.origin);
    return `${parsed.pathname}${parsed.search}${parsed.hash}`;
  } catch {
    return null;
  }
}

function buildNetworkFetchError(
  error: unknown,
  url: string,
  fallbackUrl?: string | null,
): Error {
  const reason =
    error instanceof Error && error.message ? error.message : "Failed to fetch";
  const fallbackContext =
    fallbackUrl && fallbackUrl !== url
      ? ` (fallback attempted: ${fallbackUrl})`
      : "";

  return new Error(
    `Network request failed for ${url}${fallbackContext}. ${reason}. ` +
      "Check your WordPress REST API URL, site protocol/domain, and network connection.",
  );
}

function coerceUrl(input: string | URL): string {
  return typeof input === "string" ? input : input.href;
}

/**
 * Read `code`, `message` and `details` from a REST error body.
 *
 * WP_Error responses put the useful payload under `data` rather than at the
 * top level, and which shape you get depends on whether the endpoint threw a
 * WP_Error or returned a DTO. Reading only the top level silently dropped the
 * error code for half the endpoints, which is how a credentials-required
 * conflict became an unlabelled generic failure in the UI.
 */
function normalizeErrorFields(body: Record<string, unknown>): {
  code?: unknown;
  message?: unknown;
  details?: unknown;
} {
  const nestedData =
    typeof body.data === "object" &&
    body.data !== null &&
    !Array.isArray(body.data)
      ? (body.data as Record<string, unknown>)
      : {};

  return {
    code: body.code ?? nestedData.code,
    message: body.message ?? nestedData.message,
    details: body.details ?? nestedData.details,
  };
}

/**
 * Merge the caller's init with the runtime nonce (read fresh, per call) and same-origin
 * credentials. The nonce is always the current runtime value so a mid-flight heal is picked
 * up on retry. Header shape is preserved (a plain-object stays a plain object, a `Headers`
 * stays `Headers`) so callers, and their tests, see the same headers they passed plus the
 * nonce, without key-casing surprises from a forced `Headers` round-trip.
 */
function withNonce(init: RequestInit): RequestInit {
  const nonce = getRuntimeWpNonce();
  const existing = init.headers;

  let headers: HeadersInit;
  if (existing instanceof Headers) {
    const merged = new Headers(existing);
    merged.set("X-WP-Nonce", nonce);
    headers = merged;
  } else if (Array.isArray(existing)) {
    headers = [
      ...existing.filter(([key]) => key.toLowerCase() !== "x-wp-nonce"),
      ["X-WP-Nonce", nonce],
    ];
  } else {
    headers = {
      ...(existing as Record<string, string> | undefined),
      "X-WP-Nonce": nonce,
    };
  }

  return { credentials: "same-origin", ...init, headers };
}

/**
 * Perform one fetch with a timeout and a GET/HEAD relative-URL fallback on network errors.
 * Does NOT inject the nonce or heal, callers pass an already-prepared init.
 */
async function fetchWithFallback(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const fetchWithTimeout = async (targetUrl: string): Promise<Response> => {
    if (timeoutMs <= 0) {
      return fetch(targetUrl, init);
    }
    const sourceSignal = init.signal;
    const timeoutController = new AbortController();
    let timedOut = false;
    const timeoutId = globalThis.setTimeout(() => {
      timedOut = true;
      timeoutController.abort();
    }, timeoutMs);

    const onSourceAbort = () => timeoutController.abort();
    if (sourceSignal) {
      if (sourceSignal.aborted) {
        timeoutController.abort();
      } else {
        sourceSignal.addEventListener("abort", onSourceAbort, { once: true });
      }
    }

    try {
      return await fetch(targetUrl, {
        ...init,
        signal: timeoutController.signal,
      });
    } catch (error) {
      if (timedOut && isAbortError(error)) {
        throw new RequestTimeoutError(targetUrl, timeoutMs);
      }
      throw error;
    } finally {
      globalThis.clearTimeout(timeoutId);
      if (sourceSignal) {
        sourceSignal.removeEventListener("abort", onSourceAbort);
      }
    }
  };

  try {
    return await fetchWithTimeout(url);
  } catch (error) {
    if (error instanceof RequestTimeoutError) {
      throw error;
    }
    if (!isNetworkFetchError(error)) {
      throw error;
    }

    // The server may have committed a write before the connection failed.
    // Only reads can recover by issuing the same request to a relative URL.
    const method = (init.method ?? "GET").toUpperCase();
    if (method !== "GET" && method !== "HEAD") {
      throw buildNetworkFetchError(error, url);
    }

    const fallbackUrl = toRelativeUrl(url);
    if (!fallbackUrl || fallbackUrl === url) {
      throw buildNetworkFetchError(error, url, fallbackUrl);
    }

    try {
      return await fetchWithTimeout(fallbackUrl);
    } catch (fallbackError) {
      if (!isNetworkFetchError(fallbackError)) {
        throw fallbackError;
      }
      throw buildNetworkFetchError(fallbackError, url, fallbackUrl);
    }
  }
}

async function isInvalidNonce403(response: Response): Promise<boolean> {
  if (response.status !== 403) {
    return false;
  }
  try {
    const body = (await response.clone().json()) as { code?: unknown } | null;
    return body?.code === INVALID_NONCE_CODE;
  } catch (error) {
    ignoreMalformedJson(error);
    return false;
  }
}

async function rejectConfirmedLogout(response: Response): Promise<void> {
  if (response.status !== 401) return;
  const body = await response.clone().json().catch(ignoreMalformedJson);
  assertResponsePrincipal(response);
  const code = body && normalizeErrorFields(body).code;
  if (
    code === "rest_not_logged_in" ||
    code === "not_logged_in" ||
    code === "rest_forbidden"
  ) {
    invalidatePrincipalStorage("session-ended");
    throw new SessionExpiredError();
  }
}

export interface ApiFetchOptions {
  /** Per-request timeout in ms. `0` disables the timeout (e.g. streaming responses). */
  timeoutMs?: number;
  /** Set false to skip stale-nonce self-heal (rarely needed). */
  heal?: boolean;
}

/**
 * Core fetch: attaches the nonce, applies timeout + relative-URL fallback, and self-heals a
 * stale nonce exactly once. Returns the `Response` for every non-heal status (including a
 * non-nonce 403, callers decide how to treat it). Throws `SessionExpiredError` when a
 * stale-nonce heal is impossible or the captured principal changes. Native whole-body
 * readers and clones remain bound to that principal through body completion.
 */
export async function apiFetch(
  input: string | URL,
  init: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<Response> {
  const principal = captureRequestPrincipal();
  assertCurrentPrincipal(principal);
  const url = coerceUrl(input);
  const { timeoutMs = REQUEST_TIMEOUT_MS, heal = true } = opts;

  const response = fenceResponse(
    await fetchWithFallback(url, withNonce(init), timeoutMs),
    principal,
  );

  await rejectConfirmedLogout(response);
  assertCurrentPrincipal(principal);

  const mailboxLocked = await isMailboxLocked423(response);
  assertCurrentPrincipal(principal);
  if (mailboxLocked) {
    // Mailbox lock engaged mid-session (inactivity expiry, lock-all from
    // another browser). Announce so the LockGate flips; return the response
    // so callers' normal error paths still run.
    announceMailboxLocked();
    assertCurrentPrincipal(principal);
    return response;
  }

  const credentialsRequired = await readCredentialsRequired409(response);
  assertCurrentPrincipal(principal);
  if (credentialsRequired) {
    // The account has no usable stored secret; a retry cannot succeed until
    // the user re-enters it. Announce so the connection banner surfaces the
    // reconnect prompt; return the response so callers' error paths still run.
    dispatchCredentialsRequired(credentialsRequired);
    assertCurrentPrincipal(principal);
    return response;
  }

  const invalidNonce = heal && (await isInvalidNonce403(response));
  assertCurrentPrincipal(principal);
  if (!invalidNonce) {
    return response;
  }

  // Stale nonce → mint a fresh one (single-flight) and retry once.
  const fresh = await refreshRestNonce();
  if (!fresh || !isRequestPrincipalCurrent(principal)) {
    throw new SessionExpiredError();
  }

  const retried = fenceResponse(
    await fetchWithFallback(url, withNonce(init), timeoutMs),
    principal,
  );
  await rejectConfirmedLogout(retried);
  assertCurrentPrincipal(principal);
  const retryInvalidNonce = await isInvalidNonce403(retried);
  assertCurrentPrincipal(principal);
  if (retryInvalidNonce) {
    // Fresh nonce still rejected → the login cookie itself is gone.
    throw new SessionExpiredError();
  }
  return retried;
}

/**
 * Fetch + JSON parse for endpoints that should THROW on failure. A non-nonce 403 becomes a
 * `PermissionError`; other non-2xx becomes an `Error` carrying the status. Success returns
 * the parsed body.
 */
export async function apiJson<T = unknown>(
  input: string | URL,
  init: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<T> {
  const res = await apiFetch(input, init, opts);
  if (!res.ok) {
    const body = (await res.json().catch(ignoreMalformedJson)) ?? {};
    assertResponsePrincipal(res);
    const fields = normalizeErrorFields(body);
    const message =
      typeof fields.message === "string"
        ? fields.message
        : `HTTP ${res.status}`;
    if (res.status === 403) {
      throw new PermissionError(
        message,
        typeof fields.code === "string" ? fields.code : undefined,
        fields.details,
      );
    }
    // Checked against the normalized code so the lock is still caught when the
    // response nests it under `data`, as WP_Error does.
    if (res.status === 423 && fields.code === MAILBOX_LOCKED_CODE) {
      throw new MailboxLockedError(message);
    }
    const err = new Error(message) as Error & {
      status?: number;
      code?: unknown;
      details?: unknown;
    };
    err.status = res.status;
    err.code = fields.code;
    err.details = fields.details;
    throw err;
  }
  const body = (await res.json()) as T;
  assertResponsePrincipal(res);
  return body;
}

/**
 * Serialize a plain object to FormData using PHP-compatible array keys (`key[]`) so the PHP
 * endpoints (which read `$_POST['key']` / `$_POST['key'][]`) see the same multipart shape
 * the former `apiDataPostForm` produced.
 */
function objectToFormData(data: Record<string, unknown>): FormData {
  const form = new FormData();
  for (const [key, value] of Object.entries(data ?? {})) {
    if (value === undefined || value === null) continue;
    if (Array.isArray(value)) {
      for (const item of value) {
        form.append(`${key}[]`, String(item));
      }
    } else if (value instanceof Blob) {
      form.append(key, value);
    } else {
      form.append(key, String(value));
    }
  }
  return form;
}

async function toEnvelope<T>(res: Response): Promise<ApiResponse<T>> {
  let body: Record<string, unknown>;
  try {
    body = (await res.json()) as Record<string, unknown>;
  } catch (error) {
    ignoreMalformedJson(error);
    body = {};
  }
  assertResponsePrincipal(res);
  if (res.ok) {
    return body as ApiResponse<T>;
  }
  const fields = normalizeErrorFields(body);
  // Non-2xx: hand back a numeric-status envelope (the shape the former catch produced),
  // so callers' `status >= 400` / `status === "error"` checks still trip. The
  // normalized fields are lifted to the top level so envelope callers can read
  // a code without knowing whether it arrived nested.
  return {
    ...body,
    status: res.status,
    code: fields.code,
    message: fields.message,
    details: fields.details,
    type: typeof body.type === "string" ? body.type : "failed_to_fetch",
  } as ApiResponse<T>;
}

/**
 * POST a FormData (or plain object serialized to FormData) and resolve to the server's
 * envelope. Never throws except `SessionExpiredError`; network failures resolve to a
 * `{ status: 505, type: "failed_to_fetch" }` envelope (matching the former behaviour).
 * The BaseApi `apiDataPostForm` replacement.
 */
export async function apiForm<T = unknown>(
  url: string,
  data: FormData | Record<string, unknown>,
  init: RequestInit = {},
): Promise<ApiResponse<T>> {
  const body = data instanceof FormData ? data : objectToFormData(data);
  try {
    const res = await apiFetch(url, {
      ...init,
      method: init.method ?? "POST",
      body,
    });
    return await toEnvelope<T>(res);
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    return {
      status: 505,
      message: err instanceof Error ? err.message : String(err),
      type: "failed_to_fetch",
    } as ApiResponse<T>;
  }
}

/**
 * POST a JSON body and resolve to the server's envelope. Never throws except
 * `SessionExpiredError`. The BaseApi `apiDataPost` replacement.
 */
export async function apiPost<T = unknown>(
  url: string,
  data: unknown,
  init: RequestInit = {},
  opts: ApiFetchOptions = {},
): Promise<ApiResponse<T>> {
  try {
    const res = await apiFetch(
      url,
      {
        ...init,
        method: init.method ?? "POST",
        headers: { "Content-Type": "application/json", ...init.headers },
        body: JSON.stringify(data),
      },
      opts,
    );
    return await toEnvelope<T>(res);
  } catch (err) {
    if (err instanceof SessionExpiredError) throw err;
    return {
      status: 505,
      message: err instanceof Error ? err.message : String(err),
      type: "failed_to_fetch",
    } as ApiResponse<T>;
  }
}
