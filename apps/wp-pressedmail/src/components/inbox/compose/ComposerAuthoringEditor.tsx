"use client";

/**
 * The one authoring surface.
 *
 * Every place PressedMail lets someone write email content mounts this
 * component: the message canvas in the composer, the signature editor, and the
 * auto-reply editor. They used to be two components wrapping one editor, and
 * the wrappers drifted apart: the authoring one grew extra chrome, dropped the
 * preview restyle, and wired a toolbar control to nothing. One component, with
 * the genuine differences declared as data, means those cannot drift again.
 *
 * What legitimately differs between surfaces is declared once, in
 * `PLATE_EMAIL_EDITOR_SURFACE_PRESETS` (`@kit/plate/email-surfaces`): the
 * feature flags, the minimum height, and which canvas the surface edits on.
 * Nothing in this file branches on the surface name.
 *
 * The email composer has more around the canvas than the authoring surfaces do
 * (plain-text mode, recipients, attachments, its own media-upload session
 * tracking). Those live in `ComposerContent`, which renders this for its
 * rich-text branch and passes its real compose form down.
 */

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { __ } from "@wordpress/i18n";
import {
  getPlateEmailEditorSurfacePreset,
  type PlateEmailEditorDialect,
  type PlateEmailEditorSurface,
} from "@kit/plate/email-surfaces";
import type { Value } from "@kit/plate";

import {
  PressedMailRichTextEditor,
  type EmailEditorRef,
} from "@/components/composer";
import { appMessage } from "@/context/toast";
import { useFeaturesOptional } from "@/context/features/FeaturesContext";
import { resolveMaxAttachmentBytes } from "@/hooks/compose/v2/useComposeForm";
import { useMaxAttachmentSizeMb } from "@/context/admin-settings";
import { cn } from "@/lib/utils";
import { uploadImage, validateImage } from "@/services/image-upload.service";
import type { Signature } from "@/types/signatures";

import {
  ComposerEditorToolbar,
  type ComposerToolbarForm,
} from "./ComposerEditorToolbar";
import { useMediaLibraryPicker } from "./media-library/MediaLibraryPickerProvider";
import { normalizeRichEditorHtml } from "./compose-utils";

export interface ComposerAuthoringEditorProps {
  surface: PlateEmailEditorSurface;
  value?: string;
  onChange: (html: string) => void;
  documentValue?: Value;
  onDocumentChange?: (value: Value) => void;
  dialect?: PlateEmailEditorDialect;
  onSelectDialect?: (dialect: PlateEmailEditorDialect) => void;
  placeholder?: string;
  ariaLabel?: string;
  id?: string;
  testId?: string;
  disabled?: boolean;
  className?: string;
  editorClassName?: string;
  editorKey?: React.Key;
  contentBlocksEnabled?: boolean;
  /**
   * Whether this surface may mount the AI chat kit and its toolbar entry.
   *
   * Multiplied by the surface's own `aiCommands` flag and by the `ai_drafting`
   * feature check, so passing `true` cannot enable AI on a surface that forbids
   * it or on a site without the feature. The composer additionally derives it
   * from `form.showAIPanel`, which is already gated upstream.
   */
  enableAiCommands?: boolean;
  canUseMediaLibraryImages?: boolean;
  canUploadImages?: boolean;
  subject?: string;
  onSubjectChange?: (subject: string) => void;

  /**
   * The toolbar's data source.
   *
   * The composer passes its real compose form, so the toolbar reads live
   * recipients and subject. The authoring surfaces have no compose form, so one
   * is assembled below from their own props. The previous version cast a
   * fabricated `UseComposeFormReturn` into place; the toolbar now declares only
   * the nine fields it reads, so the assembled one is honest about what it has
   * rather than pretending to be something it is not.
   */
  form?: ComposerToolbarForm;

  /** Controlled preview. Leave undefined to let the component own the toggle. */
  previewActive?: boolean;
  onTogglePreview?: () => void;
  /**
   * Inline style for the outer canvas wrapper. The composer publishes its
   * user-picked colours and font as inherited CSS variables here.
   */
  contentStyle?: React.CSSProperties;
  /**
   * Inline style for the editable element itself, separate from
   * `contentStyle`: the composer also paints the chosen body background
   * directly onto the editor so the live canvas matches the sent email.
   */
  editorStyle?: React.CSSProperties;
  toolbarVariant?: "desktop" | "mobile";

  signaturesEnabled?: boolean;
  signatures?: Signature[];
  onToggleContentType?: () => void;
  /**
   * Absent means the surface has no body background to set, and the toolbar
   * omits the control rather than rendering one that does nothing.
   */
  onSetBodyBackgroundColor?: (color: string | undefined) => void;
  onSetCanvasBackgroundColor?: (color: string | undefined) => void;

  /**
   * Media insertion. The composer supplies both because it tracks an upload
   * session and routes non-image picks to attachments; without them this
   * component inserts from the Media Library and uploads on its own.
   */
  onImageLibrary?: () => void;
  onImageUpload?: () => void;
  onEditorReady?: (ref: EmailEditorRef) => void;
}

