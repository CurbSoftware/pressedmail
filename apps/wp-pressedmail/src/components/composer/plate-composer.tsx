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
} from "@kit/plate/react";
import type { Value, Descendant } from "@kit/plate";
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
import { ComposerReactPlugins } from "./plate-composer-react-kit";
import { ComposerAIKit } from "@/components/composer/plate/ai-kit.active";
import { ComposerCopilotKit } from "@/components/composer/plate/copilot-kit.active";
import {
  serializePlateValueToHtml,
  serializePlateValueToPlainText,
} from "@/components/composer/plate-composer-serialization.active";
import type {
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
          basePlugins: ComposerReactPlugins,
          aiEnabled,
          aiPlugins: ComposerAIKit,
          copilotPlugins: ComposerCopilotKit,
        }),
      [aiEnabled],
    );

    const editor = usePlateEditor(
      createPlateEmailUsePlateEditorOptions({
        plugins,
        initialValue,
      }),
      [aiEnabled],
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
      if (editor) {
        editorController.hydrateInitialHtml(initialHtml, {
          deserializer: editor.api.html,
          setValue: (value) => editor.tf.setValue(value as Value),
        });
      }
    }, []);

    // Expose the imperative API once the editor exists.
    useEffect(() => {
      if (!editor) return;
      const editorRef = createPlateEmailEditorRef<Value, Descendant>({
        controller: editorController,
        getDomHtml: () => contentContainerRef.current?.innerHTML ?? null,
        getPlainText: () =>
          serializePlateValueToPlainText(editor.children as Value),
        deserializer: editor.api.html,
        setValue: (value) => editor.tf.setValue(value as Value),
        insertNodes: (value) => editor.tf.insertNodes(value),
        insertText: (text) => editor.tf.insertText(text),
        getSelection: () => editor.selection,
        select: (range) => editor.tf.select(range),
        insertInlineNode: (node) =>
          editor.tf.insertNodes(node as unknown as Descendant),
      });
      return publishPlateEmailEditorRef({
        editorRef,
        onReady: onReadyRef.current,
        forwardedRef: ref,
      });
    }, [editor, ref, editorController]);

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
