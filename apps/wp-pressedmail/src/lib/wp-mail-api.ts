import { apiJson, apiPost } from "@/lib/api-client";
import { getPluginRestBase } from "@/lib/runtime-config";
import type { SmtpConnectionCapabilities } from "@/components/wp-mail/types";

/**
 * WordPress system-email (wp_mail) SMTP API: administrator endpoints under
 * /wp-mail/* (see Controllers/SmtpConfigs/Actions.php and LogActions.php).
 *
 * Present in both editions. What the current site may actually do comes back
 * from the server as `capabilities`, so the client never infers it from a build
 * flag.
 */

export interface WpMailConnectionView {
  id: string;
  label: string;
  enabled: boolean;
  position: number;
  host: string;
  port: number;
  security: "none" | "ssl" | "tls";
  auth: boolean;
  username: string;
  /** A password is stored server-side. It is never sent to the client. */
  hasPassword: boolean;
  fromEmail: string;
  fromName: string;
  forceFrom: boolean;
  fromAddresses: string[];
  fallbackId: string;
  isDefault: boolean;
  isUsable: boolean;
  issues: string[];
  claimedAddresses: string[];
}

export interface WpMailSettingsView {
  enabled: boolean;
  defaultConnectionId: string;
  logRetentionDays: number;
}

export interface WpMailState {
  settings: WpMailSettingsView;
  connections: WpMailConnectionView[];
  capabilities: SmtpConnectionCapabilities & { log: boolean };
  configurationIssues: string[];
  health: WpMailHealthView[];
}

export interface WpMailHealthView {
  status: "failed";
  connectionId: string;
  connectionLabel: string;
  message: string;
  updatedAt: string;
}

export interface WpMailConnectionInput {
  label?: string;
  enabled?: boolean;
  host?: string;
  port?: number;
  security?: "none" | "ssl" | "tls";
  auth?: boolean;
  username?: string;
  /** Empty keeps the stored password. */
  password?: string;
  fromEmail?: string;
  fromName?: string;
  forceFrom?: boolean;
  fromAddresses?: string[];
  fallbackId?: string;
  replacementDefaultId?: string;
  disableRuntime?: boolean;
}

export interface WpMailMutationResult {
  ok: boolean;
  state?: WpMailState;
  errors?: Record<string, string>;
  message?: string;
}

export interface WpMailTestResult {
  ok: boolean;
  message: string;
}

export interface WpMailLogEntry {
  id: number;
  createdAt: string;
  toSummary: string;
  recipientCount: number;
  subject: string;
  fromEmail: string;
  connectionId: string;
  connectionLabel: string;
  status: "sent" | "failed";
  attempt: number;
  error: string;
}

export interface WpMailLogPage {
  entries: WpMailLogEntry[];
  total: number;
  page: number;
  perPage: number;
  logRetentionDays: number;
}

function endpoint(path: string): string {
  return `${getPluginRestBase().replace(/\/$/, "")}/wp-mail${path}`;
}

function readState(body: unknown): WpMailState | undefined {
  const candidate = body as Partial<WpMailState> | undefined;
  if (
    !candidate?.settings ||
    !candidate.connections ||
    !candidate.capabilities
  ) {
    return undefined;
  }

  return {
    settings: candidate.settings,
    connections: candidate.connections,
    capabilities: candidate.capabilities,
    configurationIssues: candidate.configurationIssues ?? [],
    health: candidate.health ?? [],
  };
}

function readMessage(res: unknown): string | undefined {
  const message = (res as { message?: unknown }).message;
  return typeof message === "string" ? message : undefined;
}

function toResult(res: unknown): WpMailMutationResult {
  const status = (res as { status?: string }).status;
  if (status === "success") {
    return { ok: true, state: readState(res) };
  }

  return {
    ok: false,
    state: readState(res),
    errors: (res as { errors?: Record<string, string> }).errors,
    message: readMessage(res),
  };
}

export async function fetchWpMailState(): Promise<WpMailState> {
  const body = await apiJson<Partial<WpMailState>>(endpoint("/settings"));
  const state = readState(body);
  if (!state) {
    throw new Error("Missing WordPress email settings payload");
  }
  return state;
}

export async function saveWpMailSettings(
  settings: Partial<WpMailSettingsView>,
): Promise<WpMailMutationResult> {
  return toResult(await apiPost(endpoint("/settings"), { settings }));
}

export async function createWpMailConnection(
  connection: WpMailConnectionInput,
): Promise<WpMailMutationResult> {
  return toResult(
    await apiPost(endpoint("/connections/create"), { connection }),
  );
}

export async function updateWpMailConnection(
  id: string,
  connection: WpMailConnectionInput,
): Promise<WpMailMutationResult> {
  return toResult(
    await apiPost(endpoint(`/connections/update/${encodeURIComponent(id)}`), {
      connection,
    }),
  );
}

export async function deleteWpMailConnection(
  id: string,
  transition: Pick<
    WpMailConnectionInput,
    "replacementDefaultId" | "disableRuntime"
  > = {},
): Promise<WpMailMutationResult> {
  return toResult(
    await apiPost(endpoint(`/connections/delete/${encodeURIComponent(id)}`), {
      transition,
    }),
  );
}

export async function setDefaultWpMailConnection(
  id: string,
): Promise<WpMailMutationResult> {
  return toResult(
    await apiPost(
      endpoint(`/connections/set-default/${encodeURIComponent(id)}`),
      {},
    ),
  );
}

export async function reorderWpMailConnections(
  order: string[],
): Promise<WpMailMutationResult> {
  return toResult(await apiPost(endpoint("/connections/reorder"), { order }));
}

/**
 * Send a test message.
 *
 * `connection` carries any unsaved edits so credentials can be validated before
 * they are stored; `connectionId` selects which saved connection to fall back to
 * for anything the caller did not override.
 */
export async function testWpMailConnection(
  connection: WpMailConnectionInput,
  recipientEmail: string,
  connectionId?: string,
): Promise<WpMailTestResult> {
  const res = await apiPost(endpoint("/test"), {
    connection,
    connectionId: connectionId ?? "",
    recipientEmail,
  });

  return {
    ok: (res as { status?: string }).status === "success",
    message: readMessage(res) ?? "",
  };
}

export async function fetchWpMailLog(
  page = 1,
  perPage = 25,
  status = "",
): Promise<WpMailLogPage> {
  const params = new URLSearchParams({
    page: String(page),
    per_page: String(perPage),
  });
  if (status) {
    params.set("status", status);
  }

  const body = await apiJson<Partial<WpMailLogPage>>(
    `${endpoint("/log")}?${params.toString()}`,
  );

  return {
    entries: body.entries ?? [],
    total: body.total ?? 0,
    page: body.page ?? page,
    perPage: body.perPage ?? perPage,
    logRetentionDays: body.logRetentionDays ?? 0,
  };
}

export async function clearWpMailLog(): Promise<boolean> {
  const res = await apiPost(endpoint("/log/clear"), {});
  return (res as { status?: string }).status === "success";
}
