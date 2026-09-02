/**
 * Tags Types
 *
 * TypeScript types for the tag management system.
 *
 * @since 1.1.0
 */

/**
 * Tag definition.
 */
export interface Tag {
  id: number;
  user_id: number;
  account_id: number | null;
  name: string;
  /** Human-readable note that doubles as the AI auto-tag instruction. */
  description?: string;
  color: string;
  icon: string | null;
  ai_prompt: string;
  ai_auto_tag_enabled: boolean;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

/**
 * Tag capabilities based on tier.
 */
export interface TagCapabilities {
  create: boolean;
  edit: boolean;
  delete: boolean;
  assign: boolean;
  current_count: number;
}

/**
 * Message identifier for tag operations.
 */
export interface MessageIdentifier {
  account_id: number;
  message_uid: string;
  folder?: string;
}

/**
 * Tag creation data.
 */
export interface CreateTagData {
  name: string;
  description?: string;
  color?: string;
  icon?: string;
  ai_prompt?: string;
  ai_auto_tag_enabled?: boolean;
  account_id?: number | null;
}

/**
 * Tag update data.
 */
export interface UpdateTagData {
  name?: string;
  description?: string;
  color?: string;
  icon?: string;
  ai_prompt?: string;
  ai_auto_tag_enabled?: boolean;
  sort_order?: number;
  is_active?: boolean;
  account_id?: number | null;
}

/**
 * API response for tags.
 */
export interface TagsResponse {
  status: "success" | "error";
  tags: Tag[];
  capabilities: TagCapabilities;
  message?: string;
}

/**
 * API response for single tag.
 */
export interface TagResponse {
  status: "success" | "error";
  tag: Tag;
  message?: string;
}

/**
 * API response for tag operations.
 */
export interface TagOperationResponse {
  status: "success" | "error";
  message: string;
  tag?: Tag;
  capabilities?: TagCapabilities;
  code?: string;
  data?: {
    current_count?: number;
  };
}

/**
 * API response for batch operations.
 */
export interface BatchOperationResponse {
  status: "success" | "error";
  message: string;
  results: {
    success: number;
    failed: number;
  };
}

/**
 * Tags context value.
 */
export interface TagsContextValue {
  tags: Tag[];
  loading: boolean;
  error: Error | null;
  capabilities: TagCapabilities | null;
  refreshTags: () => Promise<void>;
  createTag: (data: CreateTagData) => Promise<Tag>;
  updateTag: (tagId: number, data: UpdateTagData) => Promise<Tag>;
  deleteTag: (tagId: number) => Promise<void>;
  assignTag: (
    tagId: number,
    accountId: number,
    messageUid: string,
    folder?: string,
  ) => Promise<void>;
  removeTag: (
    tagId: number,
    accountId: number,
    messageUid: string,
    folder?: string,
  ) => Promise<void>;
  batchAssignTag: (
    tagId: number,
    messages: MessageIdentifier[],
  ) => Promise<{ success: number; failed: number }>;
  batchRemoveTag: (
    tagId: number,
    messages: MessageIdentifier[],
  ) => Promise<{ success: number; failed: number }>;
  getMessageTags: (
    accountId: number,
    messageUid: string,
    folder?: string,
  ) => Promise<Tag[]>;
  reorderTags: (order: number[]) => Promise<void>;
}

/**
 * Predefined tag colors.
 */
export const TAG_COLORS = [
  "#EF4444", // Red
  "#F97316", // Orange
  "#F59E0B", // Amber
  "#EAB308", // Yellow
  "#84CC16", // Lime
  "#22C55E", // Green
  "#10B981", // Emerald
  "#14B8A6", // Teal
  "#06B6D4", // Cyan
  "#0EA5E9", // Sky
  "#3B82F6", // Blue
  "#6366F1", // Indigo
  "#8B5CF6", // Violet
  "#A855F7", // Purple
  "#D946EF", // Fuchsia
  "#EC4899", // Pink
  "#F43F5E", // Rose
  "#64748B", // Slate
] as const;

/**
 * Predefined tag icons (Lucide icon names).
 */
export const TAG_ICONS = [
  "tag",
  "star",
  "heart",
  "flag",
  "bookmark",
  "bell",
  "mail",
  "inbox",
  "archive",
  "folder",
  "file",
  "clock",
  "calendar",
  "check",
  "alert-circle",
  "info",
  "zap",
  "target",
] as const;
