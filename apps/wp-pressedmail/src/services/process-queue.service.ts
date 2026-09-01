import { buildApiUrl, routeApiPrefix } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";
import type {
  SweepMatchCriteria,
  SweepSelectionMode,
} from "./one-off-sweep.service";
import type { FilterRuleFolderTarget } from "@/types/filter-rules";

/**
 * Typed client for the PressedMail process / activity queue
 * (`pressedmail/v1/process-queue`). Modeled on `one-off-sweep.service.ts`:
 * same base URL (`routeApiPrefix` + `buildApiUrl`) and REST nonce header.
 *
 * The backend is authoritative. `GET /process-queue` ALSO drains the queue
 * inline server-side, so polling it both reports and advances task progress.
 */

export type ProcessTaskKind =
  | "sync_gate"
  | "bulk_page"
  | "sync_track"
  | "client_op";

export type ProcessTaskStatus =
  | "queued"
  | "running"
  | "done"
  | "cancelled"
  | "skipped"
  | "failed";

export interface ProcessTask {
  id: number;
  group_id: string | null;
  parent_id: number | null;
  kind: ProcessTaskKind;
  status: ProcessTaskStatus;
  action: string | null;
  label: string | null;
  position: number;
  progress_current: number;
  progress_total: number;
  cancel_requested: boolean;
  error_message: string | null;
  created_at: string | null;
  started_at: string | null;
  completed_at: string | null;
}

export interface ListProcessTasksResult {
  status: string;
  tasks: ProcessTask[];
}

export interface CancelProcessTaskResult {
  status: string;
  cancelled: boolean;
}

export interface EnqueueSweepQueueRequest {
  selected_message_ids: string[];
  scope: unknown;
  action: string;
  sweep_scope_mode?: import("./one-off-sweep.service").SweepScopeMode;
  destination?: import("@/lib/folder-destination").FolderDestination;
  destination_folder_target?: FilterRuleFolderTarget | null;
  destination_folder_role?: "junk" | "trash";
  match?: SweepMatchCriteria;
  create_rule?: boolean;
  /** @deprecated legacy contract; new callers send sweep_scope_mode. */
  selection_mode?: SweepSelectionMode;
  excluded_message_ids?: string[];
}

export interface EnqueueSweepQueueResult {
  status: "queued" | string;
  group_id: string;
  page_count: number;
  candidate_count: number;
  senders: string[];
  match?: SweepMatchCriteria;
  rule_ids?: string[];
  existing_rule_ids?: string[];
  rule_error?: string | null;
  skipped_accounts?: import("./one-off-sweep.service").SweepSkippedAccount[];
  /**
   * True when the server matched an identical sweep that is already running and
   * returned that group instead of queuing a second one. Callers should say the
   * sweep is already running rather than claiming a new one was added.
   */
  deduplicated?: boolean;
}

export interface ProcessProcessQueueResult {
  status: string;
}

const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * Read the current task list. The GET drains the queue inline on the server,
 * so repeated calls are what drive progress forward.
 */
export async function listProcessTasks(): Promise<ProcessTask[]> {
  const response = await apiFetch(buildApiUrl(`${routeApiPrefix}/process-queue`), {
    method: "GET",
    credentials: "include",
    headers: getApiHeaders(),
  });

  const data = (await response.json().catch(() => ({}))) as Partial<
    ListProcessTasksResult & { message?: string }
  >;
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Could not load the activity queue");
  }

  return Array.isArray(data.tasks) ? data.tasks : [];
}

