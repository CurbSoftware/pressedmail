import type * as React from 'react';
import {
  BaseBlockquotePlugin,
  BaseBoldPlugin,
  BaseCodePlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseHighlightPlugin,
  BaseItalicPlugin,
  BaseKbdPlugin,
  BaseStrikethroughPlugin,
  BaseSubscriptPlugin,
  BaseSuperscriptPlugin,
  BaseUnderlinePlugin,
} from '@kit/plate/basic-nodes';
import {
  BaseFontBackgroundColorPlugin,
  BaseFontColorPlugin,
  BaseFontFamilyPlugin,
  BaseFontSizePlugin,
  BaseLineHeightPlugin,
  BaseTextAlignPlugin,
} from '@kit/plate/basic-styles';
import { BaseCalloutPlugin } from '@kit/plate/callout';
import {
  BaseCodeBlockPlugin,
  BaseCodeLinePlugin,
  BaseCodeSyntaxPlugin,
} from '@kit/plate/code-block';
import { BaseCommentPlugin } from '@kit/plate/comment';
import { BaseSuggestionPlugin } from '@kit/plate/suggestion';
import { BaseDatePlugin } from '@kit/plate/date';
import { BaseIndentPlugin } from '@kit/plate/indent';
import { BaseColumnItemPlugin, BaseColumnPlugin } from '@kit/plate/layout';
import { BaseLinkPlugin } from '@kit/plate/link';
import { BaseListPlugin } from '@kit/plate/list';
import { BaseCaptionPlugin } from '@kit/plate/caption';
import {
  BaseAudioPlugin,
  BaseFilePlugin,
  BaseImagePlugin,
  BaseMediaEmbedPlugin,
  BasePlaceholderPlugin,
  BaseVideoPlugin,
} from '@kit/plate/media';
import { BaseMentionPlugin } from '@kit/plate/mention';
import {
  BaseTableCellHeaderPlugin,
  BaseTableCellPlugin,
  BaseTablePlugin,
  BaseTableRowPlugin,
} from '@kit/plate/table';
import { BaseTocPlugin } from '@kit/plate/toc';
import { BaseTogglePlugin } from '@kit/plate/toggle';
import { BaseParagraphPlugin, KEYS } from '@kit/plate';

import {
  AttachmentCardPlugin,
  AISuggestionPlugin,
  QuoteBlockPlugin,
  SignatureBlockPlugin,
} from './nodes';
import {
  AISuggestionElementStatic,
  AttachmentCardElementStatic,
  QuoteElementStatic,
  SignatureElementStatic,
} from './nodes/static';
import { BlockListStatic } from './plate/block-list-static';
import { CalloutElementStatic } from './plate/callout-node-static';
import {
  CodeBlockElementStatic,
  CodeLineElementStatic,
  CodeSyntaxLeafStatic,
} from './plate/code-block-node-static';
import {
  ColumnElementStatic,
  ColumnGroupElementStatic,
} from './plate/column-node-static';
import {
  CommentLeafStatic,
  SuggestionLeafStatic,
} from './plate/comment-suggestion-static';
import { DateElementStatic } from './plate/date-node-static';
import {
  EquationElementStatic,
  InlineEquationElementStatic,
} from './plate/equation-node-static';
import { ExcalidrawElementStatic } from './plate/excalidraw-node-static';
import { KbdLeafStatic } from './plate/kbd-node-static';
import { LinkElementStatic } from './plate/link-node-static';
import { ImageElementStatic } from './plate/media-image-node-static';
import {
  AudioElementStatic,
  FileElementStatic,
  MediaEmbedElementStatic,
  PlaceholderElementStatic,
  VideoElementStatic,
} from './plate/media-node-static';
import { MentionElementStatic } from './plate/mention-node-static';
import {
  ComposerDrawingFallbackPlugin,
  ComposerEquationFallbackPlugin,
  ComposerInlineEquationFallbackPlugin,
} from './plate/optional-fallback-plugins';
import {
  TableCellElementStatic,
  TableCellHeaderElementStatic,
  TableElementStatic,
  TableRowElementStatic,
} from './plate/table-node-static';
import { parseTableCellBorders } from './plate/table-border-styles';
import { TocElementStatic } from './plate/toc-node-static';
import { ToggleElementStatic } from './plate/toggle-node-static';
import { SplitSoftBreaksPlugin } from './plate/split-soft-breaks-plugin';

function parseTableCell({
  element,
  type,
}: {
  element: HTMLElement;
  type: string;
}) {
  const background = element.style.background || element.style.backgroundColor;
  const borders = parseTableCellBorders(element);

  return {
    type,
    ...(background ? { background } : {}),
    ...(borders ? { borders } : {}),
  };
}

