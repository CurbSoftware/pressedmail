import * as React from "react";
import { __ } from "@wordpress/i18n";

import type { EmailAccount } from "@/types";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

interface ComposerFromAccountSelectProps {
  accounts: EmailAccount[];
  fromAccount: string;
  onFromAccountChange: (account: string) => void;
  disabled?: boolean;
  /** The draft is saved in a mailbox and sends from it: From cannot change. */
  locked?: boolean;
}

/**
 * The From account trigger, filling the field cell of the From row. The row's
 * context label (ComposeContextLabel) carries the visible "From"; the trigger
 * names itself through aria-label.
 */
export function ComposerFromAccountSelect({
  accounts,
  fromAccount,
  onFromAccountChange,
  disabled = false,
  locked = false,
}: ComposerFromAccountSelectProps) {
  const selectedFromAccount = fromAccount || accounts[0]?.email || "";
  // Only say why when there was a choice to make.
  const showLockReason = locked && accounts.length > 1;
  const fromDisabled = disabled || locked || accounts.length <= 1;
  const lockReasonId = React.useId();
  const lockReason = __(
    "A saved draft sends from the mailbox it is saved in. To send from another mailbox, start a new email.",
    "pressedmail",
  );

  return (
    // The title sits on the wrapper: a disabled control shows no tooltip.
    <div
      className="min-w-0"
      data-test="from-account-column"
      title={showLockReason ? lockReason : undefined}>
      {showLockReason ? (
        <span id={lockReasonId} className="sr-only">
          {lockReason}
        </span>
      ) : null}
      <Select value={selectedFromAccount} onValueChange={onFromAccountChange}>
        <SelectTrigger
          aria-label={__("From account", "pressedmail")}
          aria-describedby={showLockReason ? lockReasonId : undefined}
          className="w-full min-w-0"
          data-test="from-account-selector"
          disabled={fromDisabled}>
          <SelectValue placeholder={__("Select account", "pressedmail")} />
        </SelectTrigger>
        <SelectContent>
          {accounts
            .filter((account) => Boolean(account.email))
            .map((account) => (
              <SelectItem key={account.id} value={account.email || ""}>
                {account.email}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>
    </div>
  );
}
