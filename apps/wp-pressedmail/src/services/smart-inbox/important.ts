import { getRuntimeRestNamespace } from "@/lib/runtime-config";
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
}

export interface MarkImportantContext {
  accountId?: string | number | null;
  folder?: string | null;
  identifierMode?: "uid" | "msg_no";
}

/**
 * Persist a message's importance via the smart-inbox priority endpoint.
 */
export async function markMessageImportant(
  messageId: string | number,
  important: boolean,
  context: MarkImportantContext = {},
): Promise<ToggleResult> {
  try {
    const body: Record<string, unknown> = {
      message_id: String(messageId),
      important,
    };
    if (context.accountId !== undefined && context.accountId !== null) {
      body.account_id = context.accountId;
    }
    if (context.folder) {
      body.folder = context.folder;
    }
    if (context.identifierMode) {
      body.identifier_mode = context.identifierMode;
    }

    const response = await apiFetch(`/wp-json/${getRuntimeRestNamespace()}/smart-inbox/important`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      return { success: false };
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
