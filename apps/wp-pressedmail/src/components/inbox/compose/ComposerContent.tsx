/**
 * ComposerContent: Unified email composer UI component (v3 / Plate.js).
 *
 * Renders the consistent composer layout:
 *   From row -> Addressing -> Subject -> Toolbar -> Canvas -> Attachments -> Footer
 *
 * The caller wraps this in their own container (floating window, reading pane, etc.)
 *
 * @since 3.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  getPlateEmailEditorSurfacePreset,
  type PlateEmailEditorDialect,
} from "@kit/plate/email-surfaces";

import type { EmailEditorRef } from "@/components/composer";
import { findReadOnlyBlockNodeLabels } from "@/components/composer/plate-composer-dialect";
import { ComposerPlainTextToolbar } from "./ComposerEditorToolbar";
import { ComposerAuthoringEditor } from "./ComposerAuthoringEditor";
import { buildComposerSurfaceStyle } from "./composer-background-style";
import {
  composerDefaultFormatToDialect,
  composerFontFamilyCss,
} from "@/lib/preference-behavior";
import { ComposerFooter } from "./ComposerFooter";
import {
  ComposerHeaderCloseButton,
  ComposerHeaderSendGroup,
} from "./ComposerHeaderActions";
import { ComposerAttachmentChips } from "./ComposerAttachmentChips";
import { ComposerSubjectAttachmentActions } from "./ComposerSubjectAttachmentActions";
import { ComposerAddressing } from "./ComposerAddressing";
import { ComposerFromAccountSelect } from "./ComposerFromAccountSelect";
import { ComposeContextLabel } from "./ComposeContextLabel";
import { COMPOSER_ROW_CLASS } from "@/components/compose/composer-row";
import { RECIPIENT_LABEL_CLASS } from "@/components/compose/RecipientInput";
import { ComposeDiscardDialog } from "./ComposeDiscardDialog";
import { useAppContext } from "@/context/AppProvider";
import { appMessage } from "@/context/toast";
import {
  resolveMaxAttachmentBytes,
  type UseComposeFormReturn,
} from "@/hooks/compose/v2/useComposeForm";
import { useUserPreferences } from "@/hooks/useUserPreferences";
import { useMediaLibraryPicker } from "./media-library/MediaLibraryPickerProvider";
import { uploadImage, validateImage } from "@/services/image-upload.service";
import { cn } from "@/lib/utils";
import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import {
  composerHtmlToPlainText,
  plainTextToComposerHtml,
} from "@/lib/composer/plain-text-content";

/** The two dialects the Plate editor renders. Plain is a textarea, not a dialect state. */
type ComposerBlockDialect = Exclude<PlateEmailEditorDialect, "plain">;

export interface ComposerContentProps {
  form: UseComposeFormReturn;
  editorRef: React.RefObject<EmailEditorRef | null>;
  /** Variant controls minor layout differences. */
  variant: "floating" | "pane" | "mobile";
  /** Whether to show the header bar. */
  showHeader?: boolean;
  /** Optional extra header actions rendered before standard composer controls. */
  headerActions?: React.ReactNode;
  /** Whether to show the pane pop-out action. */
  showPopOut?: boolean;
  /** Opens the pane composer in its larger pop-out modal. */
  onPopOut?: () => void;
  /** Whether to show the action that returns a popped-out pane composer. */
  showReturnToPane?: boolean;
  /** Returns the popped-out pane composer to the reading pane. */
  onReturnToPane?: () => void;
  /** Whether to show the expand-to-full-view action. */
  showFullView?: boolean;
  /** Expands the composer to fill the whole PressedMail window. */
  onFullView?: () => void;
  /** Visual variant for the header send group (Send / Save / Discard). */
  headerSendGroupVariant?: "compact" | "ribbon";
  className?: string;
}

function isSafeInlineImageUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("/")) return true;

  try {
    const url = new URL(trimmed, window.location.origin);
    return (
      (url.protocol === "https:" || url.protocol === "http:") &&
      !url.pathname.toLowerCase().endsWith(".svg")
    );
  } catch {
    return false;
  }
}

