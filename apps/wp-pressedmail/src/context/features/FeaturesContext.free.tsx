import { createContext, useContext, useMemo, type ReactNode } from "react";

import type {
  CalendarLayoutId,
  ContactsLayoutId,
  EnhancedFeatureStatus,
  Feature,
  FeatureCategory,
  FeatureContextValue,
  FeatureId,
  LayoutConfig,
  LayoutId,
  ProEntitlementKey,
} from "@/types/features";

const AVAILABLE_FEATURES = new Set<FeatureId>([
  "sites",
  "users",
  "tags",
  "folders",
  "signatures",
  "composer",
  "user_roles",
  "support_level",
  "backend_integration",
  "dark_mode",
  "themes",
  "mobile_layouts",
  "color_schemes",
  "layouts",
  "email_client",
  "prevent_impersonation",
  "wp_admin_bar_notifications",
  "microsoft_oauth",
]);


const FREE_LAYOUT: LayoutConfig = {
  id: "pressedm",
  name: "PressedM",
  description: "Clean, balanced three-pane layout with resizable panels",
  listVariant: "default",
  composeStyle: "modal",
  navVariant: "folder",
  showCommandRibbon: false,
  showTopSearchBar: false,
  threadedView: false,
  showStatusBar: false,
};

function featureLimit(featureId: FeatureId): number {
  return AVAILABLE_FEATURES.has(featureId) ? -1 : 0;
}

function featureRecord(featureId: FeatureId): Feature {
  const available = AVAILABLE_FEATURES.has(featureId);
  return {
    id: featureId,
    name: featureId,
    description: "",
    icon: "",
    enabled: available,
    available,
    category: "core" as FeatureCategory,
    dependencies: [],
    settings: {},
  } as unknown as Feature;
}

const STATIC_STATUS = {
  features: {},
  limits: Object.fromEntries(
    [...AVAILABLE_FEATURES].map((featureId) => [
      featureId,
      featureLimit(featureId),
    ]),
  ),
} as EnhancedFeatureStatus;

// The Free value carries only what a Free component reads. The licence,
// entitlement, AI-limit, contacts-layout and calendar-layout members are Pro;
// Free reads them through pro-feature.active, which answers "off" without
// touching this context.
type ProFeatureMembers =
  | "aiBulkLimits"
  | "entitlements"
  | "isEntitlementEnabled"
  | "isPro"
  | "getAvailableContactsLayouts"
  | "isContactsLayoutAvailable"
  | "getContactsLayoutConfig"
  | "getAvailableCalendarLayouts"
  | "isCalendarLayoutAvailable"
  | "getCalendarLayoutConfig";

const STATIC_VALUE: Omit<FeatureContextValue, ProFeatureMembers> = {
  features: STATIC_STATUS,
  // The Free build never fetches, so its flags are settled from the first
  // render and consumers gating on "ready" must not wait for anything.
  entitlementsStatus: "ready",
  loading: false,
  error: null,
  hasFeatureAccess: (featureSlug) =>
    AVAILABLE_FEATURES.has(featureSlug as FeatureId),
  isFeatureAvailable: (featureId) => AVAILABLE_FEATURES.has(featureId),
  isFeatureEnabled: (featureId) => AVAILABLE_FEATURES.has(featureId),
  getFeatureValue: <T,>(featureId: FeatureId) =>
    AVAILABLE_FEATURES.has(featureId) as T,
  getFeatureLimit: featureLimit,
  getAvailableThemes: () => ["pressedm", "contrast"],
  isThemeAvailable: (themeId) =>
    themeId === "pressedm" || themeId === "contrast",
  getAvailableLayouts: () => ["pressedm"],
  isLayoutAvailable: (layoutId) => layoutId === "pressedm",
  getLayoutConfig: () => FREE_LAYOUT,
  isFeatureLoaded: (featureId) => AVAILABLE_FEATURES.has(featureId),
  getFeature: featureRecord,
  refreshFeatures: async () => {},
};

const FeaturesContext = createContext<FeatureContextValue | undefined>(
  undefined,
);

export function FeaturesProvider({ children }: { children: ReactNode }) {
  return (
    <FeaturesContext.Provider value={STATIC_VALUE as FeatureContextValue}>
      {children}
    </FeaturesContext.Provider>
  );
}

export function useFeatures(): FeatureContextValue {
  const value = useContext(FeaturesContext);
  if (!value) {
    throw new Error("useFeatures must be used within a FeaturesProvider");
  }
  return value;
}

export function useFeaturesOptional(): FeatureContextValue | undefined {
  return useContext(FeaturesContext);
}

