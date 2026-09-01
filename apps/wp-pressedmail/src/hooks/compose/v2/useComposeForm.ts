/**
 * useComposeForm: unified compose business logic hook (v2 location).
 *
 * v2 cutover: this file replaces the legacy `src/hooks/useComposeForm.ts`.
 * Surface and behavior unchanged so consumers (ComposerContent, ComposePane,
 * ComposeForm, toolbar/header/footer subcomponents) keep working. Internal
 * decomposition into the focused v2 hooks under this directory
 * (useDraftState/useRecipientState/useAttachmentState/useSendActions/etc.)
 * is a follow-up refactor, this step only relocates and rewires.
 *
 * @since 2.0.0
 */

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { useNavigate } from "react-router-dom";

import { apiFetch, apiForm } from "@/lib/api-client";
import {
  deleteEmailFromImapRouteApi,
  saveDraftRouteApi,
  sendEmailRouteApi,
  routeApiPrefix,
} from "@/context/Strings";
import { useAppContext } from "@/context/AppProvider";
import { CONSOLIDATED_INBOX_VALUE } from "@/components/inbox/account-switcher";
import { getAccountNumericId } from "@/lib/consolidated-account-scope";
import { appMessage } from "@/context/toast";
import { useUndoSend } from "@/context/undo-send";
import { useSignatures } from "@/context/signatures/SignaturesContext";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import {
  useCanUploadAttachments,
  useCanUseMediaLibraryAttachments,
  useMaxAttachmentSizeMb,
} from "@/context/admin-settings";
import type { EmailEditorRef } from "@/components/composer";
import type { EmailAccount, EmailAttachment, EmailContentType } from "@/types";
import { useMediaLibraryPicker } from "@/components/inbox/compose/media-library/MediaLibraryPickerProvider";
import type { MediaPickerSelection } from "@/services/media-library.service";
import type { Recipient } from "@/types/recipients";
import {
  dedupeRecipientGroupsByEmail,
  getContactListRecipientDescriptors,
  parseEmailString,
  recipientsFromComposeData,
  recipientsToString,
} from "@/types/recipients";
import type { Signature } from "@/types/signatures";
import { applySignature, hasSignature } from "@/services/signature.service";
import { useSignatureBinding } from "./useSignatureBinding";
import {
  getUserPreferencesSnapshot,
  useUserPreferences,
} from "@/hooks/useUserPreferences";
import {
  hasExternalRecipient,
  shouldConfirmSend,
  shouldInsertComposerSignature,
} from "@/lib/preference-behavior";
import {
  prepareEmailHtmlForSend,
  unwrapEmailBodyHtml,
} from "@/services/email-safe-html.service";
import { parseScheduledDraftHandoff } from "@/types/scheduled-emails";
import { normalizeComposerBackgroundColor } from "@/lib/composer-background-color";
import {
  COMPOSER_LEADING_BLANK_LINES_HTML,
  type ComposeMode,
} from "@/components/inbox/compose/compose-utils";
import { getCacheService } from "@/services/implementations";
import { refreshAccountSync } from "@/services/sync-driver.service";
import {
  applyPlainTextSignature,
  getPlainTextAuthoredContent,
  hasPlainTextSignature,
  normalizeOutgoingPlainText,
} from "@/lib/composer/plain-text-content";

/**
 * Returns true when `body` contains content beyond the auto-inserted
 * leading blank lines. Used to keep the "not dirty on open" semantics intact
 * even after the mount effect pre-populates the editor.
 */
function bodyHasUserContent(
  body: string,
  mode: ComposeMode,
  contentType: EmailContentType,
): boolean {
  if (!body) return false;
  if (contentType === "plain") {
    return getPlainTextAuthoredContent(body, mode).length > 0;
  }
  let stripped = body;
  if (stripped.startsWith(COMPOSER_LEADING_BLANK_LINES_HTML)) {
    stripped = stripped.slice(COMPOSER_LEADING_BLANK_LINES_HTML.length);
  }
  // Drop the quoted reply / forwarded block. `formatQuotedHtml` and
  // `formatForwardedHtml` append `<hr>…<blockquote>…</blockquote>` at the tail
  // and the user types above it, so an unedited reply/forward has no content of
  // its own and must NOT count as dirty (otherwise opening a reply and clicking
  // away would auto-save a draft).
  stripped = stripped.replace(/<hr\b[^>]*>[\s\S]*$/i, "");
  // Drop residual empty paragraphs (`<p><br></p>`, `<p></p>`) before
  // deciding whether the user has typed anything meaningful.
  stripped = stripped
    .replace(/<p><br><\/p>/g, "")
    .replace(/<p>\s*<\/p>/g, "")
    .trim();
  return stripped.length > 0;
}
import { getModeTitle } from "@/components/inbox/compose/compose-utils";
import type { ComposerDraftSaveResult, useComposer } from "@/context/composer";
import { getRuntimeRestNamespace } from "@/lib/runtime-config";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface UseComposeFormOptions {
  mode: ComposeMode;
  prefillTo?: Recipient[];
  prefillCc?: Recipient[];
  prefillBcc?: Recipient[];
  prefillSubject?: string;
  prefillBody?: string;
  /** Fresh-compose preference. Explicit persisted/draft MIME wins. */
  defaultContentType?: EmailContentType;
  quotedText?: string;
  editorRef: React.RefObject<EmailEditorRef | null>;
  /** If provided, syncs state with global ComposerContext (for floating window persistence). */
  composerContext?: ReturnType<typeof useComposer>;
  /**
   * Legacy option kept for caller compatibility. Draft auto-save now happens
   * only on composer exit via autoSaveOnClose.
   */
  autoSaveDrafts?: boolean;
  /**
   * Pro feature: when true, close/discard with dirty content silently saves
   * a draft and closes instead of showing the discard dialog.
   */
  autoSaveOnClose?: boolean;
  /**
   * When true, registers a ComposerContext navigation guard while this hook
   * is mounted so that outside navigation (e.g. clicking another email in
   * the list) routes through the discard dialog / autosave flow.
   */
  gateNavigation?: boolean;
  undoSendEnabled?: boolean;
  undoSendDelaySeconds?: 15 | 30 | 60;
  onClose?: () => void;
  onSendSuccess?: () => void;
  /**
   * Called after a manual draft save or schedule commit so the active list can
   * refresh. Draft saves include the target folder.
   */
  onDraftSaved?: (draftFolder?: string) => void;
  /** Called after an existing server draft is successfully discarded. */
  onDraftDiscarded?: (draftFolder?: string) => void;
  /**
   * Called whenever a scheduled-email row is created, updated, disarmed or
   * deleted, so the Scheduled list and store refresh without waiting for a
   * recovery pass.
   */
  onScheduledChanged?: () => void;
}

export interface UseComposeFormReturn {
  // State
  toRecipients: Recipient[];
  ccRecipients: Recipient[];
  bccRecipients: Recipient[];
  subject: string;
  body: string;
  contentType: EmailContentType;
  bodyBackgroundColor?: string;
  /** Composer canvas pane color (editing aid only, never sent or saved). */
  canvasBackgroundColor?: string;
  attachments: Array<File | EmailAttachment>;
  showCc: boolean;
  showBcc: boolean;
  isSending: boolean;
  isScheduling: boolean;
  isSavingDraft: boolean;
  isDiscarding: boolean;
  pendingInlineImageUploads: number;
  isDraftSaved: boolean;
  showDiscardDialog: boolean;
  showQuotedText: boolean;
  quotedText: string;
  mode: ComposeMode;
  modeTitle: string;
  fromAccount: string;
  isScheduledEdit: boolean;
  scheduledAt?: string;

  // Computed
  canSend: boolean;

  // Feature flags
  signaturesEnabled: boolean;
  /**
   * Whether the inline AI authoring tools (toolbar AI dropdown + "More tools"
   * AI menu items) are available, driven by the Pro `ai_drafting` feature flag,
   * which the server gates on the AI Composer being admin-enabled AND configured.
   * Despite the legacy name, this no longer controls a standalone panel (that
   * card was removed); it gates the in-editor AI controls.
   */
  showAIPanel: boolean;
  canUploadAttachments: boolean;
  canUseMediaLibraryAttachments: boolean;
  maxAttachmentSizeMb: number;
  contactListsEnabled: boolean;

  // Data
  signatures: Signature[];

