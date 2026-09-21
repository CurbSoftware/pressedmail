import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import {
  PREFERENCE_ALLOWED_VALUES,
  type EmailListDefaultSort,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const EMAIL_LIST_KEYS = [
  "email_list_mode",
  "email_list_page_size",
  "email_list_default_sort",
  "email_list_remember_folder",
] as const;

export function EmailListSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "email-list",
    EMAIL_LIST_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-email-list"
      title={__("Email list", "pressedmail")}
      description={__(
        "How the inbox loads, sorts, and remembers the last folder.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.emailList}
      docHref={settingsInfoDocHrefs.emailList}>
      <PreferenceSelectRow
        title={__("Loading", "pressedmail")}
        value={draft.email_list_mode}
        options={PREFERENCE_ALLOWED_VALUES.email_list_mode}
        labels={{
          pagination: __("Pages", "pressedmail"),
          lazy_loading: __("Infinite scroll", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_mode: value as "pagination" | "lazy_loading",
          })
        }
        dataTest="pref-email-list-mode"
      />

      <PreferenceSelectRow
        title={__("Page size", "pressedmail")}
        value={String(draft.email_list_page_size)}
        options={PREFERENCE_ALLOWED_VALUES.email_list_page_size}
        labels={{
          "20": "20",
          "50": "50",
          "100": "100",
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_page_size: Number(value) as 20 | 50 | 100,
          })
        }
        dataTest="pref-email-list-page-size"
      />
      <PreferenceSelectRow
        title={__("Default sort", "pressedmail")}
        value={draft.email_list_default_sort}
        options={PREFERENCE_ALLOWED_VALUES.email_list_default_sort}
        labels={{
          newest: __("Newest first", "pressedmail"),
          oldest: __("Oldest first", "pressedmail"),
          sender: __("Sender", "pressedmail"),
          subject: __("Subject", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            email_list_default_sort: value as EmailListDefaultSort,
          })
        }
        dataTest="pref-email-list-default-sort"
      />
      <PreferenceSwitchRow
        title={__("Remember last folder", "pressedmail")}
        checked={draft.email_list_remember_folder}
        onCheckedChange={(checked) =>
          patchDraft({ email_list_remember_folder: checked })
        }
        dataTest="pref-email-list-remember-folder"
      />
    </SettingsSectionCard>
  );
}