export const ComposerEditorPlugins = [
  // Elements
  BaseParagraphPlugin,
  BaseH1Plugin,
  BaseH2Plugin,
  BaseH3Plugin,
  BaseBlockquotePlugin,
  // Media: image keeps width/caption as inline styles; video/audio/file and
  // embeds downgrade to links; transient upload placeholders vanish.
  BaseImagePlugin.withComponent(ImageElementStatic),
  BaseVideoPlugin.withComponent(VideoElementStatic),
  BaseAudioPlugin.withComponent(AudioElementStatic),
  BaseFilePlugin.withComponent(FileElementStatic),
  BaseMediaEmbedPlugin.withComponent(MediaEmbedElementStatic),
  BasePlaceholderPlugin.withComponent(PlaceholderElementStatic),
  BaseCaptionPlugin,
  // Mentions (email-safe → @name text)
  BaseMentionPlugin.withComponent(MentionElementStatic),
  // Optional feature fallbacks (email-safe → stored plain text / snapshot)
  ComposerInlineEquationFallbackPlugin.withComponent(
    InlineEquationElementStatic
  ),
  ComposerEquationFallbackPlugin.withComponent(EquationElementStatic),
  ComposerDrawingFallbackPlugin.withComponent(ExcalidrawElementStatic),
  // Code block (email-safe inline-styled <pre><code>; tokens render plain)
  BaseCodeBlockPlugin.withComponent(CodeBlockElementStatic),
  BaseCodeLinePlugin.withComponent(CodeLineElementStatic),
  BaseCodeSyntaxPlugin.withComponent(CodeSyntaxLeafStatic),
  // Callout (email-safe inline-style table)
  BaseCalloutPlugin.withComponent(CalloutElementStatic),
  // Inline date (email-safe formatted text)
  BaseDatePlugin.withComponent(DateElementStatic),
  // Toggle (email-safe → renders expanded, no collapse chrome)
  BaseTogglePlugin.withComponent(ToggleElementStatic),
  // Columns (email-safe fixed-layout table)
  BaseColumnPlugin.withComponent(ColumnGroupElementStatic),
  BaseColumnItemPlugin.withComponent(ColumnElementStatic),
  // Table of contents (email-safe indented heading-title list)
  BaseTocPlugin.withComponent(TocElementStatic),
  // Tables
  BaseTablePlugin.withComponent(TableElementStatic),
  BaseTableRowPlugin.withComponent(TableRowElementStatic),
  BaseTableCellPlugin.extend(() => ({
    parsers: {
      html: {
        deserializer: {
          attributeNames: ['rowspan', 'colspan'],
          parse: parseTableCell,
          rules: [{ validNodeName: 'TD' }],
        },
      },
    },
  })).withComponent(TableCellElementStatic),
  BaseTableCellHeaderPlugin.extend(() => ({
    parsers: {
      html: {
        deserializer: {
          attributeNames: ['rowspan', 'colspan'],
          parse: parseTableCell,
          rules: [{ validNodeName: 'TH' }],
        },
      },
    },
  })).withComponent(TableCellHeaderElementStatic),
  BaseLinkPlugin.withComponent(LinkElementStatic),
  // Marks
  BaseBoldPlugin,
  BaseItalicPlugin,
  BaseUnderlinePlugin,
  BaseCodePlugin,
  BaseStrikethroughPlugin,
  BaseHighlightPlugin,
  // Native <sub>/<sup>; <kbd> carries inline key-cap styling for email.
  BaseSubscriptPlugin,
  BaseSuperscriptPlugin,
  BaseKbdPlugin.withComponent(KbdLeafStatic),
  BaseFontColorPlugin,
  BaseFontBackgroundColorPlugin,
  BaseFontSizePlugin,
  BaseFontFamilyPlugin,
  // Collaboration marks (comments / suggestions) are editor-local only,
  // these pass-through leaves render bare text so the marks vanish from
  // serialized email HTML (no wrapper tags, classes or data-* attributes).
  BaseCommentPlugin.withComponent(CommentLeafStatic),
  BaseSuggestionPlugin.withComponent(SuggestionLeafStatic),
  // Block style, mirror the interactive kit's inject config so unordered
  // items serialize with display:list-item and todo items go through the
  // email-safe glyph wrapper.
  BaseListPlugin.configure({
    inject: {
      nodeProps: {
        nodeKey: KEYS.listType,
        query: ({ nodeProps }) => {
          const element = nodeProps.element as
            | { listStyleType?: string; checked?: boolean }
            | undefined;
          return (
            !!element?.listStyleType &&
            ['disc', 'circle', 'square'].includes(element.listStyleType)
          );
        },
        transformProps: ({ props }) => ({
          ...props,
          style: {
            ...(props.style as React.CSSProperties),
            display: 'list-item',
          },
        }),
      },
      targetPlugins: [...KEYS.heading, KEYS.p, KEYS.blockquote],
    },
    render: { belowNodes: BlockListStatic },
  }),
  BaseTextAlignPlugin.configure({
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
  // Line height, configure the inject so the inline style survives static
  // (email) serialization, mirroring the interactive kit.
  BaseLineHeightPlugin.configure({
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
  BaseIndentPlugin,
  // Custom PressedMail nodes, static components re-emit the data-pm-*
  // contract so value→HTML serialization keeps signatures/quotes/attachments
  // round-trippable (serializeHtml renders via node.component, not the legacy
  // parsers.html.serializer path).
  SignatureBlockPlugin.withComponent(SignatureElementStatic),
  QuoteBlockPlugin.withComponent(QuoteElementStatic),
  AttachmentCardPlugin.withComponent(AttachmentCardElementStatic),
  AISuggestionPlugin.withComponent(AISuggestionElementStatic),
  // Promote every <br>/\n soft break to its own block (mirrors the
  // interactive kit's SplitSoftBreaksPlugin) so static deserialize +
  // email serialization treat each line as an independent block.
  SplitSoftBreaksPlugin,
];
