'use client';

/**
 * Interactive (React) plugin kit for the PressedMail composer.
 *
 * Mirrors the canonical kit layout from
 * plate-main/templates/plate-playground-template/src/components/editor,
 * scoped to what an email composer needs. The server-safe Base* kit in
 * plate-composer-plugins.ts stays the source of truth for static
 * serialization; this kit must keep node types/keys compatible with it.
 */

import * as React from 'react';
import { KEYS } from '@kit/plate';
import type { TLinkElement, TListElement } from '@kit/plate';
import {
  ParagraphPlugin,
  PlateElement,
  toPlatePlugin,
  type PlateElementProps,
} from '@kit/plate/react';
import {
  BlockquoteRules,
  BoldRules,
  CodeRules,
  HeadingRules,
  HighlightRules,
  HorizontalRuleRules,
  ItalicRules,
  MarkComboRules,
  StrikethroughRules,
  SubscriptRules,
  SuperscriptRules,
  UnderlineRules,
} from '@kit/plate/basic-nodes';
import {
  BlockquotePlugin,
  BoldPlugin,
  CodePlugin,
  H1Plugin,
  H2Plugin,
  H3Plugin,
  HighlightPlugin,
  HorizontalRulePlugin,
  ItalicPlugin,
  KbdPlugin,
  StrikethroughPlugin,
  SubscriptPlugin,
  SuperscriptPlugin,
  UnderlinePlugin,
} from '@kit/plate/basic-nodes/react';
import {
  FontBackgroundColorPlugin,
  FontColorPlugin,
  FontFamilyPlugin,
  FontSizePlugin,
  LineHeightPlugin,
  TextAlignPlugin,
} from '@kit/plate/basic-styles/react';
import { CalloutPlugin } from '@kit/plate/callout/react';
import { CodeBlockRules } from '@kit/plate/code-block';
import {
  CodeBlockPlugin,
  CodeLinePlugin,
  CodeSyntaxPlugin,
} from '@kit/plate/code-block/react';
import { common, createLowlight } from 'lowlight';
import { DatePlugin } from '@kit/plate/date/react';
import { IndentPlugin } from '@kit/plate/indent/react';
import { ColumnItemPlugin, ColumnPlugin } from '@kit/plate/layout/react';
import { getLinkAttributes, LinkRules } from '@kit/plate/link';
import { LinkPlugin } from '@kit/plate/link/react';
import {
  BulletedListRules,
  isOrderedList,
  OrderedListRules,
  TaskListRules,
} from '@kit/plate/list';
import { ListPlugin } from '@kit/plate/list/react';
import { CaptionPlugin } from '@kit/plate/caption/react';
import {
  AudioPlugin,
  FilePlugin,
  ImagePlugin,
  MediaEmbedPlugin,
  PlaceholderPlugin,
  VideoPlugin,
} from '@kit/plate/media/react';
import { MentionInputPlugin, MentionPlugin } from '@kit/plate/mention/react';
import {
  TableCellHeaderPlugin,
  TableCellPlugin,
  TablePlugin,
  TableRowPlugin,
} from '@kit/plate/table/react';
import { TocPlugin } from '@kit/plate/toc/react';
import { TogglePlugin } from '@kit/plate/toggle/react';

