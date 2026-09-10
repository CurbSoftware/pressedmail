/**
 * Filter Rules Service
 *
 * Service for managing email filter rules - CRUD operations
 * and rule matching engine for automatic email processing.
 *
 * @since 1.5.0
 */

import { routeApiPrefix, buildApiUrl } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";
import type {
  FilterRule,
  FilterCondition,
  FilterAction,
  CreateFilterRuleData,
  UpdateFilterRuleData,
  FilterRuleOperationResult,
  FilterMatchResult,
  ConditionLogic,
  FilterRuleRunJob,
  FilterRuleRunPreview,
  FilterRuleRunRequest,
  FilterRuleRunScope,
} from "@/types/filter-rules";
import { DEFAULT_FILTER_RULE_TRIGGERS } from "@/types/filter-rules";
import type { EmailMessage } from "@/types/index";

/**
 * Get API headers including WordPress nonce.
 */
const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * Generate a unique ID for conditions and actions.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Fetch all filter rules for an account.
 */
export async function fetchFilterRules(
  accountId?: number | null,
): Promise<FilterRule[]> {
  const url =
    typeof accountId === "number"
      ? buildApiUrl(`${routeApiPrefix}/filter-rules`, {
          account_id: accountId,
        })
      : buildApiUrl(`${routeApiPrefix}/filter-rules`);

  const response = await apiFetch(url, {
    method: "GET",
    credentials: "include",
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch filter rules: ${response.statusText}`);
  }

  const data = await response.json();
  return data.rules || [];
}

/**
 * Create a new filter rule.
 */
export async function createFilterRule(
  data: CreateFilterRuleData,
): Promise<FilterRuleOperationResult> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/create`);

  // Add IDs to conditions and actions
  const ruleData = {
    ...data,
    runTriggers: data.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS,
    scheduleIntervalMinutes: data.scheduleIntervalMinutes ?? null,
    conditions: data.conditions.map((c) => ({ ...c, id: generateId() })),
    actions: data.actions.map((a) => ({ ...a, id: generateId() })),
  };

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
    body: JSON.stringify(ruleData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        error.message || `Failed to create filter rule: ${response.statusText}`,
    };
  }

  const result = await response.json();
  return {
    success: true,
    rule: result.rule,
  };
}

/**
 * Update an existing filter rule.
 */
export async function updateFilterRule(
  ruleId: string,
  data: UpdateFilterRuleData,
): Promise<FilterRuleOperationResult> {
  // Route class supports GET/POST only. Update is POST /update/{id}.
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/update/${ruleId}`);

  // Add IDs to any new conditions and actions
  const updateData = {
    ...data,
    conditions: data.conditions?.map((c) => ({
      ...c,
      id: (c as FilterCondition).id || generateId(),
    })),
    actions: data.actions?.map((a) => ({
      ...a,
      id: (a as FilterAction).id || generateId(),
    })),
  };

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
    body: JSON.stringify(updateData),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        error.message || `Failed to update filter rule: ${response.statusText}`,
    };
  }

  const result = await response.json();
  return {
    success: true,
    rule: result.rule,
  };
}

/**
 * Delete a filter rule.
 */
export async function deleteFilterRule(
  ruleId: string,
): Promise<{ success: boolean; error?: string }> {
  // Route class supports GET/POST only. Delete is POST /delete/{id}.
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/delete/${ruleId}`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        error.message || `Failed to delete filter rule: ${response.statusText}`,
    };
  }

  return { success: true };
}

/**
 * Toggle a filter rule's enabled state.
 */
export async function toggleFilterRule(
  ruleId: string,
  enabled: boolean,
): Promise<FilterRuleOperationResult> {
  return updateFilterRule(ruleId, { enabled });
}

/**
 * Reorder filter rules by priority.
 */
/**
 * Reorder the user's rules.
 *
 * Priority is global across accounts: the server assigns it straight from this
 * list. It never read the account_id this used to post, so the parameter only
 * made the contract look account-scoped when it never was. Reordering inside a
 * filtered tab is folded back into the full order by mergeFilteredReorder
 * before it gets here.
 */
