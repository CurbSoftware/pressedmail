import { useCallback, useEffect, useRef, useState } from "react";

import { appMessage } from "@/context/toast";

export type AutosaveStatus = "idle" | "dirty" | "saving" | "saved" | "error";

export const SETTINGS_TEXT_AUTOSAVE_DEBOUNCE_MS = 700;

const SUCCESS_TOAST_COALESCE_MS = 1500;
const lastSuccessToastAtByScope = new Map<string, number>();

type SetValueAction<T> = T | ((previous: T) => T);

export interface UseAutosaveSettingOptions<T> {
  scope: string;
  key: string;
  initialValue: T;
  save: (value: T) => Promise<T | void> | T | void;
  debounceMs?: number;
  successMessage?: string;
  errorMessage?: string;
  disabled?: boolean;
}

export interface UseAutosaveSettingResult<T> {
  value: T;
  setValue: (next: SetValueAction<T>) => void;
  flush: () => Promise<boolean>;
  status: AutosaveStatus;
  error: Error | null;
}

function normalizeError(error: unknown): Error {
  if (error instanceof Error) return error;
  return new Error(typeof error === "string" ? error : "Could not save");
}

function showCoalescedSuccessToast(scope: string, message: string): void {
  const now = Date.now();
  const lastShown = lastSuccessToastAtByScope.get(scope);
  if (
    lastShown !== undefined &&
    now - lastShown < SUCCESS_TOAST_COALESCE_MS
  ) {
    return;
  }

  lastSuccessToastAtByScope.set(scope, now);
  appMessage(message, "success");
}

export function notifyAutosaveSuccess(
  scope: string,
  message = "Settings saved",
): void {
  showCoalescedSuccessToast(scope, message);
}

export function notifyAutosaveError(
  message = "Could not save settings",
): void {
  appMessage(message, "error");
}

export function resetAutosaveToastCoalescingForTests(): void {
  lastSuccessToastAtByScope.clear();
}

export function useAutosaveSetting<T>({
  scope,
  key,
  initialValue,
  save,
  debounceMs = 0,
  successMessage = "Settings saved",
  errorMessage = "Could not save settings",
  disabled = false,
}: UseAutosaveSettingOptions<T>): UseAutosaveSettingResult<T> {
  const [value, setValueState] = useState<T>(initialValue);
  const [status, setStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<Error | null>(null);
  const savedValueRef = useRef(initialValue);
  const currentValueRef = useRef(initialValue);
  const timerRef = useRef<number | null>(null);
  const pendingValueRef = useRef<T>(initialValue);
  const writeVersionRef = useRef(0);
  const mountedRef = useRef(true);

  useEffect(() => {
    currentValueRef.current = value;
  }, [value]);

  useEffect(() => {
    savedValueRef.current = initialValue;
    pendingValueRef.current = initialValue;
    setValueState(initialValue);
    setStatus("idle");
    setError(null);
  }, [initialValue]);

  useEffect(
    () => () => {
      mountedRef.current = false;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    },
    [],
  );

  const runSave = useCallback(
    async (nextValue: T): Promise<boolean> => {
      if (disabled) {
        return false;
      }

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      const writeVersion = writeVersionRef.current + 1;
      writeVersionRef.current = writeVersion;
      const previousSavedValue = savedValueRef.current;
      setStatus("saving");
      setError(null);

      try {
        const canonicalValue = await save(nextValue);
        if (!mountedRef.current || writeVersion !== writeVersionRef.current) {
          return true;
        }

        const savedValue =
          canonicalValue === undefined ? nextValue : canonicalValue;
        savedValueRef.current = savedValue;
        pendingValueRef.current = savedValue;
        currentValueRef.current = savedValue;
        setValueState(savedValue);
        setStatus("saved");
        notifyAutosaveSuccess(scope, successMessage);
        return true;
      } catch (caught) {
        if (!mountedRef.current || writeVersion !== writeVersionRef.current) {
          return false;
        }

        const normalized = normalizeError(caught);
        pendingValueRef.current = previousSavedValue;
        currentValueRef.current = previousSavedValue;
        setValueState(previousSavedValue);
        setError(normalized);
        setStatus("error");
        notifyAutosaveError(errorMessage);
        return false;
      }
    },
    [disabled, errorMessage, save, scope, successMessage],
  );

  const scheduleSave = useCallback(
    (nextValue: T) => {
      pendingValueRef.current = nextValue;
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      if (debounceMs > 0) {
        timerRef.current = window.setTimeout(() => {
          void runSave(pendingValueRef.current);
        }, debounceMs);
        return;
      }

      void runSave(nextValue);
    },
    [debounceMs, runSave],
  );

  const setValue = useCallback(
    (next: SetValueAction<T>) => {
      if (disabled) return;

      const nextValue =
        typeof next === "function"
          ? (next as (previous: T) => T)(currentValueRef.current)
          : next;

      currentValueRef.current = nextValue;
      pendingValueRef.current = nextValue;
      setValueState(nextValue);
      setStatus("dirty");
      setError(null);
      scheduleSave(nextValue);
    },
    [disabled, scheduleSave],
  );

  const flush = useCallback(async () => {
    return runSave(pendingValueRef.current);
  }, [runSave]);

  void key;

  return {
    value,
    setValue,
    flush,
    status,
    error,
  };
}
