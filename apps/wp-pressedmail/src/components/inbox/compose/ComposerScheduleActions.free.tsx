import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";

/**
 * Inert composer schedule actions. Same props as the licensed implementation,
 * so the physical `.active` shim can fall back to this rather than to the paid
 * module. See MobileScheduleActions.free.tsx for why that direction matters.
 */
interface Props {
  form: UseComposeFormReturn;
  isDeliveryPending: boolean;
  variant: "compact" | "ribbon";
}

export function ComposerScheduleSendButton(_props: Props) {
  return null;
}

export function ComposerRemoveScheduleButton(_props: Props) {
  return null;
}
