import type { CSSProperties, ReactNode } from 'react';

import type { Value } from 'platejs';

import type { PlateEmailEditorDialect, PlateEmailEditorSurface } from './email-surfaces';

export const PLATE_EMAIL_EDITOR_CONTRACT_VERSION = 1;
export const PLATE_EMAIL_EDITOR_DEFAULT_PLACEHOLDER = 'Write something…';
export const PLATE_EMAIL_EDITOR_CHANGE_DEBOUNCE_MS = 150;

export function createPlateEmailEmptyValue(): Value {
  return [{ type: 'p', children: [{ text: '' }] }] as Value;
}

export function createPlateEmailPlainTextValue(text: string): Value {
  return [{ type: 'p', children: [{ text }] }] as Value;
}

export function createPlateEmailPlainTextFallbackValue(html: string): Value {
  return createPlateEmailPlainTextValue(
    extractPlateEmailPlainTextFallback(html),
  );
}

export function createPlateEmailInlineImageNode({
  src,
  alt = '',
}: PlateEmailInlineImage): Value[number] {
  const image = normalizePlateEmailInlineImage({ src, alt });

  if (!image) {
    throw new Error('Plate email inline image requires a source URL.');
  }

  return {
    type: 'img',
    url: image.src,
    alt: image.alt,
    children: [{ text: '' }],
  } as Value[number];
}

export function normalizePlateEmailInlineImage({
  src,
  alt = '',
}: PlateEmailInlineImage): PlateEmailNormalizedInlineImage | null {
  const normalizedSrc = src.trim();

  if (!normalizedSrc) {
    return null;
  }

  return {
    src: normalizedSrc,
    alt,
  };
}

export function createPlateEmailSelectionPoint(
  path: readonly number[],
  offset: number,
): PlateEmailEditorSelectionPoint {
  return {
    path: [...path],
    offset,
  };
}

export function createPlateEmailCollapsedSelection(
  point: PlateEmailEditorSelectionPoint,
): PlateEmailEditorSelectionRange {
  return {
    anchor: createPlateEmailSelectionPoint(point.path, point.offset),
    focus: createPlateEmailSelectionPoint(point.path, point.offset),
  };
}

export function createPlateEmailSelectionStore(): PlateEmailSelectionStore {
  let savedPoint: PlateEmailEditorSelectionPoint | null = null;

  return {
    capture(selection) {
      if (!selection) {
        return false;
      }

      savedPoint = createPlateEmailSelectionPoint(
        selection.anchor.path,
        selection.anchor.offset,
      );
      return true;
    },
    restore(select) {
      const point = savedPoint;
      savedPoint = null;

      if (!point) {
        return false;
      }

      try {
        select(createPlateEmailCollapsedSelection(point));
        return true;
      } catch {
        return false;
      }
    },
    clear() {
      savedPoint = null;
    },
  };
}

export function createPlateEmailStartSelection(): PlateEmailEditorSelectionRange {
  return createPlateEmailCollapsedSelection(
    createPlateEmailSelectionPoint([0, 0], 0),
  );
}

export function createPlateEmailEndFocusOptions(): PlateEmailEditorFocusOptions {
  return { edge: 'endEditor' };
}

export function createPlateEmailEditorPluginKit<
  TBasePlugin,
  TAiPlugin = never,
  TCopilotPlugin = never,
>({
  basePlugins,
  aiEnabled = false,
  aiPlugins = [],
  copilotPlugins = [],
}: PlateEmailEditorPluginKitOptions<
  TBasePlugin,
  TAiPlugin,
  TCopilotPlugin
>): Array<TBasePlugin | TAiPlugin | TCopilotPlugin> {
  const plugins: Array<TBasePlugin | TAiPlugin | TCopilotPlugin> = [
    ...basePlugins,
  ];

  if (aiEnabled) {
    plugins.push(...aiPlugins, ...copilotPlugins);
  }

  return plugins;
}

export function createPlateEmailUsePlateEditorOptions<TPlugin, TValue = Value>({
  plugins,
  initialValue,
  shouldNormalizeEditor = true,
}: PlateEmailUsePlateEditorOptionsInput<
  TPlugin,
  TValue
>): PlateEmailUsePlateEditorOptions<TPlugin, TValue> {
  return {
    plugins,
    value: (initialValue ?? createPlateEmailEmptyValue()) as TValue,
    shouldNormalizeEditor,
  };
}

