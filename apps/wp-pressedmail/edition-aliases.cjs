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
    find: /^@\/admin\/pages\/settings\/_components\/user-settings\/ai-preferences-section$/,
    target:
      "./src/admin/pages/settings/_components/user-settings/ai-preferences-section.stub.tsx",
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
    // Spam checks are Pro only (plan 8.1): shared components reach them only
    // through these two specifiers, whose Free stubs render and do nothing.
    flag: "__ENABLE_SPAM_DETECTION__",
    find: /^@\/components\/spam$/,
    target: "./src/components/spam/index.free.tsx",
  },
  {
    flag: "__ENABLE_SPAM_DETECTION__",
    find: /^@\/context\/security$/,
    target: "./src/context/security/index.free.tsx",
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
      // PressedMail AI batching names a Pro-only engine; Free sends one email per request.
      find: /^@\/lib\/ai-batches$/,
      replacement: pick("./src/lib/ai-batches.free.ts", "./src/lib/ai-batches.ts"),
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
      // Pro rule conditions, actions, triggers and the shared-inbox rules
      // panel. Free registers none of them with the rule engine, so it ships
      // none of their copy either.
      find: /^@\/components\/settings\/filter-rules\/pro-rule-options\.active$/,
      replacement: pick(
        "./src/components/settings/filter-rules/pro-rule-options.free.ts",
        "./src/components/settings/filter-rules/pro-rule-options.pro.ts",
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
      // Calendar invites are Pro-only, so Free has no iTIP banner.
      find: /^@\/components\/inbox\/itip-banner$/,
      replacement: pick(
        "./src/components/inbox/itip-banner.free.tsx",
        "./src/components/inbox/itip-banner.tsx",
      ),
    },
    {
      // Contacts are Pro-only, so Free carries no sender add/remove client.
      find: /^@\/hooks\/useSenderContact$/,
      replacement: pick(
        "./src/hooks/useSenderContact.free.ts",
        "./src/hooks/useSenderContact.ts",
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
      // PressedOut's shared UI state. Free has one layout and mounts none.
      find: /^@\/context\/layout-ui-provider\.active$/,
      replacement: pick(
        "./src/context/layout-ui-provider.free.tsx",
        "./src/context/layout-ui-provider.pro.ts",
      ),
    },
    {
      // Pro feature flags read from shared components. Free answers false.
      find: /^@\/context\/features\/pro-feature\.active$/,
      replacement: pick(
        "./src/context/features/pro-feature.free.ts",
        "./src/context/features/pro-feature.pro.ts",
      ),
    },
    {
      // The auto-reply authoring surfaces are Pro.
      find: /^@\/lib\/email-surfaces$/,
      replacement: pick(
        "./src/lib/email-surfaces.free.ts",
        "./src/lib/email-surfaces.ts",
      ),
    },
    {
      // Undo send, inline AI, contact lists and read receipts in the composer.
      find: /^@\/hooks\/compose\/v2\/compose-pro-inputs\.active$/,
      replacement: pick(
        "./src/hooks/compose/v2/compose-pro-inputs.free.ts",
        "./src/hooks/compose/v2/compose-pro-inputs.pro.ts",
      ),
    },
    {
      // Managed-domain account setup follows a Pro domain policy. Free has
      // only the ordinary provider flow.
      find: /^@\/components\/setup\/managed-domain-setup\.active$/,
      replacement: pick(
        "./src/components/setup/managed-domain-setup.free.ts",
        "./src/components/setup/managed-domain-setup.pro.ts",
      ),
    },
    {
      // AI auto-tag for an open message. Free builds no classify request.
      find: /^@\/components\/inbox\/message-auto-tag\.active$/,
      replacement: pick(
        "./src/components/inbox/message-auto-tag.free.ts",
        "./src/components/inbox/message-auto-tag.pro.ts",
      ),
    },
    {
      // The `@`-mention input searches Pro contacts; Free registers none.
      find: /^@\/components\/composer\/plate\/mention-input-kit\.active$/,
      replacement: pick(
        "./src/components/composer/plate/mention-input-kit.free.ts",
        "./src/components/composer/plate/mention-input-kit.pro.tsx",
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
      // Contacts are Pro-only, so Free's recipient field gets no suggestions
      // and no picker; the field itself is one Free-safe module.
      find: /^@\/components\/compose\/RecipientContacts\.active$/,
      replacement: pick(
        "./src/components/compose/RecipientContacts.free.tsx",
        "./src/components/compose/RecipientContacts.pro.tsx",
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
      // The band table the UI compares against (plan 4.7). Free has no
      // security checks, so it gets an empty module.
      find: /^@\/lib\/security-bands$/,
      replacement: pick(
        "./src/lib/security-bands.free.ts",
        "./src/lib/security-bands.ts",
      ),
    },
    {
      find: /^@\/components\/icons\/SpamIcons$/,
      replacement: pick(
        "./src/components/icons/SpamIcons.free.tsx",
        "./src/components/icons/SpamIcons.tsx",
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
      // Templates, forms and campaigns are Pro, so Free carries none of their icons.
      find: /^@\/components\/icons\/TemplatesIcons$/,
      replacement: pick(
        "./src/components/icons/TemplatesIcons.free.tsx",
        "./src/components/icons/TemplatesIcons.tsx",
      ),
    },
    {
      // Field chips and their `{{` picker are part of templates, which are Pro.
      find: /^@\/components\/composer\/nodes\/template-variable-kit\.active$/,
      replacement: pick(
        "./src/components/composer/nodes/template-variable-kit.free.ts",
        "./src/components/composer/nodes/template-variable-kit.ts",
      ),
    },
    {
      // The header's Templates button. Free has no templates, forms or campaigns.
      find: /^@\/components\/application-layout\/HeaderTemplatesMenu$/,
      replacement: pick(
        "./src/components/application-layout/HeaderTemplatesMenu.free.tsx",
        "./src/components/application-layout/HeaderTemplatesMenu.tsx",
      ),
    },
    {
      // The one mounted "New email from template" picker. Free has no
      // templates, so it mounts nothing and registers nothing.
      find: /^@\/components\/templates\/TemplatePickerHost$/,
      replacement: pick(
        "./src/components/templates/TemplatePickerHost.free.tsx",
        "./src/components/templates/TemplatePickerHost.tsx",
      ),
    },
    {
      // The rows behind the Templates menu, the More section and the speed
      // dial. Free answers with none.
      find: /^@\/components\/templates\/templates-menu-model$/,
      replacement: pick(
        "./src/components/templates/templates-menu-model.free.ts",
        "./src/components/templates/templates-menu-model.ts",
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
      // The localized whitelabel runtime is Ultimate; Free has none.
      find: /^@\/context\/admin-settings\/whitelabel-runtime\.active$/,
      replacement: pick(
        "./src/context/admin-settings/whitelabel-runtime.free.ts",
        "./src/context/admin-settings/whitelabel-runtime.pro.ts",
      ),
    },
    {
      // Free has one inbox layout and no admin layout lock.
      find: /^@\/hooks\/useLayout$/,
      replacement: pick(
        "./src/hooks/useLayout.free.ts",
        "./src/hooks/useLayout.ts",
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
      // Templates are Pro. Free resolves a section that renders nothing, so the
      // settings page never imports the template editor.
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/wordpress-notification-templates\.active$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/wordpress-notification-templates.free.tsx",
        "./src/admin/pages/settings/_components/admin-settings/wordpress-notification-templates.pro.tsx",
      ),
    },
    {
      // The words for a default connection, a system email's assigned connection
      // and a sender two connections dispute only exist with several connections.
      // Free resolves a twin that says nothing, so none of them ship in it.
      find: /^@\/components\/wp-mail\/smtp-pro-copy\.active$/,
      replacement: pick(
        "./src/components/wp-mail/smtp-pro-copy.free.ts",
        "./src/components/wp-mail/smtp-pro-copy.pro.ts",
      ),
    },
    {
      // Choosing between SMTP connections is Pro. Free holds one and resolves a
      // picker that renders nothing.
      find: /^@\/admin\/pages\/settings\/_components\/admin-settings\/wp-mail-default-smtp\.active$/,
      replacement: pick(
        "./src/admin/pages/settings/_components/admin-settings/wp-mail-default-smtp.free.tsx",
        "./src/admin/pages/settings/_components/admin-settings/wp-mail-default-smtp.pro.tsx",
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
      // Saved blocks are Pro: the composer's Insert block button and the slash
      // menu's Blocks group. Free resolves a kit that renders and offers nothing.
      find: /^@\/components\/composer\/plate\/composer-blocks-kit\.active$/,
      replacement: pick(
        "./src/components/composer/plate/composer-blocks-kit.free.tsx",
        "./src/components/composer/plate/composer-blocks-kit.tsx",
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
      // Sharing is Ultimate-only; Free gets inert stubs and no sharing code.
      find: /^@\/components\/sharing$/,
      replacement: pick(
        "./src/components/sharing/index.free.ts",
        "./src/components/sharing/index.ts",
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
    {
      find: /^@\/components\/settings\/pro-tools\/tools\.active$/,
      replacement: pick(
        "./src/components/settings/pro-tools/tools.free.tsx",
        "./src/components/settings/pro-tools/tools.pro.tsx",
      ),
    },
    {
      find: /^@\/components\/contacts\/custom-fields\.active$/,
      replacement: pick(
        "./src/components/contacts/custom-fields.free.tsx",
        "./src/components/contacts/ContactCustomFields.tsx",
      ),
    },
    ...FLAG_STUB_ALIASES.filter((entry) => !flags[entry.flag]).map((entry) => ({
      find: entry.find,
      replacement: `${appDir}/${entry.target.replace(/^\.\//, "")}`,
    })),
  ];
}

module.exports = { editionAliases };
