import { __ } from "@wordpress/i18n";

import { apiFetch, SessionExpiredError } from "@/lib/api-client";
import {
  captureStoragePrincipal,
  getPrincipalStorageKey,
  isStoragePrincipalCurrent,
  removePrincipalStorageItem,
  setPrincipalStorageItem,
  type StoragePrincipal,
} from "@/lib/principal-storage";
import { getPluginRestBase } from "@/lib/runtime-config";

export type NormalSendOutcome =
  | "accepted"
  | "queued"
  | "pending"
  | "uncertain"
  | "failed"
  | "missing"
  | "conflict"
  | "forbidden"
  | "unavailable"
  | "invalid";

export interface NormalSendReceipt {
  status: "success" | "pending" | "error";
  outcome: NormalSendOutcome;
  http_status: number;
  delivery_state:
    | "accepted"
    | "queued"
    | "pending"
    | "uncertain"
    | "not_accepted"
    | "unknown";
  message: string;
  attempt_key: string;
  /** Why a send was refused before it started, when the server names it. */
  code?: string;
  error_type?: string;
  receipt_recorded?: boolean;
  message_id?: string;
  transport?: string | null;
  warning?: string;
  delivery_id?: number;
  progress?: ListDeliveryProgress;
  pending_email_id?: number;
  send_at?: string;
  delay_seconds?: number;
  remaining_seconds?: number;
}

export interface ListDeliveryProgress {
  state:
    | "queued"
    | "preparing"
    | "sending"
    | "partial"
    | "failed"
    | "uncertain"
    | "complete"
    | "cancelled"
    | "paused";
  audience: number | null;
  counts: Record<
    | "queued"
    | "claimed"
    | "accepted"
    | "failed"
    | "uncertain"
    | "skipped"
    | "removed",
    number
  >;
  due_at: string;
  published_at: string | null;
}

export function parseListDeliveryProgress(
  value: unknown,
): ListDeliveryProgress | null {
  if (!value || typeof value !== "object") return null;
  const row = value as Record<string, unknown>;
  if (
    ![
      "queued",
      "preparing",
      "sending",
      "partial",
      "failed",
      "uncertain",
      "complete",
      "cancelled",
      "paused",
    ].includes(String(row.state)) ||
    !(
      row.audience === null ||
      (typeof row.audience === "number" &&
        Number.isSafeInteger(row.audience) &&
        row.audience >= 0)
    ) ||
    typeof row.due_at !== "string" ||
    !(row.published_at === null || typeof row.published_at === "string") ||
    !row.counts ||
    typeof row.counts !== "object"
  )
    return null;
  const counts: Record<string, unknown> = {
    removed: 0,
    ...(row.counts as Record<string, unknown>),
  };
  if (
    ![
      "queued",
      "claimed",
      "accepted",
      "failed",
      "uncertain",
      "skipped",
      "removed",
    ].every(
      (key) =>
        typeof counts[key] === "number" &&
        Number.isSafeInteger(counts[key]) &&
        (counts[key] as number) >= 0,
    )
  )
    return null;
  const total = Object.values(counts).reduce<number>(
    (sum, number) => sum + (typeof number === "number" ? number : 0),
    0,
  );
  if (row.audience !== null && total !== row.audience) return null;
  return { ...row, counts } as unknown as ListDeliveryProgress;
}

type ErrorCode =
  | "principal_changed"
  | "storage_unavailable"
  | "storage_invalid"
  | "locks_unavailable"
  | "crypto_unavailable"
  | "invalid_account"
  | "status_unavailable";

