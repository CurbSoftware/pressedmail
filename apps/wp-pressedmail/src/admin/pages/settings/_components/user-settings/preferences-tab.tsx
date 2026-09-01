"use client";

import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { __ } from "@wordpress/i18n";
import { useSearchParams } from "react-router-dom";
import {
  Alert,
  AlertDescription,
  AlertTitle,
  Button,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@kit/ui/plugin";

import {
  SettingsEmptyState,
  SettingsSaveBar,
  useSettingsGuardedAction,
  useSettingsNavigationGuard,
  type SettingsDraftHandle,
} from "@/components/settings-ui";
import {
  PREFERENCE_CATEGORIES,
  PREFERENCE_SECTIONS,
  visiblePreferenceSections,
  type PreferenceCategoryId,
  type PreferenceSection,
} from "../../preferences-sections";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useComposerPalettesEnabled } from "@/hooks/useComposerPalettesEnabled";

export function PreferencesTab() {
  // Color palettes are Ultimate-tier; the rest of the sections are build-tier.
  const palettesEnabled = useComposerPalettesEnabled();
  const sections = useMemo(
    () =>
      visiblePreferenceSections().filter(
        (section) => palettesEnabled || section.id !== "color-palettes",
      ),
    [palettesEnabled],
  );

  return <PreferencesTabView sections={sections} />;
}

