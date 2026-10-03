/**
 * Free build: AI is Pro-only. The Free preferences registry compiles no AI
 * section, so nothing in the Free bundle imports this; it exists so the alias
 * graph (and every tool that walks it) resolves the specifier to a module that
 * names none of the Pro AI preference keys.
 */
export const AI_PREFERENCE_KEYS = [] as const;

export function AiPreferencesSection() {
  return null;
}
