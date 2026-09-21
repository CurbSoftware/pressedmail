export const PRINCIPAL_CHANGE_EVENT = "pressedmail:principal-change";

export interface StoragePrincipal {
  readonly site: string;
  readonly userId: number;
}

export interface PrincipalChangeDetail {
  reason: string;
  principal: StoragePrincipal | null;
}

type StorageArea = "local" | "session";
type InvalidationHandler = (detail: PrincipalChangeDetail) => void;

const KEY_PREFIX = "pressedmail:principal:v1:";
const ACTIVE_PREFIX = "pressedmail:active-principal:v1:";
const LEGACY_KEYS = [
  "compose-draft",
  "pressedmail-user",
  "pressedmail-accounts",
  "pressedmail-selectedAccount",
  "pressedmail-selectedConsolidatedAccountIds",
  "pressedmail-defaultAccountId",
  "pressedmail-compose-draft",
  "pressedmail-message-cache",
  "pressedmail-detail-cache",
  "pressedmail-folder-cache",
  "pressedmail-open-pane",
  "pressedmail-sync-tokens",
  "pressedmail-sync-state",
  "pressedmail-recent-searches",
  "pressedmail_recent_searches",
  "pressedmail-selected-folder",
  "pressedmail-first-sync-done",
  "pressedmail-entry-bootstrap-done",
  "pressedmail-session-started-at",
  "pressedmail-undo-send-failures-seen",
  "pressedmail.sidebar.accordion.expanded",
  "pressedmail-email-summaries:v1",
];

let initialized = false;
let invalidated = false;
let principal: StoragePrincipal | null = null;
let activeKey = "";
let activeValue: string | null = null;
let onInvalidation: InvalidationHandler | undefined;

function storage(area: StorageArea): Storage | null {
  try {
    if (typeof window === "undefined") return null;
    return area === "local" ? window.localStorage : window.sessionStorage;
  } catch {
    return null;
  }
}

function readBootstrapPrincipal(): StoragePrincipal | null {
  try {
    const root = window.pressedmailPlugin?.wpApiSettings?.root;
    const userId = window.pressedmailPlugin?.userInfo?.userId;
    if (
      typeof root !== "string" ||
      !/^https?:\/\//i.test(root) ||
      // eslint-disable-next-line no-control-regex -- Reject control bytes in trusted bootstrap URLs.
      /[\u0000-\u0020\u007f]/.test(root) ||
      typeof userId !== "number" ||
      !Number.isSafeInteger(userId) ||
      userId <= 0
    ) {
      return null;
    }
    const url = new URL(root);
    if (url.username || url.password) return null;
    const site = url.origin + (url.pathname.replace(/\/+$/, "") || "/");
    return Object.freeze({ site, userId });
  } catch {
    return null;
  }
}

/** Delete ambiguous old values without assigning them to the current user. */
export function purgeLegacyPrincipalStorage(): void {
  for (const area of ["local", "session"] as const) {
    const target = storage(area);
    if (!target) continue;
    for (const key of LEGACY_KEYS) {
      try {
        target.removeItem(key);
      } catch {
        // Disabled storage must not prevent the app from opening.
      }
    }
    try {
      for (let index = target.length - 1; index >= 0; index--) {
        const key = target.key(index);
        if (key?.startsWith("pressedmail:folder-tree:expanded:")) {
          target.removeItem(key);
        }
      }
    } catch {
      // Enumeration and deletion can also be blocked by browser policy.
    }
  }
}

function handleStorageChange(event: StorageEvent): void {
  if (event.key !== activeKey && event.key !== null) return;
  if (event.storageArea && event.storageArea !== storage("local")) return;
  // Read the latest marker rather than trusting a queued, possibly older event.
  isStoragePrincipalCurrent(principal);
}

/**
 * Scoped keys a purge leaves alone.
 *
 * These hold nothing a user can read: an unresolved normal-send guard is an
 * account id, a payload hash and an attempt key. The app still needs it after
 * the session that wrote it ends, because dropping it lets a message the server
 * already accepted be sent a second time. Everything else scoped to a session
 * goes, including keys this list does not yet know about.
 *
 * Mirror of PURGE_KEEPS in includes/Services/BrowserStorageCleanup.php.
 */
const PURGE_KEEPS = ["normal-send-intent:"];

