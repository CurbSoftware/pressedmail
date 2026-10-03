/**
 * Free has no managed-domain policy, so account setup is always the ordinary
 * provider flow. See managed-domain-setup.pro.ts.
 */
import type { ManagedDomainSetup } from "@/types/domain-policy";

export function useManagedDomainSetup(
  ..._args: unknown[]
): ManagedDomainSetup | null {
  return null;
}

export function ManagedDomainCredentialsStep(
  _props: Record<string, unknown>,
): null {
  return null;
}