import {
  AISuggestionNode,
  AISuggestionPlugin,
  AttachmentCardNode,
  AttachmentCardPlugin,
  QuoteBlockPlugin,
  QuoteNode,
  SignatureBlockPlugin,
  SignatureNode,
} from './nodes';
import { CalloutElement } from './plate/callout-node';
import {
  CodeBlockElement,
  CodeLineElement,
  CodeSyntaxLeaf,
} from './plate/code-block-node';
import { DndKit } from './plate/dnd-kit';
import { ColumnElement, ColumnGroupElement } from './plate/column-node';
import { DateElement } from './plate/date-node';
import { EquationElement, InlineEquationElement } from './plate/equation-node';
import { ExcalidrawElement } from './plate/excalidraw-node';
import { KbdLeaf } from './plate/kbd-node';
import { MediaEmbedElement } from './plate/media-embed-node';
import { ImageElement } from './plate/media-image-node';
import { AudioElement, FileElement, VideoElement } from './plate/media-node';
import { PlaceholderElement } from './plate/media-placeholder-node';
import { MediaPreviewDialog } from './plate/media-preview-dialog';
import { MediaUploadToast } from './plate/media-upload-toast';
import { MentionElement, MentionInputElement } from './plate/mention-node';
import {
  TableCellElement,
  TableCellHeaderElement,
  TableElement,
  TableRowElement,
} from './plate/table-node';
import { TocElement } from './plate/toc-node';
import { ToggleElement } from './plate/toggle-node';
import { AutoformatKit } from './plate/autoformat-kit';
import { BlockList } from './plate/block-list';
import { BlockMenuKit } from './plate/block-menu-kit';
import { CommentKit } from './plate/comment-kit';
import { DiscussionKit } from './plate/discussion-kit';
import { SuggestionKit } from './plate/suggestion-kit';
import { BlockPlaceholderKit } from './plate/block-placeholder-kit';
import { EmojiKit } from './plate/emoji-kit';
import { ExitBreakKit } from './plate/exit-break-kit';
import { CursorOverlayKit } from './plate/cursor-overlay-kit';
import { FloatingToolbarKit } from './plate/floating-toolbar-kit';
import { LinkFloatingToolbar } from './plate/link-toolbar';
import {
  ComposerDrawingFallbackPlugin,
  ComposerEquationFallbackPlugin,
  ComposerInlineEquationFallbackPlugin,
} from './plate/optional-fallback-plugins';
import { SlashKit } from './plate/slash-kit';
import { SplitSoftBreaksPlugin } from './plate/split-soft-breaks-plugin';

/* ─── Minimal node components (PressedMail tokens only) ─── */

function ComposerLinkNode(props: PlateElementProps<TLinkElement>) {
  return (
    <PlateElement
      {...props}
      as="a"
      attributes={{
        ...props.attributes,
        ...getLinkAttributes(props.editor, props.element),
        onMouseOver: (e) => {
          e.stopPropagation();
        },
      }}
      className="text-primary underline underline-offset-2"
    >
      {props.children}
    </PlateElement>
  );
}

/* ─── Kit ─── */

