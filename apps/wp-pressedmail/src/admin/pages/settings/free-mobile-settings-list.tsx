import { __ } from "@wordpress/i18n";
import { SettingsListRow } from "@/components/settings-ui";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";

import {
  useFreeSettingsSections,
  type FreeSettingsSectionGroup,
} from "./free-settings-sections";

export function FreeMobileSettingsList() {
  const GROUP_LABELS: Record<FreeSettingsSectionGroup, string> = {
    personal: __("Personal", "pressedmail"),
    admin: __("Admin", "pressedmail"),
    about: __("About", "pressedmail"),
  };

  const navigate = useNavigate();
  const sections = useFreeSettingsSections();

  return (
    <MobileScreen
      header={<MobileScreenHeader title={__("Settings", "pressedmail")} />}>
      <div className="flex flex-col gap-6 px-3 py-4">
        {(["personal", "admin", "about"] as FreeSettingsSectionGroup[]).map(
          (group) => {
            const groupSections = sections.filter(
              (section) => section.group === group,
            );
            if (groupSections.length === 0) return null;

            return (
              <section key={group} aria-labelledby={`pm-settings-${group}`}>
                <h2
                  id={`pm-settings-${group}`}
                  className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  {GROUP_LABELS[group]}
                </h2>
                <ul className="overflow-hidden rounded-xl border border-border bg-card">
                  {groupSections.map((section) => {
                    return (
                      <li
                        key={section.id}
                        className="border-b border-border last:border-b-0">
                        <SettingsListRow
                          label={section.label}
                          description={section.description}
                          icon={section.icon}
                          onSelect={() =>
                            navigate(
                              `/settings/${encodeURIComponent(section.id)}`,
                            )
                          }
                        />
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          },
        )}
      </div>
    </MobileScreen>
  );
}
