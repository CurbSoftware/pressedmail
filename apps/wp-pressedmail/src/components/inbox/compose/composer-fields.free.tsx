import type { ReactNode } from "react";

import type { PlateEmailEditorSurface } from "@/lib/email-surfaces";

/**
 * Free has no merge fields. The toolbar button, the email-composer catalog
 * and the field-group settings render nothing, and the editor's children
 * pass through unchanged.
 */
export function ComposerFieldCatalog({
  children,
}: {
  surface: PlateEmailEditorSurface;
  enabled: boolean;
  children: ReactNode;
}) {
  return <>{children}</>;
}

export function FieldsToolbarButton(_props: {
  disabled?: boolean;
  surface: PlateEmailEditorSurface;
}) {
  return null;
}

export function FieldGroupSettings(_props: {
  hidden: readonly string[];
  onChange: (hidden: string[]) => void;
  disabled?: boolean;
}) {
  return null;
}
