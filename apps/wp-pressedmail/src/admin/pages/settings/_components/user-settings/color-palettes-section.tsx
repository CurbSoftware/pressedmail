import { __ } from "@wordpress/i18n";
import { Switch } from "@kit/ui/plugin";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsRow,
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { ComposerColorPalette } from "@/components/ui/color-picker/ComposerColorPalette";
import {
  COMPOSER_PALETTE_HUES,
  type ComposerPaletteLevel,
} from "@/lib/composer-color-palettes";
import {
  PREFERENCE_ALLOWED_VALUES,
} from "@/hooks/useUserPreferences";

import { PreferenceSelectRow } from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const COLOR_PALETTE_KEYS = [
  "composer_palette_level",
  "palette_custom_colors",
  "disabled_palettes",
] as const;

export function ColorPalettesSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "color-palettes",
    COLOR_PALETTE_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-color-palettes"
      title={__("Color palettes", "pressedmail")}
      description={__(
        "Composer swatch density, custom colors, and which hue families stay available.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.colorPalettes}
      docHref={settingsInfoDocHrefs.colorPalettes}>
      <PreferenceSelectRow
        title={__("Palette density", "pressedmail")}
        value={draft.composer_palette_level}
        options={PREFERENCE_ALLOWED_VALUES.composer_palette_level}
        labels={{
          full: __("Full", "pressedmail"),
          reduced: __("Reduced", "pressedmail"),
          minimal: __("Minimal", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            composer_palette_level: value as ComposerPaletteLevel,
          })
        }
        dataTest="pref-composer-palette-level"
      />
      <div className="py-3" data-test="pref-palette-custom-colors">
        <ComposerColorPalette
          mode="manager"
          level={draft.composer_palette_level}
          customColors={draft.palette_custom_colors}
          onPick={() => undefined}
          onClear={() => undefined}
          onCustomColorsChange={(colors) =>
            patchDraft({ palette_custom_colors: colors })
          }
        />
      </div>
      <SettingsRow
        title={__("Enabled hue families", "pressedmail")}
        description={__(
          "Turn off a hue to hide it from composer color pickers.",
          "pressedmail",
        )}
        controlClassName="flex-col items-stretch sm:items-end"
        control={
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {COMPOSER_PALETTE_HUES.map((hue) => {
              const enabled = !draft.disabled_palettes.includes(hue);
              return (
                <label
                  key={hue}
                  className="flex items-center justify-between gap-2 text-xs capitalize">
                  {hue}
                  <Switch
                    checked={enabled}
                    data-test={`pref-disabled-palette-${hue}`}
                    onCheckedChange={(checked) => {
                      const next = checked
                        ? draft.disabled_palettes.filter(
                            (item) => item !== hue,
                          )
                        : [...draft.disabled_palettes, hue];
                      patchDraft({ disabled_palettes: next });
                    }}
                  />
                </label>
              );
            })}
          </div>
        }
      />
    </SettingsSectionCard>
  );
}