  // Handlers
  setToRecipients: (recipients: Recipient[]) => void;
  setCcRecipients: (recipients: Recipient[]) => void;
  setBccRecipients: (recipients: Recipient[]) => void;
  setSubject: (subject: string) => void;
  setBody: (body: string) => void;
  replaceBodyAndContentType: (
    body: string,
    contentType: EmailContentType,
  ) => void;
  setBodyBackgroundColor: (color?: string) => void;
  setCanvasBackgroundColor: (color?: string) => void;
  /** Sender-set importance (cross-provider priority headers on send). */
  isImportant: boolean;
  setIsImportant: (important: boolean) => void;
  setShowCc: (show: boolean) => void;
  setShowBcc: (show: boolean) => void;
  setShowQuotedText: (show: boolean) => void;
  setFromAccount: (account: string) => void;
  handleSend: () => Promise<void>;
  handleSchedule: (scheduledAt: Date) => Promise<void>;
  handleRemoveSchedule: () => Promise<void>;
  /** Resolves true when the draft reached the server. */
  handleSaveDraft: (opts?: { silent?: boolean }) => Promise<boolean>;
  handleDiscard: () => Promise<void>;
  handleDiscardConfirm: () => Promise<void>;
  handleDiscardSaveAndClose: () => Promise<void>;
  handleDiscardCancel: () => void;
  handleSignatureSelect: (signatureId: number) => void;
  handleEditorReady: (editor: EmailEditorRef | null) => void;
  handleBlockInsert: (html: string) => void;
  handleAttachment: (event: React.ChangeEvent<HTMLInputElement>) => void;
  /**
   * Append already-resolved File objects (e.g. from Drive picker) to the
   * compose attachment list. Attaches everything within the configured size
   * limit and names the oversized files in one toast.
   */
  appendAttachmentFiles: (files: File[]) => void;
  appendMediaLibraryAttachments: (attachments: MediaPickerSelection[]) => void;
  handleMediaLibraryAttachment: () => Promise<void>;
  removeAttachment: (index: number) => void;
  beginInlineImageUpload: () => boolean;
  endInlineImageUpload: () => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
  getComposeSessionVersion: () => number | null;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Resolve the per-attachment byte ceiling from the admin "max attachment size"
 * setting. A misconfigured or blank limit (<= 0 / non-finite) must mean "no
 * limit", not "drop everything". Otherwise a 0 MB setting would silently
 * filter out every Media Library selection and every uploaded file.
 */
export function resolveMaxAttachmentBytes(maxAttachmentSizeMb: number): number {
  if (!Number.isFinite(maxAttachmentSizeMb) || maxAttachmentSizeMb <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  return maxAttachmentSizeMb * 1024 * 1024;
}

/**
 * Tell the user which files were left behind, in the same toast channel as
 * every other composer error. A blocking alert() here used to take the whole
 * batch down with one oversized file.
 */
function warnOversizedAttachments(
  names: string[],
  maxAttachmentSizeMb: number,
) {
  if (names.length === 0) return;
  appMessage(
    sprintf(
      /* translators: 1: size limit in MB, 2: comma-separated file names. */
      __("Over the %1$d MB limit, so not attached: %2$s", "pressedmail"),
      maxAttachmentSizeMb,
      names.join(", "),
    ),
    "error",
  );
}

function describeAttachmentForDraftSnapshot(
  attachment: File | EmailAttachment,
): string {
  if (typeof File !== "undefined" && attachment instanceof File) {
    return [
      "file",
      attachment.name,
      attachment.size,
      attachment.type,
      attachment.lastModified,
    ].join(":");
  }

  const emailAttachment = attachment as EmailAttachment;

  return [
    "attachment",
    emailAttachment.id ?? "",
    emailAttachment.wpAttachmentId ?? "",
    emailAttachment.filename ?? "",
    emailAttachment.mimeType ?? emailAttachment.mime ?? "",
    emailAttachment.size ?? "",
    emailAttachment.url ?? "",
  ].join(":");
}

/**
 * Serialize the composer's attachments into durable descriptors for scheduling.
 * Only Media Library items (with a persistent wpAttachmentId) survive until the
 * scheduled send time; raw File uploads are dropped (the caller warns).
 */
interface ScheduledAttachmentPayload {
  id: number;
  wpAttachmentId: number;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  source: "media-library";
}

function serializeScheduledAttachments(
  attachments: Array<File | EmailAttachment>,
): ScheduledAttachmentPayload[] {
  const out: ScheduledAttachmentPayload[] = [];
  for (const attachment of attachments) {
    if (typeof File !== "undefined" && attachment instanceof File) {
      continue;
    }
    const att = attachment as EmailAttachment;
    const wpId = att.wpAttachmentId;
    if (typeof wpId !== "number" || wpId <= 0) {
      continue;
    }
    out.push({
      id: wpId,
      wpAttachmentId: wpId,
      filename: att.filename ?? "",
      mimeType: att.mimeType ?? att.mime ?? "",
      size: att.size ?? 0,
      url: att.url,
      source: "media-library",
    });
  }
  return out;
}

function appendAttachmentsToFormData(
  formData: FormData,
  attachments: Array<File | EmailAttachment>,
  includeExistingDraftParts = false,
  existingDraftManifestComplete = true,
) {
  const mediaAttachmentIds: number[] = [];
  const existingDraftAttachments: Array<{ part: string | null }> = [];
  const existingDraftParts = new Set<string>();

  for (const attachment of attachments) {
    if (typeof File !== "undefined" && attachment instanceof File) {
      formData.append("attachments[]", attachment);
      continue;
    }

    const att = attachment as EmailAttachment;
    if (att.source === "media-library" && att.wpAttachmentId) {
      mediaAttachmentIds.push(att.wpAttachmentId);
      continue;
    }

    if (
      includeExistingDraftParts &&
      typeof att.part === "string" &&
      att.part.trim() !== ""
    ) {
      const part = att.part.trim();
      if (!existingDraftParts.has(part)) {
        existingDraftParts.add(part);
        existingDraftAttachments.push({ part });
      }
      continue;
    }

    if (includeExistingDraftParts) {
      existingDraftAttachments.push({ part: null });
    }
  }

  if (mediaAttachmentIds.length > 0) {
    formData.append("media_attachment_ids", JSON.stringify(mediaAttachmentIds));
  }

  if (
    includeExistingDraftParts &&
    !existingDraftManifestComplete &&
    existingDraftAttachments.length === 0
  ) {
    existingDraftAttachments.push({ part: null });
  }

  if (includeExistingDraftParts) {
    formData.append(
      "existing_draft_attachments",
      JSON.stringify(existingDraftAttachments),
    );
  }
}

/**
 * Outcome of one draft save. `ok` is the only success signal: a server can
 * answer success without echoing a uid, and callers that clear the composer
 * must not read a missing uid as a failed save (or the reverse).
 */
type SaveDraftResult = ComposerDraftSaveResult;

interface SaveDraftOptions {
  silent?: boolean;
  subject?: string;
  body?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  contactListIds?: number[];
  contentType?: EmailContentType;
  accountId?: number;
  attachments?: Array<File | EmailAttachment>;
  draftAttachmentManifestComplete?: boolean;
}

interface DraftServerIdentity {
  uid: string;
  folder: string;
  accountId: number | null;
  uidValidity: string | null;
  messageId: string | null;
}

interface ActiveSendSnapshot {
  composeSessionVersion: number | null;
  accountId: number;
  to: string;
  cc: string;
  bcc: string;
  contactListIds: number[];
  subject: string;
  body: string;
  contentType: EmailContentType;
  isImportant: boolean;
  mode: ComposeMode;
  attachments: Array<File | EmailAttachment>;
  draftAttachmentManifestComplete: boolean;
  priorDraft: DraftServerIdentity | null;
}

function normalizeDraftUidValidity(value: unknown): string | null {
  const normalized = String(value ?? "");
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
}

function normalizeDraftMessageId(value: unknown): string | null {
  return typeof value === "string" && /^<[^<>\r\n]+>$/.test(value)
    ? value
    : null;
}

function applyBodyBackgroundColor(
  html: string,
  bodyBackgroundColor?: string,
): string {
  // Peel any wrapper the stored body still carries first. `getHTML() || body`
  // falls back to the stored HTML whenever the serializer cache is cold, and
  // wrapping that again nests one layer per save.
  const { html: content } = unwrapEmailBodyHtml(html);
  const normalizedColor = normalizeComposerBackgroundColor(bodyBackgroundColor);

  if (!normalizedColor) {
    return content;
  }

  return `<div data-pm-body-background="${normalizedColor}" style="background-color: ${normalizedColor};">${content}</div>`;
}

export function useComposeForm({
  mode,
  prefillTo,
  prefillCc,
  prefillBcc,
  prefillSubject,
  prefillBody,
  defaultContentType = "html",
  quotedText: quotedTextInput = "",
  editorRef,
  composerContext,
  autoSaveOnClose = false,
  gateNavigation = false,
  undoSendEnabled = false,
  undoSendDelaySeconds = 15,
  onClose,
  onSendSuccess,
  onDraftSaved,
  onDraftDiscarded,
  onScheduledChanged,
}: UseComposeFormOptions): UseComposeFormReturn {
  const navigate = useNavigate();
  const { accounts, selectedAccount } = useAppContext();
  const { showUndoSend } = useUndoSend();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Context data
  const { signatures } = useSignatures();

  // Feature flags
  const signaturesEnabled = useFeatureAvailable("signatures");
  // Inline AI tools availability (toolbar AI dropdown + More-tools AI items).
  // `ai_drafting` is admin-gated on the server: it is only available when the
  // AI Composer feature is toggled on AND a provider is configured, so the
  // legacy global useAIAvailable() check is no longer needed here.
  const aiFeatureEnabled = useFeatureAvailable("ai_drafting");
  const showAIPanel = aiFeatureEnabled;
  const canUploadAttachments = useCanUploadAttachments();
  const canUseMediaLibraryAttachments = useCanUseMediaLibraryAttachments();
  const maxAttachmentSizeMb = useMaxAttachmentSizeMb();
  const contactListsEnabled = useFeatureAvailable("contact_lists");
  const contextScheduledAccountId =
    composerContext?.composeData.scheduledAccountId;
  const rawContextDraftAccountId = composerContext?.composeData.draftAccountId;
  const contextDraftAccountId = Number.isInteger(
    Number(rawContextDraftAccountId),
  )
    ? Number(rawContextDraftAccountId)
    : undefined;
  const contextBoundAccountId =
    typeof contextScheduledAccountId === "number"
      ? contextScheduledAccountId
      : contextDraftAccountId;

  // ---------------------------------------------------------------------------
  // State comes from ComposerContext (floating) or local state (pane).
  // ---------------------------------------------------------------------------

  const [localTo, setLocalTo] = useState<Recipient[]>(prefillTo ?? []);
  const [localCc, setLocalCc] = useState<Recipient[]>(prefillCc ?? []);
  const [localBcc, setLocalBcc] = useState<Recipient[]>(prefillBcc ?? []);
  const [localSubject, setLocalSubject] = useState(prefillSubject ?? "");
  const [localBody, setLocalBody] = useState(prefillBody ?? "");
  const [localContentType, setLocalContentType] =
    useState<EmailContentType>(defaultContentType);
  const [localBodyBackgroundColor, setLocalBodyBackgroundColor] = useState<
    string | undefined
  >(undefined);
  const [localCanvasBackgroundColor, setLocalCanvasBackgroundColor] = useState<
    string | undefined
  >(undefined);
  const [localAttachments, setLocalAttachments] = useState<
    Array<File | EmailAttachment>
  >([]);

  // UI state
  const [showCc, setShowCc] = useState((prefillCc?.length ?? 0) > 0);
  const [showBcc, setShowBcc] = useState((prefillBcc?.length ?? 0) > 0);
  const [showQuotedText, setShowQuotedText] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isImportant, setIsImportant] = useState(false);
  const [isScheduling, setIsScheduling] = useState(false);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isDiscarding, setIsDiscarding] = useState(false);
  const [pendingInlineImageUploads, setPendingInlineImageUploads] = useState(0);
  const [isDraftSaved, setIsDraftSaved] = useState(false);
  const [fromAccount, setFromAccount] = useState(() => {
    // In consolidated mode, default to first account's email
    if (selectedAccount === CONSOLIDATED_INBOX_VALUE) {
      return accounts[0]?.email || "";
    }
    return selectedAccount || "";
  });
  const sigInsertedRef = useRef(false);
  // Tracks whether the composed body has been flushed into the editor once it
  // became ready (the cached-signatures race fix).
  const editorReadyFlushedRef = useRef(false);

  const resolveSendingAccount = useCallback((): EmailAccount | null => {
    if (typeof contextBoundAccountId === "number") {
      const byBoundAccount = accounts.find(
        (account) => getAccountNumericId(account) === contextBoundAccountId,
      );
      if (byBoundAccount) {
        return byBoundAccount;
      }
    }

    const bySelectedFrom = accounts.find(
      (account) => account.email === fromAccount,
    );
    if (bySelectedFrom) {
      return bySelectedFrom;
    }

    if (selectedAccount && selectedAccount !== CONSOLIDATED_INBOX_VALUE) {
      const bySelectedAccount = accounts.find(
        (account) => account.email === selectedAccount,
      );
      if (bySelectedAccount) {
        return bySelectedAccount;
      }
    }

    return accounts[0] ?? null;
  }, [accounts, contextBoundAccountId, fromAccount, selectedAccount]);

  const getSendingAccountId = useCallback((): number | null => {
    const account = resolveSendingAccount();
    return account ? getAccountNumericId(account) : null;
  }, [resolveSendingAccount]);

  // Account-aware signature resolution: the sending account's assigned
  // signature wins, falling back to the global default, and only auto-inserts
  // when its per-mode include flag is set. Replaces the old global-only
  // `useDefaultSignature` path so a reply/forward picks up the account's
  // selected signature.
  const { signature: boundSignature, shouldInsertForMode } =
    useSignatureBinding({ accountId: getSendingAccountId(), mode });
  const { preferences: composerPreferences } = useUserPreferences();
  const shouldInsertSignature =
    shouldInsertForMode &&
    shouldInsertComposerSignature(
      composerPreferences.composer_reply_signature_behavior,
      mode,
    );

  useEffect(() => {
    if (accounts.length === 0) {
      if (fromAccount !== "") {
        setFromAccount("");
      }
      return;
    }

    if (typeof contextBoundAccountId === "number") {
      const boundAccount = accounts.find(
        (account) => getAccountNumericId(account) === contextBoundAccountId,
      );
      if (boundAccount?.email) {
        if (fromAccount !== boundAccount.email) {
          setFromAccount(boundAccount.email);
        }
        return;
      }
    }

    if (
      fromAccount &&
      accounts.some((account) => account.email === fromAccount)
    ) {
      return;
    }

    if (
      selectedAccount &&
      selectedAccount !== CONSOLIDATED_INBOX_VALUE &&
      accounts.some((account) => account.email === selectedAccount)
    ) {
      setFromAccount(selectedAccount);
      return;
    }

    setFromAccount(accounts[0]?.email || "");
  }, [accounts, contextBoundAccountId, fromAccount, selectedAccount]);

  // ---------------------------------------------------------------------------
  // Bridging: If composerContext is provided, derive state from it
  // ---------------------------------------------------------------------------

  const isContextMode = !!composerContext;
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const getComposeSessionVersion = useCallback(
    () => composerContext?.getComposeSessionVersion() ?? null,
    [composerContext],
  );
  const ownsComposeSession = useCallback(
    (composeSessionVersion: number | null) =>
      mountedRef.current &&
      (!isContextMode || getComposeSessionVersion() === composeSessionVersion),
    [getComposeSessionVersion, isContextMode],
  );
  const scheduledEmailId =
    __IS_PRO__ && isContextMode
      ? composerContext!.composeData.scheduledEmailId
      : undefined;
  const scheduledAccountId =
    __IS_PRO__ && isContextMode ? contextScheduledAccountId : undefined;
  const scheduledAt =
    __IS_PRO__ && isContextMode
      ? composerContext!.composeData.scheduledAt
      : undefined;
  const isScheduledEdit = __IS_PRO__ && typeof scheduledEmailId === "number";
  const contextHasComposeData = Boolean(
    isContextMode &&
    (composerContext!.composeData.to ||
      composerContext!.composeData.cc ||
      composerContext!.composeData.bcc ||
      composerContext!.composeData.contactLists?.length ||
      composerContext!.composeData.subject ||
      composerContext!.composeData.body ||
      composerContext!.composeData.attachments?.length ||
      composerContext!.composeData.draftUid ||
      composerContext!.composeData.draftFolder ||
      composerContext!.composeData.draftAccountId ||
      composerContext!.composeData.draftUidValidity ||
      composerContext!.composeData.draftMessageId ||
      composerContext!.composeData.scheduledEmailId),
  );
  const useContextPrefill = isContextMode && !contextHasComposeData;

