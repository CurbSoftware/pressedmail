/**
 * Admin Settings Context
 *
 * React context for accessing admin-level plugin settings.
 * These settings are controlled by WordPress admins and affect all users.
 *
 * @since 1.6.0
 */

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from "react";
import { routeApiPrefix } from "../Strings";
import { apiFetch } from "@/lib/api-client";
import type { ThemeColorVariables } from "@/types/theme";
import type {
  AppearanceMode,
  EffectiveWhitelabelRuntime,
} from "@/types/whitelabel";

/**
 * Plugin-wide settings controlled by admin.
 */
interface PluginSettings {
  purge_data_on_uninstall: boolean;
  allow_external_images: boolean;
  allow_user_attachment_uploads: boolean;
  allow_media_library_attachments: boolean;
  allow_user_attachment_downloads: boolean;
  max_attachment_size_mb: number;
  php_max_upload_mb: number;
  sync_interval_minutes: number;
  admin_bar_enabled: boolean;
}

type ThemeTokenMap = Partial<ThemeColorVariables>;

/**
 * Combined admin settings context value.
 */
interface AdminSettingsContextValue {
  // Plugin settings
  pluginSettings: PluginSettings | null;
  // Whitelabel settings
  whitelabelSettings: EffectiveWhitelabelRuntime | null;
  // Loading state
  loading: boolean;
  // Error state
  error: Error | null;
  // Attachment permission helpers
  canUploadAttachments: boolean;
  canUseMediaLibraryAttachments: boolean;
  canDownloadAttachments: boolean;
  canShowExternalImages: boolean;
  // Theme/palette restriction helpers
  areProPalettesDisabled: boolean;
  // Whitelabel defaults and switching
  defaultLayout: "pressedm" | "pressedg" | "pressedout";
  defaultTheme: string;
  allowUserLayoutSwitching: boolean;
  allowUserThemeSwitching: boolean;
  defaultMode: AppearanceMode;
  allowUserModeSwitching: boolean;
  themeTokensLight: ThemeTokenMap;
  themeTokensDark: ThemeTokenMap;
  // Refresh function
  refreshSettings: () => Promise<void>;
}

const DEFAULT_PLUGIN_SETTINGS: PluginSettings = {
  purge_data_on_uninstall: false,
  allow_external_images: true,
  allow_user_attachment_uploads: true,
  allow_media_library_attachments: true,
  allow_user_attachment_downloads: true,
  max_attachment_size_mb: 10,
  php_max_upload_mb: 128,
  sync_interval_minutes: 5,
  admin_bar_enabled: true,
};

const AdminSettingsContext = createContext<
  AdminSettingsContextValue | undefined
>(undefined);

/**
 * Get headers for API requests including WordPress nonce.
 */
const getApiHeaders = (): HeadersInit => {
  return {
    "Content-Type": "application/json",
  };
};

interface AdminSettingsProviderProps {
  children: React.ReactNode;
}

function readEffectiveWhitelabelRuntime(): EffectiveWhitelabelRuntime | null {
  const runtime = window.pressedmailPlugin?.whitelabel;
  if (
    !runtime ||
    runtime.version !== 1 ||
    runtime.enabled !== true ||
    typeof runtime.revision !== "string" ||
    runtime.revision.length === 0
  ) {
    return null;
  }

  return runtime;
}

