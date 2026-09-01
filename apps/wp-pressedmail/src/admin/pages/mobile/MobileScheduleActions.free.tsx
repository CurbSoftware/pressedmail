import type { UseComposeFormReturn } from "@/hooks/compose/v2/useComposeForm";

/**
 * Inert mobile schedule actions.
 *
 * Takes the same props as the licensed implementation on purpose. The physical
 * `.active` shim is what TypeScript resolves when the Vite alias is not
 * applied, and it used to re-export the licensed module so callers would still
 * typecheck. That made a missed alias leak the paid implementation into a Free
 * build instead of costing a visibly absent control, which is the wrong way for
 * that failure to fall.
 */
export function MobileScheduleActions(_props: {
  form: UseComposeFormReturn;
  isDeliveryPending: boolean;
}) {
  return null;
}
