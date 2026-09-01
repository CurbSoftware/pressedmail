/**
 * ComposePane: Reading pane email composer.
 *
 * Thin wrapper around ComposerContent for use in the reading pane
 * (reply, reply-all, forward, new message from reading pane).
 *
 * @since 2.0.0
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useComposer } from "@/context/composer";
import {
  frameCenterStyle,
  frameCoverStyle,
  useAppFrameRect,
} from "@/hooks/useAppFrameRect";
import {
  enableImmersiveMode,
  isImmersiveModeActive,
  restoreWordPressChrome,
} from "@/hooks/useImmersiveMode";
import { useComposeForm } from "@/hooks/compose/v2/useComposeForm";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { ComposerContent } from "./ComposerContent";
import type { EmailEditorRef } from "@/components/composer";
import type { EmailMessage } from "@/types";
import type { Recipient } from "@/types/recipients";

// Re-export utilities for backward compatibility (RightPaneContainer imports from here)
export {
  formatQuotedText,
  formatForwardedText,
  formatQuotedHtml,
  formatForwardedHtml,
} from "./compose-utils";
export type { ComposeMode } from "./compose-utils";

import type { ComposeMode } from "./compose-utils";

export interface ComposeContext {
  mode: ComposeMode;
  originalMessage?: EmailMessage;
  prefillTo?: Recipient[];
  prefillCc?: Recipient[];
  prefillSubject?: string;
  prefillBody?: string;
  quotedText?: string;
}

export interface ComposePaneProps {
  /** Compose mode */
  composeMode: ComposeMode;
  /** Context for reply/forward */
  composeContext?: ComposeContext;
  /** Callback when compose is closed */
  onClose: () => void;
  /** Callback after successful send */
  onSendSuccess?: () => void;
  /** Callback after a manual draft save (refreshes the Drafts view) */
  onDraftSaved?: (draftFolder?: string) => void;
  /** Callback when the currently open server draft is explicitly discarded. */
  onDraftDiscarded?: (draftFolder?: string) => void;
  /** Callback after any scheduled-email row changes (refreshes Scheduled). */
  onScheduledChanged?: () => void;
  /** Optional class name */
  className?: string;
}

