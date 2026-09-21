export interface InboxActionVisibilityInput {
  isFreeBuild: boolean;
  snoozeBuildEnabled: boolean;
  snoozeEnabled: boolean;
  phishingBuildEnabled: boolean;
  phishingEnabled: boolean;
  aiSummarizeAvailable: boolean;
  autoTaggerBuildEnabled: boolean;
  aiAutoTaggerBuildEnabled: boolean;
  autoTaggerToolAvailable: boolean;
}

export interface InboxActionVisibility {
  showSnooze: boolean;
  showPhishing: boolean;
  showSummarize: boolean;
  showAutoTag: boolean;
}

export function resolveInboxActionVisibility({
  isFreeBuild,
  snoozeBuildEnabled,
  snoozeEnabled,
  phishingBuildEnabled,
  phishingEnabled,
  aiSummarizeAvailable,
  autoTaggerBuildEnabled,
  aiAutoTaggerBuildEnabled,
  autoTaggerToolAvailable,
}: InboxActionVisibilityInput): InboxActionVisibility {
  const proBuild = !isFreeBuild;

  return {
    showSnooze: proBuild && snoozeBuildEnabled && snoozeEnabled,
    showPhishing: proBuild && phishingBuildEnabled && phishingEnabled,
    showSummarize: proBuild && aiSummarizeAvailable,
    showAutoTag:
      proBuild &&
      autoTaggerBuildEnabled &&
      aiAutoTaggerBuildEnabled &&
      autoTaggerToolAvailable,
  };
}

export interface ImportantActionInput {
  isFreeBuild: boolean;
  smartInboxEnabled: boolean;
}

/**
 * Whether the message "important" control should be offered at all.
 *
 * Importance is persisted by POST smart-inbox/important, which only
 * `includes/Routes/ProApi.php` registers and which is served by the Pro
 * SmartInboxService. Free has no equivalent route and never will: shipping one
 * would mean shipping the Smart Inbox implementation in the WordPress.org
 * build. So Free does not render the control, rather than render one that
 * always 404s.
 */
export function isImportantActionAvailable({
  isFreeBuild,
  smartInboxEnabled,
}: ImportantActionInput): boolean {
  return !isFreeBuild && smartInboxEnabled;
}
