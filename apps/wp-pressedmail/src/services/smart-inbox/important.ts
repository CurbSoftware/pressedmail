import {
  parseAccountQualifiedToken,
  parseMessageIdentityRef,
} from "@/lib/message-identity";
import { getPluginRestBase } from "@/lib/runtime-config";
import { apiFetch } from "@/lib/api-client";
/**
 * Smart-inbox importance helpers.
 *
 * `important` has no IMAP flag, user-controlled importance is persisted through
 * the smart-inbox priority API (the same endpoint as useSmartInbox().markImportant).
 * These helpers let the inbox list optimistically toggle importance and revert on
 * failure, without depending on the React hook.
 */

export interface ToggleResult {
  success: boolean;
  error?: string;
  requiresRefresh?: boolean;
}

export interface MarkImportantContext {
  accountId?: string | number | null;
  folder?: string | null;
  identifierMode?: "uid" | "msg_no";
  uidValidity?: string | number;
}

/**
 * Persist a message's importance via the smart-inbox priority endpoint.
 */
export async function markMessageImportant(
  messageId: string | number,
  important: boolean,
  context: MarkImportantContext = {},
): Promise<ToggleResult> {
  const token =
    typeof messageId === "string"
      ? parseAccountQualifiedToken(messageId)
      : null;
  const ref =
    token?.kind === "message"
      ? token
      : parseMessageIdentityRef({
          accountId: context.accountId,
          folder: context.folder,
          uidValidity: context.uidValidity,
          uid: messageId,
        });
  if (
    !ref ||
    context.identifierMode === "msg_no" ||
    (context.accountId != null &&
      String(context.accountId) !== String(ref.accountId)) ||
    (context.folder != null && context.folder !== ref.folder) ||
    (context.uidValidity != null &&
      String(context.uidValidity) !== ref.uidValidity)
  ) {
    return {
      success: false,
      requiresRefresh: true,
      error: "The message identity changed. Reload the mailbox.",
    };
  }
  try {
    const body = {
      message_id: ref.uid,
      account_id: ref.accountId,
      folder: ref.folder,
      uid_validity: ref.uidValidity,
      identifier_mode: "uid",
      important,
    };

    const response = await apiFetch(
      `${getPluginRestBase()}smart-inbox/important`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!response.ok) {
      return {
        success: false,
        requiresRefresh: response.status === 409,
        error:
          response.status === 409
            ? "The mailbox changed. Reload it before changing importance."
            : "Could not update importance.",
      };
    }

    const data = await response.json();
    return { success: Boolean(data?.success) };
  } catch {
    return { success: false };
  }
}

export interface ToggleImportantDeps {
  /** Current importance state of the message. */
  getImportant: () => boolean;
  /** Optimistically patch the importance state in the list/cache. */
  setImportant: (important: boolean) => void;
  /** Persist the new importance state. */
  persist: (important: boolean) => Promise<ToggleResult>;
}

/**
 * Toggle a message's importance with an optimistic update + revert-on-failure.
 */
export async function performToggleImportant(
  deps: ToggleImportantDeps,
): Promise<ToggleResult> {
  const next = !deps.getImportant();

  // Optimistically flip so the icon updates instantly.
  deps.setImportant(next);

  const result = await deps.persist(next);

  if (!result.success) {
    // Revert on failure.
    deps.setImportant(!next);
  }

  return result;
}
