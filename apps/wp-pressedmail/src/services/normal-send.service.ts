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
    | "pending"
    | "uncertain"
    | "not_accepted"
    | "unknown";
  message: string;
  attempt_key: string;
  error_type?: string;
  receipt_recorded?: boolean;
  message_id?: string;
  transport?: string | null;
  warning?: string;
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

async function sha256(
  bytes: ArrayBuffer,
  principal: StoragePrincipal,
): Promise<string> {
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
    outcome === "accepted"
      ? "success"
      : outcome === "pending"
        ? "pending"
        : "error";
  const state =
    outcome === "failed" || outcome === "invalid"
      ? "not_accepted"
      : outcome === "accepted" ||
          outcome === "pending" ||
          outcome === "uncertain"
        ? outcome
        : "unknown";
  if (value.status !== status || value.delivery_state !== state) return null;
  return {
    status,
    outcome,
    http_status: http,
    delivery_state: state,
    message: value.message,
    attempt_key: attempt,
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
    if (receipt.outcome === "accepted") {
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
    attempt = window.crypto.randomUUID();
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
export async function sendNormalEmail(
  formData: FormData,
  options: NormalSendOptions = {},
): Promise<NormalSendReceipt> {
  if (!window.crypto?.subtle || typeof window.crypto.randomUUID !== "function")
    throw new NormalSendError("crypto_unavailable");
  const principal = captureStoragePrincipal();
  if (!principal) throw new NormalSendError("storage_unavailable");
  if (typeof navigator.locks?.request !== "function")
    throw new NormalSendError("locks_unavailable");
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
        await navigator.locks.request(
          physical,
          { mode: "exclusive" },
          (lock) => {
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
          },
        ),
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
    if (!physical || typeof navigator.locks?.request !== "function")
      return false;
    return await navigator.locks.request(
      physical,
      { mode: "exclusive" },
      () => {
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
      },
    );
  } catch {
    return false;
  }
}
