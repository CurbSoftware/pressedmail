import { __ } from "@wordpress/i18n";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";

import {
  useFreeSettingsSections,
  type FreeSettingsSectionGroup,
} from "./free-settings-sections";

const GROUP_LABELS: Record<FreeSettingsSectionGroup, string> = {
  personal: __("Personal", "pressedmail"),
  admin: __("Admin", "pressedmail"),
  about: __("About", "pressedmail"),
};

export function FreeMobileSettingsList() {
  const navigate = useNavigate();
  const sections = useFreeSettingsSections();

  return (
    <MobileScreen
      header={<MobileScreenHeader title={__("Settings", "pressedmail")} />}>
      <div className="flex flex-col gap-6 px-3 py-4">
        {(["personal", "admin", "about"] as FreeSettingsSectionGroup[]).map((group) => {
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
                  const Icon = section.icon;
                  return (
                    <li
                      key={section.id}
                      className="border-b border-border last:border-b-0">
                      <button
                        type="button"
                        onClick={() => navigate(`/settings/${section.id}`)}
                        className="pm-touch-target flex w-full items-center gap-3 px-3 py-3 text-left text-foreground active:bg-muted">
                        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-muted">
                          <Icon className="h-5 w-5" aria-hidden="true" />
                        </span>
                        <span className="flex min-w-0 flex-1 flex-col">
                          <span className="text-sm font-medium">
                            {section.label}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {section.description}
                          </span>
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </MobileScreen>
  );
}