export function createPlateEmailChangeCallbacks<TValue = Value>({
  onValueChangeRef,
  onChangeRef,
  onPlainTextChangeRef,
}: PlateEmailChangeCallbackRefs<TValue>): PlateEmailChangeCallbacks<TValue> {
  return {
    onValueChange(value) {
      onValueChangeRef.current?.(value);
    },
    onChange(html) {
      onChangeRef.current?.(html);
    },
    onPlainTextChange(text) {
      onPlainTextChangeRef.current?.(text);
    },
  };
}

export function syncPlateEmailAdapterCallbackRefs<TValue = Value>({
  onValueChangeRef,
  onValueChange,
  onChangeRef,
  onChange,
  onPlainTextChangeRef,
  onPlainTextChange,
  onReadyRef,
  onReady,
}: PlateEmailAdapterCallbackRefSyncOptions<TValue>): void {
  onValueChangeRef.current = onValueChange;
  onChangeRef.current = onChange;
  onPlainTextChangeRef.current = onPlainTextChange;
  onReadyRef.current = onReady;
}

export function handlePlateEmailEditorContainerClick<TValue = Value>({
  controller,
  disabled = false,
  target,
  currentTarget,
  focus,
}: PlateEmailEditorContainerClickOptions<TValue>): boolean {
  if (disabled || target !== currentTarget) {
    return false;
  }

  controller.focusEnd(focus);
  return true;
}

export function hasPlateEmailHtmlContent(html: string): boolean {
  return html.trim().length > 0;
}

export function createPlateEmailHtmlCache(): PlateEmailHtmlCache {
  let cachedHtml = '';
  let dirty = false;
  let sequence = 0;

  return {
    markDirty() {
      dirty = true;
    },
    reserveSerialization() {
      sequence += 1;
      return sequence;
    },
    commitSerializedHtml(commitSequence, html) {
      if (commitSequence !== sequence) {
        return false;
      }

      cachedHtml = html;
      dirty = false;
      return true;
    },
    /**
     * Adopt HTML that was just set programmatically as the current content.
     *
     * The DOM trails a programmatic `setValue` by a render, so without this a
     * caller reading `getHtml()` in the same commit gets the content from
     * before the set. Reserving a sequence also discards any serialization
     * already in flight for the old value.
     */
    commitProgrammaticHtml(html) {
      sequence += 1;
      cachedHtml = html;
      dirty = false;
    },
    cancelPendingSerialization() {
      sequence += 1;
    },
    getCurrentHtml(domHtml = null) {
      if (!dirty && cachedHtml) {
        return cachedHtml;
      }

      if (domHtml === null) {
        return cachedHtml;
      }

      return sanitizePlateEmailEditorHtml(domHtml);
    },
  };
}

export function createPlateEmailChangeScheduler<TValue = Value>({
  cache,
  delayMs = PLATE_EMAIL_EDITOR_CHANGE_DEBOUNCE_MS,
  serializeHtml,
  serializePlainText,
  setTimeoutFn = defaultPlateEmailSetTimeout,
  clearTimeoutFn = defaultPlateEmailClearTimeout,
}: PlateEmailChangeSchedulerOptions<TValue>): PlateEmailChangeScheduler<TValue> {
  let timer: PlateEmailTimerHandle | null = null;

  return {
    handleChange(value, callbacks = {}) {
      callbacks.onValueChange?.(value);
      cache.markDirty();

      if (timer !== null) {
        clearTimeoutFn(timer);
      }

      timer = setTimeoutFn(() => {
        timer = null;
        const sequence = cache.reserveSerialization();

        void serializeHtml(value)
          .then((html) => {
            if (!cache.commitSerializedHtml(sequence, html)) {
              return;
            }

            callbacks.onChange?.(html);
            callbacks.onPlainTextChange?.(serializePlainText(value));
          })
          .catch(() => {
            // Keep the cache dirty so DOM fallback remains authoritative.
          });
      }, delayMs);
    },
    cancel() {
      if (timer !== null) {
        clearTimeoutFn(timer);
        timer = null;
      }

      cache.cancelPendingSerialization();
    },
  };
}

