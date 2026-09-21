/**
 * The edition alias table: which module each `@/...` specifier resolves to in
 * the Free build versus the Pro build.
 *
 * It lives here, not in `vite.config.ts`, because the test runner needs the
 * exact same table. When the two lists drifted, tests resolved `.active`
 * specifiers to their physical fallback instead of the edition implementation,
 * so a component could pass its tests and still be wrong in every real build.
 *
 * Consumed by `vite.config.ts` and `testing/config/apps/wp-pressedmail/vitest.config.ts`.
 */

/**
 * Stub aliases keyed on a build-time feature flag rather than the edition
 * directly. They used to live only in vite.config.ts, so the test runner never
 * applied them and the stubs they select were unreachable from any test.
 *
 * @type {Array<{flag: string, find: RegExp, target: string}>}
 */
const FLAG_STUB_ALIASES = [
  {
    flag: "__ENABLE_CONTACTS__",
    find: /^@\/context\/contacts$/,
    target: "./src/context/contacts/ContactsContext.stub.tsx",
  },
  {
    flag: "__ENABLE_CONTACTS__",
    find: /^@\/context\/contacts\/ContactsContext$/,
    target: "./src/context/contacts/ContactsContext.stub.tsx",
  },
  {
    flag: "__ENABLE_CALENDAR__",
    find: /^@\/context\/calendar$/,
    target: "./src/context/calendar/CalendarContext.stub.tsx",
  },
  {
    flag: "__ENABLE_CALENDAR__",
    find: /^@\/context\/calendar\/CalendarContext$/,
    target: "./src/context/calendar/CalendarContext.stub.tsx",
  },
  {
    flag: "__ENABLE_AI_SETTINGS__",
    find: /^@\/context\/ai\/AIContext$/,
    target: "./src/context/ai/AIContext.stub.tsx",
  },
  {
    flag: "__ENABLE_AI_SETTINGS__",
    find: /^@\/context\/email-summary$/,
    target: "./src/context/email-summary/EmailSummaryContext.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/components\/phishing\/PhishingSafetyButton$/,
    target: "./src/components/phishing/PhishingSafetyButton.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/components\/phishing\/PhishingIndicator$/,
    target: "./src/components/phishing/PhishingIndicator.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/components\/phishing\/PhishingResultBadge$/,
    target: "./src/components/phishing/PhishingResultBadge.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/context\/phishing$/,
    target: "./src/context/phishing/PhishingContext.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/context\/phishing\/PhishingContext$/,
    target: "./src/context/phishing/PhishingContext.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/hooks\/useSelectedMessagePhishingScan$/,
    target: "./src/hooks/useSelectedMessagePhishingScan.stub.tsx",
  },
  {
    flag: "__ENABLE_PHISHING_DETECTION__",
    find: /^@\/hooks\/useMessagePhishingAutoScan$/,
    target: "./src/hooks/useMessagePhishingAutoScan.stub.ts",
  },
  {
    flag: "__ENABLE_AUTO_TAGGER__",
    find: /^@\/context\/auto-tagger$/,
    target: "./src/context/auto-tagger/AutoTaggerContext.stub.tsx",
  },
  {
    flag: "__ENABLE_AUTO_TAGGER__",
    find: /^@\/context\/auto-tagger\/AutoTaggerContext$/,
    target: "./src/context/auto-tagger/AutoTaggerContext.stub.tsx",
  },
];

/**
 * @param {string} appDir absolute path to apps/wp-pressedmail
 * @param {'free'|'pro'} variant
 * @param {Record<string, boolean>} [featureFlags] resolved __ENABLE_* map. Vite
 *   passes its own so env overrides are honoured; defaults to the plain
 *   variant-derived set.
 * @returns {Array<{find: RegExp, replacement: string}>}
 */
function resolveVariantFlags(appDir, variant) {
  const { FEATURE_GROUPS, FEATURE_VARIANTS, DISABLED_FEATURES } = require(
    `${appDir}/feature-variants.cjs`,
  );
  const disabled = new Set(DISABLED_FEATURES);
  const flags = {};

  for (const features of Object.values(FEATURE_GROUPS)) {
    for (const id of features) {
      const required = FEATURE_VARIANTS[id] || "free";
      flags[`__ENABLE_${id.toUpperCase()}__`] = disabled.has(id)
        ? false
        : required === "free" || (required === "pro" && variant === "pro");
    }
  }

  return flags;
}

