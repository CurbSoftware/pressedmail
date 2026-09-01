import { __ } from "@wordpress/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

import type { ImapFolder } from "@/services/interfaces";
import type { FilterRuleFolderTarget } from "@/types/filter-rules";
import {
  buildRuleFolderOptions,
  optionToFilterRuleFolderTarget,
} from "@/services/filter-rule-folder-targets";

interface RuleFolderPickerProps {
  folders: ImapFolder[];
  accountId: number;
  accountLabels: ReadonlyMap<number, string>;
  value?: FilterRuleFolderTarget | string;
  onChange: (target: FilterRuleFolderTarget) => void;
  /**
   * Read rather than spread, so a caller passing only one spelling would have
   * had it dropped. `data-test` is what Playwright resolves against.
   */
  "data-test"?: string;
  "data-testid"?: string;
}

export function RuleFolderPicker({
  folders,
  accountId,
  accountLabels,
  value,
  onChange,
  "data-test": dataTest,
  "data-testid": dataTestId,
}: RuleFolderPickerProps) {
  const testId = dataTest ?? dataTestId;
  const options = buildRuleFolderOptions(folders, accountId, accountLabels);
  const selected =
    value && typeof value === "object" && value.folderId
      ? `${value.accountId}:${value.folderId}`
      : undefined;

  return (
    <div className="space-y-1">
      <Select
        value={selected}
        onValueChange={(key) => {
          const option = options.find(
            (candidate) =>
              `${candidate.accountId}:${candidate.folderId}` === key,
          );
          if (option) onChange(optionToFilterRuleFolderTarget(option));
        }}>
        <SelectTrigger
          aria-label={__("Destination folder", "pressedmail")}
          data-test={testId}
          data-testid={testId}>
          <SelectValue placeholder={__("Choose a folder", "pressedmail")} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem
              key={`${option.accountId}:${option.folderId}`}
              value={`${option.accountId}:${option.folderId}`}
              data-test={`filter-rule-folder-option-${option.accountId}-${option.folderId}`}
              data-testid={`filter-rule-folder-option-${option.accountId}-${option.folderId}`}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {value &&
        typeof value === "object" &&
        value.status === "repair_required" && (
          <p className="text-xs text-destructive" role="alert">
            {__(
              "This folder is unavailable. Choose a replacement.",
              "pressedmail",
            )}
            {value.lastKnownPath ? ` (${value.lastKnownPath})` : ""}
          </p>
        )}
    </div>
  );
}
