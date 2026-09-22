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
}: ComposerFromAccountSelectProps) {
  const selectedFromAccount = fromAccount || accounts[0]?.email || "";
  const fromDisabled = disabled || accounts.length <= 1;

  return (
    <div className="min-w-0" data-test="from-account-column">
      <Select value={selectedFromAccount} onValueChange={onFromAccountChange}>
        <SelectTrigger
          aria-label={__("From account", "pressedmail")}
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
