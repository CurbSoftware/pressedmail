/**
 * Contacts and calendar import (Pro): the REST calls the account wizard, the
 * Accounts table and the Contacts & calendars settings page share.
 *
 * A connection is stored under a key: "<provider>:<account id>" when it came
 * from a mail account, the bare provider when it was set up on its own. A
 * two-way connection also sends edits made here back to the provider.
 */
import { __ } from "@wordpress/i18n";

import { apiFetch } from "@/lib/api-client";
import { routeApiPrefix } from "@/context/Strings";

export type ImportKind = "contacts" | "calendar";
export type ImportMode = "sync" | "once" | "two_way";
export type OAuthImportProvider = "google" | "outlook";

export interface AccountImportState {
  provider: string;
  mode: ImportMode;
  status: string;
  last_synced_at: string | null;
}

/** What /accounts/get stamps on each of the owner's rows while Pro import ships. */
export interface AccountImports {
  contacts: AccountImportState | null;
  calendar: AccountImportState | null;
}

export interface DavCredentials {
  url: string;
  username: string;
  password: string;
}

export interface ImportCallResult {
  success: boolean;
  error?: string;
  code?: string;
  /** The mode the server settled on, which may be narrower than asked. */
  mode?: ImportMode;
  /** Why two-way was not possible: read_only_grant or read_only_collection. */
  reason?: string;
}

function asMode(value: unknown): ImportMode {
  return value === "once" || value === "two_way" ? value : "sync";
}

export function importKey(provider: string, accountId: number): string {
  return accountId > 0 ? `${provider}:${accountId}` : provider;
}

const PATHS = {
  contacts: {
    oauth: "/contacts/sync/connect",
    dav: "/contacts/connect-carddav",
    mode: "/contacts/sync/mode",
    disconnect: "/contacts/sync/disconnect",
  },
  calendar: {
    oauth: "/calendar/connect",
    dav: "/calendar/connect-caldav",
    mode: "/calendar/sync/mode",
    disconnect: "/calendar/disconnect",
  },
} as const;

async function post(
  path: string,
  body: Record<string, unknown>,
): Promise<ImportCallResult> {
  try {
    const response = await apiFetch(`${routeApiPrefix}${path}`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => ({}));
    const reason = typeof data?.reason === "string" ? data.reason : undefined;
    if (response.ok && data?.status === "success") {
      return {
        success: true,
        ...(data?.mode ? { mode: asMode(data.mode) } : {}),
        ...(reason ? { reason } : {}),
      };
    }
    return {
      success: false,
      code: typeof data?.code === "string" ? data.code : undefined,
      ...(reason ? { reason } : {}),
      error:
        typeof data?.message === "string" && data.message
          ? data.message
          : __("The import could not be set up.", "pressedmail"),
    };
  } catch {
    return {
      success: false,
      error: __("The import could not be set up.", "pressedmail"),
    };
  }
}

/** Finish a relay sign-in the person already completed in the popup. */
export function connectOAuthImport(
  kind: ImportKind,
  provider: OAuthImportProvider,
  accountId: number,
  mode: ImportMode,
): Promise<ImportCallResult> {
  return post(PATHS[kind].oauth, { provider, account_id: accountId, mode });
}

export function connectDavImport(
  kind: ImportKind,
  credentials: DavCredentials,
  accountId: number,
  mode: ImportMode,
): Promise<ImportCallResult> {
  return post(PATHS[kind].dav, {
    ...credentials,
    account_id: accountId,
    mode,
  });
}

export function setImportMode(
  kind: ImportKind,
  key: string,
  mode: ImportMode,
): Promise<ImportCallResult> {
  return post(PATHS[kind].mode, { provider: key, mode });
}

export function disconnectImport(
  kind: ImportKind,
  key: string,
): Promise<ImportCallResult> {
  return post(PATHS[kind].disconnect, { provider: key });
}

/** Pull a contacts connection now. Calendars pull per calendar on their page. */
export function runContactsImport(key: string): Promise<ImportCallResult> {
  return post("/contacts/sync/trigger", { provider: key, direction: "pull" });
}

/** One connection, from either status route, in one shape. */
export interface ImportConnection {
  kind: ImportKind;
  key: string;
  provider: string;
  accountId: number;
  mode: ImportMode;
  failed: boolean;
  lastSyncedAt: string | null;
  /** Items changed on both sides that wait for a choice. */
  conflicts: number;
}

async function getJson(path: string): Promise<Record<string, unknown> | null> {
  try {
    const response = await apiFetch(`${routeApiPrefix}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json" },
    });
    const data = await response.json();
    return response.ok && data?.status === "success" ? data : null;
  } catch {
    return null;
  }
}

function asConnections(kind: ImportKind, rows: unknown): ImportConnection[] {
  if (!Array.isArray(rows)) return [];
  return rows.flatMap((row) => {
    if (!row || typeof row !== "object" || typeof row.key !== "string") {
      return [];
    }
    return [
      {
        kind,
        key: row.key,
        provider: String(row.provider ?? ""),
        accountId: Number(row.account_id ?? 0),
        mode: asMode(row.mode),
        failed: row.status === "error" || row.is_expired === true,
        lastSyncedAt:
          typeof row.last_synced_at === "string" ? row.last_synced_at : null,
        conflicts: Number.isFinite(Number(row.conflicts))
          ? Math.max(0, Number(row.conflicts))
          : 0,
      } satisfies ImportConnection,
    ];
  });
}

/** Every contacts and calendar connection this person has, mailbox-linked or not. */
export async function getImportConnections(options: {
  contacts: boolean;
  calendar: boolean;
}): Promise<ImportConnection[]> {
  const [contacts, calendar] = await Promise.all([
    options.contacts ? getJson("/contacts/sync/status") : null,
    options.calendar ? getJson("/calendar/sync-status") : null,
  ]);
  const contactRows = (contacts?.sync_status as { connections?: unknown })
    ?.connections;
  return [
    ...asConnections("contacts", contactRows),
    ...asConnections("calendar", calendar?.connections),
  ];
}
