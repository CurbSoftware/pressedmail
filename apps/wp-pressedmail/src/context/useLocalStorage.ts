import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
  Dispatch,
  SetStateAction,
} from "react";

import {
  captureStoragePrincipal,
  getPrincipalStorageItem,
  setPrincipalStorageItem,
  removePrincipalStorageItem,
  getPrincipalStorageKey,
  isStoragePrincipalCurrent,
} from "@/lib/principal-storage";

const prefixedKey = "pressedmail-";

// Module-level counter for generating unique instance IDs
// This avoids calling Math.random() during render, satisfying React purity rules
let instanceCounter = 0;

export interface UseLocalStorageOptions<T> {
  principalScoped?: boolean;
  /** Map an in-memory value to its JSON-safe persisted representation. */
  toStorage?: (value: T) => unknown;
  /** Notify the owner before another hook or tab replaces the value. */
  onExternalChange?: () => void;
}

/**
 * Custom hook for persistent state in localStorage
 * @param key - Storage key (will be prefixed with "pressedmail-")
 * @param initialValue - Initial value or function that returns initial value
 * @param options - Optional persistence serializer
 * @returns Tuple of [value, setValue] similar to useState
 */
export default function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  options?: UseLocalStorageOptions<T>,
): [T, Dispatch<SetStateAction<T>>] {
  const logicalKey = prefixedKey + key;
  const scoped = options?.principalScoped === true;
  const principal = useMemo(() => captureStoragePrincipal(), []);
  const prefixedKeyCombined = scoped
    ? getPrincipalStorageKey(logicalKey, principal)
    : logicalKey;

  // Unique instance ID to prevent handling our own events
  // Uses useMemo with empty deps to generate ID only once per hook instance

  const instanceId = useMemo(() => `instance-${++instanceCounter}`, []);

  // Helper to read from localStorage
  const readValue = useCallback((): T => {
    let storedValue: string | null = null;
    try {
      storedValue = scoped
        ? getPrincipalStorageItem("local", logicalKey, principal)
        : localStorage.getItem(logicalKey);
    } catch {
      /* Storage can be disabled. Keep the in-memory value usable. */
    }
    let data: T | null;

    // Try to parse JSON, fallback to raw value
    try {
      data = storedValue !== null ? JSON.parse(storedValue) : null;
    } catch {
      // If parsing fails, use the raw string value
      data = storedValue as unknown as T;
    }

    // Return stored value if exists
    if (data != null) return data;

    // Return initial value (either direct value or result of function)
    if (typeof initialValue === "function") {
      return (initialValue as () => T)();
    } else {
      return initialValue;
    }
  }, [scoped, logicalKey, principal, initialValue]);

  const [value, setValue] = useState<T>(readValue);
  const previousKey = useRef(logicalKey);
  if (previousKey.current !== logicalKey) {
    previousKey.current = logicalKey;
    setValue(readValue());
  }

  // Write to localStorage when value changes
  const toStorage = options?.toStorage;
  const onExternalChange = options?.onExternalChange;
  useEffect(() => {
    try {
      // Clearing is a write too. Skipping it left the previous value in
      // storage, so the next mount read it straight back: removing an account
      // set selectedAccount to null and the removed account returned on
      // reload, which is what AppProvider's "stale localStorage" repair effect
      // was cleaning up after.
      if (value == null) {
        if (scoped) removePrincipalStorageItem("local", logicalKey, principal);
        else localStorage.removeItem(logicalKey);
        return;
      }
      const serialized = JSON.stringify(toStorage ? toStorage(value) : value);
      if (scoped)
        setPrincipalStorageItem("local", logicalKey, serialized, principal);
      else localStorage.setItem(logicalKey, serialized);
    } catch {
      /* Quota failures do not prevent editing. */
    }
  }, [scoped, logicalKey, principal, value, toStorage]);

  // Listen for storage events to sync across components/tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (prefixedKeyCombined && event.key === prefixedKeyCombined) {
        if (scoped && !isStoragePrincipalCurrent(principal)) return;
        if (event.newValue === null) {
          onExternalChange?.();
          setValue(readValue());
          return;
        }
        try {
          const newValue = JSON.parse(event.newValue) as T;
          onExternalChange?.();
          setValue(newValue);
        } catch {
          onExternalChange?.();
          setValue(event.newValue as unknown as T);
        }
      }
    };

    // Listen for storage events (cross-tab sync)
    window.addEventListener("storage", handleStorageChange);

    // Also create a custom event listener for same-tab sync
    // Ignore events from our own instance to prevent double updates
    const handleCustomStorageChange = (
      event: CustomEvent<{ key: string; value: T; sourceId?: string }>,
    ) => {
      if (
        prefixedKeyCombined &&
        event.detail.key === prefixedKeyCombined &&
        (!scoped || isStoragePrincipalCurrent(principal)) &&
        event.detail.sourceId !== instanceId
      ) {
        onExternalChange?.();
        setValue(event.detail.value);
      }
    };

    window.addEventListener(
      "pressedmail-storage-change" as keyof WindowEventMap,
      handleCustomStorageChange as EventListener,
    );

    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "pressedmail-storage-change" as keyof WindowEventMap,
        handleCustomStorageChange as EventListener,
      );
    };
  }, [
    prefixedKeyCombined,
    instanceId,
    onExternalChange,
    scoped,
    principal,
    readValue,
  ]);

  // Custom setValue that also dispatches custom event for same-tab sync
  const setValueWithSync: Dispatch<SetStateAction<T>> = useCallback(
    (newValue) => {
      setValue((prev) => {
        const resolvedValue =
          typeof newValue === "function"
            ? (newValue as (prev: T) => T)(prev)
            : newValue;

        // Defer custom event dispatch to avoid updating other components during render.
        // Using queueMicrotask ensures the event fires after the current render cycle.
        queueMicrotask(() => {
          if (
            !prefixedKeyCombined ||
            (scoped && !isStoragePrincipalCurrent(principal))
          )
            return;
          window.dispatchEvent(
            new CustomEvent("pressedmail-storage-change", {
              detail: {
                key: prefixedKeyCombined,
                value: resolvedValue,
                sourceId: instanceId,
              },
            }),
          );
        });

        return resolvedValue;
      });
    },
    [prefixedKeyCombined, instanceId, scoped, principal],
  );

  return [value, setValueWithSync];
}
