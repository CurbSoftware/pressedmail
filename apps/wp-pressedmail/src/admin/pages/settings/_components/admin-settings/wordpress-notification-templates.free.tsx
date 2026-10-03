import type {
  RegisterSettingsDraft,
  SettingsDraftHandle,
} from "@/components/settings-ui";

/** Free keeps one site-wide mail server, so this section is absent. */
export function WordPressNotificationTemplates(_props: {
  registerDraft?: RegisterSettingsDraft;
}) {
  return null;
}

/** What the tab's save bar owes the section's unsaved edits. Free has no section, so nothing. */
export function sectionDraftBar(_drafts: Record<string, SettingsDraftHandle>) {
  return {
    dirty: false,
    save: async () => true,
    cancel: () => {},
  };
}
