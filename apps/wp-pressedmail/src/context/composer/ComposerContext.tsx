import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useRef,
} from "react";
import type { ComposeData } from "@/types";
import useLocalStorage from "@/context/useLocalStorage";

export const DEFAULT_COMPOSE_DATA: ComposeData & { is_reply?: boolean } = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
  mode: "new",
  attachments: [],
  draftUid: undefined,
  draftFolder: undefined,
  draftAccountId: undefined,
  draftUidValidity: undefined,
  draftMessageId: undefined,
  inReplyTo: undefined,
  references: undefined,
  draftAttachmentManifestComplete: undefined,
  scheduledEmailId: undefined,
  scheduledAccountId: undefined,
  scheduledAt: undefined,
  is_reply: false,
};

const COMPOSE_DRAFT_STORAGE = {
  toStorage: (value: ComposeData & { is_reply?: boolean }) => ({
    ...value,
    // Browser File objects are intentionally memory-only. JSON serializes them
    // as `{}`, which reloads as a ghost attachment that cannot be sent.
    attachments: (value.attachments ?? []).filter(
      (attachment) =>
        typeof File === "undefined" || !(attachment instanceof File),
    ),
  }),
};

interface ComposerContextType {
  // Window state
  isOpen: boolean;
  isMinimized: boolean;
  isMaximized: boolean;
  openComposer: () => void;
  closeComposer: () => void;
  toggleMinimize: () => void;
  toggleMaximize: () => void;

  // Compose data (persisted to localStorage)
  composeData: ComposeData & { is_reply?: boolean };
  setComposeData: React.Dispatch<
    React.SetStateAction<ComposeData & { is_reply?: boolean }>
  >;
  getComposeSessionVersion: () => number;
  queueDraftSave: (
    composeSessionVersion: number,
    save: (
      latestSavedDraft: ComposerDraftSaveResult | null,
    ) => Promise<ComposerDraftSaveResult>,
  ) => Promise<ComposerDraftSaveResult>;
  drainDraftSaves: (
    composeSessionVersion: number,
  ) => Promise<ComposerDraftSaveDrain>;
  replaceBodyAndContentType: (
    body: string,
    contentType: NonNullable<ComposeData["contentType"]>,
  ) => void;
  isSending: boolean;
  setIsSending: React.Dispatch<React.SetStateAction<boolean>>;
  resetComposeData: () => void;

  // Navigation guard: lets a mounted composer intercept outside navigation
  // (e.g. clicking a different email in the list, a route change, or a
  // wp-admin link) so it can prompt for unsaved changes or auto-save before
  // allowing the action to proceed. `onCancel` runs when the user chooses to
  // keep editing (needed by router blockers to reset their blocked state).
  registerNavigationGuard: (
    guard: (request: NavigationRequest) => void,
  ) => () => void;
  requestNavigation: (
    action: () => void,
    options?: { onCancel?: () => void },
  ) => void;

  // Dirty probe for global navigation blockers: the mounted compose form
  // registers a checker; blockers call isComposeDirty() lazily at nav time.
  registerDirtyChecker: (checker: () => boolean) => () => void;
  isComposeDirty: () => boolean;

  // The mounted pane composer's Delete, for toolbars outside the composer.
  registerDeleteHandler: (handler: () => void) => () => void;
  requestDelete: () => void;
}

export interface ComposerDraftSaveResult {
  ok: boolean;
  draft: {
    draft_uid: string;
    draft_folder: string;
    draft_uidvalidity: string;
    draft_message_id: string;
    draft_account_id: number;
  } | null;
  attachmentParts?: Record<string, string>;
  savedSnapshot?: string;
}

interface ComposerDraftSaveDrain {
  completed: ComposerDraftSaveResult | null;
  latestSavedDraft: ComposerDraftSaveResult | null;
}

interface ComposerDraftSaveQueue {
  composeSessionVersion: number;
  tail: Promise<ComposerDraftSaveResult> | null;
  latestSavedDraft: ComposerDraftSaveResult | null;
}