export const useAiBulkLimits = () => useFeatures().aiBulkLimits;
export const useIsPro = () => false;
export const useHasUltimateAccess = () => false;
export const useEntitlements = () => useFeatures().entitlements;
export const useEntitlementEnabled = (_key: ProEntitlementKey) => false;
export function useEntitlementCheck(keys: ProEntitlementKey[]) {
  return useMemo(
    () =>
      Object.fromEntries(keys.map((key) => [key, false])) as Record<
        ProEntitlementKey,
        boolean
      >,
    [keys],
  );
}

export const useFeatureAvailable = (featureId: FeatureId) =>
  useFeatures().isFeatureAvailable(featureId);
// The Free flag map is static and present from the first render, so there is
// never a pending answer for this to abstain over.
export const useFeatureAvailableOrPending = (featureId: FeatureId) =>
  useFeatureAvailable(featureId);
export const useFeatureEnabled = (featureId: FeatureId) =>
  useFeatures().isFeatureEnabled(featureId);
export const useFeatureValue = <T,>(featureId: FeatureId) =>
  useFeatures().getFeatureValue<T>(featureId);
export const useFeatureLimit = (featureId: FeatureId) =>
  useFeatures().getFeatureLimit(featureId);
export const useFeatureLoaded = (featureId: FeatureId) =>
  useFeatures().isFeatureLoaded(featureId);
export const useFeature = (featureId: FeatureId) =>
  useFeatures().getFeature(featureId);
export const useAvailableThemes = () => useFeatures().getAvailableThemes();
export const useThemeAvailable = (themeId: string) =>
  useFeatures().isThemeAvailable(themeId);

export function useFeatureCheck(featureIds: FeatureId[]) {
  const { isFeatureAvailable } = useFeatures();
  return useMemo(
    () =>
      Object.fromEntries(
        featureIds.map((featureId) => [
          featureId,
          isFeatureAvailable(featureId),
        ]),
      ) as Record<FeatureId, boolean>,
    [featureIds, isFeatureAvailable],
  );
}

export function useFeatureRemaining(
  featureId: FeatureId,
  currentCount: number,
) {
  const limit = useFeatureLimit(featureId);
  return limit === -1 ? -1 : Math.max(0, limit - currentCount);
}

export function useFeatureLimitReached(
  featureId: FeatureId,
  currentCount: number,
) {
  const limit = useFeatureLimit(featureId);
  return limit > 0 && currentCount >= limit;
}

export function useCanAddMore(featureId: FeatureId, currentCount: number) {
  const available = useFeatureAvailable(featureId);
  const limit = useFeatureLimit(featureId);
  return available && (limit === -1 || currentCount < limit);
}

export function useFeatureLimitInfo(
  featureId: FeatureId,
  currentCount: number,
) {
  const available = useFeatureAvailable(featureId);
  const limit = useFeatureLimit(featureId);
  const isUnlimited = limit === -1;
  const isDisabled = !available || limit === 0;
  const remaining = isUnlimited ? -1 : Math.max(0, limit - currentCount);
  const isLimitReached = !isUnlimited && !isDisabled && currentCount >= limit;
  return {
    limit,
    current: currentCount,
    remaining,
    isUnlimited,
    isDisabled,
    isLimitReached,
    canAdd: !isDisabled && (isUnlimited || !isLimitReached),
    percentUsed:
      isUnlimited || isDisabled
        ? 0
        : Math.min(100, (currentCount / limit) * 100),
  };
}

export const useAvailableLayouts = (): LayoutId[] =>
  useFeatures().getAvailableLayouts();
export const useLayoutAvailable = (layoutId: LayoutId) =>
  useFeatures().isLayoutAvailable(layoutId);
export const useLayoutConfig = (layoutId: LayoutId) =>
  useFeatures().getLayoutConfig(layoutId);
export const useAvailableContactsLayouts = (): ContactsLayoutId[] =>
  useFeatures().getAvailableContactsLayouts();
export const useContactsLayoutAvailable = (layoutId: ContactsLayoutId) =>
  useFeatures().isContactsLayoutAvailable(layoutId);
export const useContactsLayoutConfig = (layoutId: ContactsLayoutId) =>
  useFeatures().getContactsLayoutConfig(layoutId);
export const useAvailableCalendarLayouts = (): CalendarLayoutId[] =>
  useFeatures().getAvailableCalendarLayouts();
export const useCalendarLayoutAvailable = (layoutId: CalendarLayoutId) =>
  useFeatures().isCalendarLayoutAvailable(layoutId);
export const useCalendarLayoutConfig = (layoutId: CalendarLayoutId) =>
  useFeatures().getCalendarLayoutConfig(layoutId);

export default FeaturesContext;
