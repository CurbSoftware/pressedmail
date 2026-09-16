import { lazy, type LazyExoticComponent, type ComponentType } from "react";
import { __ } from "@wordpress/i18n";

import type { RegisterSettingsDraft } from "@/components/settings-ui";
import { isFreeBuild } from "@/lib/build-variant";

export type PreferenceMinTier = "free" | "pro";
export type PreferenceCategoryId =
  | "inbox"
  | "composer"
  | "notifications"
  | "language";

export interface PreferenceCategory {
  id: PreferenceCategoryId;
  label: string;
}

export const PREFERENCE_CATEGORIES: readonly PreferenceCategory[] = [
  { id: "inbox", label: __("Inbox", "pressedmail") },
  { id: "composer", label: __("Composer", "pressedmail") },
  { id: "notifications", label: __("Notifications", "pressedmail") },
  { id: "language", label: __("Language", "pressedmail") },
];

export interface PreferenceSectionProps {
  registerDraft: RegisterSettingsDraft;
}

export interface PreferenceSection {
  id: string;
  title: string;
  category: PreferenceCategoryId;
  minTier: PreferenceMinTier;
  keys: readonly string[];
  Component: LazyExoticComponent<ComponentType<PreferenceSectionProps>>;
}

export { ReadingActionsSection } from "./_components/user-settings/reading-actions-section";
export { RowDetailSection } from "./_components/user-settings/row-detail-section";
export { ComposerDefaultsSection } from "./_components/user-settings/composer-defaults-section";
export { ComposerBehaviorSection } from "./_components/user-settings/composer-behavior-section";
export { AlertBehaviorSection } from "./_components/user-settings/alert-behavior-section";
export { LanguageSection } from "./_components/user-settings/language-section";
export { EmailListSection } from "./_components/user-settings/email-list-section";
export { MailHandlingSection } from "./_components/user-settings/mail-handling-section";
export { NotificationsSection } from "./_components/user-settings/notifications-section";
export { ColorPalettesSection } from "./_components/user-settings/color-palettes-section";

export { READING_ACTION_KEYS } from "./_components/user-settings/reading-actions-section";
export { ROW_DETAIL_KEYS } from "./_components/user-settings/row-detail-section";
export { COMPOSER_DEFAULT_KEYS } from "./_components/user-settings/composer-defaults-section";
export { COMPOSER_BEHAVIOR_KEYS } from "./_components/user-settings/composer-behavior-section";
export { ALERT_BEHAVIOR_KEYS } from "./_components/user-settings/alert-behavior-section";
export { LANGUAGE_KEYS } from "./_components/user-settings/language-section";
export { EMAIL_LIST_KEYS } from "./_components/user-settings/email-list-section";
export { MAIL_HANDLING_KEYS } from "./_components/user-settings/mail-handling-section";
export { NOTIFICATION_KEYS } from "./_components/user-settings/notifications-section";
export { COLOR_PALETTE_KEYS } from "./_components/user-settings/color-palettes-section";

export const PREFERENCE_SECTIONS: PreferenceSection[] = [
  {
    id: "email-list",
    title: __("Email list", "pressedmail"),
    category: "inbox",
    minTier: "free",
    keys: [
      "email_list_mode",
      "email_list_page_size",
      "email_list_default_sort",
      "email_list_remember_folder",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/email-list-section");
      return { default: module.EmailListSection };
    }),
  },
  {
    id: "row-detail",
    title: __("Row details", "pressedmail"),
    category: "inbox",
    minTier: "free",
    keys: [
      "email_list_density",
      "email_list_preview",
      "email_list_show_account_badge",
      "email_list_show_attachment_icon",
      "email_list_unread_indicator",
      "email_list_date_grouping",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/row-detail-section");
      return { default: module.RowDetailSection };
    }),
  },
  {
    id: "reading-actions",
    title: __("Reading actions", "pressedmail"),
    category: "inbox",
    minTier: "free",
    keys: [
      "mark_as_read_behavior",
      "mark_as_read_delay_seconds",
      "default_reply_action",
      "after_delete_action",
      "after_archive_action",
      "send_safety_confirmation",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/reading-actions-section");
      return { default: module.ReadingActionsSection };
    }),
  },
  {
    id: "mail-handling",
    title: __("Mail handling", "pressedmail"),
    category: "inbox",
    minTier: "free",
    keys: ["auto_archive", "confirm_delete", "auto_save_drafts"],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/mail-handling-section");
      return { default: module.MailHandlingSection };
    }),
  },
  {
    id: "composer-defaults",
    title: __("Composer defaults", "pressedmail"),
    category: "composer",
    minTier: "free",
    keys: [
      "composer_default_format",
      "composer_default_font",
      "composer_default_font_size",
      "composer_signature_placement",
      "composer_ai_default_tone",
      "undo_send_enabled",
      "undo_send_delay_seconds",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/composer-defaults-section");
      return { default: module.ComposerDefaultsSection };
    }),
  },
  {
    id: "composer-behavior",
    title: __("Composer behavior", "pressedmail"),
    category: "composer",
    minTier: "free",
    keys: [
      "composer_typography_auto_format",
      "composer_confirm_unsaved_close",
      "composer_toolbar_preset",
      "composer_toolbar_items",
      "composer_mobile_toolbar_preset",
      "composer_mobile_toolbar_items",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/composer-behavior-section");
      return { default: module.ComposerBehaviorSection };
    }),
  },
  {
    id: "color-palettes",
    title: __("Color palettes", "pressedmail"),
    category: "composer",
    minTier: "free",
    keys: [
      "composer_palette_level",
      "palette_custom_colors",
      "disabled_palettes",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/color-palettes-section");
      return { default: module.ColorPalettesSection };
    }),
  },
  {
    id: "alert-behavior",
    title: __("Alert behavior", "pressedmail"),
    category: "notifications",
    minTier: "free",
    keys: [
      "notification_scope",
      "notification_preview_level",
      "notification_unread_only",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/alert-behavior-section");
      return { default: module.AlertBehaviorSection };
    }),
  },
  {
    id: "notifications",
    title: __("Notifications", "pressedmail"),
    category: "notifications",
    minTier: "free",
    keys: [
      "desktop_notifications",
      "email_notifications",
      "notification_sound",
      "notification_quiet_hours_enabled",
      "notification_quiet_hours_start",
      "notification_quiet_hours_end",
      "notification_badge_count_mode",
    ],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/notifications-section");
      return { default: module.NotificationsSection };
    }),
  },
  {
    id: "language",
    title: __("Language", "pressedmail"),
    category: "language",
    minTier: "free",
    keys: [],
    Component: lazy(async () => {
      const module =
        await import("./_components/user-settings/language-section");
      return { default: module.LanguageSection };
    }),
  },
];

export function isProPreferenceBuild(): boolean {
  return !isFreeBuild();
}

export function visiblePreferenceSections(
  sections: PreferenceSection[] = PREFERENCE_SECTIONS,
  includePro: boolean = isProPreferenceBuild(),
): PreferenceSection[] {
  return sections.filter((section) => section.minTier === "free" || includePro);
}