export async function reorderFilterRules(
  ruleIds: string[],
): Promise<{ success: boolean; error?: string }> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/reorder`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
    body: JSON.stringify({ rule_ids: ruleIds }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    return {
      success: false,
      error:
        error.message ||
        `Failed to reorder filter rules: ${response.statusText}`,
    };
  }

  return { success: true };
}

function toApiScope(scope: FilterRuleRunScope): Record<string, unknown> {
  return {
    mode: scope.mode,
    account_id: scope.accountId,
    account_ids: scope.accountIds ?? [],
    folder: scope.folder,
    folder_map: scope.folderMap ?? {},
    filters: scope.filters ?? {},
    sync_first: scope.syncFirst ?? true,
    refs: (scope.refs ?? []).map((ref) => ({
      account_id: ref.accountId,
      uid: ref.uid,
      folder: ref.folder,
    })),
  };
}

function toApiRunRequest(
  request: FilterRuleRunRequest,
): Record<string, unknown> {
  return {
    rule_ids: request.ruleIds,
    scope: toApiScope(request.scope),
  };
}

function normalizePreview(data: Record<string, unknown>): FilterRuleRunPreview {
  const preview = (data.preview ?? data) as Record<string, unknown>;
  return {
    candidateCount: Number(
      preview.candidateCount ?? preview.candidate_count ?? 0,
    ),
    supportedRuleIds: Array.isArray(
      preview.supportedRuleIds ?? preview.supported_rule_ids,
    )
      ? (
          (preview.supportedRuleIds ?? preview.supported_rule_ids) as unknown[]
        ).map(String)
      : [],
    unsupportedRules: Array.isArray(
      preview.unsupportedRules ?? preview.unsupported_rules,
    )
      ? ((preview.unsupportedRules ??
          preview.unsupported_rules) as FilterRuleRunPreview["unsupportedRules"])
      : [],
    requiresSync: Boolean(preview.requiresSync ?? preview.requires_sync),
    scope: preview.scope as FilterRuleRunScope | undefined,
  };
}

function normalizeRun(data: Record<string, unknown>): FilterRuleRunJob {
  const run = (data.run ?? data) as Record<string, unknown>;
  return {
    id: Number(run.id),
    status: String(run.status ?? "queued") as FilterRuleRunJob["status"],
    mode: run.mode as FilterRuleRunJob["mode"],
    scope: run.scope as FilterRuleRunScope | undefined,
    ruleIds: Array.isArray(run.ruleIds ?? run.rule_ids)
      ? ((run.ruleIds ?? run.rule_ids) as unknown[]).map(String)
      : [],
    unsupportedRules: Array.isArray(
      run.unsupportedRules ?? run.unsupported_rules,
    )
      ? ((run.unsupportedRules ??
          run.unsupported_rules) as FilterRuleRunJob["unsupportedRules"])
      : [],
    candidateCount: Number(run.candidateCount ?? run.candidate_count ?? 0),
    matchedCount: Number(run.matchedCount ?? run.matched_count ?? 0),
    processedCount: Number(run.processedCount ?? run.processed_count ?? 0),
    changedCount: Number(run.changedCount ?? run.changed_count ?? 0),
    failedCount: Number(run.failedCount ?? run.failed_count ?? 0),
    skippedCount: Number(run.skippedCount ?? run.skipped_count ?? 0),
    requiresSync: Boolean(run.requiresSync ?? run.requires_sync),
    cancelRequested: Boolean(run.cancelRequested ?? run.cancel_requested),
    errorMessage: String(run.errorMessage ?? run.error_message ?? ""),
    createdAt: String(run.createdAt ?? run.created_at ?? ""),
    updatedAt: String(run.updatedAt ?? run.updated_at ?? ""),
    completedAt: String(run.completedAt ?? run.completed_at ?? ""),
  };
}

export async function previewFilterRuleRun(
  request: FilterRuleRunRequest,
): Promise<FilterRuleRunPreview> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/run/preview`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
    body: JSON.stringify(toApiRunRequest(request)),
  });

  if (!response.ok) {
    throw new Error(`Failed to preview rule run: ${response.statusText}`);
  }

  return normalizePreview((await response.json()) as Record<string, unknown>);
}