/** Stable identity so the assembled toolbar form is not rebuilt every render. */
const noSignatureSelect = (): void => {};

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

export const ComposerAuthoringEditor = forwardRef<
  EmailEditorRef,
  ComposerAuthoringEditorProps
>(function ComposerAuthoringEditor(
  {
    surface,
    value = "",
    onChange,
    documentValue,
    onDocumentChange,
    dialect = "markdown",
    onSelectDialect,
    placeholder,
    ariaLabel,
    id,
    testId = "composer-authoring-editor",
    disabled = false,
    className,
    editorClassName,
    editorKey,
    contentBlocksEnabled = false,
    enableAiCommands = true,
    canUseMediaLibraryImages = true,
    canUploadImages = true,
    subject = "",
    onSubjectChange,
    form,
    previewActive: controlledPreviewActive,
    onTogglePreview,
    contentStyle,
    editorStyle,
    toolbarVariant,
    signaturesEnabled = false,
    signatures,
    onToggleContentType,
    onSetBodyBackgroundColor,
    onSetCanvasBackgroundColor,
    onImageLibrary,
    onImageUpload,
    onEditorReady,
  },
  ref,
) {
  const initialValue = useMemo(() => normalizeRichEditorHtml(value), [value]);
  const editorRef = useRef<EmailEditorRef | null>(null);
  const lastEditorHtmlRef = useRef(initialValue);
  const hasDocumentValueRef = useRef(Boolean(documentValue));
  hasDocumentValueRef.current = Boolean(documentValue);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState(initialValue);
  const [uncontrolledPreviewActive, setUncontrolledPreviewActive] =
    useState(false);

  const surfacePreset = getPlateEmailEditorSurfacePreset(surface);
  const surfaceFeatures = surfacePreset.features;
  // The host card draws the boundary, so the canvas draws none of its own.
  const flushCanvas = surfacePreset.editingCanvas === "email-canvas";

  // Controlled when the caller owns the state (the composer does, because its
  // preview also drives the plain-text branch), self-managed otherwise.
  const previewActive = controlledPreviewActive ?? uncontrolledPreviewActive;
  const togglePreview =
    onTogglePreview ??
    (() => setUncontrolledPreviewActive((active) => !active));

  // Same gating as useComposeForm's showAIPanel: the AI chat kit and toolbar
  // button only mount when the Composer AI feature is usable. `ai_drafting` is
  // admin-gated server-side (enabled AND configured).
  //
  // Read through `useFeaturesOptional` rather than `useFeatureAvailable`: the
  // strict hook throws outside a FeaturesProvider, and the composer and this
  // editor are rendered without one in unit tests that deliberately keep them
  // decoupled. Absent context means absent features, which fails closed, and
  // the surfaces that own the AI entry point still gate it a second time.
  const features = useFeaturesOptional();
  const aiFeatureEnabled = features?.isFeatureAvailable("ai_drafting") ?? false;
  const aiEnabled =
    enableAiCommands && surfaceFeatures.aiCommands && aiFeatureEnabled;
  const maxAttachmentSizeMb = useMaxAttachmentSizeMb();

  const canUseMediaLibraryInlineImages =
    canUseMediaLibraryImages &&
    surfaceFeatures.inlineMedia &&
    surfaceFeatures.mediaLibrary;
  const canUploadInlineImages =
    canUploadImages &&
    surfaceFeatures.inlineMedia &&
    surfaceFeatures.localImageUpload;

  useEffect(() => {
    setContent(initialValue);
    if (lastEditorHtmlRef.current === initialValue) return;
    lastEditorHtmlRef.current = initialValue;
    if (hasDocumentValueRef.current) return;
    editorRef.current?.setContent(initialValue);
  }, [editorKey, initialValue]);

  /**
   * Publish the real editor ref rather than a hand-written handle.
   *
   * An `useImperativeHandle` copy of the interface silently drops any method it
   * forgets, which is exactly what happened: it omitted `getPlainText`, and the
   * composer's rich-to-plain switch reads it. Forwarding the genuine ref means
   * this component cannot drift from `PlateEmailEditorRef`, whatever that
   * interface grows next. `publishPlateEmailEditorRef` supports both callback
   * and object refs, so the internal one keeps working either way.
   */
  const attachEditorRef = useCallback(
    (instance: EmailEditorRef | null) => {
      editorRef.current = instance;
      if (typeof ref === "function") {
        ref(instance);
        return;
      }
      if (ref) {
        (ref as React.MutableRefObject<EmailEditorRef | null>).current =
          instance;
      }
    },
    [ref],
  );

  const handleChange = useCallback(
    (html: string) => {
      lastEditorHtmlRef.current = normalizeRichEditorHtml(html);
      setContent(html);
      onChange(html);
    },
    [onChange],
  );

  const { openMediaPicker } = useMediaLibraryPicker();

  const handleImageLibrary = useCallback(async () => {
    if (!canUseMediaLibraryInlineImages) return;
    editorRef.current?.captureSelection();
    try {
      const selections = await openMediaPicker({
        mode: "image",
        multiple: true,
      });
      const images = selections.filter((selection) =>
        selection.mimeType.startsWith("image/"),
      );
      if (images.length === 0) {
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
  }, [canUseMediaLibraryInlineImages, openMediaPicker]);

  const handleImageUpload = useCallback(() => {
    if (!canUploadInlineImages) return;
    editorRef.current?.captureSelection();
    imageUploadInputRef.current?.click();
  }, [canUploadInlineImages]);

  const handleInlineImageFile = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

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

      try {
        const url = await uploadImage(file);
        editorRef.current?.insertInlineImage({ src: url, alt: file.name });
      } catch (err) {
        appMessage(
          err instanceof Error
            ? err.message
            : __("Image upload failed.", "pressedmail"),
          "error",
        );
      }
    },
    [maxAttachmentSizeMb],
  );

  // A caller that owns its own upload flow (the composer, which tracks an
  // upload session and routes non-image picks to attachments) renders its own
  // hidden input and hands us the opener. Rendering a second input here would
  // leave two file pickers for one toolbar button.
  const callerOwnsUpload = onImageUpload !== undefined;

  const assembledToolbarForm = useMemo<ComposerToolbarForm>(
    () => ({
      // No recipients: these surfaces write content, not a message. Empty is
      // the true answer, and the AI context these feed is a compose concern.
      toRecipients: [],
      ccRecipients: [],
      bccRecipients: [],
      subject,
      body: content,
      showAIPanel: aiEnabled,
      // Only reachable from the signature picker, which these surfaces do not
      // render because they pass signaturesEnabled={false} and no signatures.
      handleSignatureSelect: noSignatureSelect,
    }),
    [aiEnabled, content, subject],
  );
  const toolbarForm = form ?? assembledToolbarForm;

  return (
    <div
      id={id}
      className={cn(
        "flex flex-1 flex-col min-h-0",
        // Preview always shows the email canvas, so the recipient's view does
        // not change with the author's UI theme. Before Preview, the surface
        // decides: the composer edits on the app theme, the authoring surfaces
        // write on the email canvas their surrounding card already bounds.
        previewActive || flushCanvas
          ? "pm-email-content-surface"
          : "pm-composer-edit-surface",
        flushCanvas && "overflow-hidden rounded-none border-0",
        className,
      )}
      data-preview={previewActive ? "true" : "false"}
      data-dialect={dialect}
      data-test={testId}
      data-testid={testId}
      style={contentStyle}>
      <div
        className={cn(
          "flex flex-1 flex-col min-h-0",
          previewActive && "pm-email-preview-surface",
        )}
        data-preview={previewActive ? "true" : "false"}
        // A literal, not a prop: the QA inventory and the Playwright selector
        // audit read static `data-test` attributes out of the source, so a
        // computed one is invisible to them. The name is inherited from the
        // message composer, where this hook was introduced, and is kept because
        // live E2E specs and PMQA states address the canvas by it.
        data-test="body-editor-content"
        data-testid="body-editor-content">
        <PressedMailRichTextEditor
          key={editorKey}
          ref={attachEditorRef}
          surface={surface}
          dialect={dialect}
          initialValue={documentValue}
          initialHtml={initialValue}
          ariaLabel={ariaLabel}
          placeholder={placeholder}
          onChange={handleChange}
          onValueChange={onDocumentChange}
          disabled={disabled}
          aiEnabled={aiEnabled}
          onReady={onEditorReady}
          contentStyle={editorStyle}
          className={cn("flex-1", editorClassName)}>
          <div className="border-b border-border">
            <ComposerEditorToolbar
              key={disabled ? "locked" : "ready"}
              surface={surface}
              form={toolbarForm}
              disabled={disabled}
              editorRef={editorRef}
              signaturesEnabled={signaturesEnabled}
              signatures={signatures ?? []}
              canUseMediaLibraryAttachments={canUseMediaLibraryInlineImages}
              canUploadAttachments={canUploadInlineImages}
              onImageLibrary={onImageLibrary ?? handleImageLibrary}
              onImageUpload={onImageUpload ?? handleImageUpload}
              onTogglePreview={togglePreview}
              previewActive={previewActive}
              dialect={dialect}
              onSelectDialect={onSelectDialect}
              onToggleContentType={onToggleContentType}
              onSetBodyBackgroundColor={onSetBodyBackgroundColor}
              onSetCanvasBackgroundColor={onSetCanvasBackgroundColor}
              contentBlocksEnabled={contentBlocksEnabled}
              toolbarVariant={toolbarVariant}
            />
          </div>
        </PressedMailRichTextEditor>
      </div>
      {!callerOwnsUpload && (
        <input
          ref={imageUploadInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          tabIndex={-1}
          aria-hidden="true"
          onChange={handleInlineImageFile}
        />
      )}
    </div>
  );
});
