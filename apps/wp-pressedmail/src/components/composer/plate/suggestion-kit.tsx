'use client';

/**
 * Suggestion (tracked changes) plugin (template suggestion-kit.tsx port).
 *
 * Extends BaseSuggestionPlugin with active/hover tracking, inline-element
 * tagging (data-inline-suggestion) and a TrailingBlockPlugin override that
 * inserts the trailing paragraph outside suggestion mode, so this kit
 * REPLACES the standalone TrailingBlockPlugin entry in the composer kit.
 * The static (email) kit registers BaseSuggestionPlugin with a pass-through
 * leaf so suggestion marks never reach serialized email HTML.
 */

import {
  type BaseSuggestionConfig,
  BaseSuggestionPlugin,
} from '@kit/plate/suggestion';
import type {
  ExtendConfig,
  TElement,
  TInlineSuggestionData,
  TSuggestionData,
  TSuggestionText,
} from '@kit/plate';
import { KEYS, TextApi, TrailingBlockPlugin } from '@kit/plate';
import { toTPlatePlugin } from '@kit/plate/react';

import {
  SuggestionLeaf,
  SuggestionLineBreak,
  VoidRemoveSuggestionOverlay,
} from './suggestion-node';
import {
  discussionPlugin,
  getDiscussionBlockClickTarget,
  getDiscussionClickTarget,
} from './discussion-kit';

export type SuggestionConfig = ExtendConfig<
  BaseSuggestionConfig,
  {
    activeId: string | null;
    hoverId: string | null;
  }
>;

const INLINE_SUGGESTION_TARGET_PLUGINS = [
  KEYS.date,
  KEYS.inlineEquation,
  KEYS.link,
  KEYS.mention,
];

function getInlineSuggestionData(editor: any, element: TElement) {
  const suggestionApi = editor.getApi(BaseSuggestionPlugin).suggestion;
  const data = suggestionApi.suggestionData(element) as
    | TSuggestionData
    | TInlineSuggestionData
    | undefined;

  if (data) return data;
  if (typeof suggestionApi.dataList !== 'function') return;

  for (const child of element.children) {
    if (!TextApi.isText(child)) continue;

    const childData = suggestionApi.dataList(child as TSuggestionText).at(-1);

    if (childData) return childData;
  }
}

export const suggestionPlugin = toTPlatePlugin<SuggestionConfig>(
  BaseSuggestionPlugin,
  ({ editor }) => ({
    options: {
      activeId: null,
      currentUserId: editor.getOption(discussionPlugin, 'currentUserId'),
      hoverId: null,
    },
  })
).configure({
  handlers: {
    // unset active suggestion when clicking outside of suggestion
    onClick: ({ api, event, setOption, type }) => {
      const markTarget = getDiscussionClickTarget({
        selector: `.slate-${type}`,
        target: event.target,
      });
      const blockTarget = markTarget
        ? null
        : getDiscussionBlockClickTarget({
            target: event.target,
          });

      if (!markTarget && !blockTarget) {
        setOption('activeId', null);
        return;
      }

      const suggestionEntry = api.suggestion?.node({
        isText: !blockTarget,
      });

      setOption(
        'activeId',
        suggestionEntry
          ? (api.suggestion?.nodeId(suggestionEntry[0]) ?? null)
          : null
      );
    },
  },
  inject: {
    isElement: true,
    nodeProps: {
      nodeKey: '',
      styleKey: 'cssText',
      transformProps: ({ editor, element, props }) => {
        if (!element) return props;

        const suggestionData = getInlineSuggestionData(editor, element);

        if (!suggestionData) return props;

        return {
          ...props,
          'data-inline-suggestion': suggestionData.type,
        };
      },
      transformStyle: () => ({}) as CSSStyleDeclaration,
    },
    targetPlugins: INLINE_SUGGESTION_TARGET_PLUGINS,
  },
  render: {
    belowNodes: SuggestionLineBreak as any,
    belowRootNodes: VoidRemoveSuggestionOverlay as any,
    node: SuggestionLeaf,
  },
});

const trailingBlockPlugin = TrailingBlockPlugin.configure({
  options: {
    insert: (editor, { insert }) => {
      editor.getApi(suggestionPlugin).suggestion.withoutSuggestions(insert);
    },
  },
});

export const SuggestionKit = [suggestionPlugin, trailingBlockPlugin];
