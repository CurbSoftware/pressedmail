import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";

import { useUnsavedChangesGuard } from "./use-unsaved-changes-guard";

export interface SettingsNavigationGuardState {
  dirty: boolean;
  saving?: boolean;
  onSave?: () => Promise<boolean | void> | boolean | void;
}

interface SettingsNavigationGuardContextValue {
  registerGuard: (guard: SettingsNavigationGuardState) => () => void;
  guardedAction: (action: () => void) => void;
}

const cleanGuard: SettingsNavigationGuardState = {
  dirty: false,
};

const SettingsNavigationGuardContext =
  createContext<SettingsNavigationGuardContextValue | null>(null);

export function SettingsNavigationGuardProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [activeGuard, setActiveGuard] =
    useState<SettingsNavigationGuardState>(cleanGuard);

  const { guardedAction, guardDialog } = useUnsavedChangesGuard({
    dirty: activeGuard.dirty,
    saving: activeGuard.saving,
    onSave: activeGuard.onSave,
  });

  const registerGuard = useCallback((guard: SettingsNavigationGuardState) => {
    setActiveGuard(guard);

    return () => {
      setActiveGuard(cleanGuard);
    };
  }, []);

  const value = useMemo(
    () => ({ registerGuard, guardedAction }),
    [guardedAction, registerGuard],
  );

  return (
    <SettingsNavigationGuardContext.Provider value={value}>
      {children}
      {guardDialog}
    </SettingsNavigationGuardContext.Provider>
  );
}

export function useSettingsNavigationGuard(
  guard: SettingsNavigationGuardState,
) {
  const context = useContext(SettingsNavigationGuardContext);
  const { dirty, onSave, saving } = guard;

  // A save handler almost always closes over the draft, so it is a new function
  // on every keystroke. Registering it directly would re-run this effect that
  // often, and each run unregisters first, which drops the navigation the
  // dialog is holding: the user clicks Discard and nothing happens. Hold it in
  // a ref and register a stable wrapper, so the effect only re-runs when the
  // two things the dialog actually reads change.
  const onSaveRef = useRef(onSave);
  onSaveRef.current = onSave;

  const stableOnSave = useCallback(() => onSaveRef.current?.(), []);

  // Only whether a save handler exists can change what the dialog offers, so
  // that is what the effect depends on rather than the handler's identity.
  const hasSave = Boolean(onSave);

  useEffect(() => {
    if (!context) {
      return;
    }

    return context.registerGuard({
      dirty,
      saving,
      onSave: hasSave ? stableOnSave : undefined,
    });
  }, [context, dirty, saving, stableOnSave, hasSave]);
}

export function useSettingsGuardedAction() {
  const context = useContext(SettingsNavigationGuardContext);

  return context?.guardedAction ?? ((action: () => void) => action());
}