export function PreferencesTabView({
  sections = PREFERENCE_SECTIONS,
}: {
  sections?: PreferenceSection[];
}) {
  const [searchParams, setSearchParams] = useSearchParams();
  const {
    error: preferenceError,
    loading: preferencesLoading,
    refetch: refetchPreferences,
  } = useUserPreferences();
  const [hasLoadedPreferences, setHasLoadedPreferences] = useState(
    !preferencesLoading && !preferenceError,
  );
  const [drafts, setDrafts] = useState<Record<string, SettingsDraftHandle>>({});
  const subtab = searchParams.get("subtab");
  const handledSubtabRef = useRef<string | null>(null);
  const categories = useMemo(
    () =>
      PREFERENCE_CATEGORIES.filter((category) =>
        sections.some((section) => section.category === category.id),
      ),
    [sections],
  );
  const subtabCategory = sections.find(
    (section) => section.id === subtab,
  )?.category;
  const categoryParam = searchParams.get("category");
  const routeCategory = categories.find(
    (category) => category.id === categoryParam,
  )?.id;

  const registerDraft = useCallback(
    (key: string, draft: SettingsDraftHandle | null) => {
      setDrafts((current) => {
        if (!draft) {
          if (!(key in current)) {
            return current;
          }
          const next = { ...current };
          delete next[key];
          return next;
        }
        if (current[key] === draft) {
          return current;
        }
        return { ...current, [key]: draft };
      });
    },
    [],
  );

  const draftList = useMemo(() => Object.values(drafts), [drafts]);
  const dirty = draftList.some((draft) => draft.dirty);
  const saving = draftList.some((draft) => draft.saving);

  const saveChanges = useCallback(async () => {
    if (saving) {
      return false;
    }
    for (const draft of draftList) {
      const saved = await draft.save();
      if (!saved) {
        return false;
      }
    }
    return true;
  }, [draftList, saving]);

  const resetChanges = useCallback(() => {
    for (const draft of draftList) {
      draft.cancel();
    }
  }, [draftList]);

  useSettingsNavigationGuard({
    dirty,
    saving,
    onSave: saveChanges,
  });
  const guardedAction = useSettingsGuardedAction();

  const selectedCategory =
    subtabCategory ?? routeCategory ?? categories[0]?.id ?? "inbox";
  const activeSections = useMemo(
    () => sections.filter((section) => section.category === selectedCategory),
    [sections, selectedCategory],
  );

  const selectCategory = useCallback(
    (category: PreferenceCategoryId) => {
      if (category === selectedCategory) return;
      guardedAction(() => {
        const next = new URLSearchParams(searchParams);
        next.delete("subtab");
        next.set("category", category);
        setSearchParams(next);
      });
    },
    [guardedAction, searchParams, selectedCategory, setSearchParams],
  );

  useEffect(() => {
    if (!subtab) {
      handledSubtabRef.current = null;
      return;
    }

    if (handledSubtabRef.current === subtab) return;

    const section = sections.find((candidate) => candidate.id === subtab);
    if (!section) return;

    const target = document.getElementById(`preference-section-${subtab}`);
    if (!target) return;
    target.scrollIntoView({ block: "start" });
    target.focus({ preventScroll: true });
    handledSubtabRef.current = subtab;
  }, [selectedCategory, sections, subtab]);

  useEffect(() => {
    if (!preferencesLoading && !preferenceError) {
      setHasLoadedPreferences(true);
    }
  }, [preferenceError, preferencesLoading]);

  if (sections.length === 0) {
    return (
      <SettingsEmptyState
        title={__("No preference sections yet", "pressedmail")}
        description={__(
          "Inbox, composer, and notification cards will appear here as they ship.",
          "pressedmail",
        )}
      />
    );
  }

  if (preferencesLoading) {
    return (
      <div
        className="@container/preferences-nav w-full min-w-0 space-y-4"
        data-test="preferences-tab"
        data-testid="preferences-tab">
        <div
          role="status"
          className="rounded-lg border border-dashed bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">
          {__("Loading preferences...", "pressedmail")}
        </div>
      </div>
    );
  }

  if (preferenceError && !hasLoadedPreferences) {
    return (
      <div
        className="@container/preferences-nav w-full min-w-0 space-y-4"
        data-test="preferences-tab"
        data-testid="preferences-tab">
        <Alert variant="destructive">
          <AlertTitle>
            {__("Preferences could not be loaded", "pressedmail")}
          </AlertTitle>
          <AlertDescription className="space-y-3">
            <p>{preferenceError}</p>
            <Button
              type="button"
              variant="outline"
              className="min-h-11 @3xl/preferences-nav:min-h-9"
              onClick={() => void refetchPreferences()}>
              {__("Retry", "pressedmail")}
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div
      className="@container/preferences-nav w-full min-w-0 space-y-4"
      data-test="preferences-tab"
      data-testid="preferences-tab">
      <div className="space-y-2 @3xl/preferences-nav:hidden">
        <Label htmlFor="preference-category">
          {__("Preference category", "pressedmail")}
        </Label>
        <select
          id="preference-category"
          className="h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
          value={selectedCategory}
          onChange={(event) =>
            selectCategory(event.target.value as PreferenceCategoryId)
          }>
          {categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </select>
      </div>

      <Tabs
        orientation="vertical"
        value={selectedCategory}
        onValueChange={(value) => selectCategory(value as PreferenceCategoryId)}
        className="block w-full min-w-0 @3xl/preferences-nav:grid @3xl/preferences-nav:grid-cols-[12rem_minmax(0,1fr)] @3xl/preferences-nav:items-start @3xl/preferences-nav:gap-5">
        <TabsList
          aria-label={__("Preference categories", "pressedmail")}
          className="flex h-auto w-full flex-col items-stretch gap-1 bg-muted/40 p-1 @max-3xl/preferences-nav:hidden">
          {categories.map((category) => (
            <TabsTrigger
              key={category.id}
              value={category.id}
              className="min-h-11 w-full justify-start px-3 text-left">
              {category.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent
          value={selectedCategory}
          className="w-full min-w-0 space-y-4 outline-none">
          {activeSections.map((section) => {
            const Section = section.Component;
            return (
              <div
                key={section.id}
                id={`preference-section-${section.id}`}
                role="region"
                aria-label={section.title}
                tabIndex={-1}
                className="scroll-mt-4 outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                data-test={`preference-section-slot-${section.id}`}>
                <Suspense
                  fallback={
                    <div
                      role="status"
                      className="py-3 text-sm text-muted-foreground"
                      data-test="preference-section-loading"
                      data-testid="preference-section-loading">
                      {__("Loading settings...", "pressedmail")}
                    </div>
                  }>
                  <Section registerDraft={registerDraft} />
                </Suspense>
              </div>
            );
          })}
          <SettingsSaveBar
            dirty={dirty}
            saving={saving}
            status={
              preferenceError ? (
                <span role="alert" className="text-destructive">
                  {preferenceError}.{" "}
                  {__(
                    "Your changes are still unsaved. Try again.",
                    "pressedmail",
                  )}
                </span>
              ) : undefined
            }
            onReset={resetChanges}
            onSave={() => {
              void saveChanges();
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default PreferencesTab;