export const AdminSettingsProvider: React.FC<AdminSettingsProviderProps> = ({
  children,
}) => {
  const [pluginSettings, setPluginSettings] = useState<PluginSettings | null>(
    null,
  );
  const [whitelabelSettings, setWhitelabelSettings] =
    useState<EffectiveWhitelabelRuntime | null>(readEffectiveWhitelabelRuntime);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  /**
   * Fetch plugin settings from API.
   */
  /**
   * Fetch the site-wide plugin settings.
   *
   * Every failure path throws so `fetchSettings` records it. Substituting
   * DEFAULT_PLUGIN_SETTINGS here used to turn an unreachable endpoint into a
   * confident "remote images allowed, uploads allowed, downloads allowed",
   * which is the opposite of what an administrator may have configured.
   */
  const fetchPluginSettings = useCallback(async (signal?: AbortSignal) => {
    const response = await apiFetch(`${routeApiPrefix}/plugin/settings`, {
      credentials: "include",
      headers: getApiHeaders(),
      signal,
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch plugin settings: ${response.status}`);
    }

    const data = await response.json();

    if (data.status !== "success" || !data.settings) {
      throw new Error("Plugin settings response carried no settings");
    }

    setPluginSettings({
      ...DEFAULT_PLUGIN_SETTINGS,
      ...data.settings,
    });
  }, []);

  /**
   * Fetch all settings.
   */
  const fetchSettings = useCallback(
    async (signal?: AbortSignal) => {
      setLoading(true);
      setError(null);

      try {
        await fetchPluginSettings(signal);
        setWhitelabelSettings(readEffectiveWhitelabelRuntime());
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return;
        }

        setError(err instanceof Error ? err : new Error("Unknown error"));
      } finally {
        if (!signal?.aborted) {
          setLoading(false);
        }
      }
    },
    [fetchPluginSettings],
  );

  /**
   * Refresh settings.
   */
  const refreshSettings = useCallback(async () => {
    await fetchSettings();
  }, [fetchSettings]);

  // Initial fetch
  useEffect(() => {
    const abortController = new AbortController();

    void fetchSettings(abortController.signal);

    return () => {
      abortController.abort();
    };
  }, [fetchSettings]);

  useEffect(() => {
    const syncEffectiveRuntime = () => {
      setWhitelabelSettings(readEffectiveWhitelabelRuntime());
    };

    window.addEventListener(
      "pressedmail-whitelabel-runtime-updated",
      syncEffectiveRuntime,
    );
    return () => {
      window.removeEventListener(
        "pressedmail-whitelabel-runtime-updated",
        syncEffectiveRuntime,
      );
    };
  }, []);

  // A request still in flight and a request that failed are different states.
  // In flight, the permissive answer keeps the composer usable for the moment
  // it takes to load. Once the request has failed the real values are unknown,
  // and answering "allowed" would hand out a permission the site may forbid.
  const settingsUnavailable = pluginSettings === null && error !== null;

  // Computed values
  const canUploadAttachments = useMemo(() => {
    if (pluginSettings) {
      return pluginSettings.allow_user_attachment_uploads;
    }
    return !settingsUnavailable;
  }, [pluginSettings, settingsUnavailable]);

  const canUseMediaLibraryAttachments = useMemo(() => {
    if (pluginSettings) {
      return pluginSettings.allow_media_library_attachments;
    }
    return !settingsUnavailable;
  }, [pluginSettings, settingsUnavailable]);

  const canDownloadAttachments = useMemo(() => {
    if (pluginSettings) {
      return pluginSettings.allow_user_attachment_downloads;
    }
    return !settingsUnavailable;
  }, [pluginSettings, settingsUnavailable]);

  const canShowExternalImages = useMemo(() => {
    // Fail-closed while settings are still loading: never flash the per-user
    // "auto-load images" tile visible (or reveal remote images) before the
    // admin "Allow remote images" value is known.
    return pluginSettings ? pluginSettings.allow_external_images : false;
  }, [pluginSettings]);

  const areProPalettesDisabled = useMemo(() => {
    return false;
  }, []);

  const defaultLayout = useMemo(() => {
    return whitelabelSettings?.appearance.default_layout ?? "pressedm";
  }, [whitelabelSettings]);

  const defaultTheme = useMemo(() => {
    return whitelabelSettings?.appearance.theme_id ?? "pressedm";
  }, [whitelabelSettings]);

  const allowUserLayoutSwitching = useMemo(() => {
    return whitelabelSettings?.appearance.allow_user_layout_switching ?? true;
  }, [whitelabelSettings]);

  const allowUserThemeSwitching = useMemo(() => {
    return whitelabelSettings?.appearance.allow_user_theme_switching ?? true;
  }, [whitelabelSettings]);

  const defaultMode = useMemo(
    () => whitelabelSettings?.appearance.default_mode ?? "system",
    [whitelabelSettings],
  );

  const allowUserModeSwitching = useMemo(
    () => whitelabelSettings?.appearance.allow_user_mode_switching ?? true,
    [whitelabelSettings],
  );

  const themeTokensLight = useMemo(() => {
    return {};
  }, []);

  const themeTokensDark = useMemo(() => {
    return {};
  }, []);

  const value: AdminSettingsContextValue = useMemo(
    () => ({
      pluginSettings,
      whitelabelSettings,
      loading,
      error,
      canUploadAttachments,
      canUseMediaLibraryAttachments,
      canDownloadAttachments,
      canShowExternalImages,
      areProPalettesDisabled,
      defaultLayout,
      defaultTheme,
      allowUserLayoutSwitching,
      allowUserThemeSwitching,
      defaultMode,
      allowUserModeSwitching,
      themeTokensLight,
      themeTokensDark,
      refreshSettings,
    }),
    [
      pluginSettings,
      whitelabelSettings,
      loading,
      error,
      canUploadAttachments,
      canUseMediaLibraryAttachments,
      canDownloadAttachments,
      canShowExternalImages,
      areProPalettesDisabled,
      defaultLayout,
      defaultTheme,
      allowUserLayoutSwitching,
      allowUserThemeSwitching,
      defaultMode,
      allowUserModeSwitching,
      themeTokensLight,
      themeTokensDark,
      refreshSettings,
    ],
  );

  return (
    <AdminSettingsContext.Provider value={value}>
      {children}
    </AdminSettingsContext.Provider>
  );
};

/**
 * Hook to access admin settings context.
 * Throws if used outside provider.
 */
export const useAdminSettings = (): AdminSettingsContextValue => {
  const context = useContext(AdminSettingsContext);
  if (context === undefined) {
    throw new Error(
      "useAdminSettings must be used within an AdminSettingsProvider",
    );
  }
  return context;
};

/**
 * Safe hook to access admin settings context.
 * Returns null if used outside provider instead of throwing.
 */
export const useAdminSettingsSafe = (): AdminSettingsContextValue | null => {
  return useContext(AdminSettingsContext) ?? null;
};

/**
 * Hook to check if attachment uploads are allowed.
 * Returns true (allowed) if context not available.
 */
export const useCanUploadAttachments = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.canUploadAttachments ?? true;
};

/**
 * Hook to check if Media Library attachments are allowed.
 * Returns true (allowed) if context not available.
 */
export const useCanUseMediaLibraryAttachments = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.canUseMediaLibraryAttachments ?? true;
};

/**
 * Hook to check if attachment downloads are allowed.
 * Returns true (allowed) if context not available.
 */
export const useCanDownloadAttachments = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.canDownloadAttachments ?? true;
};

/**
 * Hook to check if external images may be shown.
 * Returns true (allowed) if context not available.
 */
export const useCanShowExternalImages = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.canShowExternalImages ?? true;
};

/**
 * Hook to get max attachment size in MB.
 * Returns 10 (default) if context not available.
 */
export const useMaxAttachmentSizeMb = (): number => {
  const context = useContext(AdminSettingsContext);
  return context?.pluginSettings?.max_attachment_size_mb ?? 10;
};

/**
 * Hook to get the admin email sync interval in minutes.
 * Returns 5 (default) if context is not available.
 */
export const useSyncIntervalMinutes = (): number => {
  const context = useContext(AdminSettingsContext);
  return context?.pluginSettings?.sync_interval_minutes ?? 5;
};

/**
 * Hook to check if recurring automatic mailbox sync is disabled.
 */
export const useAutoSyncDisabled = (): boolean => {
  return useSyncIntervalMinutes() <= 0;
};

/**
 * Hook to check if pro palettes are disabled.
 * Returns false (not disabled) if context not available.
 */
export const useAreProPalettesDisabled = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.areProPalettesDisabled ?? false;
};

/**
 * Hook to get default layout from whitelabel settings.
 */
export const useWhitelabelDefaultLayout =
  (): EffectiveWhitelabelRuntime["appearance"]["default_layout"] => {
    const context = useContext(AdminSettingsContext);
    return context?.defaultLayout ?? "pressedm";
  };

/**
 * Hook to get default theme from whitelabel settings.
 */
export const useWhitelabelDefaultTheme = (): string => {
  const context = useContext(AdminSettingsContext);
  return context?.defaultTheme ?? "pressedm";
};

/**
 * Hook to check if users can switch layouts.
 */
export const useAllowUserLayoutSwitching = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.allowUserLayoutSwitching ?? true;
};

/**
 * Hook to check if users can switch themes.
 */
export const useAllowUserThemeSwitching = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.allowUserThemeSwitching ?? true;
};

/** Get the administrator default appearance mode. */
export const useWhitelabelDefaultMode = (): AppearanceMode => {
  const context = useContext(AdminSettingsContext);
  return context?.defaultMode ?? "system";
};

/** Check whether users may switch light/dark/system appearance. */
export const useAllowUserModeSwitching = (): boolean => {
  const context = useContext(AdminSettingsContext);
  return context?.allowUserModeSwitching ?? true;
};

/**
 * Hook to get whitelabel theme tokens.
 */
export const useWhitelabelThemeTokens = (): {
  light: ThemeTokenMap;
  dark: ThemeTokenMap;
} => {
  const context = useContext(AdminSettingsContext);
  return {
    light: context?.themeTokensLight ?? {},
    dark: context?.themeTokensDark ?? {},
  };
};

export default AdminSettingsContext;
