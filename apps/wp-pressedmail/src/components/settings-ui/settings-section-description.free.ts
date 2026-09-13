import { __ } from "@wordpress/i18n";

/**
 * Descriptions for the settings tabs the Free edition actually renders.
 *
 * This used to be one shared map holding both editions' tabs, so Pro tab ids
 * and their copy rode into the Free bundle even though Free renders none of
 * those tabs. One of those ids is on the Free denylist in
 * `edition-purity.json`, which is how `scripts/plugin/verify-edition-purity.mjs`
 * caught it.
 *
 * The Pro map is `settings-section-description.ts`, chosen by the
 * `@/components/settings-ui/settings-section-description` alias in
 * `edition-aliases.cjs`, so no Pro reader loses anything by a Pro tab id being
 * missing here. The two maps are meant to differ: this one holds the tabs the
 * Free settings UI renders, that one holds every tab. Adding a Pro tab id here
 * is how the leak comes back, and
 * `src/test/free/settings-section-descriptions.test.ts` pins this map's keys to
 * the ids the Free settings UI actually renders, so it fails when one appears.
 */
export const FREE_SETTINGS_SECTION_DESCRIPTIONS: Record<string, string> = {
  accounts: __("Manage your personal email accounts.", "pressedmail"),
  signatures: __("Create and manage your email signatures.", "pressedmail"),
  preferences: __("Configure your inbox preferences.", "pressedmail"),
  "email-rules": __("Organize incoming messages automatically.", "pressedmail"),
  security: __("Manage inbox security preferences.", "pressedmail"),
  "admin-wp-mail": __(
    "Send WordPress system email through your own SMTP server.",
    "pressedmail",
  ),
  "admin-security-access": __(
    "Control attachment, remote content, and role permissions.",
    "pressedmail",
  ),
  "admin-diagnostics": __(
    "Review plugin status, connectivity, and configuration.",
    "pressedmail",
  ),
  "admin-sync": __(
    "Choose how often mailboxes check for new email.",
    "pressedmail",
  ),
  "admin-data": __(
    "Choose what happens to stored data when the plugin is deleted.",
    "pressedmail",
  ),
  pro: __("Discover the separately distributed Pro plugin.", "pressedmail"),
};

export function settingsSectionDescription(id: string): string {
  return FREE_SETTINGS_SECTION_DESCRIPTIONS[id] ?? "";
}
