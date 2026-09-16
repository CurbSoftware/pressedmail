/**
 * Signature Preview
 *
 * Shows a signature's body as it will render in a message. Used by the
 * signatures list in Personal Settings.
 */

import React from "react";

import { sanitizePreviewHtml } from "@/lib/sanitize-email";
import { cn } from "@/lib/utils";
import type { Signature } from "@/types/signatures";

interface SignaturePreviewProps {
  /** Signature to preview */
  signature: Signature;
  /** Additional class names */
  className?: string;
}

export const SignaturePreview: React.FC<SignaturePreviewProps> = ({
  signature,
  className,
}) => {
  if (signature.content_type === "html") {
    return (
      <div
        className={cn("signature-preview", className)}
        dangerouslySetInnerHTML={{
          __html: sanitizePreviewHtml(signature.content),
        }}
      />
    );
  }

  return (
    <div className={cn("signature-preview whitespace-pre-wrap", className)}>
      {signature.content}
    </div>
  );
};
