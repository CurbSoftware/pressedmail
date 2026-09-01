/**
 * Imperative bridge for the custom Media Library popup.
 *
 * Renders ONE {@link MediaLibraryDialog} and exposes an `await`-able
 * `openMediaPicker(opts)` (via {@link useMediaLibraryPicker}) that resolves with
 * the chosen media, mirroring the old `openWordPressMediaFrame` Promise API
 * (including its "Media selection cancelled." rejection on close) so the
 * composer's call sites barely change.
 *
 * Mount ABOVE <ComposeForm> (ComposePane / MobileComposeScreen) so both the form
 * hook and the editor can consume it.
 */

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MediaLibraryDialog } from "./MediaLibraryDialog";
import type { MediaPickerSelection } from "@/services/media-library.service";

export const MEDIA_PICKER_CANCELLED = "Media selection cancelled.";

export interface OpenMediaPickerOptions {
  mode: "image" | "all";
  multiple?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
}

interface MediaLibraryPickerContextValue {
  openMediaPicker: (
    options: OpenMediaPickerOptions,
  ) => Promise<MediaPickerSelection[]>;
}

const MediaLibraryPickerContext =
  createContext<MediaLibraryPickerContextValue | null>(null);

// Stable no-op for when no provider is mounted: rejects as "cancelled" (the
// call sites swallow that), so a missing provider degrades quietly.
const NOOP_VALUE: MediaLibraryPickerContextValue = {
  openMediaPicker: () => Promise.reject(new Error(MEDIA_PICKER_CANCELLED)),
};

type Pending = {
  resolve: (selected: MediaPickerSelection[]) => void;
  reject: (reason: unknown) => void;
};

export function MediaLibraryPickerProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<OpenMediaPickerOptions | null>(null);
  const [sessionId, setSessionId] = useState(0);
  const pendingRef = useRef<Pending | null>(null);

  const openMediaPicker = useCallback(
    (opts: OpenMediaPickerOptions) =>
      new Promise<MediaPickerSelection[]>((resolve, reject) => {
        // A picker already open? Cancel it before opening the next.
        if (pendingRef.current) {
          pendingRef.current.reject(new Error(MEDIA_PICKER_CANCELLED));
        }
        pendingRef.current = { resolve, reject };
        setSessionId((current) => current + 1);
        setOptions(opts);
        setOpen(true);
      }),
    [],
  );

  const handleConfirm = useCallback((selected: MediaPickerSelection[]) => {
    const pending = pendingRef.current;
    pendingRef.current = null;
    pending?.resolve(selected);
  }, []);

  const handleOpenChange = useCallback((next: boolean) => {
    setOpen(next);
    if (!next) {
      // Closed without a confirm → cancelled (the confirm path already nulled
      // pendingRef, so this only fires for a real cancel/escape/backdrop close).
      const pending = pendingRef.current;
      pendingRef.current = null;
      pending?.reject(new Error(MEDIA_PICKER_CANCELLED));
    }
  }, []);

  const value = useMemo(() => ({ openMediaPicker }), [openMediaPicker]);

  return (
    <MediaLibraryPickerContext.Provider value={value}>
      {children}
      {options ? (
        <MediaLibraryDialog
          key={sessionId}
          open={open}
          onOpenChange={handleOpenChange}
          mode={options.mode}
          multiple={options.multiple}
          title={options.title}
          description={options.description}
          confirmLabel={options.confirmLabel}
          onConfirm={handleConfirm}
        />
      ) : null}
    </MediaLibraryPickerContext.Provider>
  );
}

export function useMediaLibraryPicker(): MediaLibraryPickerContextValue {
  return useContext(MediaLibraryPickerContext) ?? NOOP_VALUE;
}
