import { useEffect } from "react";
import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { LanguageSwitcher } from "@/components/settings/LanguageSwitcher";

export const LANGUAGE_KEYS = [] as const;

const LANGUAGE_DRAFT = {
  dirty: false,
  saving: false,
  save: async () => true,
  cancel: () => undefined,
};

export function LanguageSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  useEffect(() => {
    registerDraft("language", LANGUAGE_DRAFT);
    return () => registerDraft("language", null);
  }, [registerDraft]);

  return (
    <SettingsSectionCard
      dataTest="preference-section-language"
      title={__("Language", "pressedmail")}
      description={__(
        "Changes only the PressedMail interface for your account.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.languagePreference}
      docHref={settingsInfoDocHrefs.languagePreference}>
      <LanguageSwitcher />
    </SettingsSectionCard>
  );
}