export function createPlateEmailEditorController<TValue = Value>({
  cache = createPlateEmailHtmlCache(),
  selectionStore = createPlateEmailSelectionStore(),
  delayMs,
  serializeHtml,
  serializePlainText,
  setTimeoutFn,
  clearTimeoutFn,
}: PlateEmailEditorControllerOptions<TValue>): PlateEmailEditorController<TValue> {
  const changeScheduler = createPlateEmailChangeScheduler<TValue>({
    cache,
    delayMs,
    serializeHtml,
    serializePlainText,
    setTimeoutFn,
    clearTimeoutFn,
  });

  return {
    handleChange(value, callbacks) {
      changeScheduler.handleChange(value, callbacks);
    },
    getHtml(domHtml = null) {
      return cache.getCurrentHtml(domHtml);
    },
    setContent(html, options) {
      setPlateEmailHtmlContent({
        html,
        ...options,
      });
      cache.commitProgrammaticHtml(html);
    },
    insertContent(html, options) {
      insertPlateEmailHtmlContent({
        html,
        ...options,
      });
    },
    hydrateInitialHtml(html, options) {
      const value = deserializePlateEmailInitialHtmlValue(
        html,
        options.deserializer,
      );

      if (!value) {
        return false;
      }

      options.setValue(value as TValue);
      // The editor's Slate value holds the document now; its DOM still shows
      // the previous content until React re-renders. Anyone reading getHtml()
      // before then (the composer's mount effect does, and it writes what it
      // reads back into the body) must not be handed the stale DOM.
      cache.commitProgrammaticHtml(html);
      return true;
    },
    captureSelection(selection) {
      return selectionStore.capture(selection);
    },
    insertContentAtSavedSelection(html, { select, ...options }) {
      selectionStore.restore(select);
      insertPlateEmailHtmlContent({
        html,
        ...options,
      });
    },
    insertInlineImage(image, insertNode, select) {
      const normalizedImage = normalizePlateEmailInlineImage(image);

      if (!normalizedImage) {
        return false;
      }

      if (select) {
        selectionStore.restore(select);
      }

      insertNode(createPlateEmailInlineImageNode(normalizedImage));
      return true;
    },
    focusStart(select) {
      select(createPlateEmailStartSelection());
    },
    focusEnd(focus) {
      focus(createPlateEmailEndFocusOptions());
    },
    cancel() {
      changeScheduler.cancel();
    },
  };
}

export function getOrCreatePlateEmailEditorController<TValue = Value>({
  controllerRef,
  ...options
}: PlateEmailEditorControllerRefOptions<TValue>): PlateEmailEditorController<TValue> {
  if (!controllerRef.current) {
    controllerRef.current = createPlateEmailEditorController<TValue>(options);
  }

  return controllerRef.current;
}

export function createPlateEmailEditorRef<TValue = Value, TNode = Value>({
  controller,
  getDomHtml = () => null,
  getPlainText,
  getValue,
  deserializer,
  setValue,
  insertNodes,
  insertText,
  getSelection,
  select,
  insertInlineNode,
}: PlateEmailEditorRefOptions<TValue, TNode>): PlateEmailEditorRef {
  return {
    getHTML() {
      return controller.getHtml(getDomHtml());
    },
    ...(getPlainText ? { getPlainText } : {}),
    ...(getValue
      ? { getValue: getValue as unknown as () => Value }
      : {}),
    setContent(html) {
      controller.setContent(html, {
        deserializer,
        setValue,
      });
    },
    insertContent(html) {
      controller.insertContent<TNode>(html, {
        deserializer,
        insertNodes,
        insertText,
      });
    },
    captureSelection() {
      controller.captureSelection(getSelection());
    },
    insertContentAtSavedSelection(html) {
      controller.insertContentAtSavedSelection<TNode>(html, {
        select,
        deserializer,
        insertNodes,
        insertText,
      });
    },
    insertInlineImage(image) {
      controller.insertInlineImage(image, insertInlineNode, select);
    },
    focusStart() {
      controller.focusStart(select);
    },
  };
}

export function publishPlateEmailEditorRef<TRef = PlateEmailEditorRef>({
  editorRef,
  onReady,
  forwardedRef,
}: PlateEmailEditorRefPublisherOptions<TRef>): PlateEmailEditorRefCleanup {
  // Publish the ref before notifying. A ready handler that catches the editor
  // up (useComposeForm flushes the composed body this way) reads the ref it was
  // handed, and the assignment has to have landed by then or the catch-up is
  // skipped for good: it is a one-shot.
  if (typeof forwardedRef === 'function') {
    forwardedRef(editorRef);
    onReady?.(editorRef);
    return () => forwardedRef(null);
  }

  if (forwardedRef) {
    forwardedRef.current = editorRef;
    onReady?.(editorRef);
    return () => {
      forwardedRef.current = null;
    };
  }

  onReady?.(editorRef);

  return () => {};
}

