'use client';

import { useCallback, useMemo, useState } from 'react';

interface UseAsyncDialogOptions {
  /**
   * External controlled open state (optional).
   * If not provided, the hook manages its own internal state.
   */
  open?: boolean;
  /**
   * External controlled onOpenChange callback (optional).
   * If not provided, the hook manages its own internal state.
   */
  onOpenChange?: (open: boolean) => void;
}

interface UseAsyncDialogReturn {
  /** Whether the dialog is open */
  open: boolean;
  /** Guarded setOpen - blocks closure when isPending is true */
  setOpen: (open: boolean) => void;
  /** Whether an async operation is in progress */
  isPending: boolean;
  /** Set pending state - call from action callbacks */
  setIsPending: (pending: boolean) => void;
  /** Props to spread on Dialog component */
  dialogProps: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    disablePointerDismissal: true;
  };
}

/**
 * Hook for managing dialog state with async operation protection.
 *
 * Prevents dialog from closing (via Escape or backdrop click) while
 * an async operation is in progress.
 *
 * @example
 * ```tsx
 * function MyDialog({ open, onOpenChange }) {
 *   const { dialogProps, isPending, setIsPending } = useAsyncDialog({ open, onOpenChange });
 *
 *   const { execute } = useAction(myAction, {
 *     onExecute: () => setIsPending(true),
 *     onSettled: () => setIsPending(false),
 *   });
 *
 *   return (
 *     <Dialog {...dialogProps}>
 *       <Button disabled={isPending}>Submit</Button>
 *     </Dialog>
 *   );
 * }
 * ```
 */
export function useAsyncDialog(
  options: UseAsyncDialogOptions = {},
): UseAsyncDialogReturn {
  const { open: externalOpen, onOpenChange: externalOnOpenChange } = options;

  const [internalOpen, setInternalOpen] = useState(false);
  const [isPending, setIsPending] = useState(false);

  const isControlled = externalOpen !== undefined;
  const open = isControlled ? externalOpen : internalOpen;

  const setOpen = useCallback(
    (newOpen: boolean) => {
      // Block closure during async operation
      if (!newOpen && isPending) return;

      if (isControlled && externalOnOpenChange) {
        externalOnOpenChange(newOpen);
      } else {
        setInternalOpen(newOpen);
      }
    },
    [isPending, isControlled, externalOnOpenChange],
  );

  const dialogProps = useMemo(
    () =>
      ({
        open,
        onOpenChange: setOpen,
        disablePointerDismissal: true,
      }) as const,
    [open, setOpen],
  );

  return {
    open,
    setOpen,
    isPending,
    setIsPending,
    dialogProps,
  };
}