/** Request cancellation of a queued/running task. */
export async function cancelProcessTask(
  taskId: number,
): Promise<CancelProcessTaskResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/process-queue/cancel`),
    {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
      body: JSON.stringify({ task_id: taskId }),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Partial<
    CancelProcessTaskResult & { message?: string }
  >;
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Could not cancel the task");
  }

  return {
    status: data.status ?? "ok",
    cancelled: data.cancelled ?? false,
  };
}

/**
 * Enqueue a sweep onto the process queue. Accepts the same request shape as the
 * legacy direct sweep (`selected_message_ids`, `scope`, `action`,
 * `destination_folder`) and returns the queued group descriptor (202).
 */
export async function enqueueSweepQueue(
  request: EnqueueSweepQueueRequest,
): Promise<EnqueueSweepQueueResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/process-queue/enqueue-sweep`),
    {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
      body: JSON.stringify(request),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Partial<
    EnqueueSweepQueueResult & { message?: string }
  >;
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Could not queue the sweep");
  }

  return {
    status: data.status ?? "queued",
    group_id: data.group_id ?? "",
    page_count: data.page_count ?? 0,
    candidate_count: data.candidate_count ?? 0,
    senders: Array.isArray(data.senders) ? data.senders : [],
    match: data.match,
    rule_ids: Array.isArray(data.rule_ids) ? data.rule_ids : [],
    existing_rule_ids: Array.isArray(data.existing_rule_ids)
      ? data.existing_rule_ids
      : [],
    rule_error: typeof data.rule_error === "string" ? data.rule_error : null,
    skipped_accounts: Array.isArray(data.skipped_accounts)
      ? data.skipped_accounts
      : [],
    deduplicated: data.deduplicated === true,
  };
}

export interface ReportClientTaskResult {
  task_id: number;
  cancel_requested: boolean;
  /**
   * The task's lifecycle status (`task_status` on the wire, the response's
   * own `status` field is the ok/error envelope). A queued client_op flips to
   * "running" once the user has no earlier active backend work.
   */
  status?: ProcessTaskStatus;
}

/**
 * Create / advance / finish an FE-reported background op (`client_op`) so a client-driven
 * bulk action (summarize / phishing / auto-tag) shows in the Activity panel. Omit `task_id`
 * to create; pass it to advance/finish. Returns the task id + whether the user cancelled it
 * from the panel (so the caller can stop).
 */
export async function reportClientTask(attrs: {
  task_id?: number;
  label?: string;
  action?: string;
  group_id?: string;
  status?: ProcessTaskStatus;
  progress_current?: number;
  progress_total?: number;
  error?: string | null;
}): Promise<ReportClientTaskResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/process-queue/report`),
    {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
      body: JSON.stringify(attrs),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Partial<
    ReportClientTaskResult & { message?: string; task_status?: string | null }
  >;
  if (!response.ok) {
    throw new Error(data.message || "Could not report the activity task");
  }

  return {
    task_id: Number(data.task_id ?? 0),
    cancel_requested: Boolean(data.cancel_requested ?? false),
    status:
      typeof data.task_status === "string"
        ? (data.task_status as ProcessTaskStatus)
        : undefined,
  };
}

export interface ClearProcessHistoryResult {
  status: string;
  cleared: number;
}

/** Delete the user's finished tasks (the Activity panel's History tab). */
export async function clearProcessHistory(): Promise<ClearProcessHistoryResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/process-queue/clear-history`),
    {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Partial<
    ClearProcessHistoryResult & { message?: string }
  >;
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Could not clear the activity history");
  }

  return {
    status: data.status ?? "ok",
    cleared: Number(data.cleared ?? 0),
  };
}

/** Manual tick nudge: asks the server to advance the queue once. */
export async function processProcessQueue(): Promise<ProcessProcessQueueResult> {
  const response = await apiFetch(
    buildApiUrl(`${routeApiPrefix}/process-queue/process`),
    {
      method: "POST",
      credentials: "include",
      headers: getApiHeaders(),
    },
  );

  const data = (await response.json().catch(() => ({}))) as Partial<
    ProcessProcessQueueResult & { message?: string }
  >;
  if (!response.ok || data.status === "error") {
    throw new Error(data.message || "Could not advance the activity queue");
  }

  return { status: data.status ?? "ok" };
}
