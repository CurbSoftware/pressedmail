/**
 * ComposerContent: Unified email composer UI component (v3 / Plate.js).
 *
 * Renders the consistent composer layout:
 *   Header -> Addressing -> Subject -> Toolbar -> Canvas -> Attachments
 *
 * The caller wraps this in their own container (floating window, reading pane, etc.)
 *
 * @since 3.0.0
 */

import React, { useCallback, useEffect, useRef, useState } from "react";
import { __ } from "@wordpress/i18n";
import { getPlateEmailEditorSurfacePreset } from "@kit/plate/email-surfaces";

import {
  PressedMailRichTextEditor,
  type EmailEditorRef,
} from "@/components/composer";
import {
  ComposerEditorToolbar,
  ComposerPlainTextToolbar,
} from "./ComposerEditorToolbar";
import { buildComposerSurfaceStyle } from "./composer-background-style";
import { composerFontFamilyCss } from "@/lib/preference-behavior";
import { ComposerFooter } from "./ComposerFooter";
import {
  ComposerHeaderCloseButton,
  ComposerHeaderSendGroup,
} from "./ComposerHeaderActions";
import { ComposerAttachmentChips } from "./ComposerAttachmentChips";
import { ComposerSubjectAttachmentActions } from "./ComposerSubjectAttachmentActions";
import { ComposerAddressing } from "./ComposerAddressing";
import { ComposerFromAccountSelect } from "./ComposerFromAccountSelect";
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
  const composerFontSizePx =
    Number(preferences.composer_default_font_size) || 14;
  const composerFontFamily = composerFontFamilyCss(
    preferences.composer_default_font,
  );
  const [previewMode, setPreviewMode] = useState(false);
  const [showPlainTextWarning, setShowPlainTextWarning] = useState(false);
  const [pendingPlainText, setPendingPlainText] = useState("");
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

  const requestRichTextMode = useCallback(() => {
    form.replaceBodyAndContentType(plainTextToComposerHtml(form.body), "html");
    setPreviewMode(false);
  }, [form]);

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
      {/* ── 1. Header ── */}
      {showHeader && (
        <div
          className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-b border-border bg-transparent px-4 py-3"
          data-test="compose-header">
          {/* Every item here truncates rather than holding its width, so the
              group shrinks beside the actions instead of sliding under them. */}
          <div
            className="flex min-w-0 flex-1 items-center gap-x-3"
            data-test="composer-status-group">
            <span
              className="truncate text-xs font-medium text-muted-foreground"
              data-test="compose-mode-label">
              {form.modeTitle}
            </span>
            {form.isDraftSaved && (
              <span className="truncate text-xs font-medium text-muted-foreground">
                {__("Draft saved", "pressedmail")}
              </span>
            )}
            {form.pendingInlineImageUploads > 0 && (
              <span
                aria-hidden="true"
                className="truncate text-xs font-medium text-muted-foreground">
                {__("Uploading image...", "pressedmail")}
              </span>
            )}
            {/* Always mounted: a live region that appears with its text
                already inside is often not announced. */}
            <span aria-live="polite" className="sr-only">
              {form.pendingInlineImageUploads > 0
                ? __("Uploading image...", "pressedmail")
                : ""}
            </span>
          </div>

          <div
            className="inline-flex shrink-0 flex-wrap items-center justify-end gap-1.5"
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
        </div>
      )}

      <div
        className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden min-h-0"
        data-test="composer-payload"
        inert={isExclusiveOperationPending ? true : undefined}>
        {/* ── 2. From, on its own row so no header action can cover it ── */}
        <div className="border-b border-border px-4 py-2" data-test="from-row">
          <ComposerFromAccountSelect
            accounts={accounts}
            fromAccount={form.fromAccount}
            onFromAccountChange={form.setFromAccount}
            disabled={isExclusiveOperationPending}
          />
        </div>

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

        {/* ── 4. Subject ── */}
        <div
          className="border-b border-border bg-transparent px-4 py-2"
          data-test="subject-row">
          <div
            className="flex min-h-7 flex-wrap items-center gap-1 rounded-md border-0 bg-transparent px-0 py-0 focus-within:ring-0"
            data-test="subject-input-shell">
            <input
              autoComplete="off"
              type="text"
              data-test="subject-input"
              value={form.subject}
              onChange={(e) => form.setSubject(e.target.value)}
              placeholder={__("Subject", "pressedmail")}
              aria-label={__("Subject", "pressedmail")}
              className="flex-1 min-w-30 bg-transparent text-sm outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
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

        {/* ── 6. Message Canvas (Plate.js) ──
            Preview mode keeps the Plate editor mounted and fully editable; it
            restyles the live canvas as a responsive recipient-style surface
            (pm-email-preview-surface: light email page, forced dark email-safe
            headings/text, centered reader-width canvas). The author can still
            type and format while Preview is on; no read-only iframe is swapped
            in. The composer toolbar is rendered as a child of
            PressedMailRichTextEditor so its plate hooks (useEditorRef) resolve
            inside the editor provider. */}
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
              <textarea
                aria-label={__("Message body", "pressedmail")}
                autoComplete="off"
                value={form.body}
                onChange={(event) => form.setBody(event.target.value)}
                placeholder={__("Write your message…", "pressedmail")}
                disabled={isExclusiveOperationPending}
                className={cn(
                  "pm-composer-text-surface flex-1 resize-none whitespace-pre-wrap break-words border-0 p-4 font-mono text-sm outline-none",
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
          <div
            className={cn(
              "flex flex-1 flex-col",
              previewMode
                ? "pm-email-content-surface"
                : "pm-composer-edit-surface",
            )}
            data-content-colors-inverted="false"
            data-preview={previewMode ? "true" : "false"}
            data-test="body-editor"
            style={buildComposerSurfaceStyle({
              bodyBackgroundColor: form.bodyBackgroundColor,
              canvasBackgroundColor: form.canvasBackgroundColor,
              fontSizePx: composerFontSizePx,
              fontFamily: composerFontFamily,
            })}>
            <div
              className={cn(
                "flex flex-1 flex-col min-h-0",
                previewMode && "pm-email-preview-surface",
              )}
              data-preview={previewMode ? "true" : "false"}
              data-test="body-editor-content">
              <PressedMailRichTextEditor
                ref={editorRef}
                surface="email"
                initialHtml={form.body || ""}
                disabled={isExclusiveOperationPending}
                aiEnabled={aiEnabled}
                // The signature and auto-reply surfaces have always passed this;
                // this one did not, so the message body was the only editable in
                // the product with no accessible name. axe rates it serious
                // (`aria-input-field-name`), and a placeholder is not a name: it
                // disappears the moment someone types.
                ariaLabel={__("Message body", "pressedmail")}
                placeholder={__("Write your message…", "pressedmail")}
                onChange={form.setBody}
                onReady={(ref) => {
                  form.handleEditorReady(ref);
                }}
                contentStyle={
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
                )}>
                <div className="border-b border-border">
                  <ComposerEditorToolbar
                    key={isExclusiveOperationPending ? "locked" : "ready"}
                    form={form}
                    disabled={isExclusiveOperationPending}
                    editorRef={editorRef}
                    signaturesEnabled={signaturesAvailable}
                    signatures={signatures}
                    canUseMediaLibraryAttachments={
                      canUseMediaLibraryInlineImages
                    }
                    canUploadAttachments={canUploadInlineImages}
                    onImageLibrary={() => void handleImageLibrary()}
                    onImageUpload={handleImageUpload}
                    onTogglePreview={() => setPreviewMode((value) => !value)}
                    previewActive={previewMode}
                    onToggleContentType={requestPlainTextMode}
                    onSetBodyBackgroundColor={setBodyBackgroundColor}
                    onSetCanvasBackgroundColor={setCanvasBackgroundColor}
                    toolbarVariant={variant === "mobile" ? "mobile" : "desktop"}
                  />
                </div>
              </PressedMailRichTextEditor>
            </div>
          </div>
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
    </div>
  );
}
