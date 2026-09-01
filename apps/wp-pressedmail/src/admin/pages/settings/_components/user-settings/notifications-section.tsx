import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsRow,
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import { DateTimeSelector } from "@/components/ui/date-time-selector";
import {
  PREFERENCE_ALLOWED_VALUES,
  type NotificationBadgeCountMode,
  type NotificationSound,
} from "@/hooks/useUserPreferences";
import { getRuntimeSiteTimezone } from "@/lib/runtime-config";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const NOTIFICATION_KEYS = [
  "desktop_notifications",
  "email_notifications",
  "notification_sound",
  "notification_quiet_hours_enabled",
  "notification_quiet_hours_start",
  "notification_quiet_hours_end",
  "notification_badge_count_mode",
] as const;

export function NotificationsSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "notifications",
    NOTIFICATION_KEYS,
    registerDraft,
  );
  const siteTimezone = getRuntimeSiteTimezone();

  return (
    <SettingsSectionCard
      dataTest="preference-section-notifications"
      title={__("Notifications", "pressedmail")}
      description={__(
        "Desktop alerts, email copies, sounds, quiet hours, and badge counts.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.notifications}
      docHref={settingsInfoDocHrefs.notifications}>
      <PreferenceSwitchRow
        title={__("Desktop notifications", "pressedmail")}
        checked={draft.desktop_notifications}
        onCheckedChange={(checked) => {
          patchDraft({ desktop_notifications: checked });
          if (
            checked &&
            typeof Notification !== "undefined" &&
            Notification.permission === "default"
          ) {
            void Notification.requestPermission();
          }
        }}
        dataTest="pref-desktop-notifications"
      />
      <PreferenceSwitchRow
        title={__("Email notifications", "pressedmail")}
        checked={draft.email_notifications}
        onCheckedChange={(checked) =>
          patchDraft({ email_notifications: checked })
        }
        dataTest="pref-email-notifications"
      />
      <PreferenceSelectRow
        title={__("Sound", "pressedmail")}
        value={draft.notification_sound}
        options={PREFERENCE_ALLOWED_VALUES.notification_sound}
        labels={{
          default: __("Default", "pressedmail"),
          subtle: __("Subtle", "pressedmail"),
          none: __("None", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ notification_sound: value as NotificationSound })
        }
        dataTest="pref-notification-sound"
      />
      <PreferenceSwitchRow
        title={__("Quiet hours", "pressedmail")}
        description={
          <>
            <span>{__("WordPress site timezone", "pressedmail")}</span>
            {": "}
            <span data-test="pref-notification-quiet-hours-timezone">
              {siteTimezone}
            </span>
          </>
        }
        checked={draft.notification_quiet_hours_enabled}
        onCheckedChange={(checked) =>
          patchDraft({ notification_quiet_hours_enabled: checked })
        }
        dataTest="pref-notification-quiet-hours-enabled"
      />
      <SettingsRow
        title={__("Quiet hours start", "pressedmail")}
        control={
          <DateTimeSelector
            id="pref-notification-quiet-hours-start"
            mode="time"
            timeDisplayMode="24h"
            showTimeModeSelector={false}
            value={draft.notification_quiet_hours_start}
            className="min-h-11 max-w-full @3xl/preferences-nav:min-h-9"
            disabled={!draft.notification_quiet_hours_enabled}
            data-test="pref-notification-quiet-hours-start"
            data-testid="pref-notification-quiet-hours-start"
            onChange={(value) =>
              patchDraft({ notification_quiet_hours_start: value })
            }
          />
        }
      />
      <SettingsRow
        title={__("Quiet hours end", "pressedmail")}
        control={
          <DateTimeSelector
            id="pref-notification-quiet-hours-end"
            mode="time"
            timeDisplayMode="24h"
            showTimeModeSelector={false}
            value={draft.notification_quiet_hours_end}
            className="min-h-11 max-w-full @3xl/preferences-nav:min-h-9"
            disabled={!draft.notification_quiet_hours_enabled}
            data-test="pref-notification-quiet-hours-end"
            data-testid="pref-notification-quiet-hours-end"
            onChange={(value) =>
              patchDraft({ notification_quiet_hours_end: value })
            }
          />
        }
      />
      <PreferenceSelectRow
        title={__("Badge count", "pressedmail")}
        value={draft.notification_badge_count_mode}
        options={PREFERENCE_ALLOWED_VALUES.notification_badge_count_mode}
        labels={{
          unread: __("All unread", "pressedmail"),
          inbox_unread: __("Inbox unread", "pressedmail"),
          none: __("Hidden", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            notification_badge_count_mode: value as NotificationBadgeCountMode,
          })
        }
        dataTest="pref-notification-badge-count-mode"
      />
    </SettingsSectionCard>
  );
}
