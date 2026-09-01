/**
 * Free-edition undo-send: inert provider and no-op hook.
 *
 * Undo send is Pro. The real context reached the Free bundle through the shared
 * compose form, which imports it unconditionally and decides at runtime.
 */
import type { ReactNode } from "react";

export function UndoSendProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useUndoSend() {
  return { showUndoSend: () => undefined };
}
