import { useId, type ReactNode } from "react";
import { __ } from "@wordpress/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
} from "@kit/ui/plugin";

import { SettingsRow } from "@/components/settings-ui";

export function PreferenceSwitchRow({
  title,
  description,
  checked,
  onCheckedChange,
  disabled,
  dataTest,
}: {
  title: ReactNode;
  description?: ReactNode;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  disabled?: boolean;
  dataTest: string;
}) {
  const titleId = useId();

  return (
    <SettingsRow
      inline
      title={title}
      titleId={titleId}
      description={description}
      control={
        <Switch
          className="after:-inset-y-[13px] @3xl/preferences-nav:after:-inset-y-2"
          checked={checked}
          onCheckedChange={onCheckedChange}
          disabled={disabled}
          aria-labelledby={titleId}
          data-test={dataTest}
        />
      }
    />
  );
}

export function PreferenceSelectRow({
  title,
  description,
  value,
  options,
  labels,
  onValueChange,
  disabled,
  dataTest,
}: {
  title: ReactNode;
  description?: ReactNode;
  value: string;
  options: readonly (string | number)[];
  labels: Record<string, string>;
  onValueChange: (value: string) => void;
  disabled?: boolean;
  dataTest: string;
}) {
  return (
    <SettingsRow
      title={title}
      description={description}
      controlClassName="min-w-0 max-w-full"
      control={
        <Select
          value={String(value)}
          onValueChange={onValueChange}
          disabled={disabled}>
          <SelectTrigger
            className="w-full max-w-full @3xl/preferences-nav:w-fit @3xl/preferences-nav:max-w-xs"
            data-test={dataTest}
            aria-label={String(title)}>
            <SelectValue placeholder={__("Select…", "pressedmail")} />
          </SelectTrigger>
          <SelectContent>
            {options.map((option) => {
              const key = String(option);
              return (
                <SelectItem
                  key={key}
                  value={key}
                  data-test={`${dataTest}-option-${key}`}>
                  {labels[key] ?? key}
                </SelectItem>
              );
            })}
          </SelectContent>
        </Select>
      }
    />
  );
}
