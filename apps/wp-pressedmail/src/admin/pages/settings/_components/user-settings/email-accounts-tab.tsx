"use client";

import { OrphanMailboxNotice } from "@/components/setup/orphan-mailbox-notice";

import { EmailConnectionsCard } from "../../email-connections-card";

export function EmailAccountsTab() {
  return (
    <div className="space-y-6">
      {/* Free has one mailbox slot, so a mailbox nobody owns blocks it. */}
      {__IS_FREE__ ? <OrphanMailboxNotice /> : null}
      <EmailConnectionsCard />
    </div>
  );
}