function editionAliases(appDir, variant, featureFlags) {
  // Plain string join rather than node:path: Vite pre-bundles the config to
  // ESM, where a `require` inside a .cjs file throws. Forward slashes are what
  // Rollup resolves against anyway.
  const pick = (free, pro) =>
    `${appDir}/${(variant === "free" ? free : pro).replace(/^\.\//, "")}`;

  const flags = featureFlags ?? resolveVariantFlags(appDir, variant);

  return [
    {
      // The eight premium palettes. Free compiles an empty stylesheet in their
      // place, so the WordPress.org build carries no Pro theme CSS at all.
      // The specifier has no physical file on purpose: a build that loses this
      // alias fails to resolve it instead of quietly picking an edition.
      find: /^@\/styles\/premium-themes\.css$/,
      replacement: pick(
        "./src/styles/premium-themes.free.css",
        "./src/styles/premium-themes.pro.css",
      ),
    },
    {
      find: /^@\/admin\/EditionApp\.active$/,
      replacement: pick(
        "./src/admin/EditionApp.free.tsx",
        "./src/admin/EditionApp.pro.tsx",
      ),
    },
    {
      find: /^@\/components\/setup\/step-credentials-oauth-policy\.active$/,
      replacement: pick(
        "./src/components/setup/step-credentials-oauth-policy.public-free.tsx",
        "./src/components/setup/step-credentials-oauth-policy.full.tsx",
      ),
    },
    {
      find: /^@\/components\/setup\/oauth-connect-provider-config\.active$/,
      replacement: pick(
        "./src/components/setup/oauth-connect-provider-config.public-free.ts",
        "./src/components/setup/oauth-connect-provider-config.full.ts",
      ),
    },
    {
      find: /^@\/components\/setup\/providers$/,
      replacement: pick(
        "./src/components/setup/providers.free.ts",
        "./src/components/setup/providers.ts",
      ),
    },
    {
      find: /^@\/lib\/provider-gate$/,
      replacement: pick(
        "./src/lib/provider-gate.free.ts",
        "./src/lib/provider-gate.ts",
      ),
    },
    {
      find: /^@\/context\/features(?:\/FeaturesContext)?$/,
      replacement: pick(
        "./src/context/features/FeaturesContext.free.tsx",
        "./src/context/features/FeaturesContext.tsx",
      ),
    },
    {
      find: /^@\/context\/features\/UpgradeModalContext$/,
      replacement: pick(
        "./src/context/features/UpgradeModalContext.free.tsx",
        "./src/context/features/UpgradeModalContext.tsx",
      ),
    },
    {
      find: /^@\/components\/features\/UpgradeModal\.active$/,
      replacement: pick(
        "./src/components/features/UpgradeModal.free.tsx",
        "./src/components/features/UpgradeModal.tsx",
      ),
    },
    {
      find: /^@\/components\/themes\/ThemeProvider$/,
      replacement: pick(
        "./src/components/themes/ThemeProvider.free.tsx",
        "./src/components/themes/ThemeProvider.tsx",
      ),
    },
    {
      find: /^@\/components\/themes$/,
      replacement: pick(
        "./src/components/themes/index.free.ts",
        "./src/components/themes/index.ts",
      ),
    },
    {
      find: /^@\/components\/layouts$/,
      replacement: pick(
        "./src/components/layouts/index.free.ts",
        "./src/components/layouts/index.ts",
      ),
    },
    {
      find: /^@\/components\/compose\/SchedulePopover$/,
      replacement: pick(
        "./src/components/compose/SchedulePopover.free.tsx",
        "./src/components/compose/SchedulePopover.tsx",
      ),
    },
    {
      // The calendar is Pro-only, so Free gets inert replacements for the two
      // "Add to calendar" buttons instead of their copy behind a false guard.
      find: /^@\/components\/calendar\/AddToCalendarButton$/,
      replacement: pick(
        "./src/components/calendar/AddToCalendarButton.free.tsx",
        "./src/components/calendar/AddToCalendarButton.tsx",
      ),
    },
    {
      // Free ships no calendar, so it has no ICS import route and no dialog.
      find: /^@\/components\/calendar\/ImportIcsPreview$/,
      replacement: pick(
        "./src/components/calendar/ImportIcsPreview.free.tsx",
        "./src/components/calendar/ImportIcsPreview.tsx",
      ),
    },
    {
      // Free ships no calendar or contacts sync, so no popup can post a
      // callback back to the opener.
      find: /^@\/lib\/calendar-oauth-callback$/,
      replacement: pick(
        "./src/lib/calendar-oauth-callback.free.ts",
        "./src/lib/calendar-oauth-callback.ts",
      ),
    },
    {
      // Auto-tagging is Pro-only, so the tag menu carries the entry only there.
      find: /^@\/components\/inbox\/MailTagAutoTagItem$/,
      replacement: pick(
        "./src/components/inbox/MailTagAutoTagItem.free.tsx",
        "./src/components/inbox/MailTagAutoTagItem.tsx",
      ),
    },
    {
      // Scheduled sending is Pro-only, so Free never names its edit route.
      find: /^@\/services\/scheduled-email-edit$/,
      replacement: pick(
        "./src/services/scheduled-email-edit.free.ts",
        "./src/services/scheduled-email-edit.ts",
      ),
    },
    {
      // Pro checks its own updates against the licence server; Free follows
      // WordPress.org and asks nobody.
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/use-latest-release$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/use-latest-release.free.ts",
        "./src/admin/pages/settings/_components/admin-settings/use-latest-release.ts",
      ),
    },
    {
      find: /^@\/components\/inbox\/compose\/ComposerScheduleActions\.active$/,
      replacement: pick(
        "./src/components/inbox/compose/ComposerScheduleActions.free.tsx",
        "./src/components/inbox/compose/ComposerScheduleActions.pro.tsx",
      ),
    },
    {
      find: /^@\/admin\/pages\/mobile\/MobileScheduleActions\.active$/,
      replacement: pick(
        "./src/admin/pages/mobile/MobileScheduleActions.free.tsx",
        "./src/admin/pages/mobile/MobileScheduleActions.pro.tsx",
      ),
    },
    {
      find: /^@\/components\/scheduled\/ScheduledEmailReadingPane$/,
      replacement: pick(
        "./src/components/scheduled/ScheduledEmailReadingPane.free.tsx",
        "./src/components/scheduled/ScheduledEmailReadingPane.tsx",
      ),
    },
    {
      find: /^@\/context\/scheduled\/ScheduledEmailsContext$/,
      replacement: pick(
        "./src/context/scheduled/ScheduledEmailsContext.free.tsx",
        "./src/context/scheduled/ScheduledEmailsContext.tsx",
      ),
    },
    {
      find: /^@\/layouts\/shared\/components\/NavigationItems$/,
      replacement: pick(
        "./src/layouts/shared/components/NavigationItems.free.tsx",
        "./src/layouts/shared/components/NavigationItems.tsx",
      ),
    },
    {
      find: /^@\/layouts\/shared\/components\/speed-dial-menu$/,
      replacement: pick(
        "./src/layouts/shared/components/speed-dial-menu.free.tsx",
        "./src/layouts/shared/components/speed-dial-menu.tsx",
      ),
    },
    {
      find: /^@\/components\/application-layout\/DisplayModeControls$/,
      replacement: pick(
        "./src/components/application-layout/DisplayModeControls.free.tsx",
        "./src/components/application-layout/DisplayModeControls.tsx",
      ),
    },
    {
      find: /^@\/components\/composer\/plate\/ai-kit\.active$/,
      replacement: pick(
        "./src/components/composer/plate/ai-kit.free.ts",
        "./src/components/composer/plate/ai-kit.tsx",
      ),
    },
    {
      find: /^@\/components\/composer\/plate\/ai-toolbar-button\.active$/,
      replacement: pick(
        "./src/components/composer/plate/ai-toolbar-button.free.tsx",
        "./src/components/composer/plate/ai-toolbar-button.tsx",
      ),
    },
    {
      find: /^@\/lib\/phishing-email$/,
      replacement: pick(
        "./src/lib/phishing-email.free.ts",
        "./src/lib/phishing-email.ts",
      ),
    },
    {
      find: /^@\/components\/icons\/PhishingIcons$/,
      replacement: pick(
        "./src/components/icons/PhishingIcons.free.tsx",
        "./src/components/icons/PhishingIcons.tsx",
      ),
    },
    {
      find: /^@\/components\/snooze\/use-snooze$/,
      replacement: pick(
        "./src/components/snooze/use-snooze.free.ts",
        "./src/components/snooze/use-snooze.ts",
      ),
    },
    {
      find: /^@\/context\/undo-send$/,
      replacement: pick(
        "./src/context/undo-send.free.tsx",
        "./src/context/undo-send.tsx",
      ),
    },
    {
      find: /^@\/layouts\/shared\/hooks\/useWhitelabelTheme$/,
      replacement: pick(
        "./src/layouts/shared/hooks/useWhitelabelTheme.free.ts",
        "./src/layouts/shared/hooks/useWhitelabelTheme.ts",
      ),
    },
    {
      find: /^@\/components\/themes\/brand-theme\.active$/,
      replacement: pick(
        "./src/components/themes/brand-theme.free.ts",
        "./src/components/themes/brand-theme.pro.ts",
      ),
    },
    {
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/whitelabel-tab\.active$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/whitelabel-tab.free.tsx",
        "./src/admin/pages/settings/_components/admin-settings/whitelabel-tab.tsx",
      ),
    },
    {
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/wp-mail-connections-panel\.active$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/wp-mail-connections-panel.free.tsx",
        "./src/admin/pages/settings/_components/admin-settings/wp-mail-connections-panel.tsx",
      ),
    },
    {
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/allowed-domains-tab\.active$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/allowed-domains-tab.free.tsx",
        "./src/admin/pages/settings/_components/admin-settings/allowed-domains-tab.tsx",
      ),
    },
    {
      find: /^@\/components\/composer\/plate\/copilot-kit\.active$/,
      replacement: pick(
        "./src/components/composer/plate/copilot-kit.free.ts",
        "./src/components/composer/plate/copilot-kit.tsx",
      ),
    },
    {
      find: /^@\/components\/composer\/plate-composer-serialization\.active$/,
      replacement: pick(
        "./src/components/composer/plate-composer-serialization.free.ts",
        "./src/components/composer/plate-composer-serialization.ts",
      ),
    },
    {
      find: /^@\/components\/compose\/RecipientInput$/,
      replacement: pick(
        "./src/components/compose/RecipientInput.free.tsx",
        "./src/components/compose/RecipientInput.tsx",
      ),
    },
    {
      find: /^@\/components\/snooze\/snooze-popover$/,
      replacement: pick(
        "./src/components/snooze/snooze-popover.free.tsx",
        "./src/components/snooze/snooze-popover.tsx",
      ),
    },
    {
      // Free renders none of the Pro tabs, so its map must not carry their ids.
      find: /^@\/components\/settings-ui\/settings-section-description$/,
      replacement: pick(
        "./src/components/settings-ui/settings-section-description.free.ts",
        "./src/components/settings-ui/settings-section-description.ts",
      ),
    },
    {
      find: /^@\/layouts\/registry\.active$/,
      replacement: pick(
        "./src/layouts/registry.free.ts",
        "./src/layouts/registry.pro.ts",
      ),
    },
    {
      find: /^@\/components\/application-layout\/DynamicHeader\.active$/,
      replacement: pick(
        "./src/components/application-layout/DynamicHeader.free.tsx",
        "./src/components/application-layout/DynamicHeader.pro.tsx",
      ),
    },
    ...FLAG_STUB_ALIASES.filter((entry) => !flags[entry.flag]).map((entry) => ({
      find: entry.find,
      replacement: `${appDir}/${entry.target.replace(/^\.\//, "")}`,
    })),
  ];
}

module.exports = { editionAliases };
