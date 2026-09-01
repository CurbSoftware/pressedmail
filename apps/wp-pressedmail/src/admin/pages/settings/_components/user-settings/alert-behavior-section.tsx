import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import {
  PREFERENCE_ALLOWED_VALUES,
  type NotificationPreviewLevel,
  type NotificationScope,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const ALERT_BEHAVIOR_KEYS = [
  "notification_scope",
  "notification_preview_level",
  "notification_unread_only",
] as const;

export function AlertBehaviorSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "alert-behavior",
    ALERT_BEHAVIOR_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-alert-behavior"
      title={__("Alert behavior", "pressedmail")}
      description={__(
        "Which new messages raise an in-app alert and how much they reveal.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.alertBehavior}
      docHref={settingsInfoDocHrefs.alertBehavior}>
      <PreferenceSelectRow
        title={__("Alert scope", "pressedmail")}
        value={draft.notification_scope}
        options={PREFERENCE_ALLOWED_VALUES.notification_scope}
        labels={{
          all: __("All folders", "pressedmail"),
          inbox: __("Inbox only", "pressedmail"),
          priority: __("Priority mail only", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ notification_scope: value as NotificationScope })
        }
        dataTest="pref-notification-scope"
      />
      <PreferenceSelectRow
        title={__("Preview", "pressedmail")}
        value={draft.notification_preview_level}
        options={PREFERENCE_ALLOWED_VALUES.notification_preview_level}
        labels={{
          sender_subject: __("Sender and subject", "pressedmail"),
          sender: __("Sender only", "pressedmail"),
          none: __("No preview", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            notification_preview_level: value as NotificationPreviewLevel,
          })
        }
        dataTest="pref-notification-preview-level"
      />
      <PreferenceSwitchRow
        title={__("Unread only", "pressedmail")}
        checked={draft.notification_unread_only}
        onCheckedChange={(checked) =>
          patchDraft({ notification_unread_only: checked })
        }
        dataTest="pref-notification-unread-only"
      />
    </SettingsSectionCard>
  );
}
