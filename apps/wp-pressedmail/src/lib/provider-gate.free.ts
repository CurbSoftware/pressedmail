import type { ProviderKey } from "@/components/setup/types";

export function isGmailOAuthEnabled(): boolean {
  return false;
}

// Free has no contacts or calendar import.
export function isGoogleSyncOAuthEnabled(): boolean {
  return false;
}

export function getComingSoonProviders(): ProviderKey[] {
  return [];
}