/**
 * Drop keys PressedMail scoped to a signed-in user, in both storage areas.
 *
 * Cached message content, the compose draft, the account list and recent searches
 * all belong to the session that wrote them, and none of them may be left for
 * whoever uses this browser next. Cosmetic preferences (theme, layout, typography)
 * are not scoped to a user and stay where they are.
 *
 * Pass the principal whose session ended to drop only that user's keys, which is
 * what a page can do without disturbing another session sharing the browser. With
 * no principal, every scoped key goes: that is the sign-out sweep, where the
 * browser knows somebody left but not who, and the mirror of it on the WordPress
 * side is BrowserStorageCleanup, which runs it from the screen a logout lands on.
 * Keep the two in step.
 */
export function purgePrincipalStorage(
  outgoing: StoragePrincipal | null = null,
): void {
  const scoped = outgoing ? scopedKeyPrefix(outgoing) : null;
  sweepScopedKeys((key) => {
    const ours = key.startsWith(KEY_PREFIX);
    // A scoped key for one user reads
    // pressedmail:principal:v1:["<site>",<userId>,"<key>"], so the JSON of the
    // pair plus a comma is exactly the start of that user's keys.
    const belongsToOutgoing = scoped !== null && ours && key.startsWith(scoped);
    const wholeStore =
      scoped === null && (ours || key.startsWith(ACTIVE_PREFIX));
    return belongsToOutgoing || wholeStore;
  });
}

/**
 * Drop scoped keys that belong to anyone but `keep`.
 *
 * The sign-out sweep for a page that is already signed in again: this browser was
 * marked when a session ended, and this page knows which user it is serving now.
 * That user's own keys stay, so signing out and back in on your own machine does
 * not throw away the draft you were typing; every other principal's keys go
 * before the app reads anything. With no resolvable principal there is no way to
 * tell whose keys these are, so all of them go.
 */
function purgeForeignPrincipalStorage(keep: StoragePrincipal | null): void {
  if (!keep) {
    purgePrincipalStorage();
    return;
  }
  const mine = scopedKeyPrefix(keep);
  sweepScopedKeys((key) => key.startsWith(KEY_PREFIX) && !key.startsWith(mine));
}

/** Walk both storage areas, dropping the keys `drop` claims, minus the keeps. */
function sweepScopedKeys(drop: (physicalKey: string) => boolean): void {
  for (const area of ["local", "session"] as const) {
    const target = storage(area);
    if (!target) continue;
    try {
      for (let index = target.length - 1; index >= 0; index--) {
        const key = target.key(index);
        if (!key || isKeptOnPurge(key)) continue;
        if (drop(key)) target.removeItem(key);
      }
    } catch {
      // Enumeration and deletion can be blocked by browser policy.
    }
  }
}

/**
 * Whether a physical key carries one of the logical keys a purge leaves alone.
 *
 * A scoped key ends with the logical key as a JSON string, so the opening quote
 * is what marks the start of one.
 */
function isKeptOnPurge(physicalKey: string): boolean {
  return PURGE_KEEPS.some((logicalKey) =>
    physicalKey.includes(`"${logicalKey}`),
  );
}

function scopedKeyPrefix(principal: StoragePrincipal): string {
  return `${KEY_PREFIX}${JSON.stringify([
    principal.site,
    principal.userId,
  ]).slice(0, -1)},`;
}

/** Call before mounting the app. Later calls never adopt a different principal. */
export function initializePrincipalStorage(
  onInvalidate?: InvalidationHandler,
): StoragePrincipal | null {
  if (onInvalidate) onInvalidation = onInvalidate;
  if (initialized) return invalidated ? null : principal;
  initialized = true;
  purgeLegacyPrincipalStorage();
  const bootPrincipal = readBootstrapPrincipal();
  // PHP marks the browser when a session ended. The login screen clears the data
  // itself; this covers a site that redirects a sign-out somewhere else. The user
  // this page is serving now keeps their own keys: they came back to their own
  // browser and the draft they were typing is theirs. Everyone else's goes before
  // the app reads anything.
  if (window.pressedmailPlugin?.purgeBrowserStorage === true) {
    purgeForeignPrincipalStorage(bootPrincipal);
  }
  if (!bootPrincipal) return null;
  principal = bootPrincipal;

  activeKey = ACTIVE_PREFIX + JSON.stringify(principal.site);
  try {
    const local = storage("local");
    if (!local) return principal;
    const previous = local.getItem(activeKey);
    let marker: unknown;
    try {
      marker = previous ? JSON.parse(previous) : null;
    } catch {
      marker = null;
    }
    if (
      Array.isArray(marker) &&
      marker.length === 2 &&
      marker[0] === principal.userId &&
      typeof marker[1] === "string" &&
      marker[1] !== ""
    ) {
      activeValue = previous;
    } else {
      // A marker that names somebody else is the previous user's session on a
      // shared browser. Their mail is still in this storage area, so it goes
      // before this user's app reads anything.
      if (
        Array.isArray(marker) &&
        marker.length === 2 &&
        typeof marker[0] === "number" &&
        marker[0] !== principal.userId
      ) {
        purgePrincipalStorage({ site: principal.site, userId: marker[0] });
      }
      const transitionId = window.crypto
        .getRandomValues(new Uint32Array(4))
        .join("-");
      const next = JSON.stringify([principal.userId, transitionId]);
      local.setItem(activeKey, next);
      activeValue = next;
    }
    window.addEventListener("storage", handleStorageChange);
  } catch {
    // Without a shared marker, all sensitive persistence fails closed.
    activeValue = null;
  }
  return principal;
}

