/**
 * Filter Rules Types
 *
 * TypeScript types for email filter rules system.
 * Supports Gmail-style automatic email filtering and actions.
 *
 * @since 1.5.0
 */

import { __ } from "@wordpress/i18n";

/**
 * Condition field types that can be matched.
 */
export type FilterConditionField =
  | "from"
  | "to"
  | "cc"
  | "bcc"
  | "subject"
  | "body"
  | "has_attachment"
  | "size"
  | "date"
  | "tag"
  | "is_read"
  | "is_starred"
  | "is_important"
  | "folder"
  | "account"
  | "list_id"
  | "reply_to"
  // Registered by Pro while phishing detection is available.
  | "ai_tag"
  | "phishing_verdict"
  | "phishing_score"
  | "phishing_band"
  | "spam_score"
  | "spam_band"
  | "spam_category"
  | "is_bulk";

/**
 * Operators for string matching conditions.
 */
export type StringMatchOperator =
  | "contains"
  | "not_contains"
  | "equals"
  | "not_equals"
  | "starts_with"
  | "ends_with"
  | "matches_regex";

/**
 * Operators for boolean conditions.
 */
export type BooleanOperator = "is_true" | "is_false";

/**
 * Operators for numeric/size conditions.
 */
export type NumericOperator =
  | "equals"
  | "not_equals"
  | "greater_than"
  | "less_than"
  | "greater_or_equal"
  | "less_or_equal";

/**
 * Operators for date conditions.
 */
export type DateOperator =
  | "before"
  | "after"
  | "on"
  | "older_than_days"
  | "newer_than_days";

/** Operators for the tag condition. */
export type TagOperator = "has" | "has_not";

/** Operators for the account condition. */
export type AccountOperator = "equals" | "not_equals";

/** Operators for the folder condition. */
export type FolderOperator =
  | "equals"
  | "not_equals"
  | "starts_with"
  | "contains";

/**
 * Combined operator type.
 */
export type FilterOperator =
  | StringMatchOperator
  | BooleanOperator
  | NumericOperator
  | DateOperator
  | TagOperator;

/**
 * A single condition within a filter rule.
 */
export interface FilterCondition {
  id: string;
  field: FilterConditionField;
  operator: FilterOperator;
  value: string | number | boolean;
  caseSensitive?: boolean;
}

/**
 * Logical grouping for multiple conditions.
 */
export type ConditionLogic = "and" | "or";

export type FilterRuleRunTrigger =
  | "manual"
  | "on_receive"
  | "scheduled"
  // Registered by Pro while the auto-tagger / phishing detection is available.
  | "on_classified"
  | "on_phishing_scanned";

export const DEFAULT_FILTER_RULE_TRIGGERS: FilterRuleRunTrigger[] = ["manual"];

export const FILTER_RULE_SCHEDULE_INTERVALS = [15, 30, 60, 360, 1440] as const;

export type FilterRuleScheduleInterval =
  (typeof FILTER_RULE_SCHEDULE_INTERVALS)[number];

/**
 * Actions that can be applied when a rule matches.
 */
export type FilterActionType =
  | "move_to_folder"
  | "move_to_trash"
  | "mark_as_read"
  | "mark_as_unread"
  | "mark_as_starred"
  | "mark_as_important"
  | "add_tag"
  | "remove_tag"
  | "archive"
  | "delete"
  | "never_spam"
  | "always_spam"
  // Registered by Pro while the feature is available.
  | "run_auto_tagger"
  | "run_phishing_check"
  | "snooze"
  | "run_spam_check"
  | "run_security_check"
  | "send_template"
  // Legacy: older rules may still carry these; they can no longer be saved.
  | "apply_label"
  | "forward"
  | "skip_inbox";

export interface FilterRuleFolderTarget {
  accountId: number;
  folderId: number | null;
  lastKnownPath: string;
  status: "resolved" | "repair_required";
}

/**
 * A single action to apply when rule matches.
 */
export interface FilterAction {
  id: string;
  type: FilterActionType;
  value?: string | FilterRuleFolderTarget;
}

/**
 * Complete filter rule definition.
 */
export interface FilterRule {
  id: string;
  name: string;
  description?: string;
  source?: "manual" | "sweep";
  enabled: boolean;
  inactiveReason?: string;
  priority: number;
  accountId: number;
  conditions: FilterCondition[];
  conditionLogic: ConditionLogic;
  actions: FilterAction[];
  stopProcessing?: boolean;
  runTriggers: FilterRuleRunTrigger[];
  scheduleIntervalMinutes?: FilterRuleScheduleInterval | null;
  lastScheduledRunAt?: string | null;
  createdAt: string;
  updatedAt: string;
  /**
   * Shared-inbox lists only: the rule holds a step only the owner may add,
   * so a manager can turn it off or delete it but not change it.
   */
  sharedLocked?: boolean;
}

