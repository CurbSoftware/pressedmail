'use client';

import * as React from 'react';
import {
  Pilcrow,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Minus,
  Code2,
  Lightbulb,
  CalendarDays,
  ChevronRight,
  Columns2,
  ListTree,
  Video,
  Music,
  Paperclip,
  Table,
} from 'lucide-react';
import { toggleList, ListStyleType } from '@kit/plate/list';
import { TablePlugin } from '@kit/plate/table/react';
import { KEYS, PathApi, type TComboboxInputElement } from '@kit/plate';
import type { PlateEditor, PlateElementProps } from '@kit/plate/react';
import { PlateElement } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';

import {
  InlineCombobox,
  InlineComboboxContent,
  InlineComboboxEmpty,
  InlineComboboxGroup,
  InlineComboboxGroupLabel,
  InlineComboboxInput,
  InlineComboboxItem,
} from './ui/inline-combobox';

type SlashItem = {
  icon: React.ReactNode;
  label: string;
  value: string;
  keywords?: string[];
  onSelect: (editor: PlateEditor) => void;
};

type SlashGroup = { group: string; items: SlashItem[] };

const turnInto = (editor: PlateEditor, type: string) => {
  editor.tf.toggleBlock(type);
  editor.tf.focus();
};

/**
 * Insert a container/structured block (callout, columns, toggle, toc, media…)
 * as a sibling after the current block, replacing the current block when it is
 * empty (the common slash-trigger case). Dependency-free, no SuggestionPlugin.
 */
const insertBlockNode = (editor: PlateEditor, node: object) => {
  editor.tf.withoutNormalizing(() => {
    const block = editor.api.block();
    if (!block) {
      editor.tf.insertNodes(node as never, { select: true });
      return;
    }
    const [current, path] = block;
    const isEmpty = editor.api.isEmpty(current);
    editor.tf.insertNodes(node as never, {
      at: PathApi.next(path),
      select: true,
    });
    if (isEmpty) {
      editor.tf.removeNodes({ at: path });
    }
  });
  editor.tf.focus();
};