export function deserializePlateEmailHtmlValue(
  html: string,
  deserializer: PlateEmailHtmlDeserializer,
): Value {
  return deserializer.deserialize({ element: html }) as Value;
}

export function setPlateEmailHtmlContent<TValue = Value>({
  html,
  deserializer,
  setValue,
}: PlateEmailSetHtmlContentOptions<TValue>): void {
  try {
    setValue(deserializePlateEmailHtmlValue(html, deserializer) as TValue);
  } catch {
    setValue(createPlateEmailPlainTextFallbackValue(html) as TValue);
  }
}

export function insertPlateEmailHtmlContent<TNode = Value>({
  html,
  deserializer,
  insertNodes,
  insertText,
}: PlateEmailInsertHtmlContentOptions<TNode>): void {
  try {
    insertNodes(deserializePlateEmailHtmlValue(html, deserializer) as TNode);
  } catch {
    insertText(extractPlateEmailPlainTextFallback(html));
  }
}

export function deserializePlateEmailInitialHtmlValue(
  html: string,
  deserializer: PlateEmailHtmlDeserializer,
): Value | null {
  if (!hasPlateEmailHtmlContent(html)) {
    return null;
  }

  try {
    return deserializePlateEmailHtmlValue(html, deserializer);
  } catch {
    return createPlateEmailEmptyValue();
  }
}

export function extractPlateEmailPlainTextFallback(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]*>/g, '');
}

/**
 * Strips editor-only DOM attributes from email editor HTML.
 *
 * This is shared by static serializer output and synchronous innerHTML
 * fallbacks. It deliberately keeps app-owned email metadata such as
 * data-pm-* and data-suggestion-* attributes intact.
 */
export function sanitizePlateEmailEditorHtml(html: string): string {
  return html
    .replace(/\s*contenteditable="[^"]*"/gi, '')
    .replace(/\s*data-slate-[a-z0-9-]+="[^"]*"/gi, '')
    .replace(/\s*data-plate-[a-z0-9-]+="[^"]*"/gi, '')
    .replace(/\s*data-block-suggestion="[^"]*"/gi, '')
    .replace(/\s*data-inline-suggestion="[^"]*"/gi, '')
    .replace(/\s*data-comment-[a-z0-9-]+="[^"]*"/gi, '')
    .replace(/\s*data-block-id="[^"]*"/gi, '')
    .replace(/\s*data-readonly="[^"]*"/gi, '')
    .replace(/\s*spellcheck="[^"]*"/gi, '')
    .replace(/\s*translate="[^"]*"/gi, '')
    .replace(/\s*role="[^"]*"/gi, '')
    .replace(/\s*autocorrect="[^"]*"/gi, '')
    .replace(/\s*autocapitalize="[^"]*"/gi, '')
    .replace(/\s*data-gramm="[^"]*"/gi, '')
    .replace(/\s*zindex="[^"]*"/gi, '')
    .replace(/\s*style="position:\s*relative;?"/gi, '');
}

function defaultPlateEmailSetTimeout(
  callback: () => void,
  delayMs: number,
): PlateEmailTimerHandle {
  return setTimeout(callback, delayMs);
}

function defaultPlateEmailClearTimeout(handle: PlateEmailTimerHandle): void {
  clearTimeout(handle as ReturnType<typeof setTimeout>);
}

export interface PlateEmailInlineImage {
  src: string;
  alt?: string;
}

export interface PlateEmailNormalizedInlineImage {
  src: string;
  alt: string;
}

export interface PlateEmailEditorSelectionPoint {
  path: number[];
  offset: number;
}

export interface PlateEmailEditorSelectionRange {
  anchor: PlateEmailEditorSelectionPoint;
  focus: PlateEmailEditorSelectionPoint;
}

export interface PlateEmailSelectionStore {
  capture: (
    selection: PlateEmailEditorSelectionRange | null | undefined,
  ) => boolean;
  restore: (select: (range: PlateEmailEditorSelectionRange) => void) => boolean;
  clear: () => void;
}

export interface PlateEmailEditorFocusOptions {
  edge: 'endEditor';
}

export interface PlateEmailEditorPluginKitOptions<
  TBasePlugin = unknown,
  TAiPlugin = never,
  TCopilotPlugin = never,
> {
  basePlugins: readonly TBasePlugin[];
  aiEnabled?: boolean;
  aiPlugins?: readonly TAiPlugin[];
  copilotPlugins?: readonly TCopilotPlugin[];
}

