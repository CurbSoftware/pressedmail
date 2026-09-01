/**
 * ComposerFooter: Compact composer footer.
 *
 * @since 2.0.0
 */

import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";

interface ComposerFooterProps {
  form: UseComposeFormReturn;
}

export function ComposerFooter({ form: _form }: ComposerFooterProps) {
  void _form;

  return null;
}
