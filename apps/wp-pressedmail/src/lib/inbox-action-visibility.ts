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