/**
 * Data for creating a new filter rule.
 */
export interface CreateFilterRuleData {
  name: string;
  description?: string;
  source?: "manual" | "sweep";
  enabled?: boolean;
  priority?: number;
  accountId: number;
  conditions: Omit<FilterCondition, "id">[];
  conditionLogic?: ConditionLogic;
  actions: Omit<FilterAction, "id">[];
  stopProcessing?: boolean;
  runTriggers?: FilterRuleRunTrigger[];
  scheduleIntervalMinutes?: FilterRuleScheduleInterval | null;
}

/**
 * Data for updating a filter rule.
 */
export interface UpdateFilterRuleData {
  name?: string;
  description?: string;
  source?: "manual" | "sweep";
  enabled?: boolean;
  priority?: number;
  conditions?: Omit<FilterCondition, "id">[];
  conditionLogic?: ConditionLogic;
  actions?: Omit<FilterAction, "id">[];
  stopProcessing?: boolean;
  runTriggers?: FilterRuleRunTrigger[];
  scheduleIntervalMinutes?: FilterRuleScheduleInterval | null;
  lastScheduledRunAt?: string | null;
}

/**
 * Result of a filter rule operation.
 */
export interface FilterRuleOperationResult {
  success: boolean;
  rule?: FilterRule;
  error?: string;
  /** The server's error code, when it sent one. */
  errorCode?: string;
}

/**
 * Result of matching a message against rules.
 */
export interface FilterMatchResult {
  matched: boolean;
  matchedRules: FilterRule[];
  actionsToApply: FilterAction[];
}

export interface FilterRuleRunRef {
  uidValidity: string;
  accountId: number;
  uid: string;
  folder: string;
}

export interface FilterRuleRunScope {
  mode: "selection" | "view";
  accountId: number;
  accountIds?: number[];
  folder: string;
  folderMap?: Record<string, string>;
  filters?: unknown;
  syncFirst?: boolean;
  refs?: FilterRuleRunRef[];
  /** Whole-view runs leave these messages alone. */
  excludeRefs?: FilterRuleRunRef[];
}

/** Actions a tag/scan sweep can run through the rule engine. */
export type SweepRuleActionType =
  | "add_tag"
  | "remove_tag"
  | "run_phishing_check"
  | "run_auto_tagger";

/**
 * A one-off sweep carried by a rule run instead of saved rules. The server
 * builds one unsaved rule per match value.
 */
export interface FilterRuleRunSweep {
  match: {
    type: "sender_email" | "sender_domain" | "subject_contains";
    values: string[];
  };
  actions: Array<{ type: SweepRuleActionType; value?: string }>;
  scoreMin?: number;
  scoreMax?: number;
  /** Pro: spam score range and "this result or worse". */
  spamMin?: number;
  spamMax?: number;
  spamBand?: string;
}

export interface FilterRuleRunRequest {
  ruleIds: string[];
  scope: FilterRuleRunScope;
  sweep?: FilterRuleRunSweep;
}

/**
 * What this site can build rules from right now. Returned with the rule list
 * by GET /filter-rules; Pro fields, actions and triggers appear only while the
 * feature behind them is available.
 */
export interface FilterRuleSchema {
  fields: Record<
    string,
    {
      operators: string[];
      value: "none" | "number" | "text" | "id" | "date" | "enum";
      options?: string[];
    }
  >;
  actions: Record<string, { terminal: boolean }>;
  triggers: string[];
}

/** One rule run in the history list. */
export interface FilterRuleRunHistoryItem extends FilterRuleRunJob {
  trigger: string;
}

export interface FilterRuleRunHistory {
  runs: FilterRuleRunHistoryItem[];
  automatic: FilterRuleRunHistoryItem[];
  automaticSummary: {
    runs: number;
    matched: number;
    changed: number;
    failed: number;
  };
}

/** Result of trying a rule draft on the newest mail. */
export interface FilterRuleTestResult {
  /** Messages it could judge: matches plus known misses. */
  checked: number;
  matched: number;
  /** Messages it could not judge: their body or headers were never saved. */
  unknown: number;
  /** Folder it tried: the Inbox unless a Folder condition names one. */
  folder: string;
  samples: Array<{ subject: string; from: string; receivedAt: string }>;
}

