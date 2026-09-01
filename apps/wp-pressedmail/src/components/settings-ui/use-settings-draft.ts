import { useCallback, useEffect, useMemo, useRef, useState } from "react";

type SettingsDraftOptions<TSettings extends object> = {
  saved: TSettings;
  equals?: (left: TSettings, right: TSettings) => boolean;
};

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(",")}]`;
  }

  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(
      ([left], [right]) => left.localeCompare(right),
    );

    return `{${entries
      .map(([key, item]) => `${JSON.stringify(key)}:${stableStringify(item)}`)
      .join(",")}}`;
  }

  return JSON.stringify(value);
}

function defaultEquals<TSettings extends object>(
  left: TSettings,
  right: TSettings,
) {
  return stableStringify(left) === stableStringify(right);
}

function changedKeysFor<TSettings extends object>(
  saved: TSettings,
  draft: TSettings,
) {
  const keys = new Set([...Object.keys(saved), ...Object.keys(draft)]);

  return Array.from(keys).filter(
    (key) =>
      stableStringify(saved[key as keyof TSettings]) !==
      stableStringify(draft[key as keyof TSettings]),
  );
}

export function useSettingsDraft<TSettings extends object>({
  saved,
  equals = defaultEquals,
}: SettingsDraftOptions<TSettings>) {
  const [draft, setDraft] = useState<TSettings>(saved);
  const savedRef = useRef(saved);
  const latestSavedRef = useRef(saved);
  const savedSnapshot = stableStringify(saved);
  latestSavedRef.current = saved;

  useEffect(() => {
    savedRef.current = latestSavedRef.current;
    setDraft(latestSavedRef.current);
  }, [savedSnapshot]);

  const patchDraft = useCallback((updates: Partial<TSettings>) => {
    setDraft((current) => ({ ...current, ...updates }));
  }, []);

  const resetDraft = useCallback(() => {
    setDraft(savedRef.current);
  }, []);

  const markSaved = useCallback((nextSaved: TSettings) => {
    savedRef.current = nextSaved;
    setDraft(nextSaved);
  }, []);

  const dirty = useMemo(
    () => !equals(savedRef.current, draft),
    [draft, equals],
  );

  const changedKeys = useMemo(
    () => changedKeysFor(savedRef.current, draft),
    [draft],
  );

  return {
    draft,
    setDraft,
    patchDraft,
    resetDraft,
    markSaved,
    dirty,
    changedKeys,
  };
}
