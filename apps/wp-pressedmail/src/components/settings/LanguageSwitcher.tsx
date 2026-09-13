/**
 * Language Switcher
 *
 * Settings control for the plugin-scoped UI language. Lists the supported
 * locales by their native name and switches the interface live via the
 * LocaleProvider. Changing it only affects PressedMail for the current user.
 *
 * @since 3.0.0
 */

import * as React from "react";
import { __ } from "@wordpress/i18n";

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
      <select
        id={selectId}
        data-test="language-select"
        aria-label={__("Interface language", "pressedmail")}
        className={cn(
          "h-11 w-full max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground @3xl/preferences-nav:h-9 @3xl/preferences-nav:max-w-xs",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          isSaving && "opacity-60",
        )}
        value={selectedLocale}
        disabled={isSaving}
        onChange={(event) => {
          const nextLocale = event.target.value;
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
        {locales.map((entry) => (
          <option key={entry.wp} value={entry.wp} lang={toBcp47(entry.wp)}>
            {entry.nativeLabel}
          </option>
        ))}
      </select>
      <p className="text-xs text-muted-foreground">
        {__(
          "Changes only the PressedMail interface for your account.",
          "pressedmail",
        )}
      </p>
    </div>
  );
}

export default LanguageSwitcher;