export interface NavigationRequest {
  action: () => void;
  onCancel?: () => void;
}

const ComposerContext = createContext<ComposerContextType | undefined>(
  undefined,
);

export function ComposerProvider({ children }: { children: React.ReactNode }) {
  // Window state
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  // Compose data (moved from MessagesProvider)
  const composeSessionVersionRef = useRef(0);
  const advanceExternalComposeSession = useCallback(() => {
    composeSessionVersionRef.current += 1;
  }, []);
  const [composeData, setStoredComposeData] = useLocalStorage<
    ComposeData & { is_reply?: boolean }
  >("compose-draft", DEFAULT_COMPOSE_DATA, {
    ...COMPOSE_DRAFT_STORAGE,
    principalScoped: true,
    onExternalChange: advanceExternalComposeSession,
  });
  const setComposeData = useCallback<
    React.Dispatch<React.SetStateAction<ComposeData & { is_reply?: boolean }>>
  >(
    (next) => {
      // Full values open, replace, or clear a compose session. Field edits use
      // functional updaters and keep ownership of the current session.
      if (typeof next !== "function") {
        composeSessionVersionRef.current += 1;
      }
      setStoredComposeData(next);
    },
    [setStoredComposeData],
  );
  const getComposeSessionVersion = useCallback(
    () => composeSessionVersionRef.current,
    [],
  );
  const draftSaveQueueRef = useRef<ComposerDraftSaveQueue | null>(null);
  const queueDraftSave = useCallback(
    (
      composeSessionVersion: number,
      save: (
        latestSavedDraft: ComposerDraftSaveResult | null,
      ) => Promise<ComposerDraftSaveResult>,
    ) => {
      let queue = draftSaveQueueRef.current;
      if (!queue || queue.composeSessionVersion !== composeSessionVersion) {
        queue = {
          composeSessionVersion,
          tail: null,
          latestSavedDraft: null,
        };
        draftSaveQueueRef.current = queue;
      }

      const activeQueue = queue;
      const prior = activeQueue.tail;
      const pending = prior
        ? prior
            .catch(() => null)
            .then((result) =>
              save(result?.ok ? result : activeQueue.latestSavedDraft),
            )
        : save(activeQueue.latestSavedDraft);
      activeQueue.tail = pending;

      void pending
        .then((result) => {
          if (result.ok && result.draft) {
            activeQueue.latestSavedDraft = result;
          }
        })
        .catch(() => null)
        .finally(() => {
          if (activeQueue.tail === pending) {
            activeQueue.tail = null;
          }
        });

      return pending;
    },
    [],
  );
  const drainDraftSaves = useCallback(
    async (composeSessionVersion: number): Promise<ComposerDraftSaveDrain> => {
      const queue = draftSaveQueueRef.current;
      if (!queue || queue.composeSessionVersion !== composeSessionVersion) {
        return { completed: null, latestSavedDraft: null };
      }

      const hadPendingSave = queue.tail !== null;
      let completed: ComposerDraftSaveResult | null = null;
      while (queue.tail) {
        const pending = queue.tail;
        completed = await pending.catch(() => ({ ok: false, draft: null }));
        if (queue.tail === pending) {
          break;
        }
      }

      return {
        completed: hadPendingSave ? completed : null,
        latestSavedDraft:
          completed?.ok && completed.draft ? completed : queue.latestSavedDraft,
      };
    },
    [],
  );
  const [isSending, setIsSending] = useState(false);

  const openComposer = useCallback(() => {
    setIsOpen(true);
    setIsMinimized(false);
    setIsMaximized(false);
  }, []);

  const closeComposer = useCallback(() => {
    setIsOpen(false);
    setIsMinimized(false);
    setIsMaximized(false);
  }, []);

  const toggleMinimize = useCallback(() => {
    setIsMinimized((prev) => {
      const next = !prev;
      if (next) setIsMaximized(false);
      return next;
    });
  }, []);

  const toggleMaximize = useCallback(() => {
    setIsMaximized((prev) => {
      const next = !prev;
      if (next) setIsMinimized(false);
      return next;
    });
  }, []);

  const resetComposeData = useCallback(() => {
    setComposeData(DEFAULT_COMPOSE_DATA);
  }, [setComposeData]);

  const replaceBodyAndContentType = useCallback(
    (body: string, contentType: NonNullable<ComposeData["contentType"]>) => {
      setComposeData((previous) => ({
        ...previous,
        body,
        contentType,
        draftDocument: contentType === "plain" ? undefined : previous.draftDocument,
      }));
    },
    [setComposeData],
  );

  const navigationGuardRef = useRef<
    ((request: NavigationRequest) => void) | null
  >(null);

  const registerNavigationGuard = useCallback(
    (guard: (request: NavigationRequest) => void) => {
      navigationGuardRef.current = guard;
      return () => {
        if (navigationGuardRef.current === guard) {
          navigationGuardRef.current = null;
        }
      };
    },
    [],
  );

  const requestNavigation = useCallback(
    (action: () => void, options?: { onCancel?: () => void }) => {
      const guard = navigationGuardRef.current;
      if (guard) {
        guard({ action, onCancel: options?.onCancel });
      } else {
        action();
      }
    },
    [],
  );

  const dirtyCheckerRef = useRef<(() => boolean) | null>(null);

  const registerDirtyChecker = useCallback((checker: () => boolean) => {
    dirtyCheckerRef.current = checker;
    return () => {
      if (dirtyCheckerRef.current === checker) {
        dirtyCheckerRef.current = null;
      }
    };
  }, []);

  const isComposeDirty = useCallback(
    () => dirtyCheckerRef.current?.() ?? false,
    [],
  );

  const deleteHandlerRef = useRef<(() => void) | null>(null);

  const registerDeleteHandler = useCallback((handler: () => void) => {
    deleteHandlerRef.current = handler;
    return () => {
      if (deleteHandlerRef.current === handler) {
        deleteHandlerRef.current = null;
      }
    };
  }, []);

  const requestDelete = useCallback(() => deleteHandlerRef.current?.(), []);

  // Memoize the context value so it only changes when real state changes.
  // An unmemoized value churned identity every render, which made consumers'
  // effects (notably the compose navigation-guard registration) re-run
  // constantly and leave stale guards registered. All callbacks below are
  // referentially stable (useCallback / useState setters).
  const value = useMemo(
    () => ({
      isOpen,
      isMinimized,
      isMaximized,
      openComposer,
      closeComposer,
      toggleMinimize,
      toggleMaximize,
      composeData,
      setComposeData,
      getComposeSessionVersion,
      queueDraftSave,
      drainDraftSaves,
      replaceBodyAndContentType,
      isSending,
      setIsSending,
      resetComposeData,
      registerNavigationGuard,
      requestNavigation,
      registerDirtyChecker,
      isComposeDirty,
      registerDeleteHandler,
      requestDelete,
    }),
    [
      isOpen,
      isMinimized,
      isMaximized,
      openComposer,
      closeComposer,
      toggleMinimize,
      toggleMaximize,
      composeData,
      setComposeData,
      getComposeSessionVersion,
      queueDraftSave,
      drainDraftSaves,
      replaceBodyAndContentType,
      isSending,
      setIsSending,
      resetComposeData,
      registerNavigationGuard,
      requestNavigation,
      registerDirtyChecker,
      isComposeDirty,
      registerDeleteHandler,
      requestDelete,
    ],
  );

  return (
    <ComposerContext.Provider value={value}>
      {children}
    </ComposerContext.Provider>
  );
}

export function useComposer() {
  const context = useContext(ComposerContext);
  if (context === undefined) {
    throw new Error("useComposer must be used within a ComposerProvider");
  }
  return context;
}
