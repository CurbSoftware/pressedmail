import { useCallback, useEffect, useMemo } from "react";

import {
  type RegisterSettingsDraft,
  type SettingsDraftHandle,
  useSettingsDraft,
} from "@/components/settings-ui";
import {
  useUserPreferences,
  type UserPreferences,
} from "@/hooks/useUserPreferences";

export function usePreferenceSectionDraft<K extends keyof UserPreferences>(
  sectionId: string,
  keys: readonly K[],
  registerDraft: RegisterSettingsDraft,
) {
  const { preferences, updatePreferences, saving } = useUserPreferences();

  const saved = useMemo(() => {
    const next = {} as Pick<UserPreferences, K>;
    for (const key of keys) {
      next[key] = preferences[key];
    }
    return next;
  }, [keys, preferences]);

  const { draft, patchDraft, resetDraft, dirty } = useSettingsDraft({ saved });

  const save = useCallback(async () => {
    const updates: Partial<UserPreferences> = {};
    for (const key of keys) {
      if (
        JSON.stringify(draft[key]) !== JSON.stringify(saved[key])
      ) {
        updates[key] = draft[key] as UserPreferences[K];
      }
    }
    if (Object.keys(updates).length === 0) {
      return true;
    }
    return updatePreferences(updates, { optimistic: false });
  }, [draft, keys, saved, updatePreferences]);

  const handle = useMemo<SettingsDraftHandle>(
    () => ({
      dirty,
      saving,
      save,
      cancel: resetDraft,
    }),
    [dirty, resetDraft, save, saving],
  );

  useEffect(() => {
    registerDraft(sectionId, handle);
    return () => registerDraft(sectionId, null);
  }, [handle, registerDraft, sectionId]);

  return { draft, patchDraft, dirty, saving };
}
