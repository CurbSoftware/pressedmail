/**
 * Free-edition branding hook: there is none.
 *
 * Custom branding is an Ultimate feature. Callers read the result only behind
 * `!__IS_FREE__`, so this build never looks inside it and it carries no
 * member names.
 */
import type { UseWhitelabelThemeReturn } from "@/types/whitelabel";

export function useWhitelabelTheme(): UseWhitelabelThemeReturn {
  return null as never;
}

export default useWhitelabelTheme;
