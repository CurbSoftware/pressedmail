import { __ } from "@wordpress/i18n";
import type { RegisterSettingsDraft } from "@/components/settings-ui";
import {
  SettingsSectionCard,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
} from "@/components/settings-ui";

import {
  PreferenceSwitchRow,
} from "./preference-controls";
import { usePreferenceSectionDraft } from "./use-preference-section-draft";

export const MAIL_HANDLING_KEYS = [
  "auto_archive",
  "confirm_delete",
  "auto_save_drafts",
] as const;

export function MailHandlingSection({
  registerDraft,
}: {
  registerDraft: RegisterSettingsDraft;
}) {
  const { draft, patchDraft } = usePreferenceSectionDraft(
    "mail-handling",
    MAIL_HANDLING_KEYS,
    registerDraft,
  );

  return (
    <SettingsSectionCard
      dataTest="preference-section-mail-handling"
      title={__("Mail handling", "pressedmail")}
      description={__(
        "Archive after reply, confirm deletes, and save drafts automatically.",
        "pressedmail",
      )}
      tooltip={settingsInfoTooltips.mailHandling}
      docHref={settingsInfoDocHrefs.mailHandling}>
      <PreferenceSwitchRow
        title={__("Archive after reply", "pressedmail")}
        description={__(
          "Move the original message to Archive after a reply is sent.",
          "pressedmail",
        )}
        checked={draft.auto_archive}
        onCheckedChange={(checked) => patchDraft({ auto_archive: checked })}
        dataTest="pref-auto-archive"
      />
      <PreferenceSwitchRow
        title={__("Confirm before deleting", "pressedmail")}
        checked={draft.confirm_delete}
        onCheckedChange={(checked) => patchDraft({ confirm_delete: checked })}
        dataTest="pref-confirm-delete"
      />
      <PreferenceSwitchRow
        title={__("Save drafts automatically", "pressedmail")}
        description={__(
          "Saves your draft to Drafts about 10 seconds after you stop typing, and when you close the composer, without asking. A draft with a file attached is saved when you leave this tab or close the composer.",
          "pressedmail",
        )}
        checked={draft.auto_save_drafts}
        onCheckedChange={(checked) => patchDraft({ auto_save_drafts: checked })}
        dataTest="pref-auto-save-drafts"
      />
    </SettingsSectionCard>
  );
}
