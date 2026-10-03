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
import { Button } from "@kit/ui/plugin";

import { notifyAutosaveError } from "@/hooks/useAutosaveSetting";
import { useWarnIfBusy } from "@/hooks/useWarnIfBusy";
import { UnsavedChangesDialog } from "./unsaved-changes-dialog";

const fallbackDataRouterContext = createContext<unknown>(null);

type PendingBlocker = {
  state?: string;
  proceed?: () => void;
  reset?: () => void;
};

type BlockedNavigation = {
  currentLocation: ReactRouter.Location;
  nextLocation: ReactRouter.Location;
  historyAction?: "POP" | "PUSH" | "REPLACE";
};

interface UnsavedRouteBlockerProps {
  shouldBlock: (navigation: BlockedNavigation) => boolean;
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
  const navigate = ReactRouter.useNavigate();
  const historyActionRef =
    useRef<BlockedNavigation["historyAction"]>(undefined);
  // Browser routers index native history entries; memory routers do not.
  const readHistoryIndex = () => {
    const index: unknown = window.history.state?.idx;
    return typeof index === "number" && Number.isInteger(index) ? index : null;
  };
  const popTargetIndexRef = useRef<number | null>(null);
  const replayTargetRef = useRef<ReactRouter.Location | null>(null);
  const blocker = ReactRouter.useBlocker((navigation) => {
    const replay = replayTargetRef.current;
    if (
      replay &&
      replay.pathname === navigation.nextLocation.pathname &&
      replay.search === navigation.nextLocation.search &&
      replay.hash === navigation.nextLocation.hash
    ) {
      replayTargetRef.current = null;
      return false;
    }
    const blocked = shouldBlock(navigation);
    if (blocked) {
      historyActionRef.current = navigation.historyAction;
      const nextIndex = readHistoryIndex();
      popTargetIndexRef.current =
        navigation.historyAction === "POP" ? nextIndex : null;
    }
    return blocked;
  });
  const currentBlockerRef = useRef(blocker);
  currentBlockerRef.current = blocker;

  useEffect(() => {
    if (blocker.state === "blocked") {
      const target = blocker.location;
      const historyAction = historyActionRef.current;
      const popTargetIndex = popTargetIndexRef.current;
      onBlocked({
        state: blocker.state,
        reset: () => {
          if (currentBlockerRef.current.state === "blocked") {
            currentBlockerRef.current.reset();
          }
        },
        proceed: () => {
          const current = currentBlockerRef.current;
          if (
            current.state === "blocked" &&
            current.location.key === target.key
          ) {
            current.proceed();
          } else {
            // An allowed view-only navigation releases React Router's blocker.
            // Keep the refused-save destination usable without calling a stale
            // proceed function (an invalid unblocked -> proceeding transition).
            replayTargetRef.current = target;
            const currentIndex = readHistoryIndex();
            if (
              historyAction === "POP" &&
              popTargetIndex !== null &&
              currentIndex !== null
            ) {
              const delta = popTargetIndex - currentIndex;
              if (delta !== 0) navigate(delta);
              else navigate(target, { state: target.state, replace: true });
            } else
              navigate(target, {
                state: target.state,
                replace: historyAction === "REPLACE",
              });
          }
        },
      });
    }
  }, [blocker, navigate, onBlocked]);

  return null;
}

const NO_VIEW_PARAMS: readonly string[] = [];

/**
 * Whether a navigation only changes which view of the same page shows: the
 * path is the same and so is every search parameter but the view ones.
 */
function changesOnlyView(
  { currentLocation, nextLocation }: BlockedNavigation,
  viewParams: readonly string[],
): boolean {
  if (
    viewParams.length === 0 ||
    currentLocation.pathname !== nextLocation.pathname
  ) {
    return false;
  }

  const rest = (search: string) => {
    const params = new URLSearchParams(search);
    viewParams.forEach((name) => params.delete(name));
    params.sort();
    return params.toString();
  };

  return rest(currentLocation.search) === rest(nextLocation.search);
}

interface UseUnsavedChangesGuardOptions {
  dirty: boolean;
  saving?: boolean;
  blockRouterNavigation?: boolean;
  /**
   * Search parameters that only choose which view of the page shows, such as an
   * inner tab. Changing nothing but these keeps the page and everything
   * staged on it, so the router is not stopped for it. Pass a list that does
   * not change between renders.
   */
  viewParams?: readonly string[];
  onDiscard?: () => void;
  onSave?: () => Promise<boolean | void> | boolean | void;
  /** Keep the route/action for a visible retry after returning to the save errors. */
  retainPendingOnSaveFailure?: boolean;
}