export async function startFilterRuleRun(
  request: FilterRuleRunRequest,
): Promise<FilterRuleRunJob> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/run`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
    body: JSON.stringify(toApiRunRequest(request)),
  });

  if (!response.ok) {
    throw new Error(`Failed to start rule run: ${response.statusText}`);
  }

  return normalizeRun((await response.json()) as Record<string, unknown>);
}

export async function fetchFilterRuleRun(
  runId: number,
): Promise<FilterRuleRunJob> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/run/${runId}`);

  const response = await apiFetch(url, {
    method: "GET",
    credentials: "include",
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch rule run: ${response.statusText}`);
  }

  return normalizeRun((await response.json()) as Record<string, unknown>);
}

export async function cancelFilterRuleRun(
  runId: number,
): Promise<FilterRuleRunJob> {
  const url = buildApiUrl(`${routeApiPrefix}/filter-rules/run/${runId}/cancel`);

  const response = await apiFetch(url, {
    method: "POST",
    credentials: "include",
    headers: getApiHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to cancel rule run: ${response.statusText}`);
  }

  return normalizeRun((await response.json()) as Record<string, unknown>);
}

// =============================================================================
// Rule Matching Engine
// =============================================================================

/**
 * Check if a string value matches a condition.
 */
function matchStringCondition(
  value: string,
  condition: FilterCondition,
): boolean {
  const target = condition.caseSensitive ? value : value.toLowerCase();
  const pattern = condition.caseSensitive
    ? String(condition.value)
    : String(condition.value).toLowerCase();

  switch (condition.operator) {
    case "contains":
      return target.includes(pattern);
    case "not_contains":
      return !target.includes(pattern);
    case "equals":
      return target === pattern;
    case "not_equals":
      return target !== pattern;
    case "starts_with":
      return target.startsWith(pattern);
    case "ends_with":
      return target.endsWith(pattern);
    case "matches_regex":
      try {
        const regex = new RegExp(
          String(condition.value),
          condition.caseSensitive ? "" : "i",
        );
        return regex.test(value);
      } catch {
        return false;
      }
    default:
      return false;
  }
}

/**
 * Check if a numeric value matches a condition.
 */
function matchNumericCondition(
  value: number,
  condition: FilterCondition,
): boolean {
  const target = Number(condition.value);

  switch (condition.operator) {
    case "equals":
      return value === target;
    case "not_equals":
      return value !== target;
    case "greater_than":
      return value > target;
    case "less_than":
      return value < target;
    case "greater_or_equal":
      return value >= target;
    case "less_or_equal":
      return value <= target;
    default:
      return false;
  }
}

/**
 * Check if a date value matches a condition.
 */
function matchDateCondition(
  dateStr: string,
  condition: FilterCondition,
): boolean {
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return false;

  switch (condition.operator) {
    case "before": {
      const target = new Date(String(condition.value));
      return date < target;
    }
    case "after": {
      const target = new Date(String(condition.value));
      return date > target;
    }
    case "on": {
      const target = new Date(String(condition.value));
      return (
        date.getFullYear() === target.getFullYear() &&
        date.getMonth() === target.getMonth() &&
        date.getDate() === target.getDate()
      );
    }
    case "older_than_days": {
      const days = Number(condition.value);
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);
      return date < threshold;
    }
    case "newer_than_days": {
      const days = Number(condition.value);
      const threshold = new Date();
      threshold.setDate(threshold.getDate() - days);
      return date > threshold;
    }
    default:
      return false;
  }
}

/**
 * Get the value from a message for a given condition field.
 */
function getMessageFieldValue(
  message: EmailMessage,
  field: FilterCondition["field"],
): string | number | boolean {
  switch (field) {
    case "from":
      return message.from || "";
    case "to":
      return message.to || "";
    case "cc":
      return message.cc || "";
    case "bcc":
      return message.bcc || "";
    case "subject":
      return message.subject || "";
    case "body":
      return message.body || message.snippet || "";
    case "has_attachment":
      return (
        (message.attachments?.length ?? 0) > 0 ||
        message.hasAttachments === true
      );
    case "size":
      return (message as EmailMessage & { size?: number }).size || 0;
    case "date":
      return message.date || "";
    default:
      return "";
  }
}

