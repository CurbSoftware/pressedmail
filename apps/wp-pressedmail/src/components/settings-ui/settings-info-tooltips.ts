export const settingsInfoTooltips = {
  preferences:
    "General preferences for notifications, mail handling, WordPress shortcuts, and the email list.",
  notifications:
    "Choose when PressedMail alerts you about new mail via email or desktop.",
  mailHandling:
    "Defaults for archiving, delete confirmation, and draft auto-save.",
  wordpressIntegration:
    "Show PressedMail entry points across the WordPress admin.",
  emailList:
    "Layout, density, and loading behavior for the inbox message list.",
  composer:
    "Defaults for the new-message editor, including formatting helpers and AI tone.",
  emailSignatures: "Create and manage signatures appended to outgoing email.",
  emailConnections:
    "Connect IMAP, SMTP, or OAuth mail accounts for PressedMail to send and receive.",
  securitySettings:
    "Authentication, session, and access policies for the PressedMail admin.",
  emailSafetyControls:
    "Protections against malicious links, remote images, and risky attachments.",
  dangerZone: "Destructive actions that permanently affect plugin data.",
  systemHealth:
    "Diagnostics for plugin status, server connectivity, and configuration.",
  pluginUpdates: "Manage the plugin update channel and check for new releases.",
  readingActions:
    "When messages are marked read, default reply, and what happens after delete or archive.",
  rowDetail: "Density, preview text, and badges on inbox rows.",
  composerBehavior:
    "Quoted originals, auto-formatting, unsaved-close prompts, and toolbar layout.",
  alertBehavior:
    "Which folders raise in-app alerts and how much of a message they show.",
  languagePreference:
    "PressedMail interface language for this WordPress user only.",
  colorPalettes:
    "Composer color-picker density, custom hex colors, and hidden hue families.",
} as const;

export type SettingsInfoTooltipKey = keyof typeof settingsInfoTooltips;

export const settingsInfoDocHrefs: Partial<
  Record<SettingsInfoTooltipKey, string>
> = {
  preferences: "user-settings",
  notifications: "user-settings",
  mailHandling: "user-settings",
  wordpressIntegration: "wordpress-settings",
  emailList: "unified-inbox-and-folders",
  composer: "composing-replies-and-forwarding",
  emailSignatures: "blocks-snippets-and-signatures",
  emailConnections: "email-accounts",
  securitySettings: "security-sessions-and-audit-protections",
  emailSafetyControls: "security-and-privacy",
  dangerZone: "upgrade-and-uninstall",
  systemHealth: "troubleshooting",
  pluginUpdates: "updates-and-releases",
  readingActions: "email-workflows",
  rowDetail: "unified-inbox-and-folders",
  composerBehavior: "composing-replies-and-forwarding",
  alertBehavior: "user-settings",
  languagePreference: "user-settings",
  colorPalettes: "ui-customization",
};
