/**
 * useLocale: read the active plugin-scoped UI language and switch it.
 *
 * @since 3.0.0
 */

import { useLocaleContext } from "@/context/i18n/LocaleProvider";

export function useLocale() {
  return useLocaleContext();
}
