/**
 * Filter Rules Types
 *
 * TypeScript types for email filter rules system.
 * Supports Gmail-style automatic email filtering and actions.
 *
 * @since 1.5.0
 */

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
  | "date";

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

/**
 * Combined operator type.
 */
export type FilterOperator =
  | StringMatchOperator
  | BooleanOperator
  | NumericOperator
  | DateOperator;

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

export type FilterRuleRunTrigger = "manual" | "on_receive" | "scheduled";

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
  | "apply_label"
  | "mark_as_read"
  | "mark_as_starred"
  | "mark_as_important"
  | "archive"
  | "delete"
  | "forward"
  | "skip_inbox"
  | "never_spam"
  | "always_spam";

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
}

export interface FilterRuleRunRequest {
  ruleIds: string[];
  scope: FilterRuleRunScope;
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
  requiresSync?: boolean;
  cancelRequested?: boolean;
  errorMessage?: string;
  createdAt?: string;
  updatedAt?: string;
  completedAt?: string;
}

/**
 * Labels for condition fields (for UI display).
 */
export const CONDITION_FIELD_LABELS: Record<FilterConditionField, string> = {
  from: "From",
  to: "To",
  cc: "CC",
  bcc: "BCC",
  subject: "Subject",
  body: "Body/Content",
  has_attachment: "Has Attachment",
  size: "Size (bytes)",
  date: "Date",
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

/**
 * Labels for action types.
 */
export const ACTION_TYPE_LABELS: Record<FilterActionType, string> = {
  move_to_folder: "Move to folder",
  move_to_trash: "Move to trash",
  apply_label: "Apply label",
  mark_as_read: "Mark as read",
  mark_as_starred: "Star",
  mark_as_important: "Mark important",
  archive: "Archive",
  delete: "Delete",
  forward: "Forward to",
  skip_inbox: "Skip inbox",
  never_spam: "Never mark as spam",
  always_spam: "Always mark as spam",
};

export const RUN_TRIGGER_LABELS: Record<FilterRuleRunTrigger, string> = {
  manual: "Manual",
  on_receive: "On receive",
  scheduled: "Scheduled",
};

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
 * Actions a rule can still carry but that nothing executes, on either side.
 * The client engine ignores them (see applyRuleActionsToMessages) and the
 * server lists the same set in FilterRuleMatcher::UNSUPPORTED_ACTION_TYPES, so
 * the editor hides them rather than letting people save a rule that does
 * nothing. They keep their labels so rules stored before this list still read
 * correctly.
 *
 * To offer one again it needs a real executor first: tag resolution for
 * apply_label, outbound send plumbing for forward, and a persisted inbox/spam
 * flag on the mailbox mirror for skip_inbox and never_spam.
 */
export const UNIMPLEMENTED_ACTIONS: FilterActionType[] = [
  "apply_label",
  "forward",
  "skip_inbox",
  "never_spam",
];

export function isUnimplementedAction(action: FilterActionType): boolean {
  return UNIMPLEMENTED_ACTIONS.includes(action);
}

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
    default:
      return [];
  }
}

/**
 * Check if an action type requires a value.
 */
export function actionRequiresValue(actionType: FilterActionType): boolean {
  return ["move_to_folder", "apply_label", "forward"].includes(actionType);
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
