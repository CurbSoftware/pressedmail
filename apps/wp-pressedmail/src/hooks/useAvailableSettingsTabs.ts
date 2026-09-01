"use client";

import { useMemo } from "react";
import { __ } from "@wordpress/i18n";

export interface SettingsTab {
  id: string;
  label: string;
  icon: React.ReactNode;
  proOnly?: boolean;
  adminOnly?: boolean;
  userOnly?: boolean;
}

function isEmailRulesBuildEnabled() {
  // Default-on: Email Rules ships in both Free and Pro builds (Free basic,
  // Pro advanced). Only an explicit `false` build flag hides it.
  return typeof __ENABLE_EMAIL_RULES__ === "boolean"
    ? __ENABLE_EMAIL_RULES__
    : (
        globalThis as typeof globalThis & {
          __ENABLE_EMAIL_RULES__?: boolean;
        }
      ).__ENABLE_EMAIL_RULES__ !== false;
}

function isAutoRepliesBuildEnabled() {
  return typeof __ENABLE_AUTO_REPLIES__ === "boolean"
    ? __ENABLE_AUTO_REPLIES__
    : (
        globalThis as typeof globalThis & {
          __ENABLE_AUTO_REPLIES__?: boolean;
        }
      ).__ENABLE_AUTO_REPLIES__ !== false;
}

/**
 * Hook to determine which settings tabs should be available based on user's license tier
 *
 * Tab Order:
 * 1. Accounts - always shown
 * 2. Signatures - always shown
 * 3. Preferences - always shown
 * 4. Email Rules - always shown when the email rules build flag is enabled
 * 5. Auto-Replies - Pro only, when the auto_replies build flag is enabled
 * 6. Security - always shown
 */
export function useAvailableSettingsTabs() {
  const aiAdminStatusLoaded = true;

  const tabs = useMemo((): SettingsTab[] => {
    const isPro = window.pressedmailPlugin?.isPro ?? false;
    const result: SettingsTab[] = [
      {
        id: "accounts",
        label: __("Accounts", "pressedmail"),
        icon: null,
        userOnly: true,
      },
      {
        id: "signatures",
        label: __("Signatures", "pressedmail"),
        icon: null,
        userOnly: true,
      },
      {
        id: "preferences",
        label: __("Preferences", "pressedmail"),
        icon: null,
        userOnly: true,
      },
    ];

    // Tags are managed inline in the inbox sidebar (TagFilterSection: add /
    // edit / delete) and in the editor tag picker, there is no longer a
    // standalone Tags settings tab.

    // Email Rules: top-level personal tab in every build (Free basic, Pro
    // advanced). Sweep block actions create saved rules here for future mail.
    if (isEmailRulesBuildEnabled()) {
      result.push({
        id: "email-rules",
        label: __("Email Rules", "pressedmail"),
        icon: null,
        userOnly: true,
      });
    }

    if (isPro && isAutoRepliesBuildEnabled()) {
      result.push({
        id: "auto-replies",
        label: __("Auto-Replies", "pressedmail"),
        icon: null,
        userOnly: true,
        proOnly: true,
      });
    }

    result.push({
      id: "security",
      label: __("Security", "pressedmail"),
      icon: null,
      userOnly: true,
    });

    // Calendar Sync (Pro): connect Google/Outlook/CalDAV. The sync backend and
    // client exist; this tab surfaces the connection UI. Gated on the pro
    // edition and the calendar_sync build flag.
    const calendarSyncEnabled =
      typeof __ENABLE_CALENDAR_SYNC__ === "boolean"
        ? __ENABLE_CALENDAR_SYNC__
        : (
            globalThis as typeof globalThis & {
              __ENABLE_CALENDAR_SYNC__?: boolean;
            }
          ).__ENABLE_CALENDAR_SYNC__ === true;
    if (isPro && calendarSyncEnabled) {
      result.push({
        id: "calendar-sync",
        label: __("Calendar Sync", "pressedmail"),
        icon: null,
        userOnly: true,
        proOnly: true,
      });
    }

    // External contact-provider sync remains disabled in the production source.
    // The flag stays as the compile-time tree-shaking boundary for its archived
    // feature work.
    const contactsSyncEnabled =
      typeof __ENABLE_CONTACTS_SYNC__ === "boolean"
        ? __ENABLE_CONTACTS_SYNC__
        : (
            globalThis as typeof globalThis & {
              __ENABLE_CONTACTS_SYNC__?: boolean;
            }
          ).__ENABLE_CONTACTS_SYNC__ === true;
    if (isPro && contactsSyncEnabled) {
      result.push({
        id: "contacts-sync",
        label: __("Contacts Sync", "pressedmail"),
        icon: null,
        userOnly: true,
        proOnly: true,
      });
    }

    return result;
  }, []);

  return { tabs, aiAdminStatusLoaded };
}
