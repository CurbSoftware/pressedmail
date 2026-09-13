"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { MobileImmersiveToggle } from "@/components/mobile-shell/MobileImmersiveToggle";
import { toggleActivityPanel } from "@/components/activity/use-activity-panel";
import { useProcessQueue } from "@/hooks/useProcessQueue";

import { buildMoreMenuSections, type MoreMenuSection } from "./more-menu";

function MoreList({
  sections,
  onNavigate,
}: {
  sections: MoreMenuSection[];
  onNavigate: (to: string) => void;
}) {
  return (
    <div className="flex flex-col gap-6 px-3 py-4">
      {sections.map((section) => (
        <section key={section.id} aria-labelledby={`pm-more-${section.id}`}>
          <h2
            id={`pm-more-${section.id}`}
            className="px-3 pb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {section.label}
          </h2>
          <ul
            role="list"
            className="overflow-hidden rounded-xl border border-border bg-card">
            {section.rows.map((row) => {
              const Icon = row.icon;
              const showBadge = typeof row.badge === "number" && row.badge > 0;
              return (
                <li
                  key={row.id}
                  className="border-b border-border last:border-b-0">
                  <button
                    type="button"
                    onClick={() =>
                      row.action === "activity"
                        ? toggleActivityPanel()
                        : row.to && onNavigate(row.to)
                    }
                    className="pm-touch-target pm-no-tap-highlight flex w-full items-center gap-3 px-3 py-3 text-left text-foreground active:bg-muted">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm font-medium">
                        {row.label}
                      </span>
                      {row.description ? (
                        <span className="line-clamp-2 text-xs text-muted-foreground">
                          {row.description}
                        </span>
                      ) : null}
                    </span>
                    {showBadge ? (
                      <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-primary px-1.5 text-[11px] font-medium tabular-nums text-primary-foreground">
                        {row.badge}
                      </span>
                    ) : null}
                    <ChevronRight
                      className="h-4 w-4 text-muted-foreground"
                      aria-hidden="true"
                    />
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
      <MobileImmersiveToggle />
    </div>
  );
}

export function MobileMoreScreen() {
  const navigate = useNavigate();
  const pluginData =
    typeof window !== "undefined" ? window.pressedmailPlugin : undefined;
  const isPro = pluginData?.isPro ?? false;
  const canManageSettings = pluginData?.canManageSettings ?? false;
  const canManagePro = (isPro === true || isPro === "1") && canManageSettings;
  const { activeTasks } = useProcessQueue();
  const activeTaskCount = activeTasks.length;

  const sections = React.useMemo(
    () =>
      buildMoreMenuSections({
        canManageSettings,
        canManagePro,
        activeTaskCount,
      }),
    [canManagePro, canManageSettings, activeTaskCount],
  );

  return (
    <MobileScreen
      header={
        // One root header layout across the shell: this screen used the large
        // left-aligned hero while Inbox, Contacts and Calendar used the
        // compact centred one.
        <MobileScreenHeader title={__("More", "pressedmail")} hideBack />
      }>
      <MoreList sections={sections} onNavigate={navigate} />
    </MobileScreen>
  );
}

export default MobileMoreScreen;