interface UseUnsavedChangesGuardResult {
  guardedAction: (action: () => void) => void;
  guardDialog: ReactNode;
}

export function useUnsavedChangesGuard({
  dirty,
  saving = false,
  blockRouterNavigation = true,
  viewParams = NO_VIEW_PARAMS,
  onDiscard,
  onSave,
  retainPendingOnSaveFailure = false,
}: UseUnsavedChangesGuardOptions): UseUnsavedChangesGuardResult {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [savingInternally, setSavingInternally] = useState(false);
  const [pendingRecovery, setPendingRecovery] = useState(false);
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
    setPendingRecovery(false);
  }, [clearPending]);

  const replayPending = useCallback(() => {
    const action = pendingActionRef.current;
    const blocker = pendingBlockerRef.current;

    clearPending();
    setDialogOpen(false);
    setPendingRecovery(false);

    if (blocker?.proceed || action) {
      replayingActionRef.current = true;
      try {
        if (blocker?.proceed) blocker.proceed();
        else action?.();
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

    let saved: boolean;
    try {
      saved = (await onSave()) !== false;
    } catch (error) {
      // A save that answered "no" has put its reasons on the page. One that threw
      // has not, and the dialog is about to close, so this is the only word the
      // admin gets that their changes did not go.
      console.error("Saving from the unsaved changes dialog failed:", error);
      notifyAutosaveError(__("Could not save your changes", "pressedmail"));
      saved = false;
    } finally {
      if (isCurrentSave()) {
        saveInFlightRef.current = false;
        setSavingInternally(false);
      }
    }

    if (!isCurrentSave()) {
      return;
    }

    if (saved) {
      replayPending();
    } else {
      // A refused save has its reasons on the page, behind this dialog, and a
      // modal would keep them out of reach. Nothing is discarded and nothing
      // navigates: the admin is back where they were, with the draft and the
      // reasons in front of them.
      if (retainPendingOnSaveFailure) {
        // Let the writer reach the field/error behind the modal without losing
        // the blocked destination. Only an explicit Stay cancels that intent.
        setDialogOpen(false);
        setPendingRecovery(true);
      } else {
        handleStay();
      }
    }
  }, [handleStay, onSave, replayPending, retainPendingOnSaveFailure, saving]);

  const guardedAction = useCallback(
    (action: () => void) => {
      if (!dirty) {
        action();
        return;
      }

      pendingBlockerRef.current?.reset?.();
      pendingBlockerRef.current = null;
      pendingActionRef.current = action;
      setPendingRecovery(false);
      setDialogOpen(true);
    },
    [dirty],
  );

  const handleBlocked = useCallback((blocker: PendingBlocker) => {
    pendingActionRef.current = null;
    pendingBlockerRef.current = blocker;
    setPendingRecovery(false);
    setDialogOpen(true);
  }, []);

  const shouldBlockRouterNavigation = useCallback(
    (navigation: BlockedNavigation) =>
      dirty &&
      !replayingActionRef.current &&
      !changesOnlyView(navigation, viewParams),
    [dirty, viewParams],
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
        {pendingRecovery ? (
          <div
            role="status"
            className="space-y-2 border-b border-border p-3 text-sm">
            <p>
              {__(
                "Navigation is paused. Save your changes to leave, or stay to keep editing.",
                "pressedmail",
              )}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                className="pointer-coarse:min-h-11"
                onClick={handleStay}
                disabled={saving || savingInternally}
                data-testid="unsaved-changes-stay">
                {__("Stay", "pressedmail")}
              </Button>
              <Button
                type="button"
                variant="outline"
                className="pointer-coarse:min-h-11"
                onClick={handleDiscard}
                disabled={saving || savingInternally}
                data-testid="unsaved-changes-discard">
                {__("Discard changes", "pressedmail")}
              </Button>
              {onSave ? (
                <Button
                  type="button"
                  className="pointer-coarse:min-h-11"
                  onClick={() => void handleSave()}
                  disabled={saving || savingInternally}
                  data-testid="unsaved-changes-save">
                  {__("Save changes and leave", "pressedmail")}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}
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
      pendingRecovery,
      saving,
      savingInternally,
      shouldBlockRouterNavigation,
    ],
  );

  return { guardedAction, guardDialog };
}
