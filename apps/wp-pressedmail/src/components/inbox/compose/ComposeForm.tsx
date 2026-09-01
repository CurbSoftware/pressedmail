/**
 * ComposeForm: Floating window email composer.
 *
 * Thin wrapper around ComposerContent that provides the floating window
 * shell (fixed positioning, shadow, border radius).
 *
 * @since 2.0.0
 */

import { useRef } from "react";
import { cn } from "@/lib/utils";
import { useComposer } from "@/context/composer";
import { useComposeForm } from "@/hooks/compose/v2/useComposeForm";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import { ComposerContent } from "./ComposerContent";
import type { EmailEditorRef } from "@/components/composer";

interface ComposeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onMinimize: () => void;
  onMaximize: () => void;
  isMinimized: boolean;
  isMaximized: boolean;
  className?: string;
  headerSendGroupVariant?: "compact" | "ribbon";
}

export function ComposeForm({
  isOpen,
  onClose,
  onMinimize,
  onMaximize,
  isMinimized,
  isMaximized,
  className,
  headerSendGroupVariant,
}: ComposeFormProps) {
  const composerCtx = useComposer();
  const editorRef = useRef<EmailEditorRef>(null);
  const { preferences } = useUserPreferences();
  const undoSendAvailable = useFeatureAvailable("undo_send");

  const form = useComposeForm({
    mode:
      composerCtx.composeData.mode ??
      (composerCtx.composeData.is_reply ? "reply" : "new"),
    editorRef,
    defaultContentType:
      preferences.composer_default_format === "plain_text" ? "plain" : "html",
    composerContext: composerCtx,
    autoSaveOnClose: preferences.auto_save_drafts,
    undoSendEnabled:
      __IS_PRO__ && undoSendAvailable && preferences.undo_send_enabled,
    undoSendDelaySeconds: preferences.undo_send_delay_seconds,
    gateNavigation: true,
    onClose,
  });

  if (!isOpen) return null;

  return (
    <div
      className={cn(
        "fixed z-50 flex flex-col rounded-xl border bg-card text-card-foreground shadow-2xl transition-all duration-300",
        isMaximized ? "inset-4 m-0" : "bottom-6 right-6 w-[36rem] max-h-[92vh]",
        className,
      )}>
      <ComposerContent
        form={form}
        editorRef={editorRef}
        variant="floating"
        showHeader
        headerSendGroupVariant={headerSendGroupVariant}
      />
    </div>
  );
}