export interface PlateEmailUsePlateEditorOptionsInput<
  TPlugin = unknown,
  TValue = Value,
> {
  plugins: TPlugin[];
  initialValue?: TValue | null;
  shouldNormalizeEditor?: boolean;
}

export interface PlateEmailUsePlateEditorOptions<
  TPlugin = unknown,
  TValue = Value,
> {
  plugins: TPlugin[];
  value: TValue;
  shouldNormalizeEditor: boolean;
}

export interface PlateEmailHtmlCache {
  markDirty: () => void;
  reserveSerialization: () => number;
  commitSerializedHtml: (sequence: number, html: string) => boolean;
  /** Adopt HTML that was just set programmatically as the current content. */
  commitProgrammaticHtml: (html: string) => void;
  cancelPendingSerialization: () => void;
  getCurrentHtml: (domHtml?: string | null) => string;
}

export type PlateEmailTimerHandle = unknown;

export interface PlateEmailMutableCallbackRef<TCallback> {
  current: TCallback | null | undefined;
}

export interface PlateEmailMutableValueRef<TValue> {
  current: TValue;
}

export interface PlateEmailChangeCallbackRefs<TValue = Value> {
  onValueChangeRef: PlateEmailMutableCallbackRef<(value: TValue) => void>;
  onChangeRef: PlateEmailMutableCallbackRef<(html: string) => void>;
  onPlainTextChangeRef: PlateEmailMutableCallbackRef<(text: string) => void>;
}

export interface PlateEmailAdapterCallbackRefSyncOptions<TValue = Value> {
  onValueChangeRef: PlateEmailMutableCallbackRef<(value: TValue) => void>;
  onValueChange?: (value: TValue) => void;
  onChangeRef: PlateEmailMutableCallbackRef<(html: string) => void>;
  onChange?: (html: string) => void;
  onPlainTextChangeRef: PlateEmailMutableCallbackRef<(text: string) => void>;
  onPlainTextChange?: (text: string) => void;
  onReadyRef: PlateEmailMutableCallbackRef<(ref: PlateEmailEditorRef) => void>;
  onReady?: (ref: PlateEmailEditorRef) => void;
}

export interface PlateEmailEditorContainerClickOptions<TValue = Value> {
  controller: Pick<PlateEmailEditorController<TValue>, 'focusEnd'>;
  disabled?: boolean;
  target: unknown;
  currentTarget: unknown;
  focus: (options: PlateEmailEditorFocusOptions) => void;
}

export interface PlateEmailChangeCallbacks<TValue = Value> {
  onValueChange?: (value: TValue) => void;
  onChange?: (html: string) => void;
  onPlainTextChange?: (text: string) => void;
}

export interface PlateEmailChangeSchedulerOptions<TValue = Value> {
  cache: PlateEmailHtmlCache;
  delayMs?: number;
  serializeHtml: (value: TValue) => Promise<string>;
  serializePlainText: (value: TValue) => string;
  setTimeoutFn?: (
    callback: () => void,
    delayMs: number,
  ) => PlateEmailTimerHandle;
  clearTimeoutFn?: (handle: PlateEmailTimerHandle) => void;
}

export interface PlateEmailChangeScheduler<TValue = Value> {
  handleChange: (
    value: TValue,
    callbacks?: PlateEmailChangeCallbacks<TValue>,
  ) => void;
  cancel: () => void;
}

export interface PlateEmailEditorControllerOptions<TValue = Value> extends Omit<
  PlateEmailChangeSchedulerOptions<TValue>,
  'cache'
> {
  cache?: PlateEmailHtmlCache;
  selectionStore?: PlateEmailSelectionStore;
}

export interface PlateEmailEditorControllerRefOptions<
  TValue = Value,
> extends PlateEmailEditorControllerOptions<TValue> {
  controllerRef: PlateEmailMutableValueRef<
    PlateEmailEditorController<TValue> | null | undefined
  >;
}

export type PlateEmailEditorSetContentOptions<TValue = Value> = Omit<
  PlateEmailSetHtmlContentOptions<TValue>,
  'html'
>;

export type PlateEmailEditorInsertContentOptions<TNode = Value> = Omit<
  PlateEmailInsertHtmlContentOptions<TNode>,
  'html'
>;

export interface PlateEmailEditorInsertAtSavedSelectionOptions<
  TNode = Value,
