/**
 * Layout Management Hook
 *
 * Provides layout state management with build-time and admin whitelabel access control.
 * Persists layout preference to localStorage.
 *
 * Build-time restrictions:
 * - Free builds: Only default layout available (FREE_LAYOUTS)
 * - Pro builds: All layouts available (ALL_LAYOUTS)
 *
 * Admin whitelabel settings can further restrict (but not expand) layout access.
 *
 * @since 1.2.0
 * @updated 2.0.0 - Removed tier-based restrictions, only whitelabel can restrict
 * @updated 3.0.0 - Re-added build-time restrictions for Free vs Pro builds
 */

import { useCallback, useEffect, useMemo } from "react";
import useLocalStorage from "@/context/useLocalStorage";
import { useAdminSettingsSafe } from "@/context/admin-settings";
import type { LayoutId, LayoutConfig } from "@/types/features";
import {
  LayoutConfigs,
  ALL_LAYOUTS,
  FREE_LAYOUTS,
  normalizeLegacyInboxLayoutId,
} from "@/types/features";

const LAYOUT_STORAGE_KEY = "pressedmail_inbox_layout";
const WHITELABEL_DEFAULT_LAYOUT_STORAGE_KEY =
  "pressedmail-whitelabel-default-layout";

export interface UseLayoutReturn {
  /** Currently active layout ID */
  currentLayout: LayoutId;
  /** Configuration for the current layout */
  config: LayoutConfig;
  /** All layout configurations */
  allLayouts: Record<LayoutId, LayoutConfig>;
  /** Layouts available for the current tier */
  availableLayouts: LayoutId[];
  /** Change the current layout (validates tier access) */
  setLayout: (layoutId: LayoutId) => boolean;
  /** Check if a specific layout is available for current tier */
  isLayoutAvailable: (layoutId: LayoutId) => boolean;
  /** Check if the current layout selection is valid for the tier */
  isValidLayout: boolean;
  /** Check if the current layout is the default */
  isDefaultLayout: boolean;
  /** Check if PressedG layout is active */
  isPressedGLayout: boolean;
  /** Check if PressedOut layout is active */
  isPressedOutLayout: boolean;
}

/**
 * Hook for managing inbox layout selection with tier-based access control.
 *
 * @example
 * ```tsx
 * function InboxPage() {
 *   const { currentLayout, config, setLayout, availableLayouts } = useLayout();
 *
 *   return (
 *     <div>
 *       <select
 *         value={currentLayout}
 *         onChange={(e) => setLayout(e.target.value as LayoutId)}
 *       >
 *         {availableLayouts.map((layout) => (
 *           <option key={layout} value={layout}>
 *             {LayoutConfigs[layout].name}
 *           </option>
 *         ))}
 *       </select>
 *       {config.showTopSearchBar && <GlobalSearchBar />}
 *       {config.showCommandRibbon && <CommandRibbon />}
 *     </div>
 *   );
 * }
 * ```
 */
