/**
 * Contacts and calendar import (Pro): the REST calls the account wizard, the
 * Accounts table and the Contacts & calendars settings page share.
 *
 * A connection is stored under a key the server hands out: "<provider>:<account
 * id>" when it came from a mail account; set up on its own, the bare provider
 * for the first account and "<provider>.2" to ".10" for the next ones. Nothing
 * here takes a key apart: the status rows say which provider and mailbox a key
 * belongs to. A two-way connection also sends edits made here back.
 */
import { __ } from "@wordpress/i18n";

import { apiFetch } from "@/lib/api-client";
import { routeApiPrefix } from "@/context/Strings";
import type { ConnectedCalendar } from "@/types/calendar";
import type { SyncResult } from "@/types/contacts";

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
  /** The key the server stored a new connection under. */
  key?: string;
  /** What the server said on success, such as "The connection works." */
  message?: string;
  /** What a contacts import did. */
  result?: SyncResult;
  /** How many events a calendar sync left out because it cannot hold them yet. */
  skipped?: number;
}

function asMode(value: unknown): ImportMode {
  return value === "once" || value === "two_way" ? value : "sync";
}

const PATHS = {
  contacts: {
    oauth: "/contacts/sync/connect",
    dav: "/contacts/connect-carddav",
    mode: "/contacts/sync/mode",
    disconnect: "/contacts/sync/disconnect",
    sync: "/contacts/sync/trigger",
    test: "/contacts/sync/test",
  },
  calendar: {
    oauth: "/calendar/connect",
    dav: "/calendar/connect-caldav",
    mode: "/calendar/sync/mode",
    disconnect: "/calendar/disconnect",
    sync: "/calendar/sync/trigger",
    test: "/calendar/sync/test",
  },
} as const;

async function post(
  path: string,
  body: Record<string, unknown>,
  /** What to say when the server gave no reason. */
  fallback: string = __("The import could not be set up.", "pressedmail"),
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
        ...(typeof data?.key === "string" ? { key: data.key } : {}),
        ...(typeof data?.message === "string" && data.message
          ? { message: data.message }
          : {}),
        ...(data?.result && typeof data.result === "object"
          ? { result: data.result as SyncResult }
          : {}),
        ...(Number(data?.sync_result?.skipped) > 0
          ? { skipped: Number(data.sync_result.skipped) }
          : {}),
      };
    }
    return {
      success: false,
      code: typeof data?.code === "string" ? data.code : undefined,
      ...(reason ? { reason } : {}),
      error:
        typeof data?.message === "string" && data.message
          ? data.message
          : fallback,
    };
  } catch {
    return { success: false, error: fallback };
  }
}

/**
 * Finish a relay sign-in the person already completed in the popup. With a
 * key, the sign-in replaces the grant of that existing connection (signing in
 * again, allowing changes); without one, a mailbox's import uses that mailbox
 * and anything else becomes a new account beside the ones already there.
 */
export function connectOAuthImport(
  kind: ImportKind,
  provider: OAuthImportProvider,
  accountId: number,
  mode: ImportMode,
  key?: string,
): Promise<ImportCallResult> {
  return post(PATHS[kind].oauth, {
    provider,
    account_id: accountId,
    mode,
    ...(key ? { key } : {}),
  });
}

export function connectDavImport(
  kind: ImportKind,
  credentials: DavCredentials,
  accountId: number,
  mode: ImportMode,
  /** What the person calls this server. The sign-in name stands in when empty. */
  displayName?: string,
): Promise<ImportCallResult> {
  return post(PATHS[kind].dav, {
    ...credentials,
    account_id: accountId,
    mode,
    ...(displayName ? { display_name: displayName } : {}),
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

/** Sync one connection now: its contacts, or every calendar of it that is switched on. */
export function runImport(
  kind: ImportKind,
  key: string,
): Promise<ImportCallResult> {
  return post(
    PATHS[kind].sync,
    { provider: key },
    __("Sync failed.", "pressedmail"),
  );
}

/** Check that a saved connection still signs in and answers. Imports nothing. */
export function testImport(
  kind: ImportKind,
  key: string,
): Promise<ImportCallResult> {
  return post(
    PATHS[kind].test,
    { provider: key },
    __("Something went wrong. Reload the page and try again.", "pressedmail"),
  );
}

/** Switch one imported calendar on or off. */
export function setCalendarImportEnabled(
  calendarId: number,
  enabled: boolean,
): Promise<ImportCallResult> {
  return post(
    `/calendar/calendars/${calendarId}/toggle-sync`,
    { enabled },
    __("Could not update sync.", "pressedmail"),
  );
}

/** One connection, from either status route, in one shape. */
export interface ImportConnection {
  kind: ImportKind;
  key: string;
  provider: string;
  accountId: number;
  /** The signed-in address, or the name given to a DAV server. Empty on older connections. */
  label: string;
  /** Contacts imported, or calendars found. */
  count: number;
  mode: ImportMode;
  failed: boolean;
  lastSyncedAt: string | null;
  /** Items changed on both sides that wait for a choice. */
  conflicts: number;
}

const PROVIDER_NAMES: Record<string, string> = {
  google: "Google",
  outlook: "Microsoft",
  carddav: "CardDAV",
  caldav: "CalDAV",
};

/**
 * What to call a connection where several can sit side by side: its label,
 * else its mailbox, else its provider. With the provider in front unless the
 * surroundings already name it.
 */
export function connectionName(
  connection: ImportConnection,
  accounts: ReadonlyArray<{ id: string | number; email: string }>,
  withProvider = true,
): string {
  const provider = PROVIDER_NAMES[connection.provider] ?? connection.provider;
  const who =
    connection.label ||
    accounts.find((account) => Number(account.id) === connection.accountId)
      ?.email;
  if (!who) return provider;
  return withProvider ? `${provider} · ${who}` : who;
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
        label: typeof row.label === "string" ? row.label : "",
        count: Math.max(
          0,
          Number(row.contact_count ?? row.calendars ?? 0) || 0,
        ),
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

/**
 * Every contacts and calendar connection this person has, mailbox-linked or
 * not. Null when a read that was asked for failed: "could not find out" is
 * not "there are none", and a caller must not show it as that.
 */
export async function getImportConnections(options: {
  contacts: boolean;
  calendar: boolean;
}): Promise<ImportConnection[] | null> {
  const [contacts, calendar] = await Promise.all([
    options.contacts ? getJson("/contacts/sync/status") : null,
    options.calendar ? getJson("/calendar/sync-status") : null,
  ]);
  if ((options.contacts && !contacts) || (options.calendar && !calendar)) {
    return null;
  }
  const contactRows = (contacts?.sync_status as { connections?: unknown })
    ?.connections;
  return [
    ...asConnections("contacts", contactRows),
    ...asConnections("calendar", calendar?.connections),
  ];
}

/** Every imported calendar, each naming its connection in `connection`. Null when the read failed. */
export async function getImportCalendars(): Promise<
  ConnectedCalendar[] | null
> {
  const data = await getJson("/calendar/calendars");
  if (!data) return null;
  return Array.isArray(data.calendars)
    ? (data.calendars as ConnectedCalendar[])
    : [];
}