> extends PlateEmailEditorInsertContentOptions<TNode> {
  select: (range: PlateEmailEditorSelectionRange) => void;
}

export interface PlateEmailEditorController<TValue = Value> {
  handleChange: (
    value: TValue,
    callbacks?: PlateEmailChangeCallbacks<TValue>,
  ) => void;
  getHtml: (domHtml?: string | null) => string;
  setContent: (
    html: string,
    options: PlateEmailEditorSetContentOptions<TValue>,
  ) => void;
  insertContent: <TNode = Value>(
    html: string,
    options: PlateEmailEditorInsertContentOptions<TNode>,
  ) => void;
  hydrateInitialHtml: (
    html: string,
    options: PlateEmailEditorSetContentOptions<TValue>,
  ) => boolean;
  captureSelection: (
    selection: PlateEmailEditorSelectionRange | null | undefined,
  ) => boolean;
  insertContentAtSavedSelection: <TNode = Value>(
    html: string,
    options: PlateEmailEditorInsertAtSavedSelectionOptions<TNode>,
  ) => void;
  insertInlineImage: (
    image: PlateEmailInlineImage,
    insertNode: (node: Value[number]) => void,
    select?: (range: PlateEmailEditorSelectionRange) => void,
  ) => boolean;
  focusStart: (select: (range: PlateEmailEditorSelectionRange) => void) => void;
  focusEnd: (focus: (options: PlateEmailEditorFocusOptions) => void) => void;
  cancel: () => void;
}

export interface PlateEmailEditorRefOptions<TValue = Value, TNode = Value> {
  controller: PlateEmailEditorController<TValue>;
  getDomHtml?: () => string | null;
  getPlainText?: () => string;
  /** The live document, for callers that must inspect it before it settles. */
  getValue?: () => TValue;
  deserializer: PlateEmailHtmlDeserializer;
  setValue: (value: TValue) => void;
  insertNodes: (value: TNode) => void;
  insertText: (text: string) => void;
  getSelection: () => PlateEmailEditorSelectionRange | null | undefined;
  select: (range: PlateEmailEditorSelectionRange) => void;
  insertInlineNode: (node: Value[number]) => void;
}

export type PlateEmailEditorForwardedRef<TRef = PlateEmailEditorRef> =
  | ((instance: TRef | null) => void)
  | { current: TRef | null }
  | null
  | undefined;

export type PlateEmailEditorRefCleanup = () => void;

export interface PlateEmailEditorRefPublisherOptions<
  TRef = PlateEmailEditorRef,
> {
  editorRef: TRef;
  onReady?: (ref: TRef) => void;
  forwardedRef?: PlateEmailEditorForwardedRef<TRef>;
}

export interface PlateEmailHtmlDeserializer {
  deserialize: (options: { element: string }) => unknown;
}

export interface PlateEmailSetHtmlContentOptions<TValue = Value> {
  html: string;
  deserializer: PlateEmailHtmlDeserializer;
  setValue: (value: TValue) => void;
}

export interface PlateEmailInsertHtmlContentOptions<TNode = Value> {
  html: string;
  deserializer: PlateEmailHtmlDeserializer;
  insertNodes: (value: TNode) => void;
  insertText: (text: string) => void;
}

export interface PlateEmailEditorRef {
  getHTML: () => string;
  /** Optional app adapter extension for synchronous semantic text capture. */
  getPlainText?: () => string;
  /** Optional app adapter extension for reading the live document. */
  getValue?: () => Value;
  setContent: (html: string) => void;
  insertContent: (html: string) => void;
  captureSelection: () => void;
  insertContentAtSavedSelection: (html: string) => void;
  insertInlineImage: (image: PlateEmailInlineImage) => void;
  focusStart: () => void;
}

export interface PlateEmailEditorAdapterProps<TValue = Value> {
  children?: ReactNode;
  surface?: PlateEmailEditorSurface;
  /**
   * How the document is presented while it is authored. A different axis from
   * `surface`: the composer is one surface and can be in any dialect.
   */
  dialect?: PlateEmailEditorDialect;
  initialHtml?: string;
  initialValue?: TValue;
  ariaLabel?: string;
  placeholder?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  aiEnabled?: boolean;
  minHeight?: number;
  onChange?: (html: string) => void;
  onValueChange?: (value: TValue) => void;
  onPlainTextChange?: (text: string) => void;
  onBlur?: () => void;
  onReady?: (ref: PlateEmailEditorRef) => void;
  className?: string;
  contentStyle?: CSSProperties;
}
