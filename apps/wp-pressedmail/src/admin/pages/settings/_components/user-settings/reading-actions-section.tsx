import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";
import {
  PREFERENCE_ALLOWED_VALUES,
  type AfterMessageAction,
  type DefaultReplyAction,
  type MarkAsReadBehavior,
  type SendSafetyConfirmation,
} from "@/hooks/useUserPreferences";

import {
  PreferenceSelectRow,
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const READING_ACTION_KEYS = [
  "mark_as_read_behavior",
  "mark_as_read_delay_seconds",
  "default_reply_action",
  "after_delete_action",
  "after_archive_action",
  "send_safety_confirmation",
] as const;

export function ReadingActionsSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "reading-actions",
    READING_ACTION_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-reading-actions"
      title={__("Reading actions", "pressedmail")}
      description={__(
        "Choose how messages are marked read and what happens after common actions.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.readingActions}
      docHref={settingsInfoDocHrefs.readingActions}>
      <PreferenceSelectRow
        title={__("Mark as read", "pressedmail")}
        description={__(
          "When an unread message should become read after you open it.",
          "pressedmail",
        )}
        value={draft.mark_as_read_behavior}
        options={PREFERENCE_ALLOWED_VALUES.mark_as_read_behavior}
        labels={{
          on_open: __("When opened", "pressedmail"),
          after_delay: __("After a delay", "pressedmail"),
          manual: __("Only when I mark it", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ mark_as_read_behavior: value as MarkAsReadBehavior })
        }
        dataTest="pref-mark-as-read-behavior"
      />
      <PreferenceSelectRow
        title={__("Mark-as-read delay", "pressedmail")}
        description={__(
          "Used when mark as read is set to after a delay.",
          "pressedmail",
        )}
        value={String(draft.mark_as_read_delay_seconds)}
        options={PREFERENCE_ALLOWED_VALUES.mark_as_read_delay_seconds}
        labels={{
          "0": __("Immediately", "pressedmail"),
          "3": __("3 seconds", "pressedmail"),
          "5": __("5 seconds", "pressedmail"),
          "10": __("10 seconds", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            mark_as_read_delay_seconds: Number(value) as 0 | 3 | 5 | 10,
          })
        }
        disabled={draft.mark_as_read_behavior !== "after_delay"}
        dataTest="pref-mark-as-read-delay"
      />
      <PreferenceSelectRow
        title={__("Default reply", "pressedmail")}
        value={draft.default_reply_action}
        options={PREFERENCE_ALLOWED_VALUES.default_reply_action}
        labels={{
          reply: __("Reply", "pressedmail"),
          reply_all: __("Reply all", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ default_reply_action: value as DefaultReplyAction })
        }
        dataTest="pref-default-reply-action"
      />
      <PreferenceSelectRow
        title={__("After delete", "pressedmail")}
        value={draft.after_delete_action}
        options={PREFERENCE_ALLOWED_VALUES.after_delete_action}
        labels={{
          message_list: __("Return to the list", "pressedmail"),
          next_message: __("Open the next message", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ after_delete_action: value as AfterMessageAction })
        }
        dataTest="pref-after-delete-action"
      />
      <PreferenceSelectRow
        title={__("After archive", "pressedmail")}
        value={draft.after_archive_action}
        options={PREFERENCE_ALLOWED_VALUES.after_archive_action}
        labels={{
          message_list: __("Return to the list", "pressedmail"),
          next_message: __("Open the next message", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({ after_archive_action: value as AfterMessageAction })
        }
        dataTest="pref-after-archive-action"
      />
      <PreferenceSelectRow
        title={__("Confirm before sending", "pressedmail")}
        value={draft.send_safety_confirmation}
        options={PREFERENCE_ALLOWED_VALUES.send_safety_confirmation}
        labels={{
          external: __("When recipients are outside my accounts", "pressedmail"),
          always: __("Always", "pressedmail"),
          never: __("Never", "pressedmail"),
        }}
        onValueChange={(value) =>
          patchDraft({
            send_safety_confirmation: value as SendSafetyConfirmation,
          })
        }
        dataTest="pref-send-safety-confirmation"
      />
    </SettingsSectionCard>
  );
}