export const ComposerReactPlugins = [
  // Blocks
  ParagraphPlugin,
  H1Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    rules: { break: { empty: 'reset' } },
  }),
  H2Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    rules: { break: { empty: 'reset' } },
  }),
  H3Plugin.configure({
    inputRules: [HeadingRules.markdown()],
    rules: { break: { empty: 'reset' } },
  }),
  BlockquotePlugin.configure({
    inputRules: [BlockquoteRules.markdown()],
  }),
  HorizontalRulePlugin.configure({
    inputRules: [HorizontalRuleRules.markdown()],
  }),
  // Code block (lowlight `common` grammars, `all` would bloat the WP bundle)
  CodeBlockPlugin.configure({
    inputRules: [CodeBlockRules.markdown({ on: 'match' })],
    node: { component: CodeBlockElement },
    options: { lowlight: createLowlight(common) },
    shortcuts: { toggle: { keys: 'mod+alt+8' } },
  }),
  CodeLinePlugin.withComponent(CodeLineElement),
  CodeSyntaxPlugin.withComponent(CodeSyntaxLeaf),
  // Callout (coloured info box; email-safe via inline-style table on serialize)
  CalloutPlugin.withComponent(CalloutElement),
  // Inline date chip (email-safe → plain formatted text)
  DatePlugin.withComponent(DateElement),
  // Collapsible toggle (email-safe → renders expanded)
  TogglePlugin.withComponent(ToggleElement),
  // Columns (email-safe → fixed-layout table on serialize)
  ColumnPlugin.withComponent(ColumnGroupElement),
  ColumnItemPlugin.withComponent(ColumnElement),
  // Table of contents (email-safe → indented heading-title list)
  TocPlugin.configure({ options: { topOffset: 80 } }).withComponent(TocElement),
  // Media: resizable + captioned image with preview dialog; video/audio/file
  // and URL embeds; drag-drop/paste uploads go through the placeholder flow
  // bridged to the WP upload endpoint. Email-safe statics: inline-styled img
  // + figcaption, links for everything else.
  ImagePlugin.configure({
    options: { disableUploadInsert: true },
    render: { afterEditable: MediaPreviewDialog, node: ImageElement },
  }),
  MediaEmbedPlugin.withComponent(MediaEmbedElement),
  VideoPlugin.withComponent(VideoElement),
  AudioPlugin.withComponent(AudioElement),
  FilePlugin.withComponent(FileElement),
  PlaceholderPlugin.configure({
    options: { disableEmptyPlaceholder: true },
    render: { afterEditable: MediaUploadToast, node: PlaceholderElement },
  }),
  CaptionPlugin.configure({
    options: {
      query: {
        allow: [KEYS.img, KEYS.video, KEYS.audio, KEYS.file, KEYS.mediaEmbed],
      },
    },
  }),

  // Mentions wired to PressedMail contacts (email-safe → @name text)
  MentionPlugin.configure({
    options: { triggerPreviousCharPattern: /^$|^[\s"']$/ },
  }).withComponent(MentionElement),
  MentionInputPlugin.withComponent(MentionInputElement),

  // Optional feature fallbacks. Existing equation/drawing values remain
  // visible, but the default PressedMail bundle does not import KaTeX,
  // Excalidraw, Mermaid, Markdown, or Docx feature stacks.
  toPlatePlugin(ComposerInlineEquationFallbackPlugin, {
    node: { component: InlineEquationElement },
  }),
  toPlatePlugin(ComposerEquationFallbackPlugin, {
    node: { component: EquationElement },
  }),
  toPlatePlugin(ComposerDrawingFallbackPlugin, {
    node: { component: ExcalidrawElement },
  }),

  // Tables, interactive node components (visible table + cell selection,
  // resize, and the floating bubble toolbar). Email output uses the inline
  // statics on serialize. initialTableWidth seeds colSizes so new tables size.
  TablePlugin.configure({
    node: { component: TableElement },
    options: { initialTableWidth: 600, minColumnWidth: 48 },
  }),
  TableRowPlugin.withComponent(TableRowElement),
  TableCellPlugin.withComponent(TableCellElement),
  TableCellHeaderPlugin.withComponent(TableCellHeaderElement),

  // Links (floating insert/edit toolbar rendered after the editable, the
  // way the template's link-kit wires it)
  LinkPlugin.configure({
    options: {
      allowedSchemes: ['http', 'https', 'mailto', 'tel'],
      transformInput: (url) => {
        const trimmed = url.trim();
        return /^[a-z][a-z0-9+.-]*:/i.test(trimmed)
          ? trimmed
          : `https://${trimmed}`;
      },
    },
    inputRules: [
      LinkRules.markdown(),
      LinkRules.autolink({ variant: 'paste' }),
      LinkRules.autolink({ variant: 'space' }),
    ],
    render: {
      node: ComposerLinkNode,
      afterEditable: () => <LinkFloatingToolbar />,
    },
  }),

  // Marks (default shortcuts: mod+b/i/u)
  BoldPlugin.configure({
    inputRules: [
      BoldRules.markdown({ variant: '*' }),
      BoldRules.markdown({ variant: '_' }),
      MarkComboRules.markdown({ variant: 'boldItalic' }),
      MarkComboRules.markdown({ variant: 'boldUnderline' }),
      MarkComboRules.markdown({ variant: 'boldItalicUnderline' }),
      MarkComboRules.markdown({ variant: 'italicUnderline' }),
    ],
  }),
  ItalicPlugin.configure({
    inputRules: [
      ItalicRules.markdown({ variant: '*' }),
      ItalicRules.markdown({ variant: '_' }),
    ],
  }),
  UnderlinePlugin.configure({
    inputRules: [UnderlineRules.markdown()],
  }),
  CodePlugin.configure({
    inputRules: [CodeRules.markdown()],
    shortcuts: { toggle: { keys: 'mod+e' } },
  }),
  StrikethroughPlugin.configure({
    inputRules: [StrikethroughRules.markdown()],
    shortcuts: { toggle: { keys: 'mod+shift+x' } },
  }),
  HighlightPlugin.configure({
    inputRules: [HighlightRules.markdown({ variant: '==' })],
    shortcuts: { toggle: { keys: 'mod+shift+h' } },
  }),
  SubscriptPlugin.configure({
    inputRules: [SubscriptRules.markdown()],
    shortcuts: { toggle: { keys: 'mod+comma' } },
  }),
  SuperscriptPlugin.configure({
    inputRules: [SuperscriptRules.markdown()],
    shortcuts: { toggle: { keys: 'mod+period' } },
  }),
  KbdPlugin.withComponent(KbdLeaf),

  // Font / color / size / family marks
  FontColorPlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
  }),
  FontBackgroundColorPlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
  }),
  FontSizePlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
  }),
  FontFamilyPlugin.configure({
    inject: { targetPlugins: [KEYS.p] },
  }),

  // Alignment
  TextAlignPlugin.configure({
    inject: {
      nodeProps: {
        defaultNodeValue: 'start',
        nodeKey: 'align',
        styleKey: 'textAlign',
        validNodeValues: ['start', 'left', 'center', 'right', 'end', 'justify'],
      },
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.img],
    },
  }),

  // Line height (injects an inline style, email-safe)
  LineHeightPlugin.configure({
    inject: {
      nodeProps: {
        defaultNodeValue: 1.5,
        nodeKey: 'lineHeight',
        styleKey: 'lineHeight',
        validNodeValues: [1, 1.15, 1.5, 2, 2.5],
      },
      targetPlugins: [...KEYS.heading, KEYS.p],
    },
  }),

  // Indent + lists
  IndentPlugin.configure({
    inject: {
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote, KEYS.img],
    },
    options: { offset: 24 },
  }),
  ListPlugin.configure({
    inputRules: [
      BulletedListRules.markdown({ variant: '-' }),
      BulletedListRules.markdown({ variant: '*' }),
      OrderedListRules.markdown({ variant: '.' }),
      OrderedListRules.markdown({ variant: ')' }),
      TaskListRules.markdown({ checked: false }),
      TaskListRules.markdown({ checked: true }),
    ],
    inject: {
      nodeProps: {
        nodeKey: KEYS.listType,
        query: ({ nodeProps }) => {
          const element = nodeProps.element as TListElement | undefined;
          return !!element?.listStyleType && !isOrderedList(element);
        },
        transformProps: ({ props }) => ({
          ...props,
          role: 'listitem',
          style: {
            ...(props.style as React.CSSProperties),
            display: 'list-item',
          },
        }),
      },
      targetPlugins: [
        ...KEYS.heading,
        KEYS.p,
        KEYS.blockquote,
        KEYS.codeBlock,
        KEYS.toggle,
        KEYS.img,
      ],
    },
    render: { belowNodes: BlockList },
  }),

  // Collaboration (editor-local, in-memory): discussions store, comment
  // marks, suggestion (tracked-changes) marks. SuggestionKit ships its own
  // TrailingBlockPlugin (inserts outside suggestion mode), replacing the
  // standalone TrailingBlockPlugin entry this kit used to register.
  ...DiscussionKit,
  ...CommentKit,
  ...SuggestionKit,

  // Editing UX: text substitutions, exit-break shortcuts, empty-block hint,
  // ":" emoji autocomplete
  ...AutoformatKit,
  ...ExitBreakKit,
  ...BlockPlaceholderKit,
  ...EmojiKit,

  // Chrome: slash "/" insert menu
  ...SlashKit,
  // Chrome: block selection + right-click context menu
  ...BlockMenuKit,
  // Chrome: selection/caret overlay
  ...CursorOverlayKit,
  // Chrome: selection bubble toolbar (renders after the editable surface)
  ...FloatingToolbarKit,
  // Chrome: drag-handle block reordering (react-dnd)
  ...DndKit,

  // Custom PressedMail nodes (parsers inherited from the Slate plugins;
  // do not redefine them here, they carry the data-pm-* HTML contract)
  toPlatePlugin(SignatureBlockPlugin, {
    node: { component: SignatureNode },
  }),
  toPlatePlugin(QuoteBlockPlugin, {
    node: { component: QuoteNode },
  }),
  toPlatePlugin(AttachmentCardPlugin, {
    node: { component: AttachmentCardNode },
  }),
  toPlatePlugin(AISuggestionPlugin, {
    node: { component: AISuggestionNode },
  }),

  // Promote every <br>/\n soft break to its own block so each line can be
  // styled independently (alignment, line-height). Wraps
  // editor.api.html.deserialize, covers paste + initial-content load.
  SplitSoftBreaksPlugin,
];
