/**
 * Free has none of the Pro features, so every Pro flag is off. See
 * pro-feature.pro.ts.
 */
import type { AiBulkLimits, FeatureId } from "@/types/features";

export function useProFeatureAvailable(_featureId: FeatureId): boolean {
  return false;
}

export function useProFeatureEnabled(_featureId: FeatureId): boolean {
  return false;
}

export function useProLicenseValid(): boolean {
  return false;
}

export function useProAiBulkLimits(): AiBulkLimits | null {
  return null;
}
