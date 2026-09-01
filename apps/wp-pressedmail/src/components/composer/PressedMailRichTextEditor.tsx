import React, { forwardRef } from "react";
import type { PlateEmailEditorAdapterProps } from "@kit/plate/email-editor";
import {
  getPlateEmailEditorSurfacePreset,
} from "@kit/plate/email-surfaces";

import { PlateComposer } from "./plate-composer";
import type {
  EmailEditorRef,
  PressedMailComposerValue,
} from "./plate-composer-types";

export interface PressedMailRichTextEditorProps
  extends PlateEmailEditorAdapterProps<PressedMailComposerValue> {}

/**
 * Canonical PressedMail rich-text editor adapter.
 *
 * App surfaces import this component; the Plate runtime stays isolated behind
 * PlateComposer and its @kit/plate package imports.
 */
export const PressedMailRichTextEditor = forwardRef<
  EmailEditorRef,
  PressedMailRichTextEditorProps
>(function PressedMailRichTextEditor(
  { initialHtml, surface = "email", minHeight, className, ...props },
  ref,
) {
  const preset = getPlateEmailEditorSurfacePreset(surface);
  const surfaceClassName = className
    ? `${preset.className} ${className}`
    : preset.className;

  return (
    <PlateComposer
      ref={ref}
      initialHtml={initialHtml}
      minHeight={minHeight ?? preset.defaultMinHeight}
      className={surfaceClassName}
      {...props}
    />
  );
});