/**
 * Check if a single condition matches a message.
 */
function matchCondition(
  message: EmailMessage,
  condition: FilterCondition,
): boolean {
  const value = getMessageFieldValue(message, condition.field);

  // Boolean conditions
  if (condition.field === "has_attachment") {
    if (condition.operator === "is_true") return value === true;
    if (condition.operator === "is_false") return value === false;
    return false;
  }

  // Date conditions
  if (condition.field === "date") {
    return matchDateCondition(String(value), condition);
  }

  // Numeric conditions
  if (condition.field === "size") {
    return matchNumericCondition(Number(value), condition);
  }

  // String conditions (default)
  return matchStringCondition(String(value), condition);
}

/**
 * Check if a rule's conditions match a message.
 */
function matchRuleConditions(
  message: EmailMessage,
  conditions: FilterCondition[],
  logic: ConditionLogic,
): boolean {
  if (conditions.length === 0) return false;

  // Anything that is not exactly "or" is AND, matching
  // FilterRuleMatcher::match_rule_conditions. Treating an unknown value as OR
  // here made the two engines disagree on a hand-edited rule: the browser
  // matched on any condition, the server needed all of them.
  if (logic === "or") {
    return conditions.some((c) => matchCondition(message, c));
  }

  return conditions.every((c) => matchCondition(message, c));
}

/**
 * Whether a rule may act on a message, by account.
 *
 * Mirrors FilterRuleRunService::rules_for_message on the server: accountId 0
 * means every account, anything else has to match the message's own account.
 * Without this a list that spans accounts - the unified inbox, a consolidated
 * folder, search results - let a rule bound to one account move, star or
 * permanently delete another account's mail.
 *
 * EmailMessage.accountId is only populated in the consolidated views. When it
 * is absent the list is single-account, so there is no mismatch to catch and
 * the rule stays eligible.
 */
export function ruleAppliesToMessageAccount(
  rule: Pick<FilterRule, "accountId">,
  message: Pick<EmailMessage, "accountId">,
): boolean {
  const ruleAccountId = Number(rule.accountId ?? 0);
  if (ruleAccountId === 0) return true;

  return (
    typeof message.accountId !== "number" || ruleAccountId === message.accountId
  );
}

/**
 * Match a message against all filter rules and return matching rules.
 */
export function matchMessageAgainstRules(
  message: EmailMessage,
  rules: FilterRule[],
): FilterMatchResult {
  const enabledRules = rules
    .filter((r) => r.enabled && ruleAppliesToMessageAccount(r, message))
    .sort((a, b) => a.priority - b.priority);

  const matchedRules: FilterRule[] = [];
  const actionsToApply: FilterAction[] = [];

  for (const rule of enabledRules) {
    if (matchRuleConditions(message, rule.conditions, rule.conditionLogic)) {
      matchedRules.push(rule);
      actionsToApply.push(...rule.actions);

      // Stop processing if this rule says to
      if (rule.stopProcessing) {
        break;
      }
    }
  }

  return {
    matched: matchedRules.length > 0,
    matchedRules,
    actionsToApply,
  };
}

/**
 * Test a rule against a message without applying actions.
 */
export function testRule(
  message: EmailMessage,
  rule: Omit<FilterRule, "id" | "accountId" | "createdAt" | "updatedAt">,
): boolean {
  const conditions = rule.conditions.map((c) => ({
    ...c,
    id: c.id || generateId(),
  }));
  return matchRuleConditions(message, conditions, rule.conditionLogic);
}

export default {
  fetchFilterRules,
  createFilterRule,
  updateFilterRule,
  deleteFilterRule,
  toggleFilterRule,
  reorderFilterRules,
  previewFilterRuleRun,
  startFilterRuleRun,
  fetchFilterRuleRun,
  cancelFilterRuleRun,
  matchMessageAgainstRules,
  testRule,
};
