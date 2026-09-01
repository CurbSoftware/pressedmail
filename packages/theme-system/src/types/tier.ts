/**
 * License tier identifiers for theme access gating.
 *
 * Binary system:
 * - free: No active paid license
 * - pro: Active paid license
 */
export type TierId = 'free' | 'pro';

/**
 * Theme tier access configuration.
 * Determines which license tiers can use a theme.
 */
export interface ThemeTierAccess {
  minimumTier: TierId;
  allowedTiers: TierId[];
}

/**
 * Tier priority for comparison.
 */
export const TierPriority: Record<TierId, number> = {
  free: 0,
  pro: 100,
};

/**
 * Check if one tier is at least as high as another.
 */
export function isTierAtLeast(tierA: TierId, tierB: TierId): boolean {
  return TierPriority[tierA] >= TierPriority[tierB];
}
