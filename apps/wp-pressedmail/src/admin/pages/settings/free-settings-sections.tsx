import {
  lazy,
  Suspense,
  useMemo,
  type ComponentType,
  type ReactNode,
} from "react";
import { __ } from "@wordpress/i18n";
import {
  Filter,
  Mail,
  MailCheck,
  PenTool,
  Settings2,
  Shield,
  ShieldAlert,
  Sparkles,
  Stethoscope,
  type LucideIcon,
} from "lucide-react";

import { settingsSectionDescription } from "@/components/settings-ui";
import { useAvailableSettingsTabs } from "@/hooks/useAvailableSettingsTabs";
import { EmailAccountsTab } from "./_components/user-settings/email-accounts-tab";
import { SignaturesTab } from "./_components/user-settings/profile-tab";
import { PreferencesTab } from "./_components/user-settings/preferences-tab";
import { SecurityTab as UserSecurityTab } from "./_components/user-settings/security-tab";
import { SecurityAccessTab } from "./_components/admin-settings/security-access-tab";
import { DiagnosticsTab } from "./_components/admin-settings/diagnostics-tab";
import { WpMailTab } from "./_components/admin-settings/wp-mail-tab";
import { ProUpgradeInfo } from "./_components/user-settings/pro-upgrade-info";

const EmailRulesTab = lazy(async () => {
  const module = await import("./_components/user-settings/email-rules-tab");
  return { default: module.EmailRulesTab as ComponentType };
});

export type FreeSettingsSectionGroup = "personal" | "admin" | "about";

export interface FreeSettingsSection {
  id: string;
  label: string;
  description: string;
  icon: LucideIcon;
  content: ReactNode;
  group: FreeSettingsSectionGroup;
}

const PERSONAL_CONTENT: Record<
  string,
  { icon: LucideIcon; content: ReactNode }
> = {
  accounts: {
    icon: Mail,
    content: <EmailAccountsTab />,
  },
  signatures: {
    icon: PenTool,
    content: <SignaturesTab />,
  },
  preferences: {
    icon: Settings2,
    content: <PreferencesTab />,
  },
  "email-rules": {
    icon: Filter,
    content: (
      <Suspense fallback={null}>
        <EmailRulesTab />
      </Suspense>
    ),
  },
  security: {
    icon: Shield,
    content: <UserSecurityTab />,
  },
};

export function useFreeSettingsSections(): FreeSettingsSection[] {
  const { tabs } = useAvailableSettingsTabs();
  const canManageSettings = Boolean(
    window.pressedmailPlugin?.canManageSettings,
  );

  return useMemo(() => {
    const sections: Omit<FreeSettingsSection, "description">[] = tabs.flatMap(
      (tab) => {
        const definition = PERSONAL_CONTENT[tab.id];
        if (!definition) return [];

        return [
          {
            id: tab.id,
            label: tab.label,
            icon: definition.icon,
            content: definition.content,
            group: "personal" as const,
          },
        ];
      },
    );

    if (canManageSettings) {
      sections.push(
        {
          id: "admin-wp-mail",
          label: __("WordPress Email", "pressedmail"),
          icon: MailCheck,
          content: <WpMailTab />,
          group: "admin",
        },
        {
          id: "admin-security-access",
          label: __("Access Control", "pressedmail"),
          icon: ShieldAlert,
          content: <SecurityAccessTab />,
          group: "admin",
        },
        {
          id: "admin-diagnostics",
          label: __("Diagnostics", "pressedmail"),
          icon: Stethoscope,
          content: <DiagnosticsTab />,
          group: "admin",
        },
      );
    }

    sections.push({
      id: "pro",
      label: __("PressedMail Pro", "pressedmail"),
      icon: Sparkles,
      content: <ProUpgradeInfo />,
      group: "about",
    });

    if (canManageSettings) {
      sections.push(
        {
          id: "admin-sync",
          label: __("Mail sync", "pressedmail"),
          icon: Mail,
          content: <SecurityAccessTab section="sync" />,
          group: "admin",
        },
        {
          id: "admin-data",
          label: __("Data and uninstall", "pressedmail"),
          icon: Shield,
          content: <SecurityAccessTab section="data" />,
          group: "admin",
        },
      );
    }
    return sections.map((section) => ({
      ...section,
      description: settingsSectionDescription(section.id),
    }));
  }, [canManageSettings, tabs]);
}
