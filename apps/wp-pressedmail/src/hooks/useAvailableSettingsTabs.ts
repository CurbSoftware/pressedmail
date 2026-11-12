"use client";

import { proToolTabs } from "@/components/settings/pro-tools/tools.active";
import { providerImportOn } from "@/lib/provider-import-flags";
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

    // Contacts & calendars (Pro): every contacts and calendar connection in
    // one page. Shown while the build carries it and the companion is on.
    if (isPro && providerImportOn()) {
      result.push({
        id: "contacts-calendars",
        label: __("Contacts & calendars", "pressedmail"),
        icon: null,
        userOnly: true,
        proOnly: true,
      });
    }

    if (isPro) result.push(...proToolTabs());
    return result;
  }, []);

  return { tabs };
}
