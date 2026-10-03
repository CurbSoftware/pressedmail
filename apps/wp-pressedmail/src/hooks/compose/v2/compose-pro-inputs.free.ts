/**
 * Free has no undo send, inline AI tools, contact lists or read receipts, so
 * the composer gets no Pro inputs. See compose-pro-inputs.pro.ts.
 */
import type { ComposeProInputs } from "@/types/compose";

export function useComposeProInputs(
  _undoSend: boolean | undefined,
): ComposeProInputs | null {
  return null;
}
