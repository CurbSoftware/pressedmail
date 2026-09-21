"use client";

import React, {
  forwardRef,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import {
  Plate,
  PlateContainer,
  PlateContent,
  usePlateEditor,
  type PlateEditor,
} from "@kit/plate/react";
import type { Value, Descendant } from "@kit/plate";
import { TextApi } from "@kit/plate";
import {
  createPlateEmailChangeCallbacks,
  createPlateEmailEditorPluginKit,
  createPlateEmailEditorRef,
  createPlateEmailUsePlateEditorOptions,
  getOrCreatePlateEmailEditorController,
  handlePlateEmailEditorContainerClick,
  PLATE_EMAIL_EDITOR_DEFAULT_PLACEHOLDER,
  publishPlateEmailEditorRef,
  syncPlateEmailAdapterCallbackRefs,
  type PlateEmailEditorController,
} from "@kit/plate/email-editor";

import { cn } from "@/lib/utils";
import { createInertHtmlDeserializer } from "@/lib/composer/composer-html-inert";
import { buildComposerReactPlugins } from "./plate-composer-dialect";
import { getComposerDomHtml } from "./plate-composer-dom";
import {
  insertSignatureBlockInDocument,
  removeSignatureBlockInDocument,
} from "./signature-document";
import { ComposerAIKit } from "@/components/composer/plate/ai-kit.active";
import { ComposerCopilotKit } from "@/components/composer/plate/copilot-kit.active";
import {
  serializePlateValueToHtml,
  serializePlateValueToPlainText,
} from "@/components/composer/plate-composer-serialization.active";
import type {
  ComposerSignatureCommand,
  EmailEditorRef,
  PressedMailPlateComposerProps,
} from "./plate-composer-types";

export type { EmailEditorRef } from "./plate-composer-types";
export type { PressedMailComposerValue } from "./plate-composer-types";

export interface PlateComposerProps extends Omit<
  PressedMailPlateComposerProps,
  "surface"
> {}

export const PlateComposer = forwardRef<EmailEditorRef, PlateComposerProps>(
  function PlateComposer(
    {
      children,
      initialHtml = "",
      initialValue,
      ariaLabel,
      placeholder = PLATE_EMAIL_EDITOR_DEFAULT_PLACEHOLDER,
      disabled = false,
      autoFocus = false,
      aiEnabled = false,
      minHeight,
      onChange,
      onValueChange,
      onPlainTextChange,
      onBlur,
      onReady,
      className,
      contentStyle,
      dialect = "markdown",
    },
    ref,
  ) {
    const contentContainerRef = useRef<HTMLDivElement>(null);
    const editorControllerRef =
      useRef<PlateEmailEditorController<Value> | null>(null);
    const editorController = getOrCreatePlateEmailEditorController<Value>({
      controllerRef: editorControllerRef,
      serializeHtml: serializePlateValueToHtml,
      serializePlainText: serializePlateValueToPlainText,
    });

    const plugins = useMemo(
      () =>
        createPlateEmailEditorPluginKit({
          basePlugins: buildComposerReactPlugins(dialect),
          aiEnabled,
          aiPlugins: ComposerAIKit,
          copilotPlugins: ComposerCopilotKit,
        }),
      [aiEnabled, dialect],
    );

    // A dialect change rebuilds the editor from a different plugin set, which
    // is a new editor holding nothing. Hand the rebuild the document the old
    // editor is holding, or the switch silently empties the message.
    //
    // Hold the EDITOR, not its value. Slate replaces `editor.children` on
    // every edit rather than mutating it, so a captured array is a snapshot of
    // the last commit and a keystroke typed since then is simply not in it.
    // The editor object is stable, and reading `.children` off it happens at
    // the moment the switch is made, which is the only moment that is correct.
    const liveEditorRef = useRef<PlateEditor | null>(null);

    const editor = usePlateEditor(
      createPlateEmailUsePlateEditorOptions({
        plugins,
        initialValue: (liveEditorRef.current?.children ?? initialValue) as
          | Value
          | null
          | undefined,
      }),
      [aiEnabled, dialect],
    );

    useEffect(() => {
      liveEditorRef.current = editor;
    });

    // Everything that turns an HTML string into editor nodes goes through this
    // wrapper, so nothing is ever parsed into the live document.
    const inertDeserializer = useMemo(
      () => (editor ? createInertHtmlDeserializer(editor.api.html) : null),
      [editor],
    );

    const setDocumentValue = useCallback(
      (value: Value) => {
        // HTML deserialization returns an insertable fragment. A saved body made
        // only of div/span wrappers can therefore contain root text or links,
        // which Slate removes when used as the entire document. Wrap that inline
        // fragment once; existing block documents keep their structure.
        const fragment = value as Descendant[];
        const inlineOnly =
          fragment.length > 0 &&
          fragment.every(
            (node) => TextApi.isText(node) || editor.api.isInline(node),
          );
        editor.tf.setValue(
          inlineOnly
            ? ([{ type: editor.getType("p"), children: fragment }] as Value)
            : value,
        );
      },
      [editor],
    );

    // Keep latest callbacks without re-subscribing the editor.
    const onChangeRef = useRef(onChange);
    const onValueChangeRef = useRef(onValueChange);
    const onPlainTextChangeRef = useRef(onPlainTextChange);
    const onReadyRef = useRef(onReady);
    useEffect(() => {
      syncPlateEmailAdapterCallbackRefs({
        onValueChangeRef,
        onValueChange,
        onChangeRef,
        onChange,
        onPlainTextChangeRef,
        onPlainTextChange,
        onReadyRef,
        onReady,
      });
    });

    const handleEditorChange = useCallback(
      (value: Value) => {
        editorController.handleChange(
          value,
          createPlateEmailChangeCallbacks({
            onValueChangeRef,
            onChangeRef,
            onPlainTextChangeRef,
          }),
        );
      },
      [editorController],
    );

    useEffect(
      () => () => {
        editorController.cancel();
      },
      [editorController],
    );

    // Deserialize initial HTML on mount
    useEffect(() => {
      if (editor && inertDeserializer && !initialValue) {
        editorController.hydrateInitialHtml(initialHtml, {
          deserializer: inertDeserializer,
          setValue: setDocumentValue,
        });
      }
    }, []);

    // Expose the imperative API once the editor exists.
    useEffect(() => {
      if (!editor || !inertDeserializer) return;
      const editorRef = createPlateEmailEditorRef<Value, Descendant>({
        controller: editorController,
        getDomHtml: () => getComposerDomHtml(contentContainerRef.current),
        getPlainText: () =>
          serializePlateValueToPlainText(editor.children as Value),
        getValue: () => editor.children as Value,
        deserializer: inertDeserializer,
        setValue: setDocumentValue,
        insertNodes: (value) => editor.tf.insertNodes(value),
        insertText: (text) => editor.tf.insertText(text),
        getSelection: () => editor.selection,
        select: (range) => editor.tf.select(range),
        insertInlineNode: (node) =>
          editor.tf.insertNodes(node as unknown as Descendant),
      });
      // The signature command is app-side: it edits the document model, which
      // the shared ref only reaches through HTML.
      const signatureCommand: ComposerSignatureCommand = {
        insertSignatureBlock: (signature, placement) =>
          insertSignatureBlockInDocument(editor, signature, placement),
        removeSignatureBlock: () => removeSignatureBlockInDocument(editor),
      };
      return publishPlateEmailEditorRef({
        editorRef: Object.assign(editorRef, signatureCommand),
        onReady: onReadyRef.current,
        forwardedRef: ref,
      });
    }, [editor, ref, editorController, setDocumentValue, inertDeserializer]);

    const handleContainerClick = useCallback(
      (event: React.MouseEvent<HTMLDivElement>) => {
        handlePlateEmailEditorContainerClick({
          controller: editorController,
          disabled,
          target: event.target,
          currentTarget: event.currentTarget,
          focus: (options) => editor?.tf.focus(options),
        });
      },
      [editor, disabled, editorController],
    );

    if (!editor) return null;

    return (
      <div
        className={cn("pm-composer-editor-root", className)}
        style={minHeight ? { minHeight: `${minHeight}px` } : undefined}>
        <Plate
          editor={editor}
          onChange={({ value }) => handleEditorChange(value as Value)}>
          {children ? (
            <div
              data-pm-editor-chrome
              contentEditable={false}
              suppressContentEditableWarning>
              {children}
            </div>
          ) : null}
          <PlateContainer
            className="pm-composer-editor"
            style={contentStyle}
            onClick={handleContainerClick}>
            <div
              ref={contentContainerRef}
              className="pm-composer-editor-content">
              <PlateContent
                onBlur={onBlur}
                readOnly={disabled}
                autoFocus={autoFocus}
                aria-label={ariaLabel}
                placeholder={placeholder}
              />
            </div>
          </PlateContainer>
        </Plate>
      </div>
    );
  },
);
