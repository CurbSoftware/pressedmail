/**
 * Compatibility wrapper: the PressedMail composer migrated from TipTap to
 * Plate.js. External callers historically imported `PluginComposerEditor`
 * (and `EmailEditorRef`) from `@/components/editor/v2/PluginComposerEditor`.
 *
 * That TipTap module is gone. This Plate-based shim preserves the legacy
 * component API so authoring surfaces (signatures, templates, content
 * blocks, auto-replies) keep working while importing from
 * `@/components/composer`.
 *
 * The legacy editor accepted `initialValue: string` (HTML). The Plate
 * composer accepts `initialHtml: string`; this wrapper maps it across.
 */

import React, { forwardRef } from "react";

import {
  PressedMailRichTextEditor,
  type PressedMailRichTextEditorProps,
} from "./PressedMailRichTextEditor";
import type {
  EmailEditorRef as PlateEmailEditorRef,
} from "./plate-composer-types";

export type EmailEditorRef = PlateEmailEditorRef;

export interface PluginComposerEditorProps
  extends Omit<PressedMailRichTextEditorProps, "initialValue"> {
  /** Legacy: HTML string initial content. Mapped to `initialHtml`. */
  initialValue?: string;
  /** @deprecated Use initialValue or initialHtml instead. */
  content?: string;
  /** @deprecated No-op. Editing is controlled via `disabled`. */
  editable?: boolean;
  /** @deprecated No-op. The bubble toolbar is always available. */
  showBubbleMenu?: boolean;
  /** Registers the AI chat kit. Mapped to PlateComposer's `aiEnabled`. */
  enableAiCommands?: boolean;
  /** Fired when the Plate editor ref becomes available. */
  onEditorReady?: (ref: EmailEditorRef) => void;
}

export const PluginComposerEditor = forwardRef<
  EmailEditorRef,
  PluginComposerEditorProps
>(function PluginComposerEditor(
  {
    initialValue,
    content,
    editable,
    showBubbleMenu: _showBubbleMenu,
    enableAiCommands = false,
    onEditorReady,
    onReady,
    disabled,
    ...rest
  },
  ref,
) {
  const html = initialValue ?? content ?? rest.initialHtml ?? "";
  const resolvedDisabled = disabled ?? editable === false;

  return (
    <PressedMailRichTextEditor
      {...rest}
      ref={ref}
      initialHtml={html}
      aiEnabled={enableAiCommands}
      onReady={(plateRef) => {
        onReady?.(plateRef);
        onEditorReady?.(plateRef);
      }}
      disabled={resolvedDisabled}
    />
  );
});