export class NormalSendError extends Error {
  constructor(readonly code: ErrorCode) {
    const messages: Record<ErrorCode, string> = {
      principal_changed: __(
        "Your signed-in account changed. Reload PressedMail before sending.",
        "pressedmail",
      ),
      storage_unavailable: __(
        "PressedMail could not save the send receipt key. Allow browser storage for this site before sending.",
        "pressedmail",
      ),
      storage_invalid: __(
        "The saved send receipt key could not be verified. Check Sent before starting a new message.",
        "pressedmail",
      ),
      locks_unavailable: __(
        "This browser cannot safely coordinate sending between tabs. Open PressedMail over HTTPS in a browser with Web Locks support.",
        "pressedmail",
      ),
      crypto_unavailable: __(
        "This browser cannot create a secure send receipt key. Open PressedMail over HTTPS in a browser with Web Crypto support.",
        "pressedmail",
      ),
      invalid_account: __(
        "Choose a valid mailbox before sending.",
        "pressedmail",
      ),
      status_unavailable: __(
        "Delivery status is unavailable. Keep this draft and check its status again before sending.",
        "pressedmail",
      ),
    };
    super(messages[code]);
    this.name = "NormalSendError";
  }
}

export interface NormalSendOptions {
  /** Only an explicit user decision can authorize a fresh send after an uncertain result. */
  confirmNewAttempt?: (receipt: NormalSendReceipt) => Promise<boolean>;
}

interface Intent {
  account_id: number;
  payload_hash: string;
  attempt_key: string;
}

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const inFlight = new Map<string, Promise<NormalSendReceipt>>();
const acceptedIntents = new Map<
  string,
  { principal: StoragePrincipal; key: string; raw: string }
>();
const scheduledIntents = new Map<
  string,
  { principal: StoragePrincipal; key: string; raw: string }
>();

function assertCurrent(
  principal: StoragePrincipal | null,
): asserts principal is StoragePrincipal {
  if (!principal || !isStoragePrincipalCurrent(principal)) {
    throw new NormalSendError("principal_changed");
  }
}

/** The general storage reader masks failures as absence. A send must distinguish them. */
function readRaw(key: string, principal: StoragePrincipal): string | null {
  assertCurrent(principal);
  const physical = getPrincipalStorageKey(key, principal);
  if (!physical) throw new NormalSendError("storage_unavailable");
  try {
    const raw = window.localStorage.getItem(physical);
    assertCurrent(principal);
    return raw;
  } catch (error) {
    if (error instanceof NormalSendError) throw error;
    throw new NormalSendError("storage_unavailable");
  }
}

function readIntent(
  key: string,
  account: number,
  hash: string,
  principal: StoragePrincipal,
): Intent | null {
  const raw = readRaw(key, principal);
  if (raw === null) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (value && typeof value === "object") {
      const intent = value as Intent;
      if (
        intent.account_id === account &&
        intent.payload_hash === hash &&
        typeof intent.attempt_key === "string" &&
        UUID.test(intent.attempt_key)
      )
        return intent;
    }
  } catch {
    /* Corruption never authorizes overwriting an unresolved send. */
  }
  throw new NormalSendError("storage_invalid");
}

/**
 * wp-admin served over plain HTTP (an intranet host, a staging site without a
 * certificate). Browsers withhold crypto.subtle, crypto.randomUUID and Web
 * Locks there, and keep crypto.getRandomValues. Sending still works, with the
 * same guard: the intent is stored before the POST, and a lost answer reads
 * the status instead of posting again.
 */
function isPlainHttpContext(): boolean {
  return window.isSecureContext === false;
}

/** Throws unless this browser can name and fingerprint a send. */
function assertSendCrypto(): void {
  const crypto = window.crypto;
  if (
    isPlainHttpContext()
      ? typeof crypto?.getRandomValues !== "function"
      : !crypto?.subtle || typeof crypto.randomUUID !== "function"
  )
    throw new NormalSendError("crypto_unavailable");
}

function hasSendLocks(): boolean {
  return typeof navigator.locks?.request === "function" || isPlainHttpContext();
}

