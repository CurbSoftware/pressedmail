/**
 * AutoTagger Types
 *
 * TypeScript types for the AutoTagger feature.
 *
 * @since 1.4.0
 */

/**
 * AutoTagger settings.
 */
export interface AutoTaggerSettings {
  /** Whether the admin has configured the shared AI API key */
  is_admin_configured: boolean;
  /** Whether the admin has enabled AutoTagger site-wide */
  is_admin_enabled: boolean;
  /** Whether the saved admin AI provider connection has tested successfully */
  is_admin_connection_valid: boolean;
  /** Whether AutoTagger is currently available to users */
  is_available: boolean;
  /** Whether on-demand AI tagging can run through the configured provider */
  is_tool_available?: boolean;
  /** Model to use for classification */
  model: string;
  /** Whether auto-tagging is enabled */
  is_enabled: boolean;
  /** Custom prompt appended to the AI system prompt */
  custom_prompt: string;
}

/**
 * AutoTagger tag with classification prompt.
 */
export interface AutoTaggerTag {
  /** Tag ID */
  id: number;
  /** Display name */
  name: string;
  /** Hex color code */
  color: string;
  /** AI classification prompt */
  prompt: string;
  /** Sort order */
  sort_order: number;
  /** Whether the tag is active */
  is_active: boolean;
  /** Creation timestamp */
  created_at: string | null;
  /** Last update timestamp */
  updated_at: string | null;
}

/**
 * Data for creating a new tag.
 */
export interface CreateAutoTaggerTagData {
  name: string;
  color?: string;
  prompt: string;
  is_active?: boolean;
}

/**
 * Data for updating a tag.
 */
export interface UpdateAutoTaggerTagData {
  name?: string;
  color?: string;
  prompt?: string;
  is_active?: boolean;
  sort_order?: number;
}

/**
 * Classification result for a single email.
 */
export interface ClassificationResult {
  email_uid: string | number | null;
  folder: string;
  tags: Array<{
    id: number;
    name: string;
    confidence: number;
    source: "matching_rule" | "llm";
  }>;
}

/**
 * AutoTagger run log entry.
 */
