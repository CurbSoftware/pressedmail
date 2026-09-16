import { useEffect, useMemo, useState, type ReactNode } from "react";
import { __ } from "@wordpress/i18n";
import { useSearchParams } from "react-router-dom";

import { Button, Separator, cn } from "@kit/ui/plugin";
import { PageTopBar } from "@/components/application-layout/PageTopBar";
import { useMobileShellFlag } from "@/components/mobile-shell";
import {
  SettingsHeaderActionsProvider,
  SettingsNavigationGuardProvider,
  useSettingsGuardedAction,
} from "@/components/settings-ui";
import { useIsMobileOrTablet } from "@/hooks/useMobile";

import SettingsLayout from "./layout";
import {
  SETTINGS_NAV_ACTIVE_CLASS,
  SETTINGS_NAV_INDICATOR_CLASS,
} from "@/lib/sidebar-navigation-styles";
import { FreeMobileSettingsList } from "./free-mobile-settings-list";
import {
  useFreeSettingsSections,
  type FreeSettingsSectionGroup,
} from "./free-settings-sections";

const GROUP_LABELS: Record<FreeSettingsSectionGroup, string> = {
  personal: __("Personal", "pressedmail"),
  admin: __("Admin", "pressedmail"),
  about: __("About", "pressedmail"),
};

function FreeDesktopSettings() {
  const sections = useFreeSettingsSections();
  const [searchParams, setSearchParams] = useSearchParams();
  const guardedAction = useSettingsGuardedAction();
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  const requestedSection = searchParams.get("tab");
  const normalizedRequest =
    requestedSection === "general" ? "preferences" : requestedSection;
  const fallbackId = sections[0]?.id ?? "accounts";
  const activeId = sections.some((section) => section.id === normalizedRequest)
    ? (normalizedRequest as string)
    : fallbackId;
  const activeSection = sections.find((section) => section.id === activeId);

  useEffect(() => {
    if (!requestedSection || requestedSection === activeId) {
      return;
    }
    const next = new URLSearchParams(searchParams);
    next.set("tab", activeId);
    next.delete("subtab");
    setSearchParams(next, { replace: true });
  }, [activeId, requestedSection, searchParams, setSearchParams]);

  const grouped = useMemo(
    () => ({
      personal: sections.filter((section) => section.group === "personal"),
      admin: sections.filter((section) => section.group === "admin"),
      about: sections.filter((section) => section.group === "about"),
    }),
    [sections],
  );

  useEffect(() => setHeaderActions(null), [activeId]);

  const selectSection = (sectionId: string) => {
    guardedAction(() => {
      const next = new URLSearchParams(searchParams);
      next.set("tab", sectionId);
      next.delete("subtab");
      setSearchParams(next);
    });
  };

  return (
    <SettingsLayout>
      <div
        data-test="settings-container"
        className="flex h-full min-h-0 w-full flex-col md:flex-row">
        <aside className="flex w-full flex-col border-b bg-muted/30 md:h-full md:w-64 md:border-b-0 md:border-r">
          {(["personal", "admin", "about"] as FreeSettingsSectionGroup[]).map(
            (group, groupIndex) => {
              const groupSections = grouped[group];
              if (groupSections.length === 0) return null;

              return (
                <div key={group} className="px-4 pb-4 pt-4">
                  {groupIndex > 0 ? <Separator className="mb-3" /> : null}
                  <h2
                    id={`pm-settings-group-${group}`}
                    className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {GROUP_LABELS[group]}
                  </h2>
                  <nav
                    aria-labelledby={`pm-settings-group-${group}`}
                    className="mt-3 space-y-1">
                    {groupSections.map((section) => {
                      const Icon = section.icon;
                      const isActive = section.id === activeId;
                      return (
                        <Button
                          key={section.id}
                          type="button"
                          variant="ghost"
                          aria-current={isActive ? "page" : undefined}
                          className={cn(
                            "gap-2 text-sm",
                            SETTINGS_NAV_INDICATOR_CLASS,
                            isActive && SETTINGS_NAV_ACTIVE_CLASS,
                          )}
                          onClick={() => selectSection(section.id)}
                          data-test={`settings-tab-${section.id}`}>
                          <Icon
                            className={cn(
                              "h-4 w-4",
                              isActive && "text-primary",
                            )}
                          />
                          <span className="truncate">{section.label}</span>
                        </Button>
                      );
                    })}
                  </nav>
                </div>
              );
            },
          )}
        </aside>

        <section className="flex min-w-0 flex-1 flex-col">
          {/* Keep this in step with settings-shell.tsx: the title row and the
              content well have to agree or the two editions drift apart again.
              1248 is 1280 minus px-4 on both sides, 1504 is 1536 minus the
              same. */}
          <PageTopBar
            className="py-1.5"
            contentClassName="mx-auto w-full max-w-[1248px] min-h-[40px] 2xl:max-w-[1504px]"
            icon={
              activeSection ? <activeSection.icon className="h-5 w-5" /> : null
            }
            title={activeSection?.label}
            description={activeSection?.description}
            actions={headerActions}
          />
          <div className="flex-1 overflow-y-auto">
            <div className="mx-auto w-full max-w-7xl px-4 pb-6 pt-4 2xl:max-w-[96rem]">
              <SettingsHeaderActionsProvider
                key={activeId}
                onActionsChange={setHeaderActions}>
                {activeSection?.content}
              </SettingsHeaderActionsProvider>
            </div>
          </div>
        </section>
      </div>
    </SettingsLayout>
  );
}

export default function FreeSettings() {
  const isMobileOrTablet = useIsMobileOrTablet();
  const mobileShellEnabled = useMobileShellFlag();
  const compactSettings = isMobileOrTablet && mobileShellEnabled;

  if (compactSettings) {
    return <FreeMobileSettingsList />;
  }

  return (
    <SettingsNavigationGuardProvider>
      <FreeDesktopSettings />
    </SettingsNavigationGuardProvider>
  );
}
