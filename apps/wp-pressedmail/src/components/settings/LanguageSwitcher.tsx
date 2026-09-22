/**
 * Language Switcher
 *
 * Settings control for the plugin-scoped UI language. Lists the supported
 * locales by their native name and reloads the interface after a saved choice.
 * Changing it only affects PressedMail for the current user.
 *
 * @since 3.0.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@kit/ui/plugin";

import { appMessage } from "@/context/toast";
import { useSettingsGuardedAction } from "@/components/settings-ui";
import { cn } from "@/lib/utils";
import { toBcp47 } from "@/lib/i18n-boot";
import { useLocale } from "@/hooks/useLocale";

interface LanguageSwitcherProps {
  className?: string;
  value?: string;
  saving?: boolean;
  onValueChange?: (value: string) => void;
}

export function LanguageSwitcher({
  className,
  value,
  saving: controlledSaving,
  onValueChange,
}: LanguageSwitcherProps) {
  const { locale, setLocale, locales, saving } = useLocale();
  const guardedAction = useSettingsGuardedAction();
  const selectId = React.useId();
  const selectedLocale = value ?? locale;
  const isSaving = controlledSaving ?? saving;

  return (
    <div
      className={cn("flex flex-col gap-1.5", className)}
      data-test="language-switcher">
      <label htmlFor={selectId} className="text-sm font-medium text-foreground">
        {__("Language", "pressedmail")}
      </label>
      <Select
        value={selectedLocale}
        disabled={isSaving}
        onValueChange={(nextLocale) => {
          if (onValueChange) {
            onValueChange(nextLocale);
            return;
          }

          guardedAction(() => {
            void setLocale(nextLocale).then((didSave) => {
              if (didSave) {
                appMessage(__("Language updated", "pressedmail"), "success");
              }
            });
          });
        }}>
        <SelectTrigger
          id={selectId}
          data-test="language-select"
          data-testid="language-select"
          aria-label={__("Interface language", "pressedmail")}
          className={cn(
            "max-w-full @3xl/preferences-nav:max-w-xs",
            isSaving && "opacity-60",
          )}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {locales.map((entry) => (
            <SelectItem
              key={entry.wp}
              value={entry.wp}
              lang={toBcp47(entry.wp)}
              data-test={`language-select-option-${entry.wp}`}
              data-testid={`language-select-option-${entry.wp}`}>
              {entry.nativeLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <p className="text-xs text-muted-foreground">
        {__(
          "Changes only PressedMail for your account. Some text remains in English.",
          "pressedmail",
        )}
      </p>
    </div>
  );
}

export default LanguageSwitcher;