export interface AutoTaggerLog {
  id: number;
  account_id: number | null;
  emails_processed: number;
  tags_applied: number;
  tokens_used: number;
  error_message: string | null;
  started_at: string | null;
  completed_at: string | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Automation rule action types.
 */
export type AutoTaggerRuleActionType =
  | "move_to_folder"
  | "apply_label"
  | "mark_read"
  | "archive";

/**
 * AutoTagger automation rule.
 */
export interface AutoTaggerRule {
  /** Rule ID */
  id: number;
  /** Associated tag ID */
  tag_id: number;
  /** Action to perform */
  action_type: AutoTaggerRuleActionType;
  /** Target folder for move_to_folder action */
  target_folder: string | null;
  account_id: number | null;
  target_folder_id: number | null;
  target_status: "resolved" | "repair_required";
  /** Generic target value for other actions */
  target_value: string | null;
  /** Whether the rule is active */
  is_active: boolean;
  /** Rule priority (lower = higher priority) */
  priority: number;
  /** Creation timestamp */
  created_at: string | null;
  /** Last update timestamp */
  updated_at: string | null;
  /** Associated tag details (when loaded with relation) */
  tag?: AutoTaggerTag | null;
}

/**
 * Data for creating a new automation rule.
 */
export interface CreateAutoTaggerRuleData {
  tag_id: number;
  action_type?: AutoTaggerRuleActionType;
  target_folder?: string;
  account_id?: number;
  target_folder_id?: number | null;
  target_status?: "resolved" | "repair_required";
  target_value?: string;
  is_active?: boolean;
  priority?: number;
}

/**
 * Data for updating an automation rule.
 */
export interface UpdateAutoTaggerRuleData {
  tag_id?: number;
  action_type?: AutoTaggerRuleActionType;
  target_folder?: string;
  account_id?: number;
  target_folder_id?: number | null;
  target_status?: "resolved" | "repair_required";
  target_value?: string;
  is_active?: boolean;
  priority?: number;
}

export interface AutoTaggerFolderTarget {
  folder_id: number | null;
  last_known_path: string;
  status: "resolved" | "repair_required";
}

export interface AutoTaggerAccountSettings {
  account_id: number;
  is_enabled: boolean;
  watched_folders: string[];
  excluded_folders: string[];
  watched_folder_targets: AutoTaggerFolderTarget[];
  excluded_folder_targets: AutoTaggerFolderTarget[];
  auto_classify_new: boolean;
}

/**
 * Matching rule types for deterministic pre-classification.
 */
export type MatchingRuleType =
  | "sender_contains"
  | "keyword"
  | "subject_contains"
  | "domain";

/**
 * Matching rule match fields.
 */
export type MatchingRuleMatchField = "from" | "subject" | "body" | "any";

/**
 * AutoTagger matching rule (deterministic pre-classification).
 */
export interface AutoTaggerMatchingRule {
  /** Rule ID */
  id: number;
  /** Owner user ID */
  user_id: number;
  /** Associated tag ID */
  tag_id: number;
  /** Rule type */
  rule_type: MatchingRuleType;
  /** Match pattern string */
  pattern: string;
  /** Field to match against */
  match_field: MatchingRuleMatchField;
  /** Whether the rule is active */
  is_active: boolean;
  /** Rule priority (lower = higher priority) */
  priority: number;
  /** Creation timestamp */
  created_at: string | null;
  /** Last update timestamp */
  updated_at: string | null;
  /** Associated tag details (when loaded with relation) */
  tag?: {
    id: number;
    name: string;
    color: string;
  } | null;
}

/**
 * Data for creating a new matching rule.
 */
export interface CreateMatchingRuleData {
  tag_id: number;
  rule_type: MatchingRuleType;
  pattern: string;
  match_field?: MatchingRuleMatchField;
  is_active?: boolean;
}

/**
 * Data for updating a matching rule.
 */
export interface UpdateMatchingRuleData {
  tag_id?: number;
  rule_type?: MatchingRuleType;
  pattern?: string;
  match_field?: MatchingRuleMatchField;
  is_active?: boolean;
  priority?: number;
}

/**
 * API response for matching rules list.
 */
export interface MatchingRulesResponse {
  status: "success" | "error";
  message?: string;
  matching_rules: AutoTaggerMatchingRule[];
}

/**
 * API response for matching rule operations.
 */
export interface MatchingRuleOperationResponse {
  status: "success" | "error";
  message: string;
  matching_rule?: AutoTaggerMatchingRule;
  code?: string;
}

/**
 * API response for settings.
 */
export interface AutoTaggerSettingsResponse {
  status: "success" | "error";
  message?: string;
  settings: AutoTaggerSettings;
}

/**
 * API response for tags list.
 */
export interface AutoTaggerTagsResponse {
  status: "success" | "error";
  message?: string;
  tags: AutoTaggerTag[];
}

/**
 * API response for single tag.
 */
export interface AutoTaggerTagResponse {
  status: "success" | "error";
  message?: string;
  tag: AutoTaggerTag;
}

/**
 * API response for tag operations.
 */
export interface AutoTaggerOperationResponse {
  status: "success" | "error";
  message: string;
  tag?: AutoTaggerTag;
  code?: string;
}

/**
 * API response for classification.
 */
export interface ClassifyResponse {
  status: "success" | "error";
  message: string;
  code?: string;
  emails_processed?: number;
  tags_applied?: number;
  tokens_used?: number;
  results?: ClassificationResult[];
}

/**
 * API response for logs.
 */
export interface AutoTaggerLogsResponse {
  status: "success" | "error";
  message?: string;
  logs: AutoTaggerLog[];
}

/**
 * API response for rules list.
 */
export interface AutoTaggerRulesResponse {
  status: "success" | "error";
  message?: string;
  rules: AutoTaggerRule[];
}

/**
 * API response for single rule.
 */
export interface AutoTaggerRuleResponse {
  status: "success" | "error";
  message?: string;
  rule: AutoTaggerRule;
}

/**
 * API response for rule operations.
 */
export interface AutoTaggerRuleOperationResponse {
  status: "success" | "error";
  message: string;
  rule?: AutoTaggerRule;
  code?: string;
}

/**
 * Queue item status.
 */
export type QueueItemStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "skipped";

/**
 * Queue status counts returned by the API.
 */
export interface QueueStatus {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  skipped: number;
  total: number;
}

/**
 * API response for queue enqueue operation.
 */
export interface QueueEnqueueResponse {
  status: "success" | "error";
  message: string;
  enqueued?: number;
  skipped?: number;
  total?: number;
}

/**
 * API response for queue status.
 */
export interface QueueStatusResponse {
  status: "success" | "error";
  message?: string;
  queue_status: QueueStatus;
}

/**
 * API response for queue clear/retry operations.
 */
export interface QueueOperationResponse {
  status: "success" | "error";
  message: string;
  count?: number;
}

/**
 * Settings update payload.
 */
export interface AutoTaggerSettingsUpdate {
  model?: string;
  is_enabled?: boolean;
  custom_prompt?: string;
}

/**
 * Predefined tag colors.
 */
export const AUTO_TAGGER_COLORS = [
  "#6366f1", // Indigo
  "#8b5cf6", // Violet
  "#a855f7", // Purple
  "#d946ef", // Fuchsia
  "#ec4899", // Pink
  "#f43f5e", // Rose
  "#ef4444", // Red
  "#f97316", // Orange
  "#f59e0b", // Amber
  "#eab308", // Yellow
  "#84cc16", // Lime
  "#22c55e", // Green
  "#10b981", // Emerald
  "#14b8a6", // Teal
  "#06b6d4", // Cyan
  "#0ea5e9", // Sky
  "#3b82f6", // Blue
  "#64748b", // Slate
] as const;

/**
 * Context value for AutoTagger.
 */
export interface AutoTaggerContextValue {
  settings: AutoTaggerSettings | null;
  tags: AutoTaggerTag[];
  rules: AutoTaggerRule[];
  matchingRules: AutoTaggerMatchingRule[];
  loading: boolean;
  error: string | null;
  isConfigured: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (settings: AutoTaggerSettingsUpdate) => Promise<boolean>;
  refreshTags: () => Promise<void>;
  createTag: (data: CreateAutoTaggerTagData) => Promise<AutoTaggerTag | null>;
  updateTag: (
    tagId: number,
    data: UpdateAutoTaggerTagData,
  ) => Promise<AutoTaggerTag | null>;
  deleteTag: (tagId: number) => Promise<boolean>;
  reorderTags: (order: number[]) => Promise<boolean>;
  refreshRules: () => Promise<void>;
  createRule: (
    data: CreateAutoTaggerRuleData,
  ) => Promise<AutoTaggerRule | null>;
  updateRule: (
    ruleId: number,
    data: UpdateAutoTaggerRuleData,
  ) => Promise<AutoTaggerRule | null>;
  deleteRule: (ruleId: number) => Promise<boolean>;
  refreshMatchingRules: () => Promise<void>;
  createMatchingRule: (
    data: CreateMatchingRuleData,
  ) => Promise<AutoTaggerMatchingRule | null>;
  updateMatchingRule: (
    ruleId: number,
    data: UpdateMatchingRuleData,
  ) => Promise<AutoTaggerMatchingRule | null>;
  deleteMatchingRule: (ruleId: number) => Promise<boolean>;
  classifyEmails: (
    accountId: number,
    emails: Array<{
      uid?: string | number;
      msg_no?: number;
      folder?: string;
      subject?: string;
      from?: string;
      to?: string;
      cc?: string;
      date?: string;
      body?: string;
    }>,
    options?: { signal?: AbortSignal },
  ) => Promise<ClassifyResponse>;
  queueStatus: QueueStatus | null;
  enqueueEmails: (
    accountId: number,
    emails: Array<{
      uid: string | number;
      folder: string;
      subject?: string;
      from?: string;
      date?: string;
    }>,
  ) => Promise<QueueEnqueueResponse>;
  fetchQueueStatus: (accountId?: number) => Promise<void>;
  clearQueue: (accountId?: number) => Promise<boolean>;
  retryFailed: (accountId?: number) => Promise<boolean>;
}

/**
 * Available action type labels.
 */
export const AUTO_TAGGER_ACTION_TYPES = [
  { value: "move_to_folder" as const, label: "Move to Folder" },
  { value: "apply_label" as const, label: "Apply Label" },
  { value: "mark_read" as const, label: "Mark as Read" },
  { value: "archive" as const, label: "Archive" },
] as const;

/**
 * Available matching rule types with labels.
 */
export const MATCHING_RULE_TYPES = [
  { value: "sender_contains" as const, label: "Sender Contains" },
  { value: "subject_contains" as const, label: "Subject Contains" },
  { value: "keyword" as const, label: "Keyword" },
  { value: "domain" as const, label: "Domain" },
] as const;

/**
 * Available matching rule match fields with labels.
 */
export const MATCHING_RULE_MATCH_FIELDS = [
  { value: "any" as const, label: "Any Field" },
  { value: "from" as const, label: "From" },
  { value: "subject" as const, label: "Subject" },
  { value: "body" as const, label: "Body" },
] as const;
