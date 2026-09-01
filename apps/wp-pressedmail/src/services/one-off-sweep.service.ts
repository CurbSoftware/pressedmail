/**
 * Sweep request/scope types shared by the sweep dialog (`EmailSweep`) and its
 * call sites. The sweep network call now goes through the process / activity
 * queue (`enqueueSweepQueue` in `process-queue.service.ts`); the old direct
 * `POST /messages/sweep` client was removed when sweeps were routed through the
 * queue, but these types remain the canonical request shape.
 */

export type SweepScope = {
  kind: "account_folder" | "combined_inbox";
  accountIds: number[];
  folderRole?: string;
  folderPath?: string;
  /**
   * Per-account source paths for the combined view (accountId → path) so the
   * server resolves each account's own folder instead of guessing from one
   * shared path string.
   */
  folderMap?: Record<string, string>;
  viewLabel: string;
};

export type OneOffSweepAction = "delete" | "block" | "move";
export type SweepDestinationRole = "junk" | "trash";

export type SweepMatchType =
  | "sender_email"
  | "sender_domain"
  | "subject_contains";

export interface SweepMatchCriteria {
  type: SweepMatchType;
  values: string[];
}

/**
 * Legacy selection semantics, still accepted by the server for old clients:
 * - "explicit": criteria matches across the whole scope UNION the selected rows.
 * - "current_view": every email in the view minus exclusions (criteria ignored).
 */
export type SweepSelectionMode = "explicit" | "current_view";

/**
 * Current scope semantics: the criteria ALWAYS apply:
 * - "entire_view": criteria across the whole folder, minus
 *   `excluded_message_ids`.
 * - "selected_only": criteria within the explicitly selected messages.
 */
export type SweepScopeMode = "entire_view" | "selected_only";

export interface SweepSkippedAccount {
  account_id: number;
  email: string;
  reason: "inactive" | "folder_not_found" | string;
}

export interface StartOneOffSweepRequest {
  selected_message_ids: string[];
  scope: SweepScope;
  action: OneOffSweepAction;
  sweep_scope_mode?: SweepScopeMode;
  destination?: import("@/lib/folder-destination").FolderDestination;
  destination_folder_target?: import("@/types/filter-rules").FilterRuleFolderTarget | null;
  destination_folder_role?: SweepDestinationRole;
  match?: SweepMatchCriteria;
  create_rule?: boolean;
  /** @deprecated legacy contract; new callers send sweep_scope_mode. */
  selection_mode?: SweepSelectionMode;
  excluded_message_ids?: string[];
}
