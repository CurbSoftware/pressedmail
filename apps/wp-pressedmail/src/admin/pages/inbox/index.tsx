import { __ } from "@wordpress/i18n";
import { ThemedMailLayout } from "@/components/inbox/themed-mail-layout";
import { useAppContext } from "@/context/AppProvider";
import Wizard from "@/context/SetupWizardWidget";
import { useInboxSurfaceBoot } from "@/hooks/useInboxSurfaceBoot";
import { useVisibleBodyPrefetch } from "@/hooks/useVisibleBodyPrefetch";
import { AlertCircle, Loader2 } from "lucide-react";

import { Alert, AlertDescription, AlertTitle, Button } from "@kit/ui/plugin";

export default function MailPage() {
  const {
    accounts,
    onComplete,
    hasCompletedSetup,
    isLoading,
    error,
    isAddAccount,
  } = useAppContext();

  // Single boot point for the admin inbox. Do NOT also call in ThemedMailLayout.
  const { accountImportState } = useInboxSurfaceBoot();

  // Warm the bodies of whatever page is on screen, so opening a message does
  // not wait on IMAP. Boot warms the first few once; this keeps up with paging
  // and folder changes, and stands down whenever the sync driver is working.
  useVisibleBodyPrefetch();

  const showWizard = !hasCompletedSetup || isAddAccount;

  // Show loading state
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center bg-background">
        <div className="text-center">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">
            {__("Loading...", "pressedmail")}
          </p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex h-full items-center justify-center bg-background p-4">
        <Alert variant="destructive" className="max-w-md">
          <AlertCircle className="h-5 w-5" />
          <AlertTitle className="font-semibold">
            {__("Something went wrong", "pressedmail")}
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="mb-4">{error}</p>
            <Button onClick={() => window.location.reload()} variant="outline">
              {__("Try Again", "pressedmail")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // Sync progress is non-blocking: the footer status bar shows live
  // "Syncing · N/M folders · X/Y emails · Connected" while the mailbox mirror
  // warms in the background. Users land directly in the inbox and can read,
  // compose, and navigate while counts update. Cancelling setup never reaches
  // here with a phantom account, `leaveSetupWizard` only clears wizard state
  // and never calls `addAccount`, so no blocking UI is shown on cancel.
  return (
    <div
      data-account-import-state={accountImportState}
      className={`flex min-h-0 flex-col bg-background ${showWizard ? "h-full overflow-hidden" : "h-full"}`}>
      {showWizard ? (
        <Wizard onComplete={onComplete} isLoading={isLoading} />
      ) : (
        // Messages come from InboxContext. The `mails` prop used to carry a
        // 302-line fixture of invented people, which every layout ignored and
        // the Pro bundle shipped to customers.
        <ThemedMailLayout accounts={accounts} defaultCollapsed={false} />
      )}
    </div>
  );
}