  useEffect(() => {
    if (!useContextPrefill || !composerContext) {
      return;
    }
    const hasPrefill = Boolean(
      prefillTo?.length ||
      prefillCc?.length ||
      prefillBcc?.length ||
      prefillSubject ||
      prefillBody,
    );
    if (!hasPrefill) {
      return;
    }

    composerContext.setComposeData((previous) => {
      const sessionAlreadyHasData = Boolean(
        previous.to ||
        previous.cc ||
        previous.bcc ||
        previous.subject ||
        previous.body ||
        previous.attachments?.length ||
        previous.draftUid ||
        previous.scheduledEmailId,
      );
      if (sessionAlreadyHasData) {
        return previous;
      }
      return {
        ...previous,
        to: recipientsToString(prefillTo ?? []),
        cc: recipientsToString(prefillCc ?? []),
        bcc: recipientsToString(prefillBcc ?? []),
        contactLists: getContactListRecipientDescriptors(prefillTo ?? []),
        subject: prefillSubject ?? "",
        body: prefillBody ?? "",
      };
    });
  }, [
    composerContext,
    prefillBcc,
    prefillBody,
    prefillCc,
    prefillSubject,
    prefillTo,
    useContextPrefill,
  ]);

  // Derived recipients from context (for floating window)
  const toRecipients = isContextMode
    ? useContextPrefill
      ? (prefillTo ?? [])
      : recipientsFromComposeData(
          composerContext!.composeData.to || "",
          composerContext!.composeData.contactLists,
        )
    : localTo;
  const ccRecipients = isContextMode
    ? useContextPrefill
      ? (prefillCc ?? [])
      : parseEmailString(composerContext!.composeData.cc || "")
    : localCc;
  const bccRecipients = isContextMode
    ? useContextPrefill
      ? (prefillBcc ?? [])
      : parseEmailString(composerContext!.composeData.bcc || "")
    : localBcc;
  const uniqueRecipientGroups = useMemo(
    () =>
      dedupeRecipientGroupsByEmail({
        to: toRecipients,
        cc: ccRecipients,
        bcc: bccRecipients,
      }),
    [toRecipients, ccRecipients, bccRecipients],
  );
  const subject = isContextMode
    ? useContextPrefill
      ? (prefillSubject ?? "")
      : composerContext!.composeData.subject
    : localSubject;
  const body = isContextMode
    ? useContextPrefill
      ? (prefillBody ?? "")
      : composerContext!.composeData.body
    : localBody;
  const contentType: EmailContentType = isContextMode
    ? (composerContext!.composeData.contentType ??
      (composerContext!.composeData.body ||
      composerContext!.composeData.draftUid ||
      composerContext!.composeData.scheduledEmailId
        ? "html"
        : defaultContentType))
    : localContentType;
  // Mirror the latest composed body so the editor-ready catch-up can flush it
  // without re-creating the callback on every keystroke.
  const latestBodyRef = useRef(body);
  latestBodyRef.current = body;
  const bodyBackgroundColor = isContextMode
    ? normalizeComposerBackgroundColor(
        composerContext!.composeData.bodyBackgroundColor,
      )
    : localBodyBackgroundColor;
  const canvasBackgroundColor = isContextMode
    ? normalizeComposerBackgroundColor(
        composerContext!.composeData.canvasBackgroundColor,
      )
    : localCanvasBackgroundColor;
  const attachments = isContextMode
    ? (composerContext!.composeData.attachments ?? [])
    : localAttachments;
  const attachmentsRef = useRef(attachments);
  attachmentsRef.current = attachments;
  const initialComposeStateRef = useRef({
    to: recipientsToString(toRecipients),
    cc: recipientsToString(ccRecipients),
    bcc: recipientsToString(bccRecipients),
    contactListIds: getContactListRecipientDescriptors(toRecipients).map(
      (list) => list.id,
    ),
    subject,
    authoredBody: bodyHasUserContent(body, mode, contentType),
    contentType,
    bodyBackgroundColor: bodyBackgroundColor ?? "",
    attachments: attachments.map(describeAttachmentForDraftSnapshot),
  });