export interface FilterRuleRunUnsupportedRule {
  id: string;
  name: string;
  unsupported_conditions?: string[];
  unsupportedConditions?: string[];
  unsupported_actions?: string[];
  unsupportedActions?: string[];
  has_supported_actions?: boolean;
  hasSupportedActions?: boolean;
}

export interface FilterRuleRunPreview {
  candidateCount: number;
  supportedRuleIds: string[];
  unsupportedRules: FilterRuleRunUnsupportedRule[];
  requiresSync: boolean;
  scope?: FilterRuleRunScope;
}

export interface FilterRuleRunJob {
  id: number;
  status:
    | "queued"
    | "syncing"
    | "processing"
    | "completed"
    | "failed"
    | "cancelled";
  mode?: "selection" | "view";
  scope?: FilterRuleRunScope;
  ruleIds?: string[];
  unsupportedRules?: FilterRuleRunUnsupportedRule[];
  candidateCount?: number;
  matchedCount?: number;
  processedCount?: number;
  changedCount?: number;
  failedCount?: number;
  skippedCount?: number;
  requiresSync?: boolean;
  cancelRequested?: boolean;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

/** Fields every build offers. Pro fields carry their labels in the Pro module. */
export type CoreConditionField = Exclude<
  FilterConditionField,
  | "ai_tag"
  | "phishing_verdict"
  | "phishing_score"
  | "phishing_band"
  | "spam_score"
  | "spam_band"
  | "spam_category"
  | "is_bulk"
>;

/** Actions every build can save, plus legacy ones older rules may carry. */
export type CoreActionType = Exclude<
  FilterActionType,
  | "run_auto_tagger"
  | "run_phishing_check"
  | "run_spam_check"
  | "run_security_check"
  | "snooze"
  | "send_template"
>;

/**
 * Labels for condition fields. Keys are the schema the QA inventory reads;
 * the UI shows conditionFieldLabel(), which is translated.
 */
export const CONDITION_FIELD_LABELS: Record<CoreConditionField, string> = {
  from: "From",
  to: "To",
  cc: "CC",
  bcc: "BCC",
  subject: "Subject",
  body: "Body",
  has_attachment: "Has attachment",
  size: "Body size (bytes)",
  date: "Date",
  tag: "Tag",
  is_read: "Read",
  is_starred: "Starred",
  is_important: "Important",
  folder: "Folder",
  account: "Account",
  list_id: "List-Id header",
  reply_to: "Reply-To header",
};

/**
 * Labels for string operators (for UI display).
 */
export const STRING_OPERATOR_LABELS: Record<StringMatchOperator, string> = {
  contains: "Contains",
  not_contains: "Does not contain",
  equals: "Equals exactly",
  not_equals: "Does not equal",
  starts_with: "Starts with",
  ends_with: "Ends with",
  matches_regex: "Matches pattern (regex)",
};

/**
 * Labels for boolean operators.
 */
export const BOOLEAN_OPERATOR_LABELS: Record<BooleanOperator, string> = {
  is_true: "Yes",
  is_false: "No",
};

/**
 * Labels for numeric operators.
 */
export const NUMERIC_OPERATOR_LABELS: Record<NumericOperator, string> = {
  equals: "Equals",
  not_equals: "Does not equal",
  greater_than: "Greater than",
  less_than: "Less than",
  greater_or_equal: "Greater than or equal",
  less_or_equal: "Less than or equal",
};

/**
 * Labels for date operators.
 */
export const DATE_OPERATOR_LABELS: Record<DateOperator, string> = {
  before: "Before",
  after: "After",
  on: "On",
  older_than_days: "Older than (days)",
  newer_than_days: "Newer than (days)",
};

export const TAG_OPERATOR_LABELS: Record<TagOperator, string> = {
  has: "Has tag",
  has_not: "Does not have tag",
};

export const ACCOUNT_OPERATOR_LABELS: Record<AccountOperator, string> = {
  equals: "Is",
  not_equals: "Is not",
};

export const FOLDER_OPERATOR_LABELS: Record<FolderOperator, string> = {
  equals: "Is",
  not_equals: "Is not",
  starts_with: "Is inside",
  contains: "Name contains",
};

/**
 * Labels for action types.
 */
export const ACTION_TYPE_LABELS: Record<
  Exclude<CoreActionType, "apply_label" | "forward" | "skip_inbox">,
  string
> = {
  move_to_folder: "Move to folder",
  move_to_trash: "Move to trash",
  mark_as_read: "Mark as read",
  mark_as_unread: "Mark as unread",
  mark_as_starred: "Star",
  mark_as_important: "Mark important",
  add_tag: "Add tag",
  remove_tag: "Remove tag",
  archive: "Archive",
  delete: "Delete",
  never_spam: "Never mark as spam",
  always_spam: "Always mark as spam",
};

export const RUN_TRIGGER_LABELS: Record<
  Exclude<FilterRuleRunTrigger, "on_classified" | "on_phishing_scanned">,
  string
> = {
  manual: "Manual",
  on_receive: "On receive",
  scheduled: "Scheduled",
};

/** Translated label for a core condition field, or "" for one this map does not know. */
export function conditionFieldLabel(field: string): string {
  switch (field) {
    case "from":
      return __("From", "pressedmail");
    case "to":
      return __("To", "pressedmail");
    case "cc":
      return __("Cc", "pressedmail");
    case "bcc":
      return __("Bcc", "pressedmail");
    case "subject":
      return __("Subject", "pressedmail");
    case "body":
      return __("Body", "pressedmail");
    case "has_attachment":
      return __("Has attachment", "pressedmail");
    case "size":
      return __("Body size (bytes)", "pressedmail");
    case "date":
      return __("Date", "pressedmail");
    case "tag":
      return __("Tag", "pressedmail");
    case "is_read":
      return __("Read", "pressedmail");
    case "is_starred":
      return __("Starred", "pressedmail");
    case "is_important":
      return __("Important", "pressedmail");
    case "folder":
      return __("Folder", "pressedmail");
    case "account":
      return __("Account", "pressedmail");
    case "list_id":
      return __("Mailing list (List-Id)", "pressedmail");
    case "reply_to":
      return __("Reply-To", "pressedmail");
    default:
      return "";
  }
}

/**
 * Translated label for an operator as it reads on a given field. Pass
 * `numeric` for a number field an extension adds, so "equals" reads as a
 * comparison, the way it does on size.
 */
export function operatorLabel(
  field: string,
  operator: string,
  numeric = false,
): string {
  // Flag fields, core or added by an extension, take only these two.
  if (operator === "is_true" || operator === "is_false") {
    return operator === "is_true"
      ? __("Yes", "pressedmail")
      : __("No", "pressedmail");
  }
  if (field === "tag") {
    return operator === "has"
      ? __("Has tag", "pressedmail")
      : __("Does not have tag", "pressedmail");
  }
  if (
    field === "account" ||
    (field === "folder" && ["equals", "not_equals"].includes(operator))
  ) {
    return operator === "equals"
      ? __("Is", "pressedmail")
      : __("Is not", "pressedmail");
  }
  if (field === "folder") {
    return operator === "starts_with"
      ? __("Is inside", "pressedmail")
      : __("Name contains", "pressedmail");
  }
  switch (operator) {
    case "contains":
      return __("Contains", "pressedmail");
    case "not_contains":
      return __("Does not contain", "pressedmail");
    case "equals":
      return field === "size" || numeric
        ? __("Equals", "pressedmail")
        : __("Equals exactly", "pressedmail");
    case "not_equals":
      return __("Does not equal", "pressedmail");
    case "starts_with":
      return __("Starts with", "pressedmail");
    case "ends_with":
      return __("Ends with", "pressedmail");
    case "matches_regex":
      return __("Matches pattern (regex)", "pressedmail");
    case "greater_than":
      return __("More than", "pressedmail");
    case "less_than":
      return __("Less than", "pressedmail");
    case "greater_or_equal":
      return __("At least", "pressedmail");
    case "less_or_equal":
      return __("At most", "pressedmail");
    case "before":
      return __("Before", "pressedmail");
    case "after":
      return __("After", "pressedmail");
    case "on":
      return __("On", "pressedmail");
    case "older_than_days":
      return __("Older than (days)", "pressedmail");
    case "newer_than_days":
      return __("Newer than (days)", "pressedmail");
    default:
      return operator;
  }
}

/** Translated label for a core action, or "" for one this map does not know. */
export function actionTypeLabel(type: string): string {
  switch (type) {
    case "move_to_folder":
      return __("Move to folder", "pressedmail");
    case "move_to_trash":
      return __("Move to Trash", "pressedmail");
    case "mark_as_read":
      return __("Mark as read", "pressedmail");
    case "mark_as_unread":
      return __("Mark as unread", "pressedmail");
    case "mark_as_starred":
      return __("Star", "pressedmail");
    case "mark_as_important":
      return __("Mark important", "pressedmail");
    case "add_tag":
      return __("Add tag", "pressedmail");
    case "remove_tag":
      return __("Remove tag", "pressedmail");
    case "archive":
      return __("Archive", "pressedmail");
    case "delete":
      return __("Delete", "pressedmail");
    case "never_spam":
      return __("Never send to Junk", "pressedmail");
    case "always_spam":
      return __("Send to Junk", "pressedmail");
    case "apply_label":
      return __("Apply label (no longer runs)", "pressedmail");
    case "forward":
      return __("Forward (no longer runs)", "pressedmail");
    case "skip_inbox":
      return __("Skip inbox", "pressedmail");
    default:
      return "";
  }
}

/** Translated label for a core run trigger, or "" for one this map does not know. */
export function runTriggerLabel(trigger: string): string {
  // Timed rules are Pro; Free has no scheduled trigger to name.
  if (!__IS_FREE__ && trigger === "scheduled") {
    return __("On a schedule", "pressedmail");
  }
  switch (trigger) {
    case "manual":
      return __("When I run it", "pressedmail");
    case "on_receive":
      return __("When mail arrives", "pressedmail");
    default:
      return "";
  }
}

export function ruleCanRunManually(rule: Pick<FilterRule, "runTriggers">) {
  return (rule.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS).includes("manual");
}

/**
 * Whether the rule asked to run as mail arrives. Mirrors the server's
 * FilterRuleAutomationService::rules_with_trigger fallback, so a rule with no
 * stored triggers counts as manual-only.
 */
export function ruleRunsOnReceive(rule: Pick<FilterRule, "runTriggers">) {
  return (rule.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS).includes(
    "on_receive",
  );
}

/**
 * Legacy actions an older rule can still carry but nothing executes. The
 * server lists apply_label and forward in FilterRuleMatcher::UNSUPPORTED_ACTION_TYPES;
 * skip_inbox is read back as archive. The editor never offers them; they keep
 * labels so an old rule still reads correctly.
 */
export const UNIMPLEMENTED_ACTIONS: FilterActionType[] = [
  "apply_label",
  "forward",
  "skip_inbox",
];

export function isUnimplementedAction(action: FilterActionType): boolean {
  return UNIMPLEMENTED_ACTIONS.includes(action);
}

/**
 * Condition fields the server run engine cannot evaluate. None any more: body
 * and size read the cached body (an uncached body never matches).
 */
export const SERVER_UNSUPPORTED_CONDITION_FIELDS: FilterConditionField[] = [];

/**
 * Whether the server run engine will execute this rule, or skip it.
 *
 * Mirrors FilterRuleMatcher::is_rule_runnable for the core schema: a rule
 * that still carries a legacy action does nothing there.
 */
export function ruleRunsOnServer(
  rule: Pick<FilterRule, "conditions" | "actions">,
): boolean {
  const actions = rule.actions ?? [];
  if (actions.some((a) => isUnimplementedAction(a.type))) {
    return false;
  }

  return actions.length > 0;
}

/** Condition fields that test a flag and take no value. */
export const FLAG_CONDITION_FIELDS: FilterConditionField[] = [
  "has_attachment",
  "is_read",
  "is_starred",
  "is_important",
];

/**
 * Get available operators for a condition field.
 */
export function getOperatorsForField(
  field: FilterConditionField,
): FilterOperator[] {
  switch (field) {
    case "from":
    case "to":
    case "cc":
    case "bcc":
    case "subject":
    case "body":
    case "list_id":
    case "reply_to":
      return [
        "contains",
        "not_contains",
        "equals",
        "not_equals",
        "starts_with",
        "ends_with",
        "matches_regex",
      ];
    case "has_attachment":
    case "is_read":
    case "is_starred":
    case "is_important":
      return ["is_true", "is_false"];
    case "size":
      return [
        "equals",
        "not_equals",
        "greater_than",
        "less_than",
        "greater_or_equal",
        "less_or_equal",
      ];
    case "date":
      return ["before", "after", "on", "older_than_days", "newer_than_days"];
    case "tag":
      return ["has", "has_not"];
    case "account":
      return ["equals", "not_equals"];
    case "folder":
      return ["equals", "not_equals", "starts_with", "contains"];
    default:
      return [];
  }
}

/**
 * Check if an action type requires a value.
 */
export function actionRequiresValue(actionType: FilterActionType): boolean {
  return ["move_to_folder", "add_tag", "remove_tag"].includes(actionType);
}

/**
 * Default empty filter rule for creating new rules.
 */
export const DEFAULT_FILTER_RULE: Omit<
  FilterRule,
  "id" | "accountId" | "createdAt" | "updatedAt"
> = {
  name: "",
  description: "",
  enabled: true,
  priority: 0,
  conditions: [],
  conditionLogic: "and",
  actions: [],
  stopProcessing: false,
  runTriggers: DEFAULT_FILTER_RULE_TRIGGERS,
  scheduleIntervalMinutes: null,
  lastScheduledRunAt: null,
};
