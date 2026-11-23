import type { ReactNode, RefObject } from "react";

import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";

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
  fallback?: boolean;
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

/** Free has no contact lists, so no mail merge and no fields for plain text. */
export function TextFieldsButton(_props: {
  inputRef: RefObject<HTMLInputElement | HTMLTextAreaElement | null>;
  target: "subject" | "body";
  value: string;
  onValueChange: (value: string) => void;
  disabled?: boolean;
}) {
  return null;
}

export function MailMergeChoice(_props: {
  form: UseComposeFormReturn;
  disabled?: boolean;
}) {
  return null;
}

export function MailMergeReviewDialog(_props: { form: UseComposeFormReturn }) {
  return null;
}
