import React, {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  useState,
} from "react";
import { __ } from "@wordpress/i18n";
import { getPlateEmailEditorSurfacePreset } from "@kit/plate/email-surfaces";

import {
  PressedMailRichTextEditor,
  type EmailEditorRef,
} from "@/components/composer";
import { appMessage } from "@/context/toast";
import { useFeatureAvailable } from "@/context/features/FeaturesContext";
import {
  resolveMaxAttachmentBytes,
  type UseComposeFormReturn,
} from "@/hooks/compose/v2/useComposeForm";
import { useMaxAttachmentSizeMb } from "@/context/admin-settings";
import { useMediaLibraryPicker } from "./media-library/MediaLibraryPickerProvider";
import { cn } from "@/lib/utils";
import { uploadImage, validateImage } from "@/services/image-upload.service";

import {
  ComposerEditorToolbar,
  type ComposerAuthoringSurface,
} from "./ComposerEditorToolbar";
import { normalizeRichEditorHtml } from "./compose-utils";

export interface ComposerAuthoringEditorProps {
  surface: Exclude<ComposerAuthoringSurface, "email">;
  value?: string;
  onChange: (html: string) => void;
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
   * Accepted for backward compatibility with callers. Authoring surfaces render
   * their own Preview toggle; this label is not currently surfaced separately.
   */
  previewTitle?: string;
  enableAiCommands?: boolean;
  canUseMediaLibraryImages?: boolean;
  canUploadImages?: boolean;
  subject?: string;
  onSubjectChange?: (subject: string) => void;
}

const emptyComposeForm = {
  handleSignatureSelect: () => {},
  showAIPanel: false,
} as unknown as UseComposeFormReturn;

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
  },
  ref,
) {
  const initialValue = useMemo(() => normalizeRichEditorHtml(value), [value]);
  const editorRef = useRef<EmailEditorRef | null>(null);
  const lastEditorHtmlRef = useRef(initialValue);
  const imageUploadInputRef = useRef<HTMLInputElement | null>(null);
  const [content, setContent] = useState(initialValue);
  const [previewActive, setPreviewActive] = useState(false);
  const maxAttachmentSizeMb = useMaxAttachmentSizeMb();
  const surfacePreset = getPlateEmailEditorSurfacePreset(surface);
  const surfaceFeatures = surfacePreset.features;
  // Same gating as useComposeForm's showAIPanel: the AI chat kit and toolbar
  // button only mount when the Composer AI feature is usable. `ai_drafting` is
  // admin-gated server-side (enabled AND configured), so no separate runtime
  // check is needed.
  const aiFeatureEnabled = useFeatureAvailable("ai_drafting");
  const aiEnabled =
    enableAiCommands && surfaceFeatures.aiCommands && aiFeatureEnabled;
  const contentBlocksAvailable =
    contentBlocksEnabled && surfaceFeatures.contentBlocks;
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
    editorRef.current?.setContent(initialValue);
  }, [editorKey, initialValue]);

  useImperativeHandle(
    ref,
    () => ({
      getHTML: () => editorRef.current?.getHTML() ?? content,
      setContent: (html: string) => {
        lastEditorHtmlRef.current = normalizeRichEditorHtml(html);
        setContent(html);
        editorRef.current?.setContent(html);
      },
      insertContent: (html: string) => {
        editorRef.current?.insertContent(html);
      },
      captureSelection: () => {
        editorRef.current?.captureSelection();
      },
      insertContentAtSavedSelection: (html: string) => {
        editorRef.current?.insertContentAtSavedSelection(html);
      },
      insertInlineImage: (image: { src: string; alt?: string }) => {
        editorRef.current?.insertInlineImage(image);
      },
      focusStart: () => {
        editorRef.current?.focusStart();
      },
    }),
    [content],
  );

  const handleChange = useCallback(
    (html: string) => {
      lastEditorHtmlRef.current = normalizeRichEditorHtml(html);
      setContent(html);
      onChange(html);
    },
    [onChange],
  );

  const authoringForm = useMemo(
    () =>
      ({
        ...emptyComposeForm,
        body: content,
        mode: "new",
        quotedText: "",
        showAIPanel: aiEnabled,
        subject,
        setBody: handleChange,
        ...(onSubjectChange ? { setSubject: onSubjectChange } : {}),
      }) as unknown as UseComposeFormReturn,
    [content, aiEnabled, handleChange, onSubjectChange, subject],
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

  return (
    <div
      id={id}
      className={cn(
        "pm-email-content-surface overflow-hidden",
        surface === "signature" || surface === "auto_reply"
          ? "rounded-none border-0"
          : "rounded-md border",
        className,
      )}
      data-content-colors-inverted="false"
      data-test={testId}
      data-testid={testId}>
      <PressedMailRichTextEditor
        key={editorKey}
        ref={editorRef}
        surface={surface}
        initialHtml={initialValue}
        ariaLabel={ariaLabel}
        placeholder={placeholder}
        onChange={handleChange}
        disabled={disabled}
        aiEnabled={aiEnabled}
        className={cn(
          "min-h-[200px] border-0",
          previewActive && "pm-email-preview-surface",
          editorClassName,
        )}>
        <div className="border-b border-border">
          <ComposerEditorToolbar
            key={disabled ? "locked" : "ready"}
            surface={surface}
            form={authoringForm}
            disabled={disabled}
            editorRef={editorRef}
            signaturesEnabled={false}
            signatures={[]}
            canUseMediaLibraryAttachments={canUseMediaLibraryInlineImages}
            canUploadAttachments={canUploadInlineImages}
            onImageLibrary={handleImageLibrary}
            onImageUpload={handleImageUpload}
            onTogglePreview={() => setPreviewActive((active) => !active)}
            previewActive={previewActive}
            onSetBodyBackgroundColor={() => {}}
            contentBlocksEnabled={contentBlocksAvailable}
          />
        </div>
      </PressedMailRichTextEditor>
      <input
        ref={imageUploadInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
        onChange={handleInlineImageFile}
      />
    </div>
  );
});
