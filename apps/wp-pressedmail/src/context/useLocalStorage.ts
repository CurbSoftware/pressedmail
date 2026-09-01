import {
  useState,
  useEffect,
  useCallback,
  useMemo,
  Dispatch,
  SetStateAction,
} from "react";

const prefixedKey = "pressedmail-";

// Module-level counter for generating unique instance IDs
// This avoids calling Math.random() during render, satisfying React purity rules
let instanceCounter = 0;

export interface UseLocalStorageOptions<T> {
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
  const prefixedKeyCombined = prefixedKey + key;

  // Unique instance ID to prevent handling our own events
  // Uses useMemo with empty deps to generate ID only once per hook instance

  const instanceId = useMemo(() => `instance-${++instanceCounter}`, []);

  // Helper to read from localStorage
  const readValue = useCallback((): T => {
    const storedValue = localStorage.getItem(prefixedKeyCombined);
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
  }, [prefixedKeyCombined, initialValue]);

  const [value, setValue] = useState<T>(readValue);

  // Write to localStorage when value changes
  const toStorage = options?.toStorage;
  const onExternalChange = options?.onExternalChange;
  useEffect(() => {
    if (value == null) return;
    localStorage.setItem(
      prefixedKeyCombined,
      JSON.stringify(toStorage ? toStorage(value) : value),
    );
  }, [prefixedKeyCombined, value, toStorage]);

  // Listen for storage events to sync across components/tabs
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === prefixedKeyCombined && event.newValue !== null) {
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
        event.detail.key === prefixedKeyCombined &&
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
  }, [prefixedKeyCombined, instanceId, onExternalChange]);

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
    [prefixedKeyCombined, instanceId],
  );

  return [value, setValueWithSync];
}
