/**
 * Pane Compose Context
 *
 * Provides compose request signals for the Default layout where compose
 * opens in the reading pane (content area) instead of a floating window.
 *
 * Supports:
 * - New message
 * - Reply / Reply All / Forward (triggered from toolbar)
 *
 * - Toolbar/GlobalNavBar writes requests via requestPane*()
 * - RightPaneContainer subscribes and acts on requests
 *
 * @since 3.2.0
 * @updated 3.3.0 - Added reply/replyAll/forward request types
 */

import {
  createContext,
  useContext,
  useState,
  useCallback,
  type ReactNode,
} from "react";
import type { ComposeData } from "@/types";

export type PaneComposeRequest =
  | { type: "new" }
  | { type: "prefill"; data: ComposeData }
  | { type: "reply" }
  | { type: "reply-all" }
  | { type: "forward" }
  | null;

interface PaneComposeContextType {
  paneComposeRequest: PaneComposeRequest;
  requestPaneCompose: () => void;
  requestPaneComposeWithData: (data: ComposeData) => void;
  requestPaneReply: () => void;
  requestPaneReplyAll: () => void;
  requestPaneForward: () => void;
  clearPaneComposeRequest: () => void;
}

const PaneComposeContext = createContext<PaneComposeContextType | null>(null);

export function PaneComposeProvider({ children }: { children: ReactNode }) {
  const [paneComposeRequest, setPaneComposeRequest] =
    useState<PaneComposeRequest>(null);

  const requestPaneCompose = useCallback(() => {
    setPaneComposeRequest({ type: "new" });
  }, []);

  const requestPaneComposeWithData = useCallback((data: ComposeData) => {
    setPaneComposeRequest({ type: "prefill", data });
  }, []);

  const requestPaneReply = useCallback(() => {
    setPaneComposeRequest({ type: "reply" });
  }, []);

  const requestPaneReplyAll = useCallback(() => {
    setPaneComposeRequest({ type: "reply-all" });
  }, []);

  const requestPaneForward = useCallback(() => {
    setPaneComposeRequest({ type: "forward" });
  }, []);

  const clearPaneComposeRequest = useCallback(() => {
    setPaneComposeRequest(null);
  }, []);

  return (
    <PaneComposeContext.Provider
      value={{
        paneComposeRequest,
        requestPaneCompose,
        requestPaneComposeWithData,
        requestPaneReply,
        requestPaneReplyAll,
        requestPaneForward,
        clearPaneComposeRequest,
      }}>
      {children}
    </PaneComposeContext.Provider>
  );
}

export function usePaneCompose() {
  return useContext(PaneComposeContext);
}