/** Capture before starting async work and supply it again when storing results. */
export function captureStoragePrincipal(): StoragePrincipal | null {
  initializePrincipalStorage();
  return isStoragePrincipalCurrent(principal) ? principal : null;
}

export function isStoragePrincipalCurrent(
  captured: StoragePrincipal | null,
): boolean {
  if (!isRequestPrincipalCurrent(captured) || !activeValue) return false;
  try {
    return storage("local")?.getItem(activeKey) === activeValue;
  } catch {
    return false;
  }
}

/** Request identity remains usable when the browser disables persistence. */
export function captureRequestPrincipal(): StoragePrincipal | null {
  initializePrincipalStorage();
  return isRequestPrincipalCurrent(principal) ? principal : null;
}

export function isRequestPrincipalCurrent(
  captured: StoragePrincipal | null,
): boolean {
  initializePrincipalStorage();
  if (invalidated || !principal || captured !== principal) return false;
  const current = readBootstrapPrincipal();
  if (current?.site !== principal.site || current.userId !== principal.userId) {
    invalidatePrincipalStorage("bootstrap-changed");
    return false;
  }
  if (!activeValue) return true;
  try {
    const local = storage("local");
    if (!local) return true;
    if (local.getItem(activeKey) !== activeValue) {
      invalidatePrincipalStorage("principal-changed");
      return false;
    }
    return true;
  } catch {
    return true;
  }
}

/** Invalidate first, then let the application clear memory and reload via callback. */
export function invalidatePrincipalStorage(reason = "principal-changed"): void {
  if (invalidated) return;
  initialized = true;
  invalidated = true;
  try {
    const local = storage("local");
    if (activeValue && local?.getItem(activeKey) === activeValue) {
      local.removeItem(activeKey);
    }
  } catch {
    // Invalidate this page even if notifying sibling tabs is unavailable.
  }
  // Every caller here means the same thing: this page was showing one user's
  // mailbox and that user is gone (a different principal, a lost session). The
  // stored copy belongs to that session, so it goes with it, even in a tab the
  // user abandoned. Without a resolved principal there is no way to tell whose
  // keys these are, and an unidentifiable page drops them all.
  purgePrincipalStorage(principal);
  if (typeof window !== "undefined") {
    window.removeEventListener("storage", handleStorageChange);
    window.dispatchEvent(
      new CustomEvent<PrincipalChangeDetail>(PRINCIPAL_CHANGE_EVENT, {
        detail: { reason, principal },
      }),
    );
  }
  onInvalidation?.({ reason, principal });
}

/** Physical key for native storage-event matching. Use the guarded API for writes. */
export function getPrincipalStorageKey(
  key: string,
  captured = captureStoragePrincipal(),
): string | null {
  if (!captured || !key || !isStoragePrincipalCurrent(captured)) return null;
  return KEY_PREFIX + JSON.stringify([captured.site, captured.userId, key]);
}

export function getPrincipalStorageItem(
  area: StorageArea,
  key: string,
  captured = captureStoragePrincipal(),
): string | null {
  const scopedKey = getPrincipalStorageKey(key, captured);
  if (!scopedKey) return null;
  try {
    return storage(area)?.getItem(scopedKey) ?? null;
  } catch {
    return null;
  }
}

export function setPrincipalStorageItem(
  area: StorageArea,
  key: string,
  value: string,
  captured = captureStoragePrincipal(),
): boolean {
  const scopedKey = getPrincipalStorageKey(key, captured);
  if (!scopedKey) return false;
  try {
    const target = storage(area);
    if (!target) return false;
    target.setItem(scopedKey, value);
    return true;
  } catch {
    return false;
  }
}

export function removePrincipalStorageItem(
  area: StorageArea,
  key: string,
  captured = captureStoragePrincipal(),
): boolean {
  const scopedKey = getPrincipalStorageKey(key, captured);
  if (!scopedKey) return false;
  try {
    const target = storage(area);
    if (!target) return false;
    target.removeItem(scopedKey);
    return true;
  } catch {
    return false;
  }
}
