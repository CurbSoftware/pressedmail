import { useUserPreferences } from "@/hooks/useUserPreferences";

/**
 * Convenience hook for email list mode preference.
 *
 * Free builds are locked to pagination mode via compile-time constant.
 * Pro builds respect the user's stored preference.
 */
export function useEmailListMode() {
  const { preferences, loading, saving, updatePreference } =
    useUserPreferences();

  // Free build: force pagination regardless of stored value
  const emailListMode: "pagination" | "lazy_loading" = __IS_FREE__
    ? "pagination"
    : preferences.email_list_mode;

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