/** A version 4 UUID, from getRandomValues where randomUUID is withheld. */
function newAttemptKey(): string {
  if (typeof window.crypto.randomUUID === "function")
    return window.crypto.randomUUID();
  const bytes = window.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * The payload fingerprint where crypto.subtle is withheld.
 *
 * ponytail: 64 bits and not cryptographic. It only tells this user's own
 * unresolved sends apart in this browser (a handful at most) and never leaves
 * it; the server dedupes on the attempt key. Swap in a JS SHA-256 if the
 * fingerprint ever has to resist a chosen payload.
 */
function plainHttpDigest(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let index = 0; index < bytes.length; index++) {
    h1 = Math.imul(h1 ^ bytes[index]!, 2654435761);
    h2 = Math.imul(h2 ^ bytes[index]!, 1597334677);
  }
  h1 =
    Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^
    Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 =
    Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^
    Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  const hex = (value: number) => (value >>> 0).toString(16).padStart(8, "0");
  return `http-${bytes.length.toString(16)}-${hex(h2)}${hex(h1)}`;
}

// Stands in for Web Locks over plain HTTP: one queue per key, in this tab.
const tabLocks = new Map<string, Promise<unknown>>();

/**
 * Run `work` holding the exclusive lock for `name`.
 *
 * ponytail: over plain HTTP the lock is this tab's own queue. Two tabs sending
 * the same message in the same instant are not serialized; the stored intent
 * (written and read back before the POST) and the server's attempt key still
 * stand between them and a duplicate. A storage-based lock closes that if it
 * ever matters.
 */
function withSendLock<T>(
  name: string,
  work: (lock: unknown) => T | Promise<T>,
): Promise<T> {
  if (typeof navigator.locks?.request === "function")
    return navigator.locks.request(
      name,
      { mode: "exclusive" },
      work,
    ) as Promise<T>;
  const run = (tabLocks.get(name) ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => work({ name }));
  tabLocks.set(name, run);
  const release = () => {
    if (tabLocks.get(name) === run) tabLocks.delete(name);
  };
  run.then(release, release);
  return run;
}

