import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { ComposerToolbarCustomizeDialog } from "@/components/inbox/compose/ComposerToolbarCustomizeDialog";
import {
  PREFERENCE_ALLOWED_VALUES,
  type ComposerToolbarPreset,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const COMPOSER_BEHAVIOR_KEYS = [
  "composer_typography_auto_format",
  "composer_confirm_unsaved_close",
  "composer_toolbar_preset",
  "composer_toolbar_items",
  "composer_mobile_toolbar_preset",
  "composer_mobile_toolbar_items",
] as const;

const PRESET_LABELS: Record<string, string> = {
  simple: __("Simple", "pressedmail"),
  standard: __("Standard", "pressedmail"),
  advanced: __("Advanced", "pressedmail"),
  recommended_mobile: __("Recommended mobile", "pressedmail"),
  custom: __("Custom", "pressedmail"),
};

export function ComposerBehaviorSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "composer-behavior",
    COMPOSER_BEHAVIOR_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-composer-behavior"
      title={__("Composer behavior", "pressedmail")}
      description={__(
        "Quotes, auto-formatting, unsaved-close prompts, and toolbar presets.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.composerBehavior}
      docHref={settingsInfoDocHrefs.composerBehavior}>
      <PreferenceSwitchRow
        title={__("Typography auto-format", "pressedmail")}
        description={__(
          "Replace shortcuts such as -> with typographic characters while typing.",
          "pressedmail",
        )}
        checked={draft.composer_typography_auto_format}
        onCheckedChange={(checked) =>
          patchDraft({ composer_typography_auto_format: checked })
        }
        dataTest="pref-composer-typography-auto-format"
      />
      <PreferenceSwitchRow
        title={__("Confirm unsaved close", "pressedmail")}
        checked={draft.composer_confirm_unsaved_close}
        onCheckedChange={(checked) =>
          patchDraft({ composer_confirm_unsaved_close: checked })
        }
        dataTest="pref-composer-confirm-unsaved-close"
      />
      <PreferenceSelectRow
        title={__("Desktop toolbar", "pressedmail")}
        value={draft.composer_toolbar_preset}
        options={PREFERENCE_ALLOWED_VALUES.composer_toolbar_preset}
        labels={PRESET_LABELS}
        onValueChange={(value) =>
          patchDraft({
            composer_toolbar_preset: value as ComposerToolbarPreset,
          })
        }
        dataTest="pref-composer-toolbar-preset"
      />
      <PreferenceSelectRow
        title={__("Mobile toolbar", "pressedmail")}
        value={draft.composer_mobile_toolbar_preset}
        options={PREFERENCE_ALLOWED_VALUES.composer_mobile_toolbar_preset}
        labels={PRESET_LABELS}
        onValueChange={(value) =>
          patchDraft({
            composer_mobile_toolbar_preset: value as ComposerToolbarPreset,
          })
        }
        dataTest="pref-composer-mobile-toolbar-preset"
      />
      <div className="flex items-center justify-between gap-3 py-3">
        <div className="text-sm font-medium">
          {__("Custom toolbar items", "pressedmail")}
        </div>
        <ComposerToolbarCustomizeDialog
          surface="email"
          aiInteractive
          triggerClassName="h-11 w-11 @3xl/preferences-nav:h-8 @3xl/preferences-nav:w-8"
          toolbarPreferences={draft}
          onToolbarPreferencesChange={patchDraft}
        />
      </div>
    </SettingsSectionCard>
  );
}