  // Setters that write to the correct store
  const setToRecipients = useCallback(
    (recipients: Recipient[]) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          to: recipientsToString(recipients),
          contactLists: getContactListRecipientDescriptors(recipients),
          is_reply: false,
        }));
      } else {
        setLocalTo(recipients);
      }
    },
    [isContextMode, composerContext],
  );

  const setCcRecipients = useCallback(
    (recipients: Recipient[]) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          cc: recipientsToString(recipients),
        }));
      } else {
        setLocalCc(recipients);
      }
    },
    [isContextMode, composerContext],
  );

  const setBccRecipients = useCallback(
    (recipients: Recipient[]) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          bcc: recipientsToString(recipients),
        }));
      } else {
        setLocalBcc(recipients);
      }
    },
    [isContextMode, composerContext],
  );

  const setSubject = useCallback(
    (value: string) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          subject: value,
        }));
      } else {
        setLocalSubject(value);
      }
    },
    [isContextMode, composerContext],
  );

  const setBody = useCallback(
    (value: string) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          body: value,
          contentType: prev.contentType ?? contentType,
        }));
      } else {
        setLocalBody(value);
      }
    },
    [isContextMode, composerContext, contentType],
  );

  const replaceBodyAndContentType = useCallback(
    (value: string, nextContentType: EmailContentType) => {
      if (isContextMode) {
        composerContext!.replaceBodyAndContentType(value, nextContentType);
      } else {
        setLocalBody(value);
        setLocalContentType(nextContentType);
      }
    },
    [isContextMode, composerContext],
  );

  const setBodyBackgroundColor = useCallback(
    (value?: string) => {
      const normalizedColor = normalizeComposerBackgroundColor(value);

      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          bodyBackgroundColor: normalizedColor,
        }));
      } else {
        setLocalBodyBackgroundColor(normalizedColor);
      }
    },
    [isContextMode, composerContext],
  );

  const setCanvasBackgroundColor = useCallback(
    (value?: string) => {
      const normalizedColor = normalizeComposerBackgroundColor(value);

      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          canvasBackgroundColor: normalizedColor,
        }));
      } else {
        setLocalCanvasBackgroundColor(normalizedColor);
      }
    },
    [isContextMode, composerContext],
  );

  // ---------------------------------------------------------------------------
  // Signature context
  // ---------------------------------------------------------------------------

  const leadingBlanksInsertedRef = useRef(false);
  const initialContentTypeRef = useRef(contentType);
  // Tracks which signature id is currently auto-applied, so the From-account
  // swap effect only replaces when the resolved signature actually changes.
  const appliedSignatureIdRef = useRef<number | null>(null);

  // Auto-insert leading blanks (so cursor lands at the top) and the default
  // signature on mount.
  useEffect(() => {
    if (sigInsertedRef.current && leadingBlanksInsertedRef.current) {
      return;
    }

    let nextBody: string | null = null;
    const currentBody = body ?? "";

    if (
      initialContentTypeRef.current === "html" &&
      contentType === "html" &&
      !leadingBlanksInsertedRef.current
    ) {
      leadingBlanksInsertedRef.current = true;
      // The blanks give the user room above a freshly generated quote block. A
      // restored draft or armed schedule already has whatever spacing they
      // left, and the startsWith guard below cannot recognise a body that has
      // been through the editor once, so it would add five more every reopen.
      const isRestoredBody = hasAnyDraftIdentityMarker || isScheduledEdit;
      if (
        !isRestoredBody &&
        !currentBody.startsWith(COMPOSER_LEADING_BLANK_LINES_HTML)
      ) {
        nextBody = `${COMPOSER_LEADING_BLANK_LINES_HTML}${currentBody}`;
      }
    }

    if (
      !sigInsertedRef.current &&
      signaturesEnabled &&
      boundSignature &&
      shouldInsertSignature
    ) {
      sigInsertedRef.current = true;
      appliedSignatureIdRef.current = boundSignature.id;
      const source = nextBody ?? currentBody;
      // Reply/forward → above the <hr> separator; new → after the body.
      nextBody =
        contentType === "plain"
          ? applyPlainTextSignature(source, boundSignature, mode)
          : applySignature(source, boundSignature, {
              mode,
              replaceExisting: false,
              placement: composerPreferences.composer_signature_placement,
            });
    }

    if (nextBody !== null && nextBody !== currentBody) {
      editorRef.current?.setContent?.(nextBody);
      setBody(nextBody);
    }

    // Park the caret at the top of the editor so the user lands above the
    // quoted block instead of at the end of content.
    editorRef.current?.focusStart?.();
  }, [
    signaturesEnabled,
    boundSignature,
    shouldInsertSignature,
    mode,
    contentType,
    composerPreferences.composer_signature_placement,
  ]);

  // Swap the auto-inserted signature when the From account changes. Scoped to
  // the signature block (applySignature replaceExisting strips only that block,
  // preserving the user's typed text) and gated on an existing block, so it
  // never re-adds a signature the user deleted nor clobbers body content.
  useEffect(() => {
    if (!sigInsertedRef.current) return;
    if (!signaturesEnabled || !boundSignature || !shouldInsertSignature) return;
    if (boundSignature.id === appliedSignatureIdRef.current) return;

    const currentBody =
      contentType === "plain"
        ? (body ?? "")
        : (editorRef.current?.getHTML?.() ?? body ?? "");
    if (
      contentType === "plain"
        ? !hasPlainTextSignature(currentBody, mode)
        : !hasSignature(currentBody)
    ) {
      return;
    }

    appliedSignatureIdRef.current = boundSignature.id;
    const updatedBody =
      contentType === "plain"
        ? applyPlainTextSignature(currentBody, boundSignature, mode)
        : applySignature(currentBody, boundSignature, {
            mode,
            replaceExisting: true,
            placement: composerPreferences.composer_signature_placement,
          });
    if (contentType === "html" && editorRef.current) {
      editorRef.current.setContent(updatedBody);
    } else {
      setBody(updatedBody);
    }
  }, [
    boundSignature,
    shouldInsertSignature,
    signaturesEnabled,
    mode,
    contentType,
    body,
    editorRef,
    setBody,
    composerPreferences.composer_signature_placement,
  ]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------

  // Tracks the IMAP UID/folder of the draft last appended for THIS compose
  // session so a resave replaces it instead of piling up duplicate drafts.
  const priorDraftRef = useRef<DraftServerIdentity | null>(null);
  const activeSendSnapshotRef = useRef<ActiveSendSnapshot | null>(null);
  const openedDraftIdentityRef = useRef<string | null>(null);
  const lastSavedDraftSnapshotRef = useRef<string | null>(null);
  const closeAutoSaveStartedRef = useRef(false);
  const rawContextDraftUid = composerContext?.composeData.draftUid;
  const rawContextDraftFolder = composerContext?.composeData.draftFolder;
  const contextDraftUid = String(rawContextDraftUid ?? "").trim() || null;
  const contextDraftFolder = String(rawContextDraftFolder ?? "").trim() || null;
  const contextDraftUidValidity = normalizeDraftUidValidity(
    composerContext?.composeData.draftUidValidity,
  );
  const contextDraftMessageId = normalizeDraftMessageId(
    composerContext?.composeData.draftMessageId,
  );
  const hasAnyDraftIdentityMarker = Boolean(
    isContextMode &&
    (rawContextDraftUid !== undefined ||
      rawContextDraftFolder !== undefined ||
      rawContextDraftAccountId !== undefined ||
      composerContext!.composeData.draftUidValidity !== undefined ||
      composerContext!.composeData.draftMessageId !== undefined),
  );
  const hasCompleteDraftIdentity = Boolean(
    contextDraftUid &&
    contextDraftFolder &&
    contextDraftAccountId &&
    contextDraftAccountId > 0 &&
    contextDraftUidValidity &&
    contextDraftMessageId,
  );
  const hasIncompleteDraftIdentity =
    hasAnyDraftIdentityMarker && !hasCompleteDraftIdentity;

  useEffect(() => {
    if (!isContextMode) {
      return;
    }

    if (hasCompleteDraftIdentity) {
      const identity = `${String(contextDraftAccountId)}::${String(contextDraftFolder)}::${String(contextDraftUid)}::${String(contextDraftUidValidity)}::${String(contextDraftMessageId)}`;
      if (openedDraftIdentityRef.current !== identity) {
        priorDraftRef.current = {
          uid: String(contextDraftUid),
          folder: String(contextDraftFolder),
          accountId: contextDraftAccountId ?? null,
          uidValidity: contextDraftUidValidity,
          messageId: contextDraftMessageId,
        };
        openedDraftIdentityRef.current = identity;
      }
      return;
    }

    if (hasAnyDraftIdentityMarker || openedDraftIdentityRef.current) {
      priorDraftRef.current = null;
      openedDraftIdentityRef.current = null;
    }
  }, [
    contextDraftAccountId,
    contextDraftFolder,
    contextDraftMessageId,
    contextDraftUid,
    contextDraftUidValidity,
    hasAnyDraftIdentityMarker,
    hasCompleteDraftIdentity,
    isContextMode,
  ]);

  const clearForm = useCallback(() => {
    if (isContextMode) {
      composerContext!.setComposeData({
        to: "",
        cc: "",
        bcc: "",
        contactLists: [],
        subject: "",
        body: "",
        contentType: undefined,
        mode: "new",
        bodyBackgroundColor: undefined,
        canvasBackgroundColor: undefined,
        attachments: [],
        draftUid: undefined,
        draftFolder: undefined,
        draftAccountId: undefined,
        draftUidValidity: undefined,
        draftMessageId: undefined,
        draftAttachmentManifestComplete: undefined,
        scheduledEmailId: undefined,
        scheduledAccountId: undefined,
        scheduledAt: undefined,
      });
    } else {
      setLocalTo([]);
      setLocalCc([]);
      setLocalBcc([]);
      setLocalSubject("");
      setLocalBody("");
      setLocalContentType(defaultContentType);
      setLocalBodyBackgroundColor(undefined);
      setLocalCanvasBackgroundColor(undefined);
      setLocalAttachments([]);
    }
    sigInsertedRef.current = false;
    appliedSignatureIdRef.current = null;
    leadingBlanksInsertedRef.current = false;
    priorDraftRef.current = null;
    openedDraftIdentityRef.current = null;
    lastSavedDraftSnapshotRef.current = null;
  }, [isContextMode, composerContext, defaultContentType]);

  const resolveOutgoingBody = useCallback(
    (overrideBody?: string): string => {
      if (overrideBody !== undefined) return overrideBody;
      if (contentType === "plain") return normalizeOutgoingPlainText(body);
      return applyBodyBackgroundColor(
        editorRef.current?.getHTML() || body,
        bodyBackgroundColor,
      );
    },
    [body, bodyBackgroundColor, contentType, editorRef],
  );

  const getDraftSnapshot = useCallback(
    (overrides?: { subject?: string; body?: string }): string =>
      JSON.stringify({
        accountId: getSendingAccountId(),
        to: recipientsToString(uniqueRecipientGroups.to),
        cc: recipientsToString(uniqueRecipientGroups.cc),
        bcc: recipientsToString(uniqueRecipientGroups.bcc),
        contactListIds: getContactListRecipientDescriptors(
          uniqueRecipientGroups.to,
        ).map((list) => list.id),
        subject: overrides?.subject ?? subject,
        body: resolveOutgoingBody(overrides?.body),
        contentType,
        bodyBackgroundColor: bodyBackgroundColor ?? "",
        attachments: attachments.map(describeAttachmentForDraftSnapshot),
      }),
    [
      attachments,
      bccRecipients,
      bodyBackgroundColor,
      ccRecipients,
      uniqueRecipientGroups,
      resolveOutgoingBody,
      contentType,
      getSendingAccountId,
      subject,
      toRecipients,
    ],
  );

  const applySavedDraftResult = useCallback(
    (
      result: SaveDraftResult,
      composeSessionVersion: number | null,
      feedback: "manual" | "silent" | null,
    ): boolean => {
      if (
        !result.ok ||
        !result.draft ||
        !ownsComposeSession(composeSessionVersion)
      ) {
        return false;
      }

      const savedDraft = result.draft;
      const attachmentParts = result.attachmentParts;
      let rebindAttachment:
        | ((attachment: File | EmailAttachment) => File | EmailAttachment)
        | null = null;
      if (attachmentParts && Object.keys(attachmentParts).length > 0) {
        rebindAttachment = (
          attachment: File | EmailAttachment,
        ): File | EmailAttachment => {
          if (typeof File !== "undefined" && attachment instanceof File) {
            return attachment;
          }
          const part = (attachment as EmailAttachment).part;
          const replacementPart =
            typeof part === "string" ? attachmentParts[part] : undefined;
          return replacementPart
            ? { ...(attachment as EmailAttachment), part: replacementPart }
            : attachment;
        };
        attachmentsRef.current = attachmentsRef.current.map(rebindAttachment);
      }

      const savedIdentity: DraftServerIdentity = {
        uid: savedDraft.draft_uid,
        folder: savedDraft.draft_folder,
        accountId: savedDraft.draft_account_id,
        uidValidity: savedDraft.draft_uidvalidity,
        messageId: savedDraft.draft_message_id,
      };
      priorDraftRef.current = savedIdentity;
      const activeSendSnapshot = activeSendSnapshotRef.current;
      if (activeSendSnapshot?.composeSessionVersion === composeSessionVersion) {
        activeSendSnapshotRef.current = {
          ...activeSendSnapshot,
          attachments: rebindAttachment
            ? activeSendSnapshot.attachments.map(rebindAttachment)
            : activeSendSnapshot.attachments,
          draftAttachmentManifestComplete: true,
          priorDraft: { ...savedIdentity },
        };
      }
      openedDraftIdentityRef.current = `${String(savedDraft.draft_account_id)}::${savedDraft.draft_folder}::${savedDraft.draft_uid}::${savedDraft.draft_uidvalidity}::${savedDraft.draft_message_id}`;

      if (isContextMode) {
        composerContext!.setComposeData((previous) => {
          if (
            composerContext!.getComposeSessionVersion() !==
            composeSessionVersion
          ) {
            return previous;
          }
          return {
            ...previous,
            attachments: rebindAttachment
              ? (previous.attachments ?? []).map(rebindAttachment)
              : previous.attachments,
            draftUid: savedDraft.draft_uid,
            draftFolder: savedDraft.draft_folder,
            draftAccountId: savedDraft.draft_account_id,
            draftUidValidity: savedDraft.draft_uidvalidity,
            draftMessageId: savedDraft.draft_message_id,
            draftAttachmentManifestComplete: true,
          };
        });
      } else if (rebindAttachment) {
        setLocalAttachments((previous) => previous.map(rebindAttachment));
      }
      if (result.savedSnapshot) {
        lastSavedDraftSnapshotRef.current = result.savedSnapshot;
      }

      if (feedback !== null) {
        setIsDraftSaved(true);
        if (feedback === "manual") {
          appMessage(__("Draft saved", "pressedmail"), "success");
          onDraftSaved?.(savedDraft.draft_folder);
        }
        setTimeout(() => {
          if (mountedRef.current) {
            setIsDraftSaved(false);
          }
        }, 2000);
      }

      return true;
    },
    [composerContext, isContextMode, onDraftSaved, ownsComposeSession],
  );

  // Persist the in-progress message to the account's IMAP Drafts folder.
  // Authoritative store is IMAP; localStorage is kept only as a local cache.
  // `opts.silent` suppresses the success toast (used by auto-save and undo send).
  const performSaveDraft = useCallback(
    async (
      opts: SaveDraftOptions | undefined,
      composeSessionVersion: number | null,
    ): Promise<SaveDraftResult> => {
      if (hasIncompleteDraftIdentity) {
        appMessage(
          __("Reload this draft before saving or sending it.", "pressedmail"),
          "error",
        );
        return { ok: false, draft: null };
      }
      const accountId = opts?.accountId ?? getSendingAccountId();
      if (accountId === null) {
        if (!opts?.silent) {
          appMessage(__("Select a sending account", "pressedmail"), "error");
        }
        return { ok: false, draft: null };
      }

      const priorDraft = priorDraftRef.current;
      if (
        priorDraft &&
        (priorDraft.accountId === null || priorDraft.accountId !== accountId)
      ) {
        appMessage(
          __(
            "Switch back to the draft's account before saving or sending it.",
            "pressedmail",
          ),
          "error",
        );
        return { ok: false, draft: null };
      }
      if (priorDraft && (!priorDraft.uidValidity || !priorDraft.messageId)) {
        appMessage(
          __("Reload this draft before saving or sending it.", "pressedmail"),
          "error",
        );
        return { ok: false, draft: null };
      }
      if (!ownsComposeSession(composeSessionVersion)) {
        return { ok: false, draft: null };
      }

      const resolvedDraftBody = resolveOutgoingBody(opts?.body);
      const currentAttachments = opts?.attachments ?? attachmentsRef.current;

      const formData = new FormData();
      formData.append(
        "to",
        opts?.to ?? recipientsToString(uniqueRecipientGroups.to),
      );
      formData.append(
        "cc",
        opts?.cc ?? recipientsToString(uniqueRecipientGroups.cc),
      );
      formData.append(
        "bcc",
        opts?.bcc ?? recipientsToString(uniqueRecipientGroups.bcc),
      );
      formData.append(
        "contact_list_ids",
        JSON.stringify(
          opts?.contactListIds ??
            getContactListRecipientDescriptors(uniqueRecipientGroups.to).map(
              (list) => list.id,
            ),
        ),
      );
      formData.append("subject", opts?.subject ?? subject);
      formData.append("body", resolvedDraftBody);
      formData.append("content_type", opts?.contentType ?? contentType);
      formData.append("account_id", String(accountId));
      const draftAttachmentManifestComplete =
        opts?.draftAttachmentManifestComplete ??
        (!isContextMode ||
          composerContext!.composeData.draftAttachmentManifestComplete !==
            false);
      appendAttachmentsToFormData(
        formData,
        currentAttachments,
        priorDraft !== null,
        draftAttachmentManifestComplete,
      );
      if (priorDraft) {
        formData.append("prior_draft_uid", priorDraft.uid);
        formData.append("prior_draft_folder", priorDraft.folder);
        formData.append("draft_account_id", String(priorDraft.accountId));
        formData.append("prior_draft_uidvalidity", priorDraft.uidValidity!);
        formData.append("prior_draft_message_id", priorDraft.messageId!);
        formData.append(
          "draft_attachment_manifest_complete",
          draftAttachmentManifestComplete ? "1" : "0",
        );
      }

      setIsSavingDraft(true);
      try {
        const response = (await apiForm(saveDraftRouteApi, formData)) as {
          status?: string;
          message?: string;
          data?: {
            draft_uid?: string;
            draft_folder?: string;
            draft_uidvalidity?: string | number;
            draft_message_id?: string;
            attachment_parts?: Record<string, string>;
          };
        };

        if (!response || response.status !== "success") {
          if (ownsComposeSession(composeSessionVersion)) {
            appMessage(
              response?.message || __("Failed to save draft", "pressedmail"),
              "error",
            );
          }
          return { ok: false, draft: null };
        }

        const data = response.data;
        const draftUidValidity = normalizeDraftUidValidity(
          data?.draft_uidvalidity,
        );
        const draftMessageId = normalizeDraftMessageId(data?.draft_message_id);
        if (
          !data?.draft_uid ||
          !data?.draft_folder ||
          !draftUidValidity ||
          !draftMessageId
        ) {
          if (ownsComposeSession(composeSessionVersion)) {
            appMessage(
              __(
                "Reload the saved draft before editing it again.",
                "pressedmail",
              ),
              "error",
            );
          }
          return { ok: false, draft: null };
        }

        const savedDraft = {
          draft_uid: String(data.draft_uid),
          draft_folder: String(data.draft_folder),
          draft_uidvalidity: draftUidValidity,
          draft_message_id: draftMessageId,
          draft_account_id: accountId,
        };
        const result: SaveDraftResult = {
          ok: true,
          draft: savedDraft,
          attachmentParts: data?.attachment_parts,
          savedSnapshot: getDraftSnapshot({
            subject: opts?.subject ?? subject,
            body: resolvedDraftBody,
          }),
        };
        applySavedDraftResult(
          result,
          composeSessionVersion,
          opts?.silent ? "silent" : "manual",
        );
        return result;
      } catch (error) {
        if (ownsComposeSession(composeSessionVersion)) {
          console.error("[useComposeForm] save draft failed", error);
          appMessage(__("Failed to save draft", "pressedmail"), "error");
        }
        return { ok: false, draft: null };
      } finally {
        if (mountedRef.current) {
          setIsSavingDraft(false);
        }
      }
    },
    [
      getSendingAccountId,
      resolveOutgoingBody,
      contentType,
      getDraftSnapshot,
      applySavedDraftResult,
      toRecipients,
      ccRecipients,
      bccRecipients,
      subject,
      uniqueRecipientGroups,
      composerContext,
      hasIncompleteDraftIdentity,
      isContextMode,
      ownsComposeSession,
    ],
  );

  // The save only writes `priorDraftRef` once the server answers. Anything that
  // deletes or replaces the draft has to know a save is still in the air, or it
  // targets a draft that does not exist yet and leaves the real one behind.
  // Each new save chains to the captured tail so queued callers stay serial.
  const inFlightSaveRef = useRef<Promise<SaveDraftResult> | null>(null);
  const operationGateRef = useRef<"delivery" | "discard" | "save-close" | null>(
    null,
  );
  const pendingInlineImageUploadsRef = useRef(0);

  const beginInlineImageUpload = useCallback((): boolean => {
    if (operationGateRef.current) {
      return false;
    }
    pendingInlineImageUploadsRef.current += 1;
    setPendingInlineImageUploads(pendingInlineImageUploadsRef.current);
    return true;
  }, []);

  const endInlineImageUpload = useCallback(() => {
    pendingInlineImageUploadsRef.current = Math.max(
      0,
      pendingInlineImageUploadsRef.current - 1,
    );
    if (mountedRef.current) {
      setPendingInlineImageUploads(pendingInlineImageUploadsRef.current);
    }
  }, []);

  const claimComposeOperation = useCallback(
    (operation: "delivery" | "discard" | "save-close"): boolean => {
      if (operationGateRef.current) {
        return false;
      }
      if (pendingInlineImageUploadsRef.current > 0) {
        appMessage(
          __("Wait for the image upload to finish.", "pressedmail"),
          "error",
        );
        return false;
      }
      operationGateRef.current = operation;
      if (operation !== "delivery") {
        setIsDiscarding(true);
      }
      return true;
    },
    [],
  );

  const releaseComposeOperation = useCallback(
    (operation: "delivery" | "discard" | "save-close") => {
      if (operationGateRef.current !== operation) {
        return;
      }
      operationGateRef.current = null;
      if (operation !== "delivery" && mountedRef.current) {
        setIsDiscarding(false);
      }
    },
    [],
  );

  const saveDraftToServer = useCallback(
    (
      opts?: SaveDraftOptions,
      allowDuringOperation = false,
    ): Promise<SaveDraftResult> => {
      if (
        (!allowDuringOperation && operationGateRef.current) ||
        pendingInlineImageUploadsRef.current > 0
      ) {
        if (pendingInlineImageUploadsRef.current > 0) {
          appMessage(
            __("Wait for the image upload to finish.", "pressedmail"),
            "error",
          );
        }
        return Promise.resolve({ ok: false, draft: null });
      }
      const composeSessionVersion =
        composerContext?.getComposeSessionVersion() ?? null;
      if (composerContext && composeSessionVersion !== null) {
        return composerContext.queueDraftSave(
          composeSessionVersion,
          async (latestSavedDraft) => {
            if (!ownsComposeSession(composeSessionVersion)) {
              return { ok: false, draft: null };
            }
            if (
              latestSavedDraft &&
              !applySavedDraftResult(
                latestSavedDraft,
                composeSessionVersion,
                null,
              )
            ) {
              return { ok: false, draft: null };
            }
            return performSaveDraft(opts, composeSessionVersion);
          },
        );
      }

      const prior = inFlightSaveRef.current;
      const pending = prior
        ? prior
            .catch(() => null)
            .then(() => performSaveDraft(opts, composeSessionVersion))
        : performSaveDraft(opts, composeSessionVersion);
      inFlightSaveRef.current = pending;
      void pending
        .catch(() => null)
        .finally(() => {
          if (inFlightSaveRef.current === pending) {
            inFlightSaveRef.current = null;
          }
        });
      return pending;
    },
    [
      applySavedDraftResult,
      composerContext,
      ownsComposeSession,
      performSaveDraft,
    ],
  );

  const waitForPendingSaves = useCallback(
    async (composeSessionVersion: number | null): Promise<boolean> => {
      if (composerContext && composeSessionVersion !== null) {
        const drained = await composerContext.drainDraftSaves(
          composeSessionVersion,
        );
        if (!ownsComposeSession(composeSessionVersion)) {
          return false;
        }
        if (
          drained.latestSavedDraft &&
          !applySavedDraftResult(
            drained.latestSavedDraft,
            composeSessionVersion,
            null,
          )
        ) {
          return false;
        }
        return drained.completed?.ok !== false;
      }

      let saveFailed = false;

      while (inFlightSaveRef.current) {
        const pendingSave = inFlightSaveRef.current;
        const result = await pendingSave.catch(() => ({
          ok: false,
          draft: null,
        }));
        saveFailed ||= !result.ok;
        if (!ownsComposeSession(composeSessionVersion)) {
          return false;
        }
        if (inFlightSaveRef.current === pendingSave) {
          break;
        }
      }

      return !saveFailed && ownsComposeSession(composeSessionVersion);
    },
    [applySavedDraftResult, composerContext, ownsComposeSession],
  );

  const handleSend = useCallback(async () => {
    if (toRecipients.length === 0) {
      appMessage(
        __("Please enter at least one recipient", "pressedmail"),
        "error",
      );
      return;
    }
    // A blank subject is allowed. Fall back to "[No Subject]" rather than
    // blocking the send.
    const effectiveSubject = subject.trim()
      ? subject
      : __("[No Subject]", "pressedmail");

    const sendingAccount = resolveSendingAccount();
    const sendingAccountId = sendingAccount
      ? getAccountNumericId(sendingAccount)
      : null;
    if (!sendingAccount || sendingAccountId === null) {
      appMessage(__("Select a sending account", "pressedmail"), "error");
      return;
    }
    if (hasIncompleteDraftIdentity) {
      appMessage(
        __("Reload this draft before saving or sending it.", "pressedmail"),
        "error",
      );
      return;
    }

    const recipientEmails = [
      ...uniqueRecipientGroups.to,
      ...uniqueRecipientGroups.cc,
      ...uniqueRecipientGroups.bcc,
    ]
      .map((recipient) => recipient.email)
      .filter(Boolean);
    if (
      shouldConfirmSend(
        composerPreferences.send_safety_confirmation,
        hasExternalRecipient(recipientEmails, sendingAccount.email ?? ""),
      )
    ) {
      const confirmed = window.confirm(__("Send this message?", "pressedmail"));
      if (!confirmed) {
        return;
      }
    }

    if (!claimComposeOperation("delivery")) {
      return;
    }
    const composeSessionVersion =
      composerContext?.getComposeSessionVersion() ?? null;
    const resolvedBody =
      contentType === "plain"
        ? normalizeOutgoingPlainText(body)
        : editorRef.current?.getHTML() || body;
    const sendSnapshot: ActiveSendSnapshot = {
      composeSessionVersion,
      accountId: sendingAccountId,
      to: recipientsToString(uniqueRecipientGroups.to),
      cc: recipientsToString(uniqueRecipientGroups.cc),
      bcc: recipientsToString(uniqueRecipientGroups.bcc),
      contactListIds: getContactListRecipientDescriptors(
        uniqueRecipientGroups.to,
      ).map((list) => list.id),
      subject: effectiveSubject,
      body:
        contentType === "plain"
          ? resolvedBody
          : prepareEmailHtmlForSend(resolvedBody, { bodyBackgroundColor }),
      contentType,
      isImportant,
      mode,
      attachments: attachmentsRef.current.map((attachment) =>
        typeof File !== "undefined" && attachment instanceof File
          ? attachment
          : { ...(attachment as EmailAttachment) },
      ),
      draftAttachmentManifestComplete:
        !isContextMode ||
        composerContext!.composeData.draftAttachmentManifestComplete !== false,
      priorDraft: priorDraftRef.current ? { ...priorDraftRef.current } : null,
    };
    activeSendSnapshotRef.current = sendSnapshot;
    setIsSending(true);
    try {
      // A save establishes the authoritative identity of the server draft.
      // Sending before it settles can leave that draft behind after the
      // message is sent, so consume the same promise instead of saving again.
      if (!(await waitForPendingSaves(composeSessionVersion))) {
        return;
      }

      const activeSendSnapshot = activeSendSnapshotRef.current;
      if (
        !activeSendSnapshot ||
        activeSendSnapshot.composeSessionVersion !== composeSessionVersion
      ) {
        return;
      }

      const priorDraft = activeSendSnapshot.priorDraft;
      if (
        priorDraft &&
        (priorDraft.accountId === null ||
          priorDraft.accountId !== activeSendSnapshot.accountId)
      ) {
        appMessage(
          __(
            "Switch back to the draft's account before saving or sending it.",
            "pressedmail",
          ),
          "error",
        );
        return;
      }
      if (priorDraft && (!priorDraft.uidValidity || !priorDraft.messageId)) {
        appMessage(
          __("Reload this draft before saving or sending it.", "pressedmail"),
          "error",
        );
        return;
      }

      const formData = new FormData();
      formData.append("to", activeSendSnapshot.to);
      formData.append("cc", activeSendSnapshot.cc);
      formData.append("bcc", activeSendSnapshot.bcc);
      formData.append(
        "contact_list_ids",
        JSON.stringify(activeSendSnapshot.contactListIds),
      );
      formData.append("subject", activeSendSnapshot.subject);
      formData.append("body", activeSendSnapshot.body);
      formData.append("content_type", activeSendSnapshot.contentType);
      formData.append("account_id", String(activeSendSnapshot.accountId));
      // Sender-set importance: stamp the cross-provider priority headers on send.
      if (activeSendSnapshot.isImportant) {
        formData.append("importance", "high");
      }

      const currentAttachments = activeSendSnapshot.attachments;
      const maxBytes = resolveMaxAttachmentBytes(maxAttachmentSizeMb);
      const oversizedUpload = currentAttachments.find(
        (file) => file instanceof File && file.size > maxBytes,
      );

      if (oversizedUpload instanceof File) {
        appMessage(
          __(
            "One or more attachments exceed the configured size limit.",
            "pressedmail",
          ),
          "error",
        );
        return;
      }

      appendAttachmentsToFormData(
        formData,
        currentAttachments,
        priorDraft !== null,
        activeSendSnapshot.draftAttachmentManifestComplete,
      );
      if (priorDraft) {
        formData.append("prior_draft_uid", priorDraft.uid);
        formData.append("prior_draft_folder", priorDraft.folder);
        formData.append("draft_account_id", String(priorDraft.accountId));
        formData.append("prior_draft_uidvalidity", priorDraft.uidValidity!);
        formData.append("prior_draft_message_id", priorDraft.messageId!);
        formData.append(
          "draft_attachment_manifest_complete",
          activeSendSnapshot.draftAttachmentManifestComplete ? "1" : "0",
        );
      }

      // Reply flag
      if (
        activeSendSnapshot.mode === "reply" ||
        activeSendSnapshot.mode === "reply-all"
      ) {
        formData.append("is_reply", "true");
      }

      if (__IS_PRO__ && undoSendEnabled) {
        if (currentAttachments.length > 0) {
          appMessage(
            __(
              "Undo message is not available for messages with attachments yet.",
              "pressedmail",
            ),
            "error",
          );
          return;
        }

        const saved = await saveDraftToServer(
          {
            silent: true,
            subject: activeSendSnapshot.subject,
            body: activeSendSnapshot.body,
            to: activeSendSnapshot.to,
            cc: activeSendSnapshot.cc,
            bcc: activeSendSnapshot.bcc,
            contactListIds: activeSendSnapshot.contactListIds,
            contentType: activeSendSnapshot.contentType,
            accountId: activeSendSnapshot.accountId,
            attachments: activeSendSnapshot.attachments,
            draftAttachmentManifestComplete:
              activeSendSnapshot.draftAttachmentManifestComplete,
          },
          true,
        );
        if (!saved.ok || !saved.draft) {
          return;
        }

        formData.append("draft_uid", saved.draft.draft_uid);
        formData.append("draft_folder", saved.draft.draft_folder);
        formData.append("draft_uidvalidity", saved.draft.draft_uidvalidity);
        formData.append("draft_message_id", saved.draft.draft_message_id);

        const response = (await apiForm(
          `${routeApiPrefix}/undo-send/queue`,
          formData,
        )) as {
          status?: string | number;
          message?: string;
          data?: {
            id?: number | string;
            send_at?: string;
            delay_seconds?: number;
            remaining_seconds?: number;
          };
        };

        if (response.status !== "success") {
          appMessage(
            response?.message ||
              __("Unable to queue the message right now.", "pressedmail"),
            "error",
          );
          throw new Error(response?.message || "Failed to queue email");
        }

        const pendingId = Number(response.data?.id);
        showUndoSend({
          id: Number.isFinite(pendingId) ? pendingId : 0,
          subject: activeSendSnapshot.subject,
          sendAt: response.data?.send_at,
          delaySeconds:
            response.data?.delay_seconds ||
            response.data?.remaining_seconds ||
            undoSendDelaySeconds,
        });

        if (ownsComposeSession(composeSessionVersion)) {
          clearForm();
          localStorage.removeItem("compose-draft");
          localStorage.removeItem("pressedmail-compose-draft");
          onSendSuccess?.();
          onClose?.();
        }
        return;
      }

      const response = await apiForm(sendEmailRouteApi, formData);

      if (response.status !== 200) {
        appMessage(
          response?.message ||
            __("Unable to send the message right now.", "pressedmail"),
          "error",
        );
        throw new Error(response?.message || "Failed to send email");
      }

      appMessage(
        response?.message || __("Message sent successfully!", "pressedmail"),
        "success",
      );

      // Invalidate all message caches for this account so the Sent folder
      // reflects the new message on next visit. Omitting `folder` acts as a
      // wildcard covering all provider Sent folder names ("[Gmail]/Sent Mail",
      // "Sent Items", "Sent", etc.).
      getCacheService().invalidateMessages({
        accountId: String(activeSendSnapshot.accountId),
      });
      // Bump the account to the front of the sync queue so the server-side
      // mirror picks up the sent message quickly. Fire-and-forget.
      void refreshAccountSync([activeSendSnapshot.accountId]).catch(() => {});

      if (ownsComposeSession(composeSessionVersion)) {
        clearForm();
        localStorage.removeItem("compose-draft");
        localStorage.removeItem("pressedmail-compose-draft");
        onSendSuccess?.();
        onClose?.();
      }
    } catch (error) {
      console.error("[useComposeForm] send failed", error);
    } finally {
      if (
        activeSendSnapshotRef.current?.composeSessionVersion ===
        composeSessionVersion
      ) {
        activeSendSnapshotRef.current = null;
      }
      releaseComposeOperation("delivery");
      if (mountedRef.current) {
        setIsSending(false);
      }
    }
  }, [
    toRecipients,
    ccRecipients,
    bccRecipients,
    uniqueRecipientGroups,
    subject,
    body,
    bodyBackgroundColor,
    contentType,
    isImportant,
    hasIncompleteDraftIdentity,
    composerContext,
    isContextMode,
    mode,
    quotedTextInput,
    showQuotedText,
    resolveSendingAccount,
    maxAttachmentSizeMb,
    editorRef,
    undoSendEnabled,
    undoSendDelaySeconds,
    saveDraftToServer,
    showUndoSend,
    clearForm,
    onClose,
    onSendSuccess,
    ownsComposeSession,
    composerPreferences.send_safety_confirmation,
    claimComposeOperation,
    releaseComposeOperation,
    waitForPendingSaves,
  ]);

  // Commit the composer to a scheduled-email row. Shared by the Schedule button
  // and by every persist path taken while editing an already-scheduled email,
  // because the row (not the IMAP draft) is what the sender reads at send time.
  const submitScheduledEmail = useCallback(
    async (
      scheduledAt: Date | string,
      submitOptions: {
        /** Suppress the toast and keep the composer open (in-place edit save). */
        silent?: boolean;
        /** Run inside an operation another handler already claimed. */
        allowDuringOperation?: boolean;
      } = {},
    ): Promise<boolean> => {
      if (__IS_FREE__) return false;
      const silent = submitOptions.silent === true;
      const allowDuringOperation = submitOptions.allowDuringOperation === true;
      const hasRecipient =
        toRecipients.length > 0 ||
        ccRecipients.length > 0 ||
        bccRecipients.length > 0;

      if (!hasRecipient) {
        appMessage(
          __("Please enter at least one recipient", "pressedmail"),
          "error",
        );
        return false;
      }
      // A blank subject is allowed. Fall back to "[No Subject]".
      const effectiveSubject = subject.trim()
        ? subject
        : __("[No Subject]", "pressedmail");

      const sendingAccountId = getSendingAccountId();
      if (sendingAccountId === null) {
        appMessage(__("Select a sending account", "pressedmail"), "error");
        return false;
      }
      if (hasIncompleteDraftIdentity) {
        appMessage(
          __("Reload this draft before scheduling it.", "pressedmail"),
          "error",
        );
        return false;
      }

      // Only durable Media Library attachments survive to send time. Dropping
      // the rest is irreversible once the composer closes, so ask first rather
      // than posting a notice the user cannot act on.
      const scheduledAttachments = serializeScheduledAttachments(attachments);
      const droppedAttachments =
        attachments.length - scheduledAttachments.length;
      if (droppedAttachments > 0) {
        const confirmed = window.confirm(
          sprintf(
            /* translators: %d: number of uploaded files that cannot be scheduled. */
            __(
              "Uploaded files cannot be scheduled, so %d of them will not go out with this message. Add them to the Media Library to include them. Schedule it anyway?",
              "pressedmail",
            ),
            droppedAttachments,
          ),
        );
        if (!confirmed) {
          return false;
        }
      }

      if (!allowDuringOperation && !claimComposeOperation("delivery")) {
        return false;
      }
      const composeSessionVersion = getComposeSessionVersion();
      const scheduledBody =
        contentType === "plain"
          ? normalizeOutgoingPlainText(body)
          : prepareEmailHtmlForSend(editorRef.current?.getHTML() || body, {
              bodyBackgroundColor,
            });
      setIsScheduling(true);
      try {
        if (!(await waitForPendingSaves(composeSessionVersion))) {
          return false;
        }

        const priorDraft = priorDraftRef.current
          ? { ...priorDraftRef.current }
          : null;
        if (
          priorDraft &&
          (priorDraft.accountId === null ||
            priorDraft.accountId !== sendingAccountId)
        ) {
          appMessage(
            __(
              "Switch back to the draft's account before scheduling it.",
              "pressedmail",
            ),
            "error",
          );
          return false;
        }
        if (priorDraft && (!priorDraft.uidValidity || !priorDraft.messageId)) {
          appMessage(
            __("Reload this draft before scheduling it.", "pressedmail"),
            "error",
          );
          return false;
        }

        const apiUrl = window.pressedmailPlugin?.apiUrl || "";

        const endpoint = isScheduledEdit
          ? `${apiUrl}${getRuntimeRestNamespace()}/scheduled-emails/update/${scheduledEmailId}`
          : `${apiUrl}${getRuntimeRestNamespace()}/scheduled-emails/schedule`;
        const response = await apiFetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            account_id: sendingAccountId,
            to_addresses: recipientsToString(uniqueRecipientGroups.to),
            cc_addresses:
              recipientsToString(uniqueRecipientGroups.cc) || undefined,
            bcc_addresses:
              recipientsToString(uniqueRecipientGroups.bcc) || undefined,
            contact_list_ids: getContactListRecipientDescriptors(
              uniqueRecipientGroups.to,
            ).map((list) => list.id),
            subject: effectiveSubject,
            body: scheduledBody,
            ...(contentType === "html" && bodyBackgroundColor
              ? { body_background_color: bodyBackgroundColor }
              : {}),
            content_type: contentType,
            attachments: scheduledAttachments,
            scheduled_at:
              typeof scheduledAt === "string"
                ? scheduledAt
                : scheduledAt.toISOString(),
            importance: isImportant ? "high" : undefined,
            ...(priorDraft
              ? {
                  prior_draft_uid: priorDraft.uid,
                  prior_draft_folder: priorDraft.folder,
                  prior_draft_account_id: priorDraft.accountId,
                  prior_draft_uidvalidity: priorDraft.uidValidity,
                  prior_draft_message_id: priorDraft.messageId,
                }
              : {}),
          }),
        });

        const result = await response.json();

        if (result.status !== "success") {
          // A mailbox with no stored secret answers the DTO 409 shape, which
          // nests its message under `data`. apiFetch has already raised the
          // reconnect banner by then; this just keeps the toast from saying
          // something less useful than the reason.
          appMessage(
            result.message ||
              result.data?.message ||
              __("Failed to schedule email", "pressedmail"),
            "error",
          );
          return false;
        }

        // The server replaced the IMAP draft, so the identity this composer
        // held is dead. Drop it so no later discard can try to delete it, but
        // only while this is still the same compose session: a replacement
        // compose owns these refs now and its own content is unsaved.
        if (ownsComposeSession(composeSessionVersion)) {
          priorDraftRef.current = null;
          openedDraftIdentityRef.current = null;
          lastSavedDraftSnapshotRef.current = getDraftSnapshot();
        }

        if (!silent) {
          appMessage(
            isScheduledEdit
              ? __("Scheduled email updated", "pressedmail")
              : __("Email scheduled successfully", "pressedmail"),
            "success",
          );
        }
        onDraftSaved?.(priorDraft?.folder);
        onScheduledChanged?.();
        return true;
      } catch (error) {
        console.error("[useComposeForm] schedule failed", error);
        appMessage(
          __("Failed to schedule email. Please try again.", "pressedmail"),
          "error",
        );
        return false;
      } finally {
        if (!allowDuringOperation) {
          releaseComposeOperation("delivery");
        }
        if (mountedRef.current) {
          setIsScheduling(false);
        }
      }
    },
    [
      getDraftSnapshot,
      onScheduledChanged,
      toRecipients,
      ccRecipients,
      bccRecipients,
      uniqueRecipientGroups,
      subject,
      body,
      bodyBackgroundColor,
      contentType,
      attachments,
      isImportant,
      hasIncompleteDraftIdentity,
      getSendingAccountId,
      editorRef,
      isScheduledEdit,
      scheduledEmailId,
      claimComposeOperation,
      getComposeSessionVersion,
      onDraftSaved,
      ownsComposeSession,
      releaseComposeOperation,
      waitForPendingSaves,
    ],
  );

  const handleSchedule = useCallback(
    async (scheduledAt: Date) => {
      if (__IS_FREE__) return;
      const composeSessionVersion = getComposeSessionVersion();
      if (
        (await submitScheduledEmail(scheduledAt)) &&
        ownsComposeSession(composeSessionVersion)
      ) {
        clearForm();
        onClose?.();
      }
    },
    [
      submitScheduledEmail,
      clearForm,
      getComposeSessionVersion,
      onClose,
      ownsComposeSession,
    ],
  );

  // Persist composer edits back onto an armed schedule without changing its
  // time. Every close/save path uses this while editing a scheduled email,
  // because the send reads the row, not the IMAP draft it left in Drafts.
  const saveScheduledEdits = useCallback(
    async (allowDuringOperation = false): Promise<boolean> => {
      if (!isScheduledEdit || !scheduledAt) {
        return false;
      }
      // Pass the stored GMT string straight through. Parsing it into a JS Date
      // would read it as local time and shift the send by the UTC offset on
      // every edit.
      return submitScheduledEmail(scheduledAt, {
        silent: true,
        allowDuringOperation,
      });
    },
    [isScheduledEdit, scheduledAt, submitScheduledEmail],
  );

  // POST one scheduled-email lifecycle action for the row this composer edits.
  const postScheduledEmailAction = useCallback(
    async (
      action: "cancel" | "send-now" | "delete",
      payload?: Record<string, unknown>,
    ): Promise<{
      status?: string;
      message?: string;
      data?: unknown;
    } | null> => {
      if (__IS_FREE__) return null;
      if (typeof scheduledEmailId !== "number") {
        return null;
      }
      const apiUrl = window.pressedmailPlugin?.apiUrl || "";
      const response = await apiFetch(
        `${apiUrl}${getRuntimeRestNamespace()}/scheduled-emails/${action}/${scheduledEmailId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload ?? {}),
        },
      );
      return (await response.json()) as {
        status?: string;
        message?: string;
        data?: unknown;
      };
    },
    [scheduledEmailId],
  );

  const handleRemoveSchedule = useCallback(async () => {
    if (__IS_FREE__) return;
    if (!isScheduledEdit || typeof scheduledEmailId !== "number") {
      return;
    }

    if (!claimComposeOperation("save-close")) {
      return;
    }
    const composeSessionVersion = getComposeSessionVersion();
    setIsScheduling(true);
    try {
      if (!(await waitForPendingSaves(composeSessionVersion))) {
        return;
      }
      // Cancel first. Editing no longer unschedules on open, so this button is
      // the only thing that disarms the send, and the handoff hands the IMAP
      // copy back as a plain draft the save below can replace.
      const prior = priorDraftRef.current;
      const cancelled = await postScheduledEmailAction("cancel", {
        intent: "edit",
        require_draft_handoff: true,
        ...(prior
          ? {
              prior_draft_uid: prior.uid,
              prior_draft_folder: prior.folder,
              prior_draft_account_id: prior.accountId,
              prior_draft_uidvalidity: prior.uidValidity,
              prior_draft_message_id: prior.messageId,
            }
          : {}),
      });
      if (cancelled?.status !== "success") {
        appMessage(
          cancelled?.message ||
            __("Failed to remove schedule. Please try again.", "pressedmail"),
          "error",
        );
        return;
      }
      const handedOff = parseScheduledDraftHandoff(cancelled);
      if (handedOff) {
        priorDraftRef.current = {
          uid: handedOff.draft_uid,
          folder: handedOff.draft_folder,
          accountId: handedOff.draft_account_id,
          uidValidity: String(handedOff.draft_uidvalidity),
          messageId: handedOff.draft_message_id,
        };
        openedDraftIdentityRef.current = `${String(handedOff.draft_account_id)}::${handedOff.draft_folder}::${handedOff.draft_uid}::${String(handedOff.draft_uidvalidity)}::${handedOff.draft_message_id}`;
      }
      onScheduledChanged?.();
      const saved = await saveDraftToServer(undefined, true);
      if (!saved.ok || !ownsComposeSession(composeSessionVersion)) {
        return;
      }
      appMessage(
        __("Schedule removed. The message remains in Drafts.", "pressedmail"),
        "success",
      );
      clearForm();
      onClose?.();
    } catch (error) {
      console.error("[useComposeForm] remove schedule failed", error);
      appMessage(
        __("Failed to remove schedule. Please try again.", "pressedmail"),
        "error",
      );
    } finally {
      releaseComposeOperation("save-close");
      if (mountedRef.current) {
        setIsScheduling(false);
      }
    }
  }, [
    clearForm,
    claimComposeOperation,
    getComposeSessionVersion,
    isScheduledEdit,
    onClose,
    onScheduledChanged,
    ownsComposeSession,
    postScheduledEmailAction,
    releaseComposeOperation,
    saveDraftToServer,
    scheduledEmailId,
    waitForPendingSaves,
  ]);

  // The Send button while a schedule is armed. Push the edits onto the row,
  // then let the server run its normal scheduled delivery immediately, so the
  // send, the Sent copy and the draft cleanup all follow one code path.
  const handleScheduledSendNow = useCallback(async () => {
    if (__IS_FREE__) return;
    if (!isScheduledEdit || typeof scheduledEmailId !== "number") {
      return;
    }
    if (!claimComposeOperation("delivery")) {
      return;
    }
    setIsSending(true);
    try {
      if (!(await saveScheduledEdits(true))) {
        return;
      }
      const sent = await postScheduledEmailAction("send-now");
      if (sent?.status !== "success") {
        appMessage(
          sent?.message || __("Failed to send this email.", "pressedmail"),
          "error",
        );
        return;
      }
      appMessage(__("Email sent", "pressedmail"), "success");
      onScheduledChanged?.();
      onSendSuccess?.();
      clearForm();
      onClose?.();
    } catch (error) {
      console.error("[useComposeForm] scheduled send now failed", error);
      appMessage(
        __("Failed to send this email. Please try again.", "pressedmail"),
        "error",
      );
    } finally {
      releaseComposeOperation("delivery");
      if (mountedRef.current) {
        setIsSending(false);
      }
    }
  }, [
    claimComposeOperation,
    clearForm,
    isScheduledEdit,
    onClose,
    onScheduledChanged,
    onSendSuccess,
    postScheduledEmailAction,
    releaseComposeOperation,
    saveScheduledEdits,
    scheduledEmailId,
  ]);

  const handleSaveDraft = useCallback(
    async (opts?: { silent?: boolean }): Promise<boolean> => {
      // While a schedule is armed the row is what gets sent, so saving must
      // update the row. Writing a plain draft instead would leave the old body
      // queued and the edit would silently never go out.
      if (isScheduledEdit) {
        return saveScheduledEdits();
      }
      const result = await saveDraftToServer(opts);
      return result.ok;
    },
    [isScheduledEdit, saveScheduledEdits, saveDraftToServer],
  );

  const hasUnsavedDraftChanges = useCallback(
    () => lastSavedDraftSnapshotRef.current !== getDraftSnapshot(),
    [getDraftSnapshot],
  );

  const hasComposedDraftContent = useCallback(() => {
    const isGeneratedMessage =
      (mode === "reply" || mode === "reply-all" || mode === "forward") &&
      !isScheduledEdit &&
      !composerContext?.composeData.draftUid;

    if (isGeneratedMessage) {
      const initial = initialComposeStateRef.current;
      return Boolean(
        recipientsToString(toRecipients) !== initial.to ||
        recipientsToString(ccRecipients) !== initial.cc ||
        recipientsToString(bccRecipients) !== initial.bcc ||
        JSON.stringify(
          getContactListRecipientDescriptors(toRecipients).map(
            (list) => list.id,
          ),
        ) !== JSON.stringify(initial.contactListIds) ||
        subject !== initial.subject ||
        bodyHasUserContent(body, mode, contentType) !== initial.authoredBody ||
        contentType !== initial.contentType ||
        (bodyBackgroundColor ?? "") !== initial.bodyBackgroundColor ||
        JSON.stringify(attachments.map(describeAttachmentForDraftSnapshot)) !==
          JSON.stringify(initial.attachments),
      );
    }

    return Boolean(
      bodyHasUserContent(body, mode, contentType) ||
      bodyBackgroundColor ||
      toRecipients.length > 0 ||
      ccRecipients.length > 0 ||
      bccRecipients.length > 0 ||
      subject ||
      attachments.length > 0,
    );
  }, [
    attachments,
    bccRecipients,
    body,
    bodyBackgroundColor,
    ccRecipients,
    composerContext?.composeData.draftUid,
    contentType,
    isScheduledEdit,
    mode,
    subject,
    toRecipients,
  ]);

  // Resolves true when there is nothing to save or the save landed. The caller
  // clears the composer on true, so a failed save must report false: the local
  // copy is the only copy left at that point.
  const saveDraftOnExplicitClose = useCallback(async (): Promise<boolean> => {
    if (!claimComposeOperation("save-close")) {
      return false;
    }
    const composeSessionVersion = getComposeSessionVersion();
    try {
      if (!(await waitForPendingSaves(composeSessionVersion))) {
        return false;
      }
      if (!hasUnsavedDraftChanges()) {
        return true;
      }
      if (isScheduledEdit) {
        return saveScheduledEdits(true);
      }
      const result = await saveDraftToServer(undefined, true);
      return result.ok;
    } finally {
      releaseComposeOperation("save-close");
    }
  }, [
    claimComposeOperation,
    getComposeSessionVersion,
    hasUnsavedDraftChanges,
    isScheduledEdit,
    releaseComposeOperation,
    saveScheduledEdits,
    saveDraftToServer,
    waitForPendingSaves,
  ]);

  const [showDiscardDialog, setShowDiscardDialog] = useState(false);
  const pendingNavigationRef = useRef<(() => void) | null>(null);
  // Cancel callback for the pending navigation (router blockers use it to
  // reset their blocked state when the user keeps editing).
  const pendingNavigationCancelRef = useRef<(() => void) | null>(null);

  // Discarding a compose session backed by a server draft must delete that
  // IMAP draft before the composer and reading pane are cleared. apiForm
  // resolves HTTP/network failures as error envelopes, so inspect the result.
  const deletePriorDraftFromServer = useCallback(async (): Promise<boolean> => {
    if (!claimComposeOperation("discard")) {
      return false;
    }
    const composeSessionVersion =
      composerContext?.getComposeSessionVersion() ?? null;
    try {
      // Drain the live save tail, not one captured promise. A save queued while
      // another save settles can otherwise append after the delete.
      if (!(await waitForPendingSaves(composeSessionVersion))) {
        return false;
      }
      if (
        !ownsComposeSession(composeSessionVersion) ||
        hasIncompleteDraftIdentity
      ) {
        appMessage(
          __("Could not delete the draft from the server.", "pressedmail"),
          "error",
        );
        return false;
      }

      const prior = priorDraftRef.current ? { ...priorDraftRef.current } : null;
      if (!prior) {
        return true;
      }

      const accountId = prior.accountId;
      if (!accountId || !prior.uidValidity || !prior.messageId) {
        appMessage(
          __("Could not delete the draft from the server.", "pressedmail"),
          "error",
        );
        return false;
      }

      // The server discards a bound draft only when the whole identity is
      // present and self-consistent (parse_bound_draft_discard). Sending a
      // partial one is rejected before any IMAP work with "The draft identity
      // is incomplete", which the composer can only retry, forever.
      const response = (await apiForm(deleteEmailFromImapRouteApi, {
        account_id: String(accountId),
        uid: prior.uid,
        folder: prior.folder,
        prior_draft_uid: prior.uid,
        prior_draft_folder: prior.folder,
        draft_account_id: String(accountId),
        prior_draft_uidvalidity: prior.uidValidity,
        prior_draft_message_id: prior.messageId,
      })) as { status?: string | number; message?: string };
      if (response?.status !== "success" && response?.status !== 200) {
        appMessage(
          response?.message ||
            __("Could not delete the draft from the server.", "pressedmail"),
          "error",
        );
        return false;
      }
      if (!ownsComposeSession(composeSessionVersion)) {
        return false;
      }

      priorDraftRef.current = null;
      openedDraftIdentityRef.current = null;
      onDraftDiscarded?.(prior.folder);
      onDraftSaved?.(prior.folder);
      return true;
    } catch {
      appMessage(
        __("Could not delete the draft from the server.", "pressedmail"),
        "error",
      );
      return false;
    } finally {
      releaseComposeOperation("discard");
    }
  }, [
    claimComposeOperation,
    composerContext,
    hasIncompleteDraftIdentity,
    onDraftDiscarded,
    onDraftSaved,
    ownsComposeSession,
    releaseComposeOperation,
    waitForPendingSaves,
  ]);

  // Throw away whatever this composer is backed by. An armed schedule means the
  // row and its IMAP copy go together: deleting only the draft would leave the
  // row queued to send a message the user just discarded.
  const discardComposeTarget = useCallback(async (): Promise<boolean> => {
    if (!isScheduledEdit) {
      return deletePriorDraftFromServer();
    }
    if (!claimComposeOperation("discard")) {
      return false;
    }
    try {
      const deleted = await postScheduledEmailAction("delete");
      if (deleted?.status !== "success") {
        appMessage(
          deleted?.message ||
            __("Could not delete this scheduled email.", "pressedmail"),
          "error",
        );
        return false;
      }
      priorDraftRef.current = null;
      openedDraftIdentityRef.current = null;
      onScheduledChanged?.();
      onDraftSaved?.();
      return true;
    } catch (error) {
      console.error("[useComposeForm] scheduled discard failed", error);
      appMessage(
        __("Could not delete this scheduled email.", "pressedmail"),
        "error",
      );
      return false;
    } finally {
      releaseComposeOperation("discard");
    }
  }, [
    claimComposeOperation,
    deletePriorDraftFromServer,
    isScheduledEdit,
    onDraftSaved,
    onScheduledChanged,
    postScheduledEmailAction,
    releaseComposeOperation,
  ]);

  const handleDiscard = useCallback(async () => {
    if (operationGateRef.current) {
      return;
    }
    if (pendingInlineImageUploadsRef.current > 0) {
      appMessage(
        __("Wait for the image upload to finish.", "pressedmail"),
        "error",
      );
      return;
    }
    const hasDirtyContent = hasComposedDraftContent();
    const hasPendingDraftChanges = hasDirtyContent && hasUnsavedDraftChanges();
    if (hasPendingDraftChanges) {
      if (autoSaveOnClose) {
        if (closeAutoSaveStartedRef.current) {
          return;
        }

        closeAutoSaveStartedRef.current = true;
        if (!(await saveDraftOnExplicitClose())) {
          // Nothing reached the server, so keep the composer and let the user
          // retry instead of dropping the message on the floor.
          closeAutoSaveStartedRef.current = false;
          return;
        }
        clearForm();
        onClose?.();
        return;
      }
      if (!composerPreferences.composer_confirm_unsaved_close) {
        if (!(await discardComposeTarget())) {
          return;
        }
        localStorage.removeItem("pressedmail-compose-draft");
        localStorage.removeItem("compose-draft");
        dirtyRef.current = false;
        clearForm();
        onClose?.();
        return;
      }
      setShowDiscardDialog(true);
      return;
    }
    // Nothing pending. An empty composer discards its server draft; a composer
    // holding content that is already saved just closes, because deleting here
    // would throw away the draft the user saved a moment ago.
    if (!hasDirtyContent && !(await discardComposeTarget())) {
      return;
    }
    localStorage.removeItem("pressedmail-compose-draft");
    localStorage.removeItem("compose-draft");
    clearForm();
    onClose?.();
  }, [
    hasComposedDraftContent,
    hasUnsavedDraftChanges,
    autoSaveOnClose,
    saveDraftOnExplicitClose,
    discardComposeTarget,
    clearForm,
    onClose,
    composerPreferences.composer_confirm_unsaved_close,
  ]);

  const consumePendingNavigation = useCallback(() => {
    const action = pendingNavigationRef.current;
    pendingNavigationRef.current = null;
    pendingNavigationCancelRef.current = null;
    if (action) action();
  }, []);

  // Drop a queued navigation without running it, and let whoever blocked it
  // (the router blocker, the message list) reset. Used when an exit path fails:
  // the composer stays open, so the pending action must not linger and fire
  // later against stale state.
  const abandonPendingNavigation = useCallback(() => {
    pendingNavigationRef.current = null;
    const cancel = pendingNavigationCancelRef.current;
    pendingNavigationCancelRef.current = null;
    cancel?.();
  }, []);

  const handleDiscardConfirm = useCallback(async () => {
    if (operationGateRef.current) {
      return;
    }
    if (pendingInlineImageUploadsRef.current > 0) {
      appMessage(
        __("Wait for the image upload to finish.", "pressedmail"),
        "error",
      );
      return;
    }
    setShowDiscardDialog(false);
    if (!(await discardComposeTarget())) {
      // Reopening the dialog here loops forever whenever the discard cannot
      // succeed: same state, same click, same failure. Report it once, release
      // the blocked navigation, and let the user decide what to do next.
      abandonPendingNavigation();
      return;
    }
    localStorage.removeItem("pressedmail-compose-draft");
    localStorage.removeItem("compose-draft");
    // Clear dirtiness synchronously: onClose/consumePendingNavigation may
    // navigate before the dirty-tracking effect re-runs, and a stale dirty
    // flag would re-trigger the route blocker on that navigation.
    dirtyRef.current = false;
    clearForm();
    onClose?.();
    consumePendingNavigation();
  }, [
    abandonPendingNavigation,
    discardComposeTarget,
    clearForm,
    onClose,
    consumePendingNavigation,
  ]);

  const handleDiscardSaveAndClose = useCallback(async () => {
    if (operationGateRef.current) {
      return;
    }
    if (pendingInlineImageUploadsRef.current > 0) {
      appMessage(
        __("Wait for the image upload to finish.", "pressedmail"),
        "error",
      );
      return;
    }
    // Wait for the save. clearForm() wipes the localStorage-backed compose
    // state, so closing before the server answers would destroy the message on
    // a failed save and leave the user nothing to retry with.
    if (!(await saveDraftOnExplicitClose())) {
      // The save failed and said why. Close the dialog anyway so the user is not
      // stuck re-firing the same failing save from a modal they cannot dismiss.
      setShowDiscardDialog(false);
      abandonPendingNavigation();
      return;
    }
    setShowDiscardDialog(false);
    dirtyRef.current = false;
    clearForm();
    onClose?.();
    consumePendingNavigation();
  }, [
    abandonPendingNavigation,
    saveDraftOnExplicitClose,
    clearForm,
    onClose,
    consumePendingNavigation,
  ]);

  const handleDiscardCancel = useCallback(() => {
    setShowDiscardDialog(false);
    // A stuck gate makes every later close silently no-op, so the X button
    // looks dead. Keep Editing is the one path that always ends an operation.
    operationGateRef.current = null;
    if (mountedRef.current) {
      setIsDiscarding(false);
    }
    pendingNavigationRef.current = null;
    const cancel = pendingNavigationCancelRef.current;
    pendingNavigationCancelRef.current = null;
    cancel?.();
  }, []);

  // Refs capture latest values so navigation guards don't have to depend on
  // changing state. Auto-save applies to explicit close and guarded navigation.
  const autoSaveOnCloseRef = useRef(autoSaveOnClose);
  const dirtyRef = useRef(false);

  useEffect(() => {
    autoSaveOnCloseRef.current = autoSaveOnClose;
    const hasDirtyContent = hasComposedDraftContent();
    dirtyRef.current = hasDirtyContent && hasUnsavedDraftChanges();

    if (!hasDirtyContent) {
      closeAutoSaveStartedRef.current = false;
    }
  }, [autoSaveOnClose, hasComposedDraftContent, hasUnsavedDraftChanges]);

  // Refs for the navigation guard so the registered callback always sees
  // the latest cleanup helpers without re-registering on every render.
  const clearFormRef = useRef(clearForm);
  const onCloseRef = useRef(onClose);
  const saveDraftOnExplicitCloseRef = useRef(saveDraftOnExplicitClose);
  useEffect(() => {
    clearFormRef.current = clearForm;
    onCloseRef.current = onClose;
    saveDraftOnExplicitCloseRef.current = saveDraftOnExplicitClose;
  }, [clearForm, onClose, saveDraftOnExplicitClose]);

  // Register a guard with ComposerContext so outside navigation (e.g. clicking
  // a different email in the list, a route change, or a wp-admin link) routes
  // through this compose instance. Also expose dirtiness so global blockers
  // (ComposeNavigationBlocker) can decide lazily whether to block at all.
  useEffect(() => {
    if (!gateNavigation || !composerContext) return;

    const guard = ({
      action,
      onCancel,
    }: {
      action: () => void;
      onCancel?: () => void;
    }) => {
      if (operationGateRef.current) {
        onCancel?.();
        return;
      }
      if (!dirtyRef.current && pendingInlineImageUploadsRef.current === 0) {
        localStorage.removeItem("pressedmail-compose-draft");
        localStorage.removeItem("compose-draft");
        clearFormRef.current();
        onCloseRef.current?.();
        action();
        return;
      }

      if (autoSaveOnCloseRef.current) {
        if (closeAutoSaveStartedRef.current) return;
        closeAutoSaveStartedRef.current = true;
        void saveDraftOnExplicitCloseRef.current().then((saved) => {
          if (!saved) {
            closeAutoSaveStartedRef.current = false;
            onCancel?.();
            return;
          }

          dirtyRef.current = false;
          clearFormRef.current();
          onCloseRef.current?.();
          action();
        });
        return;
      }

      pendingNavigationRef.current = action;
      pendingNavigationCancelRef.current = onCancel ?? null;
      setShowDiscardDialog(true);
    };

    const unregisterGuard = composerContext.registerNavigationGuard(guard);
    const unregisterDirty = composerContext.registerDirtyChecker(
      () => dirtyRef.current || pendingInlineImageUploadsRef.current > 0,
    );
    return () => {
      unregisterGuard();
      unregisterDirty();
    };
  }, [gateNavigation, composerContext]);

  // The mount effect composes the body (leading blanks + default signature)
  // and tries to push it into the editor. When signatures
  // are already cached at mount, that push runs before the TipTap editor
  // exists (deferred creation), so `setContent` no-ops and the signature lands
  // only in `body` (preview), never as editable editor content. This flushes
  // the composed body into the editor the moment it signals ready, exactly
  // once, so the auto-inserted signature is editable.
  const handleEditorReady = useCallback(
    (editor: EmailEditorRef | null) => {
      if (!editor) {
        // Editor unmounted; allow a fresh flush if it remounts.
        editorReadyFlushedRef.current = false;
        return;
      }
      if (editorReadyFlushedRef.current) return;
      editorReadyFlushedRef.current = true;

      const composed = latestBodyRef.current;
      if (composed && editorRef.current) {
        editorRef.current.setContent?.(composed);
        editorRef.current.focusStart?.();
      }
    },
    [editorRef],
  );

  const handleSignatureSelect = useCallback(
    (signatureId: number) => {
      const signature = signatures.find((s) => s.id === signatureId);
      if (!signature) return;

      const currentBody =
        contentType === "plain"
          ? body || ""
          : editorRef.current?.getHTML() || body || "";
      // Place above the <hr> separator on reply/forward (same as auto-insert),
      // replacing any existing block, never appended below the quoted text.
      const updatedBody =
        contentType === "plain"
          ? applyPlainTextSignature(currentBody, signature, mode)
          : applySignature(currentBody, signature, {
              mode,
              replaceExisting: true,
              placement: composerPreferences.composer_signature_placement,
            });
      appliedSignatureIdRef.current = signature.id;

      if (contentType === "html" && editorRef.current) {
        editorRef.current.setContent(updatedBody);
      } else {
        setBody(updatedBody);
      }
      appMessage(__("Signature applied", "pressedmail"), "success");
    },
    [
      signatures,
      body,
      setBody,
      editorRef,
      mode,
      contentType,
      composerPreferences.composer_signature_placement,
    ],
  );

  const handleBlockInsert = useCallback(
    (html: string) => {
      if (editorRef.current) {
        editorRef.current.insertContent(html);
      } else {
        setBody(body + html);
      }
      appMessage(__("Block inserted", "pressedmail"), "success");
    },
    [body, setBody, editorRef],
  );

  const appendAttachmentFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      const maxBytes = resolveMaxAttachmentBytes(maxAttachmentSizeMb);
      warnOversizedAttachments(
        files.filter((f) => f.size > maxBytes).map((f) => f.name),
        maxAttachmentSizeMb,
      );

      // One oversized file must not reject the files that were fine, the same
      // way the Media Library path already behaves.
      const allowed = files.filter((f) => f.size <= maxBytes);
      if (allowed.length === 0) return;

      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          attachments: [...(prev.attachments ?? []), ...allowed],
        }));
      } else {
        setLocalAttachments((prev) => [...prev, ...allowed]);
      }
    },
    [isContextMode, composerContext, maxAttachmentSizeMb],
  );

  const handleAttachment = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files || []);
      appendAttachmentFiles(files);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    },
    [appendAttachmentFiles],
  );

  const appendMediaLibraryAttachments = useCallback(
    (selectedAttachments: MediaPickerSelection[]) => {
      const maxBytes = resolveMaxAttachmentBytes(maxAttachmentSizeMb);
      warnOversizedAttachments(
        selectedAttachments
          .filter((attachment) => attachment.size > maxBytes)
          .map((attachment) => attachment.filename),
        maxAttachmentSizeMb,
      );

      const allowedAttachments: EmailAttachment[] = selectedAttachments
        .filter((attachment) => attachment.size <= maxBytes)
        .map((attachment) => ({
          id: `wp-media-${attachment.id}`,
          wpAttachmentId: attachment.id,
          filename: attachment.filename,
          mimeType: attachment.mimeType,
          size: attachment.size,
          url: attachment.url,
          source: "media-library",
        }));

      if (allowedAttachments.length === 0) {
        return;
      }

      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          attachments: [...(prev.attachments ?? []), ...allowedAttachments],
        }));
      } else {
        setLocalAttachments((prev) => [...prev, ...allowedAttachments]);
      }

      appMessage(__("Media Library files attached", "pressedmail"), "success");
    },
    [composerContext, isContextMode, maxAttachmentSizeMb],
  );

  const { openMediaPicker } = useMediaLibraryPicker();

  const handleMediaLibraryAttachment = useCallback(async () => {
    if (operationGateRef.current) {
      return;
    }
    const composeSessionVersion = getComposeSessionVersion();
    try {
      const selectedAttachments = await openMediaPicker({
        mode: "all",
        multiple: true,
      });

      if (
        operationGateRef.current ||
        !ownsComposeSession(composeSessionVersion)
      ) {
        return;
      }
      appendMediaLibraryAttachments(selectedAttachments);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : __("Failed to open the Media Library.", "pressedmail");

      if (message !== "Media selection cancelled.") {
        appMessage(message, "error");
      }
    }
  }, [
    appendMediaLibraryAttachments,
    getComposeSessionVersion,
    openMediaPicker,
    ownsComposeSession,
  ]);

  const removeAttachment = useCallback(
    (index: number) => {
      if (isContextMode) {
        composerContext!.setComposeData((prev) => ({
          ...prev,
          attachments: (prev.attachments ?? []).filter((_, i) => i !== index),
        }));
      } else {
        setLocalAttachments((prev) => prev.filter((_, i) => i !== index));
      }
    },
    [isContextMode, composerContext],
  );

  // ---------------------------------------------------------------------------
  // Computed
  // ---------------------------------------------------------------------------

  // A subject is optional. The send path substitutes "[No Subject]" when it is
  // blank, so only a recipient is required to enable sending.
  const canSend = toRecipients.length > 0;
  const modeTitle = getModeTitle(mode);

  return {
    toRecipients,
    ccRecipients,
    bccRecipients,
    subject,
    body,
    contentType,
    bodyBackgroundColor,
    canvasBackgroundColor,
    attachments,
    showCc,
    showBcc,
    isSending,
    isImportant,
    isScheduling,
    isSavingDraft,
    isDiscarding,
    pendingInlineImageUploads,
    isDraftSaved,
    showDiscardDialog,
    showQuotedText,
    quotedText: quotedTextInput,
    mode,
    modeTitle,
    fromAccount,
    isScheduledEdit,
    scheduledAt,
    canSend,
    signaturesEnabled,
    showAIPanel,
    canUploadAttachments,
    canUseMediaLibraryAttachments,
    maxAttachmentSizeMb,
    contactListsEnabled,
    signatures,
    setToRecipients,
    setCcRecipients,
    setBccRecipients,
    setSubject,
    setBody,
    replaceBodyAndContentType,
    setBodyBackgroundColor,
    setCanvasBackgroundColor,
    setIsImportant,
    setShowCc,
    setShowBcc,
    setShowQuotedText,
    setFromAccount,
    // Send on an armed schedule means "send it now", not "queue a second copy".
    handleSend: isScheduledEdit ? handleScheduledSendNow : handleSend,
    handleSchedule,
    handleRemoveSchedule,
    handleSaveDraft,
    handleDiscard,
    handleDiscardConfirm,
    handleDiscardSaveAndClose,
    handleDiscardCancel,
    handleSignatureSelect,
    handleEditorReady,
    handleBlockInsert,
    handleAttachment,
    appendAttachmentFiles,
    appendMediaLibraryAttachments,
    handleMediaLibraryAttachment,
    removeAttachment,
    beginInlineImageUpload,
    endInlineImageUpload,
    fileInputRef,
    getComposeSessionVersion,
  };
}