export function ComposerContent({
  form,
  editorRef,
  variant,
  showHeader = true,
  headerActions,
  showPopOut = false,
  onPopOut,
  showReturnToPane = false,
  onReturnToPane,
  showFullView = false,
  onFullView,
  headerSendGroupVariant = "compact",
  className,
}: ComposerContentProps) {
  const { accounts } = useAppContext();
  const { preferences } = useUserPreferences();
  const preferredDialect = composerDefaultFormatToDialect(
    preferences.composer_default_format,
  );
  const composerFontSizePx =
    Number(preferences.composer_default_font_size) || 14;
  const composerFontFamily = composerFontFamilyCss(
    preferences.composer_default_font,
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [showPlainTextWarning, setShowPlainTextWarning] = useState(false);
  const [pendingPlainText, setPendingPlainText] = useState("");
  // The per-compose dialect override. Plain is not held here: it is a real
  // format change and `form.contentType` already owns it.
  const [dialect, setDialect] = useState<ComposerBlockDialect>(
    form.draftDocument?.dialect ??
      (preferredDialect === "plain" ? "markdown" : preferredDialect),
  );
  useEffect(() => {
    const nextDialect = form.draftDocument?.dialect ?? preferredDialect;
    setDialect(nextDialect === "plain" ? "markdown" : nextDialect);
  }, [form.composeSessionVersion, form.draftDocument?.dialect, preferredDialect]);
  const [pendingDialect, setPendingDialect] =
    useState<ComposerBlockDialect | null>(null);
  const [pendingInertLabels, setPendingInertLabels] = useState<string[]>([]);
  const emailSurfacePreset = getPlateEmailEditorSurfacePreset("email");
  const emailSurfaceFeatures = emailSurfacePreset.features;
  const attachments = form.attachments;
  const {
    canUploadAttachments,
    canUseMediaLibraryAttachments,
    maxAttachmentSizeMb,
    setBodyBackgroundColor,
    setCanvasBackgroundColor,
    signatures,
    signaturesEnabled,
  } = form;
  const imageUploadInputRef = useRef<HTMLInputElement>(null);
  const imageUploadSessionRef = useRef<number | null | undefined>(undefined);
  const isExclusiveOperationPending =
    form.isSending || form.isScheduling || form.isDiscarding;
  const isExclusiveOperationPendingRef = useRef(isExclusiveOperationPending);
  isExclusiveOperationPendingRef.current = isExclusiveOperationPending;
  useEffect(() => {
    if (!isExclusiveOperationPending) return;
    setShowPlainTextWarning(false);
    setPendingPlainText("");
    setPendingDialect(null);
    setPendingInertLabels([]);
  }, [isExclusiveOperationPending]);
  const aiEnabled = Boolean(
    form.showAIPanel && emailSurfaceFeatures.aiCommands,
  );
  const canUseMediaLibraryInlineImages =
    canUseMediaLibraryAttachments &&
    emailSurfaceFeatures.inlineMedia &&
    emailSurfaceFeatures.mediaLibrary;
  const canUploadInlineImages =
    canUploadAttachments &&
    emailSurfaceFeatures.inlineMedia &&
    emailSurfaceFeatures.localImageUpload;
  const signaturesAvailable =
    signaturesEnabled && emailSurfaceFeatures.signatures;

  const commitPlainTextMode = useCallback(
    (plainText: string) => {
      form.replaceBodyAndContentType(plainText, "plain");
      form.setBodyBackgroundColor(undefined);
      form.setCanvasBackgroundColor(undefined);
      setPreviewMode(false);
      setShowPlainTextWarning(false);
      setPendingPlainText("");
    },
    [form],
  );

  const commitDialect = useCallback(
    (next: ComposerBlockDialect) => {
      // Coming back from plain, the body is text: wrap it into blocks first.
      if (form.contentType === "plain") {
        form.replaceBodyAndContentType(
          plainTextToComposerHtml(form.body),
          "html",
        );
        setPreviewMode(false);
      }
      setDialect(next);
      form.setEditorDialect(next);
      setPendingDialect(null);
      setPendingInertLabels([]);
    },
    [form],
  );

  const requestPlainTextMode = useCallback(() => {
    // getPlainText reads live Plate children synchronously, avoiding the
    // debounced HTML callback and preserving the user's latest keystroke.
    const livePlainText =
      editorRef.current?.getPlainText?.() ??
      composerHtmlToPlainText(editorRef.current?.getHTML?.() || form.body);

    if (livePlainText.trim()) {
      setPendingPlainText(livePlainText);
      setShowPlainTextWarning(true);
      return;
    }

    commitPlainTextMode(livePlainText);
  }, [commitPlainTextMode, editorRef, form.body]);

  const requestDialect = useCallback(
    (next: PlateEmailEditorDialect) => {
      if (next === "plain") {
        requestPlainTextMode();
        return;
      }

      if (next === dialect && form.contentType !== "plain") return;

      // Rich text renders block-only nodes through their read-only renderers.
      // Say which ones before the switch, so nothing goes inert unannounced.
      // Read from the live document: the saved HTML trails the last keystroke
      // and the Free edition's HTML parser drops nodes it cannot represent.
      const inert = findReadOnlyBlockNodeLabels(
        editorRef.current?.getValue?.() ?? null,
      );
      if (next === "rich_text" && inert.length > 0) {
        setPendingDialect(next);
        setPendingInertLabels(inert);
        return;
      }

      commitDialect(next);
    },
    [commitDialect, dialect, editorRef, form.contentType, requestPlainTextMode],
  );

  const requestRichTextMode = useCallback(() => {
    requestDialect(dialect);
  }, [dialect, requestDialect]);

  const { openMediaPicker } = useMediaLibraryPicker();

  const handleImageLibrary = useCallback(async () => {
    if (
      !canUseMediaLibraryInlineImages ||
      isExclusiveOperationPendingRef.current
    )
      return;
    const composeSessionVersion = form.getComposeSessionVersion();
    editorRef.current?.captureSelection();
    try {
      const selections = await openMediaPicker({
        mode: "image",
        multiple: true,
      });
      if (
        isExclusiveOperationPendingRef.current ||
        form.getComposeSessionVersion() !== composeSessionVersion
      ) {
        return;
      }
      const images = selections.filter((selection) =>
        selection.mimeType.startsWith("image/"),
      );
      const nonImages = selections.filter(
        (selection) => !selection.mimeType.startsWith("image/"),
      );
      if (nonImages.length > 0) {
        form.appendMediaLibraryAttachments(nonImages);
      }
      if (images.length === 0) {
        if (nonImages.length > 0) {
          return;
        }
        appMessage(
          __(
            "Select at least one image file from the Media Library.",
            "pressedmail",
          ),
          "error",
        );
        return;
      }
      const embeddableImages = images.filter((image) =>
        isSafeInlineImageUrl(image.url),
      );
      if (embeddableImages.length === 0) {
        appMessage(
          __(
            "Selected images do not include a usable Media Library URL.",
            "pressedmail",
          ),
          "error",
        );
        return;
      }
      for (const image of embeddableImages) {
        editorRef.current?.insertInlineImage({
          src: image.url,
          alt: String(image.filename ?? ""),
        });
      }
    } catch (err) {
      if (
        err instanceof Error &&
        err.message !== "Media selection cancelled."
      ) {
        appMessage(err.message, "error");
      }
    }
  }, [canUseMediaLibraryInlineImages, editorRef, form, openMediaPicker]);

  // Capture the caret before the OS file dialog steals focus, then open the
  // hidden image picker. The selection is restored when the upload resolves.
  const handleImageUpload = useCallback(() => {
    if (!canUploadInlineImages || isExclusiveOperationPendingRef.current)
      return;
    imageUploadSessionRef.current = form.getComposeSessionVersion();
    editorRef.current?.captureSelection();
    imageUploadInputRef.current?.click();
  }, [canUploadInlineImages, editorRef, form]);

  const handleInlineImageFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      const composeSessionVersion = imageUploadSessionRef.current;
      imageUploadSessionRef.current = undefined;
      // Reset so re-selecting the same file fires another change event.
      event.target.value = "";
      if (
        !file ||
        isExclusiveOperationPendingRef.current ||
        composeSessionVersion === undefined ||
        form.getComposeSessionVersion() !== composeSessionVersion
      ) {
        return;
      }
      const validation = validateImage(file, {
        maxSize: resolveMaxAttachmentBytes(maxAttachmentSizeMb),
      });
      if (!validation.valid) {
        appMessage(
          validation.error ?? __("Unsupported image file.", "pressedmail"),
          "error",
        );
        return;
      }
      if (!form.beginInlineImageUpload()) {
        return;
      }
      try {
        const url = await uploadImage(file);
        if (
          isExclusiveOperationPendingRef.current ||
          form.getComposeSessionVersion() !== composeSessionVersion
        ) {
          return;
        }
        editorRef.current?.insertInlineImage({ src: url, alt: file.name });
      } catch (err) {
        if (
          !isExclusiveOperationPendingRef.current &&
          form.getComposeSessionVersion() === composeSessionVersion
        ) {
          appMessage(
            err instanceof Error
              ? err.message
              : __("Image upload failed.", "pressedmail"),
            "error",
          );
        }
      } finally {
        form.endInlineImageUpload();
      }
    },
    [editorRef, form, maxAttachmentSizeMb],
  );

  return (
    <div
      className={cn("flex h-full flex-col", className)}
      data-test="compose-form">
      {/* ── 1. From row: context label | account | send and close ──
          Outside the scrolling payload so the actions stay put. The label
          cell is the mode word over "From"; the field cell is the account
          trigger, which tracks the pane width; the action cell keeps its
          intrinsic width. */}
      <div
        className={cn(
          COMPOSER_ROW_CLASS,
          "border-b border-border bg-transparent px-4 py-2",
        )}
        data-test="compose-header">
        <ComposeContextLabel mode={form.mode} />

        <div className="min-w-0" data-test="from-row">
          <ComposerFromAccountSelect
            accounts={accounts}
            fromAccount={form.fromAccount}
            onFromAccountChange={form.setFromAccount}
            disabled={isExclusiveOperationPending}
          />
        </div>

        {showHeader && (
          <div
            className="inline-flex shrink-0 items-center justify-end gap-1.5"
            data-test="composer-action-group">
            <div
              className="inline-flex flex-nowrap items-center gap-1.5"
              data-test="composer-send-group">
              {headerActions}
              <ComposerHeaderSendGroup
                form={form}
                showPopOut={showPopOut}
                onPopOut={onPopOut}
                showReturnToPane={showReturnToPane}
                onReturnToPane={onReturnToPane}
                showFullView={showFullView}
                onFullView={onFullView}
                variant={headerSendGroupVariant}
              />
            </div>

            <div className="shrink-0" data-test="composer-close-group">
              <ComposerHeaderCloseButton form={form} />
            </div>
          </div>
        )}
      </div>

      <div
        className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden min-h-0"
        data-test="composer-payload"
        inert={isExclusiveOperationPending ? true : undefined}>
        {/* ── 3. Addressing (To, Cc, Bcc) ── */}
        <ComposerAddressing
          toRecipients={form.toRecipients}
          ccRecipients={form.ccRecipients}
          bccRecipients={form.bccRecipients}
          showCc={form.showCc}
          showBcc={form.showBcc}
          onToChange={form.setToRecipients}
          onCcChange={form.setCcRecipients}
          onBccChange={form.setBccRecipients}
          onShowCcChange={form.setShowCc}
          onShowBccChange={form.setShowBcc}
          showListSuggestions={form.contactListsEnabled}
          disabled={isExclusiveOperationPending}
          autoFocusTo={form.mode === "new"}
        />

        {/* ── 4. Subject ──
            The shared metadata grid (composer-row.ts). The compact "Re"
            label matches To/Cc/Bcc (RECIPIENT_LABEL_CLASS), so the field
            starts in column two naturally and the attachment cluster takes
            the action cell. The placeholder and aria-label keep the field's
            full name for naming. */}
        <div
          className="border-b border-border bg-transparent px-4 py-2"
          data-test="subject-row">
          <div className={COMPOSER_ROW_CLASS} data-test="subject-input-shell">
            <span className={RECIPIENT_LABEL_CLASS} aria-hidden="true">
              {__("Re", "pressedmail")}
            </span>
            <input
              autoComplete="off"
              type="text"
              data-test="subject-input"
              value={form.subject}
              onChange={(e) => form.setSubject(e.target.value)}
              placeholder={__("Subject", "pressedmail")}
              aria-label={__("Subject", "pressedmail")}
              className="min-w-0 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
              disabled={isExclusiveOperationPending}
            />
            <ComposerSubjectAttachmentActions form={form} />
          </div>
          <ComposerAttachmentChips
            attachments={attachments}
            onRemove={form.removeAttachment}
            disabled={isExclusiveOperationPending}
          />
        </div>

        {/* ── 5. Hidden image upload input ──
            Picker for inline image uploads (toolbar → Insert image → Upload
            from computer). Inserts at the caret captured on open. */}
        <input
          ref={imageUploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          data-test="composer-inline-image-input"
          disabled={isExclusiveOperationPending}
          onChange={(event) => void handleInlineImageFile(event)}
        />

        {/* 6. Message Canvas.
            Rich text renders the shared authoring surface, the same one the
            signature and auto-reply editors mount, so all three cannot drift
            apart. Preview keeps the editor mounted and fully editable and
            restyles the live canvas as a responsive recipient-style surface
            (pm-email-preview-surface: light email page, forced dark email-safe
            headings/text, centered reader-width canvas). The author can still
            type and format while Preview is on; no read-only iframe is swapped
            in. Plain text is the one branch that is genuinely composer-only, so
            it stays here. */}
        {form.contentType === "plain" ? (
          <div
            className="pm-composer-text-surface flex flex-1 flex-col"
            data-preview={previewMode ? "true" : "false"}
            data-test="body-editor">
            <div className="border-b border-border">
              <ComposerPlainTextToolbar
                key={isExclusiveOperationPending ? "locked" : "ready"}
                form={form}
                disabled={isExclusiveOperationPending}
                signaturesEnabled={signaturesAvailable}
                signatures={signatures}
                onTogglePreview={() => setPreviewMode((value) => !value)}
                previewActive={previewMode}
                toolbarVariant={variant === "mobile" ? "mobile" : "desktop"}
                onToggleContentType={requestRichTextMode}
              />
            </div>
            {previewMode ? (
              <pre
                className="pm-composer-text-surface m-0 flex-1 whitespace-pre-wrap break-words p-4 font-mono text-sm"
                data-test="plain-text-preview"
                data-testid="plain-text-preview">
                {form.body}
              </pre>
            ) : (
              // data-no-theme, because this is an editor surface and not a
              // field. Without it the element rules for every textarea in the
              // plugin reached it and it wore a field's rounded corners, a
              // field's fill and a field's foreground, none of which belong on
              // something that fills its pane edge to edge. The surface class
              // paints it instead, the same colour as the rich editor beside it.
              <textarea
                data-no-theme
                aria-label={__("Message body", "pressedmail")}
                autoComplete="off"
                value={form.body}
                onChange={(event) => form.setBody(event.target.value)}
                placeholder={__("Write your message…", "pressedmail")}
                disabled={isExclusiveOperationPending}
                className={cn(
                  "pm-composer-text-surface flex-1 resize-none whitespace-pre-wrap break-words border-0 p-4 font-mono text-sm",
                  variant === "floating"
                    ? "min-h-[300px]"
                    : variant === "mobile"
                      ? "min-h-[280px]"
                      : "min-h-[200px]",
                )}
              />
            )}
          </div>
        ) : (
          <>
            <ComposerAuthoringEditor
              surface="email"
              testId="body-editor"
              value={form.body || ""}
              onChange={form.setBody}
              documentValue={form.draftDocument?.value}
              onDocumentChange={(value) =>
                form.setDraftDocument(value, dialect)
              }
              dialect={dialect}
              onSelectDialect={requestDialect}
              editorKey={form.composeSessionVersion ?? undefined}
              form={form}
              ref={editorRef}
              disabled={isExclusiveOperationPending}
              enableAiCommands={aiEnabled}
              ariaLabel={__("Message body", "pressedmail")}
              placeholder={__("Write your message…", "pressedmail")}
              previewActive={previewMode}
              onTogglePreview={() => setPreviewMode((value) => !value)}
              contentStyle={buildComposerSurfaceStyle({
                bodyBackgroundColor: form.bodyBackgroundColor,
                canvasBackgroundColor: form.canvasBackgroundColor,
                fontSizePx: composerFontSizePx,
                fontFamily: composerFontFamily,
              })}
              editorStyle={
                form.bodyBackgroundColor
                  ? { backgroundColor: form.bodyBackgroundColor }
                  : undefined
              }
              className={cn(
                "flex-1",
                variant === "floating"
                  ? "min-h-[300px]"
                  : variant === "mobile"
                    ? "min-h-[280px]"
                    : "min-h-[200px]",
              )}
              signaturesEnabled={signaturesAvailable}
              signatures={signatures}
              canUseMediaLibraryImages={canUseMediaLibraryAttachments}
              canUploadImages={canUploadAttachments}
              onToggleContentType={requestPlainTextMode}
              onSetBodyBackgroundColor={setBodyBackgroundColor}
              onSetCanvasBackgroundColor={setCanvasBackgroundColor}
              toolbarVariant={variant === "mobile" ? "mobile" : "desktop"}
              onImageLibrary={() => void handleImageLibrary()}
              onImageUpload={handleImageUpload}
              onEditorReady={(ref) => {
                form.handleEditorReady(ref);
              }}
            />
            {dialect === "rich_text" &&
              (preferences.cache_email_body_content === false ||
                form.draftDocumentStorageUnavailable) && (
                <p
                  role="status"
                  className="mx-3 mb-3 rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
                  {preferences.cache_email_body_content === false
                    ? __(
                        "Database email caching is off. This draft will reopen from email HTML, so some Rich Text blocks may change.",
                        "pressedmail",
                      )
                    : __(
                        "Rich Text document storage is unavailable. This draft will reopen from email HTML, so some blocks may change.",
                        "pressedmail",
                      )}
                </p>
              )}
          </>
        )}
      </div>

      {/* ── 8. Footer ── */}
      <ComposerFooter form={form} />

      {/* Discard confirmation dialog */}
      <ComposeDiscardDialog
        open={form.showDiscardDialog}
        onSaveDraft={form.handleDiscardSaveAndClose}
        onDelete={form.handleDiscardConfirm}
        onCancel={form.handleDiscardCancel}
        isSavingDraft={form.isSavingDraft}
      />

      {form.confirmation ? (
        <ConfirmationPanel
          open
          {...form.confirmation}
          onConfirm={() => form.resolveConfirmation(true)}
          onCancel={() => form.resolveConfirmation(false)}
          onOpenChange={(open) => {
            if (!open) form.resolveConfirmation(false);
          }}
        />
      ) : null}

      <ConfirmationPanel
        open={showPlainTextWarning}
        onOpenChange={(open) => {
          if (!open || !isExclusiveOperationPendingRef.current) {
            setShowPlainTextWarning(open);
          }
        }}
        title={__("Switch to plain text?", "pressedmail")}
        description={
          <span>
            {__(
              "Formatting and layout will be removed. Links will become visible URLs. Attachments will stay attached. Switching back will not restore formatting.",
              "pressedmail",
            )}
          </span>
        }
        confirmText={__("Switch to plain text", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        onConfirm={() => {
          if (!isExclusiveOperationPendingRef.current) {
            commitPlainTextMode(pendingPlainText);
          }
        }}
        onCancel={() => setPendingPlainText("")}
      />

      <ConfirmationPanel
        open={pendingDialect !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPendingDialect(null);
            setPendingInertLabels([]);
          }
        }}
        title={__("Switch to rich text?", "pressedmail")}
        description={
          <span>
            {sprintf(
              __(
                "Rich text shows these the way the recipient will see them, and hides the controls that only exist in the block editor: %s. Nothing is removed, and switching back to Markdown brings the controls back.",
                "pressedmail",
              ),
              pendingInertLabels.join(", "),
            )}
          </span>
        }
        confirmText={__("Switch to rich text", "pressedmail")}
        cancelText={__("Cancel", "pressedmail")}
        onConfirm={() => {
          if (pendingDialect) commitDialect(pendingDialect);
        }}
        onCancel={() => {
          setPendingDialect(null);
          setPendingInertLabels([]);
        }}
      />
    </div>
  );
}
