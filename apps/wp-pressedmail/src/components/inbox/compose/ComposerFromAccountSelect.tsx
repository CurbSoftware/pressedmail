import { __ } from "@wordpress/i18n";

import type { EmailAccount } from "@/types";
import {
  Label,
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

export function ComposerFromAccountSelect({
  accounts,
  fromAccount,
  onFromAccountChange,
  disabled = false,
}: ComposerFromAccountSelectProps) {
  const selectedFromAccount = fromAccount || accounts[0]?.email || "";
  const fromDisabled = disabled || accounts.length <= 1;

  return (
    <div
      className="flex min-w-0 max-w-full items-center gap-2"
      data-test="from-account-column">
      <Label className="shrink-0 text-xs font-medium text-muted-foreground">
        {__("From", "pressedmail")}
      </Label>
      <Select value={selectedFromAccount} onValueChange={onFromAccountChange}>
        <SelectTrigger
          aria-label={__("From account", "pressedmail")}
          // The shared select width pinned by src/test/ui-standardization.test.ts,
          // plus max-w-full so a narrow pane clips the trigger, not the row. The
          // header can no longer squeeze it: From sits on a row of its own.
          className="w-[min(18rem,45vw)] min-w-0 max-w-full"
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