const groups: SlashGroup[] = [
  {
    group: __('Basic blocks', 'pressedmail'),
    items: [
      {
        icon: <Pilcrow />,
        label: __('Text', 'pressedmail'),
        value: KEYS.p,
        keywords: ['paragraph'],
        onSelect: (editor) => turnInto(editor, KEYS.p),
      },
      {
        icon: <Heading1 />,
        label: __('Heading 1', 'pressedmail'),
        value: KEYS.h1,
        keywords: ['title', 'h1'],
        onSelect: (editor) => turnInto(editor, KEYS.h1),
      },
      {
        icon: <Heading2 />,
        label: __('Heading 2', 'pressedmail'),
        value: KEYS.h2,
        keywords: ['subtitle', 'h2'],
        onSelect: (editor) => turnInto(editor, KEYS.h2),
      },
      {
        icon: <Heading3 />,
        label: __('Heading 3', 'pressedmail'),
        value: KEYS.h3,
        keywords: ['h3'],
        onSelect: (editor) => turnInto(editor, KEYS.h3),
      },
      {
        icon: <List />,
        label: __('Bulleted list', 'pressedmail'),
        value: 'ul',
        keywords: ['unordered', 'ul', '-'],
        onSelect: (editor) => {
          toggleList(editor, { listStyleType: ListStyleType.Disc });
          editor.tf.focus();
        },
      },
      {
        icon: <ListOrdered />,
        label: __('Numbered list', 'pressedmail'),
        value: 'ol',
        keywords: ['ordered', 'ol', '1'],
        onSelect: (editor) => {
          toggleList(editor, { listStyleType: ListStyleType.Decimal });
          editor.tf.focus();
        },
      },
      {
        icon: <Quote />,
        label: __('Blockquote', 'pressedmail'),
        value: KEYS.blockquote,
        keywords: ['quote', 'citation'],
        onSelect: (editor) => turnInto(editor, KEYS.blockquote),
      },
      {
        icon: <Code2 />,
        label: __('Code block', 'pressedmail'),
        value: KEYS.codeBlock,
        keywords: ['code', 'snippet', '```'],
        onSelect: (editor) => {
          editor.tf.toggleBlock(KEYS.codeBlock);
          editor.tf.focus();
        },
      },
      {
        icon: <Lightbulb />,
        label: __('Callout', 'pressedmail'),
        value: KEYS.callout,
        keywords: ['note', 'info', 'highlight', 'warning'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.callout,
            children: [{ type: KEYS.p, children: [{ text: '' }] }],
          }),
      },
      {
        icon: <ChevronRight />,
        label: __('Toggle', 'pressedmail'),
        value: KEYS.toggle,
        keywords: ['collapse', 'expand', 'accordion', 'details'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.toggle,
            children: [{ text: '' }],
          }),
      },
      {
        icon: <Columns2 />,
        label: __('Columns', 'pressedmail'),
        value: 'column_group',
        keywords: ['layout', 'grid', '2 columns', '3 columns'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: 'column_group',
            children: [
              {
                type: 'column',
                width: '50%',
                children: [{ type: KEYS.p, children: [{ text: '' }] }],
              },
              {
                type: 'column',
                width: '50%',
                children: [{ type: KEYS.p, children: [{ text: '' }] }],
              },
            ],
          }),
      },
      {
        icon: <ListTree />,
        label: __('Table of contents', 'pressedmail'),
        value: KEYS.toc,
        keywords: ['toc', 'outline', 'contents'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.toc,
            children: [{ text: '' }],
          }),
      },
    ],
  },
  {
    group: __('Insert', 'pressedmail'),
    items: [
      {
        icon: <Minus />,
        label: __('Divider', 'pressedmail'),
        value: 'hr',
        keywords: ['horizontal rule', 'divider', '---'],
        onSelect: (editor) => {
          editor.tf.insertNodes({
            type: 'hr',
            children: [{ text: '' }],
          } as never);
          editor.tf.focus();
        },
      },
      {
        icon: <CalendarDays />,
        label: __('Date', 'pressedmail'),
        value: KEYS.date,
        keywords: ['time', 'today', 'calendar'],
        onSelect: (editor) => {
          editor.tf.insertNodes({
            type: KEYS.date,
            date: '',
            children: [{ text: '' }],
          } as never);
          editor.tf.focus();
        },
      },
      {
        icon: <Video />,
        label: __('Video', 'pressedmail'),
        value: KEYS.video,
        keywords: ['movie', 'mp4', 'embed'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.video,
            url: '',
            children: [{ text: '' }],
          }),
      },
      {
        icon: <Music />,
        label: __('Audio', 'pressedmail'),
        value: KEYS.audio,
        keywords: ['sound', 'mp3', 'music'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.audio,
            url: '',
            children: [{ text: '' }],
          }),
      },
      {
        icon: <Paperclip />,
        label: __('File', 'pressedmail'),
        value: KEYS.file,
        keywords: ['attachment', 'download', 'document'],
        onSelect: (editor) =>
          insertBlockNode(editor, {
            type: KEYS.file,
            url: '',
            children: [{ text: '' }],
          }),
      },
      {
        icon: <Table />,
        label: __('Table', 'pressedmail'),
        value: KEYS.table,
        keywords: ['grid', 'cells', 'rows', 'columns'],
        onSelect: (editor) => {
          editor
            .getTransforms(TablePlugin)
            .insert.table({ colCount: 3, rowCount: 3 }, { select: true });
          editor.tf.focus();
        },
      },
    ],
  },
];

export function SlashInputElement(
  props: PlateElementProps<TComboboxInputElement>,
) {
  const { editor, element } = props;

  return (
    <PlateElement {...props} as="span">
      <InlineCombobox element={element} trigger="/">
        <InlineComboboxInput />

        <InlineComboboxContent>
          <InlineComboboxEmpty>
            {__('No results', 'pressedmail')}
          </InlineComboboxEmpty>

          {groups.map(({ group, items }) => (
            <InlineComboboxGroup key={group}>
              <InlineComboboxGroupLabel>{group}</InlineComboboxGroupLabel>

              {items.map(({ icon, keywords, label, value, onSelect }) => (
                <InlineComboboxItem
                  key={value}
                  group={group}
                  keywords={keywords}
                  label={label}
                  value={value}
                  onClick={() => onSelect(editor)}
                >
                  <div className="mr-2 text-muted-foreground">{icon}</div>
                  {label}
                </InlineComboboxItem>
              ))}
            </InlineComboboxGroup>
          ))}
        </InlineComboboxContent>
      </InlineCombobox>

      {props.children}
    </PlateElement>
  );
}
