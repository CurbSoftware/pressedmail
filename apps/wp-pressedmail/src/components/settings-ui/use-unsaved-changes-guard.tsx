import { __ } from "@wordpress/i18n";
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
import * as ReactRouter from "react-router-dom";

import { useWarnIfBusy } from "@/hooks/useWarnIfBusy";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

const fallbackDataRouterContext = createContext<unknown>(null);

type PendingBlocker = {
  state?: string;
  proceed?: () => void;
  reset?: () => void;
};

interface UnsavedRouteBlockerProps {
  shouldBlock: () => boolean;
  onBlocked: (blocker: PendingBlocker) => void;
}

function UnsavedRouteBlocker({
  shouldBlock,
  onBlocked,
}: UnsavedRouteBlockerProps) {
  const dataRouterContextValue =
    "UNSAFE_DataRouterContext" in ReactRouter
      ? (
          ReactRouter as typeof ReactRouter & {
            UNSAFE_DataRouterContext?: React.Context<unknown>;
          }
        ).UNSAFE_DataRouterContext
      : fallbackDataRouterContext;
  const dataRouterContext = useContext(
    dataRouterContextValue ?? fallbackDataRouterContext,
  );

  if (!dataRouterContext) {
    return null;
  }

  return (
    <UnsavedDataRouteBlocker shouldBlock={shouldBlock} onBlocked={onBlocked} />
  );
}

function UnsavedDataRouteBlocker({
  shouldBlock,
  onBlocked,
}: UnsavedRouteBlockerProps) {
  const blocker = ReactRouter.useBlocker(shouldBlock);

  useEffect(() => {
    if (blocker.state === "blocked") {
      onBlocked(blocker);
    }
  }, [blocker, onBlocked]);

  return null;
}

interface UseUnsavedChangesGuardOptions {
  dirty: boolean;
  saving?: boolean;
  blockRouterNavigation?: boolean;
  onDiscard?: () => void;
  onSave?: () => Promise<boolean | void> | boolean | void;
}

interface UseUnsavedChangesGuardResult {
  guardedAction: (action: () => void) => void;
  guardDialog: ReactNode;
}

export function useUnsavedChangesGuard({
  dirty,
  saving = false,
  blockRouterNavigation = true,
  onDiscard,
  onSave,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingInternally, setSavingInternally] = useState(false);
  const pendingActionRef = useRef<(() => void) | null>(null);
  const pendingBlockerRef = useRef<PendingBlocker | null>(null);
  const replayingActionRef = useRef(false);
  const saveInFlightRef = useRef(false);
  const saveGenerationRef = useRef(0);
  const mountedRef = useRef(true);

  useWarnIfBusy(dirty, __("You have unsaved changes.", "pressedmail"));

  const clearPending = useCallback(() => {
    pendingActionRef.current = null;
    pendingBlockerRef.current = null;
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      saveGenerationRef.current += 1;
      saveInFlightRef.current = false;
      clearPending();
    };
  }, [clearPending]);

  const handleStay = useCallback(() => {
    pendingBlockerRef.current?.reset?.();
    clearPending();
    setDialogOpen(false);
  }, [clearPending]);

  const replayPending = useCallback(() => {
    const action = pendingActionRef.current;
    const blocker = pendingBlockerRef.current;

    clearPending();
    setDialogOpen(false);

    if (blocker?.proceed) {
      blocker.proceed();
      return;
    }

    if (action) {
      replayingActionRef.current = true;
      try {
        action();
      } finally {
        replayingActionRef.current = false;
      }
    }
  }, [clearPending]);

  const handleDiscard = useCallback(() => {
    onDiscard?.();
    replayPending();
  }, [onDiscard, replayPending]);

  const handleSave = useCallback(async () => {
    if (!onSave || saving || saveInFlightRef.current) {
      return;
    }

    saveInFlightRef.current = true;
    const saveGeneration = ++saveGenerationRef.current;
    setSavingInternally(true);
    const isCurrentSave = () =>
      mountedRef.current && saveGenerationRef.current === saveGeneration;

    let shouldReplay: boolean;
    try {
      const result = await onSave();
      shouldReplay = result !== false;
    } catch {
      return;
    } finally {
      if (isCurrentSave()) {
        saveInFlightRef.current = false;
        setSavingInternally(false);
      }
    }

    if (shouldReplay && isCurrentSave()) {
      replayPending();
    }
  }, [onSave, replayPending, saving]);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (!dirty) {
        action();
        return;
      }

      pendingActionRef.current = action;
      setDialogOpen(true);
    },
    [dirty],
  );

  const handleBlocked = useCallback((blocker: PendingBlocker) => {
    pendingBlockerRef.current = blocker;
    setDialogOpen(true);
  }, []);

  const shouldBlockRouterNavigation = useCallback(
    () => dirty && !replayingActionRef.current,
    [dirty],
  );

  const guardDialog = useMemo(
    () => (
      <>
        {blockRouterNavigation ? (
          <UnsavedRouteBlocker
            shouldBlock={shouldBlockRouterNavigation}
            onBlocked={handleBlocked}
          />
        ) : null}
        <UnsavedChangesDialog
          open={dialogOpen}
          saving={saving || savingInternally}
          onStay={handleStay}
          onDiscard={handleDiscard}
          onSave={onSave ? handleSave : undefined}
        />
      </>
    ),
    [
      blockRouterNavigation,
      dialogOpen,
      dirty,
      handleBlocked,
      handleDiscard,
      handleSave,
      handleStay,
      onSave,
      saving,
      savingInternally,
      shouldBlockRouterNavigation,
    ],
  );

  return { guardedAction, guardDialog };
}