export function ComposePane({
  composeMode,
  composeContext,
  onClose,
  onSendSuccess,
  onDraftSaved,
  onDraftDiscarded,
  onScheduledChanged,
  className,
}: ComposePaneProps) {
  const composerContext = useComposer();
  const editorRef = useRef<EmailEditorRef>(null);
  // "pane" renders inline in the reading pane; "popout" is the centered
  // resizable dialog; "full" fills the whole PressedMail window.
  const [paneMode, setPaneMode] = useState<"pane" | "popout" | "full">("pane");
  const isPoppedOut = paneMode === "popout";
  const isFullView = paneMode === "full";
  const isOverlayMode = isPoppedOut || isFullView;
  const { preferences } = useUserPreferences();

  const form = useComposeForm({
    mode: composeMode,
    prefillTo: composeContext?.prefillTo,
    prefillCc: composeContext?.prefillCc,
    prefillSubject: composeContext?.prefillSubject,
    prefillBody: composeContext?.prefillBody,
    quotedText: composeContext?.quotedText,
    editorRef,
    defaultContentType:
      preferences.composer_default_format === "plain_text" ? "plain" : "html",
    composerContext,
    autoSaveOnClose: preferences.auto_save_drafts,
    gateNavigation: true,
    onClose,
    onSendSuccess,
    onDraftSaved,
    onDraftDiscarded,
    onScheduledChanged,
  });

  // Full view means the whole screen belongs to PressedMail, so it turns on
  // immersive mode, the same mechanism as the header toggle, which hides the
  // WordPress admin bar and side menu outright. Sizing the panel around that
  // chrome does not work: WordPress paints it at z-index 99999, above anything
  // the plugin can stack. If the user was already immersive we leave it alone;
  // otherwise the chrome goes back on the way out.
  const restoreChromeRef = useRef(false);

  const enterFullView = useCallback(() => {
    if (!isImmersiveModeActive()) {
      enableImmersiveMode();
      restoreChromeRef.current = true;
    }
    setPaneMode("full");
  }, []);

  const leaveFullView = useCallback((next: "pane" | "popout") => {
    if (restoreChromeRef.current) {
      restoreWordPressChrome();
      restoreChromeRef.current = false;
    }
    setPaneMode(next);
  }, []);

  // Closing or sending while still in full view must not strand the user in a
  // chrome-less wp-admin.
  useEffect(
    () => () => {
      if (restoreChromeRef.current) {
        restoreWordPressChrome();
        restoreChromeRef.current = false;
      }
    },
    [],
  );

  // The pop-out keeps its dim backdrop inside the plugin area, it leaves the
  // WordPress chrome on screen, so it must not paint over it either.
  const frameBox = useAppFrameRect(isPoppedOut);
  const isContained = isPoppedOut && frameBox !== null;

  const frameCover = frameCoverStyle(frameBox);
  // Mirrors the uncontained 92vw/78vh sizing and the max-w-5xl / min-h-[28rem]
  // bounds, measured against the frame instead of the viewport.
  const popoutStyle = frameCenterStyle(frameBox, {
    widthRatio: 0.92,
    maxWidth: 1024,
    heightRatio: 0.78,
    minHeight: 448,
  });

  const panelStyle = isPoppedOut ? popoutStyle : undefined;

  // Switching view unmounts the button that was focused (the Full view button
  // only renders while not in full view), which drops focus to <body> and
  // loses the keyboard user's place mid-message. Park focus on the panel.
  const panelRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!isOverlayMode) return;
    panelRef.current?.focus();
  }, [isOverlayMode, paneMode]);

  return (
    <>
      {isPoppedOut ? (
        <div
          key="compose-popout-overlay"
          data-test="compose-popout-overlay"
          data-testid="compose-popout-overlay"
          data-pm-contained={isContained ? "true" : undefined}
          className={cn(
            "fixed z-50 bg-black/60 backdrop-blur-sm",
            !isContained && "inset-0",
          )}
          style={frameCover}
          aria-hidden="true"
        />
      ) : null}
      <div
        key="compose-pane-container"
        ref={panelRef}
        tabIndex={isOverlayMode ? -1 : undefined}
        role={isOverlayMode ? "dialog" : undefined}
        aria-modal={isOverlayMode ? "true" : undefined}
        aria-label={isOverlayMode ? form.modeTitle : undefined}
        data-test={
          isFullView
            ? "compose-fullview-panel"
            : isPoppedOut
              ? "compose-popout-panel"
              : undefined
        }
        data-testid={
          isFullView
            ? "compose-fullview-panel"
            : isPoppedOut
              ? "compose-popout-panel"
              : undefined
        }
        data-pm-contained={isContained ? "true" : undefined}
        className={cn(
          isFullView &&
            "fixed inset-0 z-50 flex overflow-hidden bg-card text-card-foreground",
          isPoppedOut &&
            "fixed z-50 flex min-w-[320px] -translate-x-1/2 -translate-y-1/2 resize overflow-hidden rounded-lg border border-border bg-card text-card-foreground shadow-2xl",
          isPoppedOut &&
            !isContained &&
            "left-1/2 top-1/2 h-[78vh] max-h-[92vh] min-h-[28rem] w-[92vw] max-w-5xl",
          !isOverlayMode && "h-full",
          !isOverlayMode && className,
        )}
        style={panelStyle}>
        <ComposerContent
          form={form}
          editorRef={editorRef}
          variant="pane"
          showHeader
          showPopOut={!isPoppedOut}
          showReturnToPane={isOverlayMode}
          showFullView={!isFullView}
          onPopOut={() => leaveFullView("popout")}
          onReturnToPane={() => leaveFullView("pane")}
          onFullView={enterFullView}
          className="h-full w-full"
        />
      </div>
    </>
  );
}

export default ComposePane;
