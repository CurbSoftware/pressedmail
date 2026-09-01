import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { Navigate, useParams } from "react-router-dom";

import {
  MobileScreen,
  MobileScreenHeader,
  useHideTabBar,
} from "@/components/mobile-shell";
import {
  SettingsHeaderActionsProvider,
  SettingsNavigationGuardProvider,
  useSettingsGuardedAction,
} from "@/components/settings-ui";
import { useOptionalBackStack } from "@/hooks/useBackStack";

import { useFreeSettingsSections } from "./free-settings-sections";

export default function FreeMobileSettingsDetail() {
  return (
    <SettingsNavigationGuardProvider>
      <FreeMobileSettingsDetailContent />
    </SettingsNavigationGuardProvider>
  );
}

function FreeMobileSettingsDetailContent() {
  useHideTabBar(true);
  const { section: sectionId } = useParams<{ section: string }>();
  const sections = useFreeSettingsSections();
  const back = useOptionalBackStack();
  const guardedAction = useSettingsGuardedAction();
  const [headerActions, setHeaderActions] = useState<ReactNode | null>(null);
  const section = useMemo(
    () => sections.find((candidate) => candidate.id === sectionId),
    [sectionId, sections],
  );

  useEffect(() => setHeaderActions(null), [sectionId]);

  const handleBack = useCallback(() => {
    if (back) {
      guardedAction(back.pop);
    }
  }, [back, guardedAction]);

  if (!section) {
    return <Navigate to="/settings" replace />;
  }

  return (
    <MobileScreen
      header={
        <MobileScreenHeader
          title={section.label}
          trailing={headerActions}
          onBack={back ? handleBack : undefined}
        />
      }>
      <SettingsHeaderActionsProvider
        key={section.id}
        onActionsChange={setHeaderActions}>
        <div className="px-3 py-4">{section.content}</div>
      </SettingsHeaderActionsProvider>
    </MobileScreen>
  );
}
