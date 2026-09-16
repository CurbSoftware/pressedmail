import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { useFeatureAvailable } from "@/context/features";
import {
  PREFERENCE_ALLOWED_VALUES,
  type ComposerDefaultFont,
  type ComposerDefaultFontSize,
  type ComposerDefaultFormat,
  type ComposerSignaturePlacement,
  type UndoSendDelaySeconds,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const COMPOSER_DEFAULT_KEYS = [
  "composer_default_format",
  "composer_default_font",
  "composer_default_font_size",
  "composer_signature_placement",
  "composer_ai_default_tone",
  "undo_send_enabled",
  "undo_send_delay_seconds",
] as const;

export function ComposerDefaultsSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const aiAvailable = useFeatureAvailable("ai_integration");
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "composer-defaults",
    COMPOSER_DEFAULT_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-composer-defaults"
      title={__("Composer defaults", "pressedmail")}
      description={
        __IS_PRO__
          ? __(
              "Starting format, font, signature placement, and send helpers.",
              "pressedmail",
            )
          : __("Starting format, font, and signature placement.", "pressedmail")
      }
      tooltip={settingsInfoTooltips.composer}
      docHref={settingsInfoDocHrefs.composer}>
      <PreferenceSelectRow
        title={__("Default format", "pressedmail")}
        value={draft.composer_default_format}
        options={PREFERENCE_ALLOWED_VALUES.composer_default_format}
        labels={{
          rich_text: __("Rich text", "pressedmail"),
          plain_text: __("Plain text", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            composer_default_format: value as ComposerDefaultFormat,
          })
        }
        dataTest="pref-composer-default-format"
      />
      <PreferenceSelectRow
        title={__("Default font", "pressedmail")}
        value={draft.composer_default_font}
        options={PREFERENCE_ALLOWED_VALUES.composer_default_font}
        labels={{
          system: __("System", "pressedmail"),
          sans: __("Sans-serif", "pressedmail"),
          serif: __("Serif", "pressedmail"),
          mono: __("Monospace", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ composer_default_font: value as ComposerDefaultFont })
        }
        dataTest="pref-composer-default-font"
      />
      <PreferenceSelectRow
        title={__("Default font size", "pressedmail")}
        value={draft.composer_default_font_size}
        options={PREFERENCE_ALLOWED_VALUES.composer_default_font_size}
        labels={{
          "12": "12",
          "14": "14",
          "16": "16",
          "18": "18",
        }}
        onValueChange={(value) =>
          patchDraft({
            composer_default_font_size: value as ComposerDefaultFontSize,
          })
        }
        dataTest="pref-composer-default-font-size"
      />
      <PreferenceSelectRow
        title={__("Signature placement", "pressedmail")}
        value={draft.composer_signature_placement}
        options={PREFERENCE_ALLOWED_VALUES.composer_signature_placement}
        labels={{
          end: __("At the end of the message", "pressedmail"),
          before_quote: __("Above the quoted original", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            composer_signature_placement: value as ComposerSignaturePlacement,
          })
        }
        dataTest="pref-composer-signature-placement"
      />
      {__IS_PRO__ && aiAvailable ? (
        <PreferenceSelectRow
          title={__("AI default tone", "pressedmail")}
          value={draft.composer_ai_default_tone}
          options={PREFERENCE_ALLOWED_VALUES.composer_ai_default_tone}
          labels={{
            professional: __("Professional", "pressedmail"),
            casual: __("Casual", "pressedmail"),
            friendly: __("Friendly", "pressedmail"),
            formal: __("Formal", "pressedmail"),
          }}
          onValueChange={(value) =>
            patchDraft({
              composer_ai_default_tone: value as
                | "professional"
                | "casual"
                | "friendly"
                | "formal",
            })
          }
          dataTest="pref-composer-ai-default-tone"
        />
      ) : null}
      {__IS_PRO__ ? (
        <>
          <PreferenceSwitchRow
            title={__("Undo send", "pressedmail")}
            checked={draft.undo_send_enabled}
            onCheckedChange={(checked) =>
              patchDraft({ undo_send_enabled: checked })
            }
            dataTest="pref-undo-send-enabled"
          />
          <PreferenceSelectRow
            title={__("Undo send delay", "pressedmail")}
            value={String(draft.undo_send_delay_seconds)}
            options={PREFERENCE_ALLOWED_VALUES.undo_send_delay_seconds}
            labels={{
              "15": __("15 seconds", "pressedmail"),
              "30": __("30 seconds", "pressedmail"),
              "60": __("60 seconds", "pressedmail"),
            }}
            onValueChange={(value) =>
              patchDraft({
                undo_send_delay_seconds: Number(value) as UndoSendDelaySeconds,
              })
            }
            disabled={!draft.undo_send_enabled}
            dataTest="pref-undo-send-delay"
          />
        </>
      ) : null}
    </SettingsSectionCard>
  );
}
