export interface InboxActionVisibilityInput {
  isFreeBuild: boolean;
  /** False for a teammate on a shared mailbox: these tools are owner-only. */
  isMailboxOwner: boolean;
  snoozeBuildEnabled: boolean;
  snoozeEnabled: boolean;
  phishingBuildEnabled: boolean;
  phishingEnabled: boolean;
  /** Omitted by callers that predate spam checks: spam stays hidden. */
  spamBuildEnabled?: boolean;
  spamEnabled?: boolean;
  aiSummarizeAvailable: boolean;
  autoTaggerBuildEnabled: boolean;
  aiAutoTaggerBuildEnabled: boolean;
  autoTaggerToolAvailable: boolean;
}

export interface InboxActionVisibility {
  showSnooze: boolean;
  showPhishing: boolean;
  showSpam: boolean;
  showSummarize: boolean;
  showAutoTag: boolean;
}

export function resolveInboxActionVisibility({
  isFreeBuild,
  isMailboxOwner,
  snoozeBuildEnabled,
  snoozeEnabled,
  phishingBuildEnabled,
  phishingEnabled,
  spamBuildEnabled = false,
  spamEnabled = false,
  aiSummarizeAvailable,
  autoTaggerBuildEnabled,
  aiAutoTaggerBuildEnabled,
  autoTaggerToolAvailable,
}: InboxActionVisibilityInput): InboxActionVisibility {
  const proBuild = !isFreeBuild && isMailboxOwner; // Pro build, owner of the mailbox.

  return {
    showSnooze: proBuild && snoozeBuildEnabled && snoozeEnabled,
    showPhishing: proBuild && phishingBuildEnabled && phishingEnabled,
    showSpam: proBuild && spamBuildEnabled && spamEnabled,
    showSummarize: proBuild && aiSummarizeAvailable,
    showAutoTag:
      proBuild &&
      autoTaggerBuildEnabled &&
      aiAutoTaggerBuildEnabled &&
      autoTaggerToolAvailable,
  };
}
