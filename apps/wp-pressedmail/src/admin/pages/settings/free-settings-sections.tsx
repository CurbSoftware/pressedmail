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
  { icon: LucideIcon; description: string; content: ReactNode }
> = {
  accounts: {
    icon: Mail,
    description: __("Manage your personal email accounts.", "pressedmail"),
    content: <EmailAccountsTab />,
  },
  signatures: {
    icon: PenTool,
    description: __("Create and manage your email signatures.", "pressedmail"),
    content: <SignaturesTab />,
  },
  preferences: {
    icon: Settings2,
    description: __("Configure your inbox preferences.", "pressedmail"),
    content: <PreferencesTab />,
  },
  "email-rules": {
    icon: Filter,
    description: __("Organize incoming messages automatically.", "pressedmail"),
    content: (
      <Suspense fallback={null}>
        <EmailRulesTab />
      </Suspense>
    ),
  },
  security: {
    icon: Shield,
    description: __("Manage inbox security preferences.", "pressedmail"),
    content: <UserSecurityTab />,
  },
};

export function useFreeSettingsSections(): FreeSettingsSection[] {
  const { tabs } = useAvailableSettingsTabs();
  const canManageSettings = Boolean(
    window.pressedmailPlugin?.canManageSettings,
  );

  return useMemo(() => {
    const sections: FreeSettingsSection[] = tabs.flatMap((tab) => {
      const definition = PERSONAL_CONTENT[tab.id];
      if (!definition) return [];

      return [
        {
          id: tab.id,
          label: tab.label,
          description: definition.description,
          icon: definition.icon,
          content: definition.content,
          group: "personal" as const,
        },
      ];
    });

    if (canManageSettings) {
      sections.push(
        {
          id: "admin-wp-mail",
          label: __("WordPress Email", "pressedmail"),
          description: __(
            "Send WordPress system email through your own SMTP server.",
            "pressedmail",
          ),
          icon: MailCheck,
          content: <WpMailTab />,
          group: "admin",
        },
        {
          id: "admin-security-access",
          label: __("Access Control", "pressedmail"),
          description: __(
            "Control site-wide attachment, remote-content, and credential access.",
            "pressedmail",
          ),
          icon: ShieldAlert,
          content: <SecurityAccessTab />,
          group: "admin",
        },
        {
          id: "admin-diagnostics",
          label: __("Diagnostics", "pressedmail"),
          description: __(
            "Review plugin status, connectivity, and configuration.",
            "pressedmail",
          ),
          icon: Stethoscope,
          content: <DiagnosticsTab />,
          group: "admin",
        },
      );
    }

    sections.push({
      id: "pro",
      label: __("PressedMail Pro", "pressedmail"),
      description: __(
        "Discover the separately distributed Pro plugin.",
        "pressedmail",
      ),
      icon: Sparkles,
      content: <ProUpgradeInfo />,
      group: "about",
    });

    return sections;
  }, [canManageSettings, tabs]);
}