export function useLayout(): UseLayoutReturn {
  const adminSettings = useAdminSettingsSafe();
  const isAdminSettingsLoading = adminSettings?.loading ?? false;
  const whitelabelSettings = adminSettings?.whitelabelSettings ?? null;
  const isWhitelabelEnabled = Boolean(whitelabelSettings?.enabled);
  const allowUserLayoutSwitching =
    isWhitelabelEnabled && whitelabelSettings
      ? (whitelabelSettings.appearance.allow_user_layout_switching ?? true)
      : true;
  const whitelabelDefaultLayout =
    isWhitelabelEnabled && whitelabelSettings
      ? normalizeLegacyInboxLayoutId(
          whitelabelSettings.appearance.default_layout ?? "pressedm",
        )
      : "pressedm";

  // Build-time constant: determines which layouts are available for this build
  // Since __IS_FREE__ is replaced at compile time, this is effectively a constant
  const buildLayouts = __IS_FREE__ ? FREE_LAYOUTS : ALL_LAYOUTS;

  // Admin whitelabel settings can further restrict (but not expand) layout access
  const availableLayouts = useMemo<LayoutId[]>(() => {
    if (!allowUserLayoutSwitching) {
      // Admin has disabled layout switching - only show the default (if valid for build)
      const restricted = buildLayouts.includes(whitelabelDefaultLayout)
        ? whitelabelDefaultLayout
        : "pressedm";
      return [restricted];
    }
    return buildLayouts;
  }, [allowUserLayoutSwitching, buildLayouts, whitelabelDefaultLayout]);

  const resolvedDefaultLayout = useMemo<LayoutId>(() => {
    return availableLayouts.includes(whitelabelDefaultLayout)
      ? whitelabelDefaultLayout
      : "pressedm";
  }, [availableLayouts, whitelabelDefaultLayout]);

  const storedLayoutValue =
    typeof window !== "undefined"
      ? localStorage.getItem(`pressedmail-${LAYOUT_STORAGE_KEY}`)
      : null;
  const storedAdminDefault =
    typeof window !== "undefined"
      ? localStorage.getItem(WHITELABEL_DEFAULT_LAYOUT_STORAGE_KEY)
      : null;
  const hasUserLayoutPreference =
    storedLayoutValue !== null &&
    (storedAdminDefault === null ||
      storedLayoutValue !== JSON.stringify(storedAdminDefault));

  // Persist layout preference to localStorage
  const [storedLayout, setStoredLayout] = useLocalStorage<LayoutId>(
    LAYOUT_STORAGE_KEY,
    isWhitelabelEnabled ? resolvedDefaultLayout : "pressedm",
  );

  // Determine current layout - validate stored value against build-restricted layouts
  const currentLayout = useMemo<LayoutId>(() => {
    if (!allowUserLayoutSwitching) {
      return resolvedDefaultLayout;
    }
    if (isWhitelabelEnabled && !hasUserLayoutPreference) {
      return resolvedDefaultLayout;
    }
    // Only trust stored layout if it's valid for this build (normalize legacy "default")
    const normalizedStored = storedLayout
      ? normalizeLegacyInboxLayoutId(storedLayout)
      : storedLayout;
    if (normalizedStored && buildLayouts.includes(normalizedStored)) {
      return normalizedStored;
    }
    // Fall back to default
    return "pressedm";
  }, [
    allowUserLayoutSwitching,
    buildLayouts,
    hasUserLayoutPreference,
    isWhitelabelEnabled,
    resolvedDefaultLayout,
    storedLayout,
  ]);

  // JUSTIFICATION: Clear invalid stored layouts for the build variant.
  // This handles cases where a user had Pro and downgraded to Free,
  // or localStorage was manually manipulated.
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (
      storedLayout &&
      !buildLayouts.includes(normalizeLegacyInboxLayoutId(storedLayout))
    ) {
      setStoredLayout("pressedm");
    }
  }, [storedLayout, setStoredLayout, buildLayouts]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (isAdminSettingsLoading) return;

    if (isWhitelabelEnabled) {
      if (!hasUserLayoutPreference && storedLayout !== resolvedDefaultLayout) {
        setStoredLayout(resolvedDefaultLayout);
      }
      if (!hasUserLayoutPreference) {
        localStorage.setItem(
          WHITELABEL_DEFAULT_LAYOUT_STORAGE_KEY,
          resolvedDefaultLayout,
        );
      }
    }
  }, [
    hasUserLayoutPreference,
    isAdminSettingsLoading,
    isWhitelabelEnabled,
    resolvedDefaultLayout,
    setStoredLayout,
    storedLayout,
  ]);

  // Get configuration for current layout
  const config = useMemo<LayoutConfig>(() => {
    return LayoutConfigs[currentLayout] || LayoutConfigs.pressedm;
  }, [currentLayout]);

  // Set layout with validation
  const setLayout = useCallback(
    (layoutId: LayoutId): boolean => {
      if (!allowUserLayoutSwitching) {
        const fallback = resolvedDefaultLayout;
        if (layoutId !== fallback) {
          console.warn("Layout switching is disabled by admin settings");
          return false;
        }
      }
      if (!availableLayouts.includes(layoutId)) {
        console.warn(
          `Layout "${layoutId}" is not available for current tier. Available layouts: ${availableLayouts.join(", ")}`,
        );
        return false;
      }
      if (typeof window !== "undefined") {
        localStorage.removeItem(WHITELABEL_DEFAULT_LAYOUT_STORAGE_KEY);
      }
      setStoredLayout(layoutId);
      return true;
    },
    [
      allowUserLayoutSwitching,
      availableLayouts,
      resolvedDefaultLayout,
      setStoredLayout,
    ],
  );

  // Check layout availability
  const checkLayoutAvailable = useCallback(
    (layoutId: LayoutId): boolean => {
      return availableLayouts.includes(layoutId);
    },
    [availableLayouts],
  );

  // Check if the current layout is valid for the tier
  const isValidLayout = useMemo(() => {
    return availableLayouts.includes(currentLayout);
  }, [availableLayouts, currentLayout]);

  return {
    currentLayout,
    config,
    allLayouts: LayoutConfigs,
    availableLayouts,
    setLayout,
    isLayoutAvailable: checkLayoutAvailable,
    isValidLayout,
    isDefaultLayout: currentLayout === "pressedm",
    isPressedGLayout: currentLayout === "pressedg",
    isPressedOutLayout: currentLayout === "pressedout",
  };
}

/**
 * Hook to get just the current layout ID.
 */
export function useCurrentLayout(): LayoutId {
  const { currentLayout } = useLayout();
  return currentLayout;
}

/**
 * Hook to check if a specific layout is currently active.
 */
export function useIsLayout(layoutId: LayoutId): boolean {
  const { currentLayout } = useLayout();
  return currentLayout === layoutId;
}

/**
 * Hook to get layout-specific configuration values.
 */
export function useLayoutValue<K extends keyof LayoutConfig>(
  key: K,
): LayoutConfig[K] {
  const { config } = useLayout();
  return config[key];
}

export default useLayout;
