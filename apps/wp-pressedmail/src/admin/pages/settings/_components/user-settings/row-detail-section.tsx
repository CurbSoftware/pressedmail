import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import {
  PREFERENCE_ALLOWED_VALUES,
  type EmailListDateGrouping,
  type EmailListDensityPreference,
  type EmailListGroupingPreference,
  type EmailListPreviewPreference,
  type EmailListUnreadIndicator,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const ROW_DETAIL_KEYS = [
  "email_list_density",
  "email_list_preview",
  "email_list_show_account_badge",
  "email_list_show_attachment_icon",
  "email_list_unread_indicator",
  "email_list_date_grouping",
  "email_list_grouping",
] as const;

export function RowDetailSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "row-detail",
    ROW_DETAIL_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-row-detail"
      title={__("Row details", "pressedmail")}
      description={__(
        "Control density, previews, and badges in every inbox list layout.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.rowDetail}
      docHref={settingsInfoDocHrefs.rowDetail}>
      <PreferenceSelectRow
        title={__("Density", "pressedmail")}
        value={draft.email_list_density}
        options={PREFERENCE_ALLOWED_VALUES.email_list_density}
        labels={{
          loose: __("Loose", "pressedmail"),
          comfortable: __("Comfortable", "pressedmail"),
          compact: __("Compact", "pressedmail"),
          dense: __("Dense", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_density: value as EmailListDensityPreference,
          })
        }
        dataTest="pref-email-list-density"
      />
      <PreferenceSelectRow
        title={__("Preview", "pressedmail")}
        value={draft.email_list_preview}
        options={PREFERENCE_ALLOWED_VALUES.email_list_preview}
        labels={{
          full: __("Full preview", "pressedmail"),
          snippet: __("Snippet", "pressedmail"),
          hidden: __("Hidden", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_preview: value as EmailListPreviewPreference,
          })
        }
        dataTest="pref-email-list-preview"
      />
      <PreferenceSwitchRow
        title={__("Account badge", "pressedmail")}
        checked={draft.email_list_show_account_badge}
        onCheckedChange={(checked) =>
          patchDraft({ email_list_show_account_badge: checked })
        }
        dataTest="pref-email-list-show-account-badge"
      />
      <PreferenceSwitchRow
        title={__("Attachment icon", "pressedmail")}
        checked={draft.email_list_show_attachment_icon}
        onCheckedChange={(checked) =>
          patchDraft({ email_list_show_attachment_icon: checked })
        }
        dataTest="pref-email-list-show-attachment-icon"
      />
      <PreferenceSelectRow
        title={__("Unread indicator", "pressedmail")}
        value={draft.email_list_unread_indicator}
        options={PREFERENCE_ALLOWED_VALUES.email_list_unread_indicator}
        labels={{
          dot_and_bold: __("Dot and bold", "pressedmail"),
          dot: __("Dot only", "pressedmail"),
          bold: __("Bold only", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_unread_indicator: value as EmailListUnreadIndicator,
          })
        }
        dataTest="pref-email-list-unread-indicator"
      />
      <PreferenceSelectRow
        title={__("Date grouping", "pressedmail")}
        value={draft.email_list_date_grouping}
        options={PREFERENCE_ALLOWED_VALUES.email_list_date_grouping}
        labels={{
          none: __("None", "pressedmail"),
          day: __("By day", "pressedmail"),
          week: __("By week", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_date_grouping: value as EmailListDateGrouping,
          })
        }
        dataTest="pref-email-list-date-grouping"
      />
      <PreferenceSelectRow
        title={__("Conversation grouping", "pressedmail")}
        value={draft.email_list_grouping}
        options={PREFERENCE_ALLOWED_VALUES.email_list_grouping}
        labels={{
          list: __("One row per message", "pressedmail"),
          threads: __("Group by conversation", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_grouping: value as EmailListGroupingPreference,
          })
        }
        dataTest="pref-email-list-grouping"
      />
    </SettingsSectionCard>
  );
}
