"use client";

import {
  createContext,
  Fragment,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

interface SettingsHeaderActionEntry {
  element: ReactNode;
  order: number;
}

interface SettingsHeaderActionsContextValue {
  registerAction: (key: string, entry: SettingsHeaderActionEntry) => void;
  unregisterAction: (key: string) => void;
}

interface SettingsHeaderActionsProviderProps {
  children: ReactNode;
  onActionsChange: (actions: ReactNode | null) => void;
}

const SettingsHeaderActionsContext =
  createContext<SettingsHeaderActionsContextValue | null>(null);

function renderActions(actions: Record<string, SettingsHeaderActionEntry>) {
  const entries = Object.entries(actions)
    .filter(([, entry]) => Boolean(entry.element))
    .sort(([, a], [, b]) => a.order - b.order);

  if (entries.length === 0) {
    return null;
  }

  return (
    <>
      {entries.map(([key, entry]) => (
        <Fragment key={key}>{entry.element}</Fragment>
      ))}
    </>
  );
}

export function SettingsHeaderActionsProvider({
  children,
  onActionsChange,
}: SettingsHeaderActionsProviderProps) {
  const [actions, setActions] = useState<
    Record<string, SettingsHeaderActionEntry>
  >({});

  const registerAction = useCallback(
    (key: string, entry: SettingsHeaderActionEntry) => {
      setActions((current) => {
        const existing = current[key];

        if (
          existing?.element === entry.element &&
          existing?.order === entry.order
        ) {
          return current;
        }

        return {
          ...current,
          [key]: entry,
        };
      });
    },
    [],
  );

  const unregisterAction = useCallback((key: string) => {
    setActions((current) => {
      if (!(key in current)) {
        return current;
      }

      const next = { ...current };
      delete next[key];
      return next;
    });
  }, []);

  const contextValue = useMemo(
    () => ({ registerAction, unregisterAction }),
    [registerAction, unregisterAction],
  );

  useEffect(() => {
    onActionsChange(renderActions(actions));
  }, [actions, onActionsChange]);

  useEffect(() => {
    return () => onActionsChange(null);
  }, [onActionsChange]);

  return (
    <SettingsHeaderActionsContext.Provider value={contextValue}>
      {children}
    </SettingsHeaderActionsContext.Provider>
  );
}

export function useSettingsHeaderAction(
  key: string,
  element: ReactNode | null,
  order = 0,
) {
  const context = useContext(SettingsHeaderActionsContext);

  useEffect(() => {
    if (!context || !element) {
      return undefined;
    }

    context.registerAction(key, { element, order });
    return () => context.unregisterAction(key);
  }, [context, element, key, order]);

  return Boolean(context);
}
