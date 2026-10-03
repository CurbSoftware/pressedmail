/**
 * Free has no whitelabel runtime. See whitelabel-runtime.pro.ts.
 */
import type { WhitelabelRuntimeState } from "@/types/whitelabel";

export function useWhitelabelRuntime(
  _settingsVersion: unknown,
): WhitelabelRuntimeState | null {
  return null;
}
