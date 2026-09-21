import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Convenience hook for email list mode preference.
 *
 * Every edition respects the stored value. Infinite scroll is not a paid
 * feature: the sentinel and the observer ship in both packages, and the server
 * serves offset pages either way.
 */
export function useEmailListMode() {
  const { preferences, loading, saving, updatePreference } =
    useUserPreferences();

  const emailListMode: "pagination" | "lazy_loading" =
    preferences.email_list_mode;

  const pageSize = preferences.email_list_page_size;
  const isPagination = emailListMode === "pagination";

  return {
    emailListMode,
    pageSize,
    isPagination,
    loading,
    saving,
    updatePreference,
  };
}