async function sha256(
  bytes: ArrayBuffer,
  principal: StoragePrincipal,
): Promise<string> {
  if (!window.crypto?.subtle && isPlainHttpContext()) {
    assertCurrent(principal);
    return plainHttpDigest(bytes);
  }
  let digest: ArrayBuffer;
  try {
    digest = await window.crypto.subtle.digest("SHA-256", bytes);
  } catch {
    assertCurrent(principal);
    throw new NormalSendError("crypto_unavailable");
  }
  assertCurrent(principal);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

async function fingerprint(
  form: FormData,
  principal: StoragePrincipal,
): Promise<string> {
  const fields = new Map<string, unknown[]>();
  for (const [key, value] of form.entries()) {
    const values = fields.get(key) ?? [];
    if (typeof value === "string") values.push(["text", value]);
    else {
      const bytes = await value.arrayBuffer();
      assertCurrent(principal);
      const hash = await sha256(bytes, principal);
      assertCurrent(principal);
      // lastModified is a local file-picker detail, not part of the outgoing message.
      values.push(["file", value.name, value.type, value.size, hash]);
    }
    fields.set(key, values);
  }
  // Field insertion order is immaterial; repeated field/attachment order is not.
  const canonical = JSON.stringify(
    Array.from(fields).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
  );
  return sha256(new TextEncoder().encode(canonical).buffer, principal);
}

function parseReceipt(
  body: unknown,
  http: number,
  attempt: string,
): NormalSendReceipt | null {
  if (!body || typeof body !== "object") return null;
  const value = body as Record<string, unknown>;
  const statuses: Record<NormalSendOutcome, number> = {
    accepted: 200,
    queued: 202,
    pending: 202,
    uncertain: 409,
    failed: 422,
    missing: 404,
    conflict: 409,
    forbidden: 403,
    unavailable: 503,
    invalid: 400,
  };
  const outcome = value.outcome as NormalSendOutcome;
  if (
    !Object.prototype.hasOwnProperty.call(statuses, outcome) ||
    statuses[outcome] !== http ||
    value.http_status !== http ||
    typeof value.message !== "string"
  )
    return null;
  const status =
    outcome === "accepted" || outcome === "queued"
      ? "success"
      : outcome === "pending"
        ? "pending"
        : "error";
  const state =
    outcome === "failed" || outcome === "invalid"
      ? "not_accepted"
      : outcome === "accepted" ||
          outcome === "queued" ||
          outcome === "pending" ||
          outcome === "uncertain"
        ? outcome
        : "unknown";
  if (value.status !== status || value.delivery_state !== state) return null;
  const progress =
    outcome === "queued" ? parseListDeliveryProgress(value.progress) : null;
  if (
    outcome === "queued" &&
    (!progress ||
      typeof value.delivery_id !== "number" ||
      !Number.isSafeInteger(value.delivery_id) ||
      value.delivery_id <= 0)
  )
    return null;
  if (
    value.pending_email_id !== undefined &&
    (outcome !== "queued" ||
      typeof value.pending_email_id !== "number" ||
      !Number.isSafeInteger(value.pending_email_id) ||
      value.pending_email_id <= 0 ||
      typeof value.send_at !== "string" ||
      ![value.delay_seconds, value.remaining_seconds].every(
        (number) =>
          typeof number === "number" &&
          Number.isSafeInteger(number) &&
          number >= 0,
      ))
  )
    return null;
  return {
    status,
    outcome,
    http_status: http,
    delivery_state: state,
    message: value.message,
    attempt_key: attempt,
    ...(progress ? { delivery_id: value.delivery_id as number, progress } : {}),
    ...(typeof value.pending_email_id === "number"
      ? {
          pending_email_id: value.pending_email_id,
          send_at: value.send_at as string,
          delay_seconds: value.delay_seconds as number,
          remaining_seconds: value.remaining_seconds as number,
        }
      : {}),
    ...(typeof value.code === "string" ? { code: value.code } : {}),
    ...(typeof value.error_type === "string"
      ? { error_type: value.error_type }
      : {}),
    ...(typeof value.receipt_recorded === "boolean"
      ? { receipt_recorded: value.receipt_recorded }
      : {}),
    ...(typeof value.message_id === "string"
      ? { message_id: value.message_id }
      : {}),
    ...(typeof value.transport === "string" || value.transport === null
      ? { transport: value.transport }
      : {}),
    ...(typeof value.warning === "string" ? { warning: value.warning } : {}),
  };
}

async function requestReceipt(
  url: string,
  init: RequestInit,
  attempt: string,
  principal: StoragePrincipal,
): Promise<NormalSendReceipt> {
  assertCurrent(principal);
  try {
    const response = await apiFetch(url, {
      ...init,
      credentials: "same-origin",
      cache: "no-store",
      redirect: "error",
    });
    assertCurrent(principal);
    const body: unknown = await response.json();
    assertCurrent(principal);
    const receipt = parseReceipt(body, response.status, attempt);
    if (!receipt) throw new NormalSendError("status_unavailable");
    return receipt;
  } catch (error) {
    assertCurrent(principal);
    if (
      error instanceof SessionExpiredError ||
      error instanceof NormalSendError
    )
      throw error;
    throw new NormalSendError("status_unavailable");
  }
}

function retryNeedsConfirmation(receipt: NormalSendReceipt): boolean {
  return (
    receipt.outcome === "uncertain" ||
    receipt.outcome === "failed" ||
    receipt.outcome === "missing"
  );
}

async function sendLocked(
  form: FormData,
  account: number,
  hash: string,
  key: string,
  principal: StoragePrincipal,
  options: NormalSendOptions,
): Promise<NormalSendReceipt> {
  assertCurrent(principal);
  // Capture the endpoint before awaits, alongside the page's site/user guard.
  const base = getPluginRestBase();
  const getStatus = (attempt: string) => {
    const url = new URL(
      `${base}messages/send-status/${account}`,
      window.location.href,
    );
    url.searchParams.set("attempt_key", attempt);
    return requestReceipt(url.href, { method: "GET" }, attempt, principal);
  };
  let intent = readIntent(key, account, hash, principal);
  const remember = (receipt: NormalSendReceipt) => {
    assertCurrent(principal);
    if (receipt.outcome === "accepted" || receipt.outcome === "queued") {
      const current = readIntent(key, account, hash, principal);
      const raw = readRaw(key, principal);
      if (raw !== null && current?.attempt_key === receipt.attempt_key)
        acceptedIntents.set(receipt.attempt_key, { principal, key, raw });
    }
    return receipt;
  };
  if (intent) {
    let receipt = await getStatus(intent.attempt_key);
    assertCurrent(principal);
    if (!retryNeedsConfirmation(receipt) || !options.confirmNewAttempt)
      return remember(receipt);
    const confirmed = await options.confirmNewAttempt(receipt);
    assertCurrent(principal);
    if (confirmed !== true) return receipt;
    // The original request may have completed while the confirmation was open.
    receipt = await getStatus(intent.attempt_key);
    assertCurrent(principal);
    if (!retryNeedsConfirmation(receipt)) return remember(receipt);
    if (
      readIntent(key, account, hash, principal)?.attempt_key !==
      intent.attempt_key
    )
      throw new NormalSendError("storage_invalid");
  }
  let attempt: string;
  try {
    attempt = newAttemptKey();
  } catch {
    throw new NormalSendError("crypto_unavailable");
  }
  if (!UUID.test(attempt)) throw new NormalSendError("crypto_unavailable");
  intent = { account_id: account, payload_hash: hash, attempt_key: attempt };
  const raw = JSON.stringify(intent);
  if (
    !setPrincipalStorageItem("local", key, raw, principal) ||
    readRaw(key, principal) !== raw
  )
    throw new NormalSendError("storage_unavailable");
  assertCurrent(principal);
  form.set("attempt_key", attempt);
  let receipt: NormalSendReceipt;
  try {
    receipt = await requestReceipt(
      `${base}messages/send-email`,
      { method: "POST", body: form },
      attempt,
      principal,
    );
    // A forward refused over its attachments never reached a transport, so
    // there is no attempt left to ask about: the next send posts again.
    if (
      receipt.outcome === "invalid" &&
      receipt.code?.startsWith("forward_source_")
    )
      removePrincipalStorageItem("local", key, principal);
  } catch (error) {
    assertCurrent(principal);
    if (
      error instanceof SessionExpiredError ||
      !(error instanceof NormalSendError) ||
      error.code !== "status_unavailable"
    )
      throw error;
    // A lost response authorizes a read, never a second POST or an immediate retry dialog.
    receipt = await getStatus(attempt);
  }
  assertCurrent(principal);
  return remember(receipt);
}

/** Persist intent before transport; keep it until the successful composer actually closes. */
export async function retainScheduledListIntent(
  account: number,
  authoredRequest: string,
): Promise<string> {
  const principal = captureStoragePrincipal();
  assertCurrent(principal);
  if (!Number.isSafeInteger(account) || account <= 0)
    throw new NormalSendError("invalid_account");
  assertSendCrypto();
  if (!hasSendLocks()) throw new NormalSendError("locks_unavailable");
  const hash = await sha256(
    new TextEncoder().encode(authoredRequest).buffer,
    principal,
  );
  const key = `scheduled-list-intent:${account}:${hash}`;
  const physical = getPrincipalStorageKey(key, principal);
  if (!physical) throw new NormalSendError("storage_unavailable");
  return withSendLock(physical, () => {
    const existing = readIntent(key, account, hash, principal);
    if (existing) {
      scheduledIntents.set(existing.attempt_key, {
        principal,
        key,
        raw: readRaw(key, principal)!,
      });
      return existing.attempt_key;
    }
    const attempt = newAttemptKey();
    if (!UUID.test(attempt)) throw new NormalSendError("crypto_unavailable");
    const raw = JSON.stringify({
      account_id: account,
      payload_hash: hash,
      attempt_key: attempt,
    });
    if (
      !setPrincipalStorageItem("local", key, raw, principal) ||
      readRaw(key, principal) !== raw
    )
      throw new NormalSendError("storage_unavailable");
    scheduledIntents.set(attempt, { principal, key, raw });
    return attempt;
  });
}

/** Call only after an owned native scheduled row was durably acknowledged. */
export async function acknowledgeScheduledListIntent(
  attempt: string,
): Promise<boolean> {
  const observed = scheduledIntents.get(attempt);
  if (!observed) return false;
  acceptedIntents.set(attempt, observed);
  const removed = await acknowledgeNormalSend(attempt);
  if (removed) scheduledIntents.delete(attempt);
  return removed;
}

export async function sendNormalEmail(
  formData: FormData,
  options: NormalSendOptions = {},
): Promise<NormalSendReceipt> {
  assertSendCrypto();
  const principal = captureStoragePrincipal();
  if (!principal) throw new NormalSendError("storage_unavailable");
  if (!hasSendLocks()) throw new NormalSendError("locks_unavailable");
  // Snapshot synchronously, before hashing yields or the caller can edit the form.
  const form = new FormData();
  const capturedOptions = { confirmNewAttempt: options.confirmNewAttempt };
  for (const [key, value] of formData.entries())
    if (key !== "attempt_key") form.append(key, value);
  const accounts = form.getAll("account_id");
  const account = Number(accounts[0]);
  if (
    accounts.length !== 1 ||
    typeof accounts[0] !== "string" ||
    !/^[1-9][0-9]*$/.test(accounts[0]) ||
    !Number.isSafeInteger(account)
  )
    throw new NormalSendError("invalid_account");
  const hash = await fingerprint(form, principal);
  assertCurrent(principal);
  const key = `normal-send-intent:${account}:${hash}`;
  const physical = getPrincipalStorageKey(key, principal);
  if (!physical) throw new NormalSendError("storage_unavailable");
  const existing = inFlight.get(physical);
  if (existing) {
    const receipt = await existing;
    assertCurrent(principal);
    return receipt;
  }
  let acquired = false;
  const request = Promise.resolve()
    .then(
      async () =>
        await withSendLock(physical, (lock) => {
          if (!lock) throw new NormalSendError("locks_unavailable");
          acquired = true;
          return sendLocked(
            form,
            account,
            hash,
            key,
            principal,
            capturedOptions,
          );
        }),
    )
    .catch((error: unknown) => {
      if (!acquired) throw new NormalSendError("locks_unavailable");
      throw error;
    });
  inFlight.set(physical, request);
  try {
    const receipt = await request;
    assertCurrent(principal);
    return receipt;
  } finally {
    if (inFlight.get(physical) === request) inFlight.delete(physical);
  }
}

/** Call only after closing the successful composer. Unknown/stale keys are never cleared. */
export async function acknowledgeNormalSend(
  attempt_key: string,
): Promise<boolean> {
  const observed = acceptedIntents.get(attempt_key);
  if (!observed || !isStoragePrincipalCurrent(observed.principal)) return false;
  try {
    const physical = getPrincipalStorageKey(observed.key, observed.principal);
    if (!physical || !hasSendLocks()) return false;
    return await withSendLock(physical, () => {
      if (readRaw(observed.key, observed.principal) !== observed.raw)
        return false;
      if (
        !removePrincipalStorageItem(
          "local",
          observed.key,
          observed.principal,
        ) ||
        readRaw(observed.key, observed.principal) !== null
      )
        return false;
      acceptedIntents.delete(attempt_key);
      return true;
    });
  } catch {
    return false;
  }
}
