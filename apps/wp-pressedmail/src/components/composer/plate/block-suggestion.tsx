'use client';

/**
 * Suggestion card inside the block-discussion popover (template
 * block-suggestion.tsx port). Adaptations: @kit/ui/plugin primitives,
 * initials-only avatars, `brand` token → `primary`, action labels wrapped
 * in __() (the block-type names from block-discussion-index stay
 * untranslated, they double as match keys in getRemoveSummaryItems).
 */

import { acceptSuggestion, rejectSuggestion } from '@kit/plate/suggestion';
import { SuggestionPlugin } from '@kit/plate/suggestion/react';
import { CheckIcon, XIcon } from 'lucide-react';
import { useEditorPlugin, usePluginOption } from '@kit/plate/react';
import * as React from 'react';
import { __, sprintf } from '@wordpress/i18n';

import { Avatar, AvatarFallback, Button } from '@kit/ui/plugin';

import { discussionPlugin, type TDiscussion } from './discussion-kit';
import {
  BLOCK_SUGGESTION_TOKEN,
  type ResolvedSuggestion,
} from './lib/block-discussion-index';
import {
  Comment,
  CommentCreateForm,
  formatCommentDate,
  getUserInitials,
} from './comment';


/** Mark keys are code names; the common ones get a translated label. */
function formattingName(key: string): string {
  const names: Record<string, string> = {
    bold: __('Bold', 'pressedmail'),
    italic: __('Italic', 'pressedmail'),
    underline: __('Underline', 'pressedmail'),
    strikethrough: __('Strikethrough', 'pressedmail'),
    code: __('Code', 'pressedmail'),
    subscript: __('Subscript', 'pressedmail'),
    superscript: __('Superscript', 'pressedmail'),
    color: __('Text color', 'pressedmail'),
    backgroundColor: __('Highlight', 'pressedmail'),
    fontSize: __('Font size', 'pressedmail'),
    fontFamily: __('Font', 'pressedmail'),
  };
  return names[key] ?? key;
}

export function BlockSuggestionCard({
  idx,
  isLast,
  suggestion,
}: {
  idx: number;
  isLast: boolean;
  suggestion: ResolvedSuggestion;
}) {
  const { api, editor } = useEditorPlugin(SuggestionPlugin);

  const userInfo = usePluginOption(discussionPlugin, 'user', suggestion.userId);

  const accept = (suggestion: ResolvedSuggestion) => {
    api.suggestion.withoutSuggestions(() => {
      acceptSuggestion(editor, suggestion);
    });
  };

  const reject = (suggestion: ResolvedSuggestion) => {
    api.suggestion.withoutSuggestions(() => {
      rejectSuggestion(editor, suggestion);
    });
  };

  const [hovering, setHovering] = React.useState(false);

  const suggestionText2Array = (text: string) => {
    if (text === BLOCK_SUGGESTION_TOKEN)
      return [__('line breaks', 'pressedmail')];

    return text.split(BLOCK_SUGGESTION_TOKEN).filter(Boolean);
  };

  const getRemoveSummaryItems = (text: string) => {
    const items = suggestionText2Array(text).map((item) => {
      if (item === 'column_group') return 'Column';
      if (item === 'code_block') return 'Code Block';

      return item;
    });

    if (items.includes('Table')) return ['Table'];
    if (items.includes('Code Block')) return ['Code Block'];
    if (items.includes('Column')) return ['Column'];

    return items;
  };

  const [editingId, setEditingId] = React.useState<string | null>(null);

  return (
    <div
      className="relative"
      key={`${suggestion.suggestionId}-${idx}`}
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div className="flex flex-col p-4">
        <div className="relative flex items-center">
          <Avatar className="size-5">
            <AvatarFallback className="text-[10px]">
              {getUserInitials(userInfo?.name)}
            </AvatarFallback>
          </Avatar>
          <h4 className="mx-2 font-semibold text-sm leading-none">
            {userInfo?.name}
          </h4>
          <div className="text-muted-foreground/80 text-xs leading-none">
            <span className="mr-1">
              {formatCommentDate(new Date(suggestion.createdAt))}
            </span>
          </div>
        </div>

        <div className="relative mt-1 mb-4 pl-[32px]">
          <div className="flex flex-col gap-2">
            {suggestion.type === 'remove' &&
              getRemoveSummaryItems(suggestion.text!).map((text, index) => (
                <div className="flex items-center gap-2" key={index}>
                  <span className="text-muted-foreground text-sm">
                    {__('Delete:', 'pressedmail')}
                  </span>

                  <span className="text-sm" key={index}>
                    {text}
                  </span>
                </div>
              ))}

            {suggestion.type === 'insert' &&
              suggestionText2Array(suggestion.newText!).map((text, index) => (
                <div className="flex items-center gap-2" key={index}>
                  <span className="text-muted-foreground text-sm">
                    {__('Add:', 'pressedmail')}
                  </span>

                  <span className="text-sm" key={index}>
                    {text || __('line breaks', 'pressedmail')}
                  </span>
                </div>
              ))}

            {suggestion.type === 'replace' && (
              <div className="flex flex-col gap-2">
                {suggestionText2Array(suggestion.newText!).map(
                  (text, index) => (
                    <React.Fragment key={index}>
                      <div
                        className="flex items-start gap-2 text-primary/80"
                        key={index}
                      >
                        <span className="text-sm">
                          {__('with:', 'pressedmail')}
                        </span>
                        <span className="text-sm">
                          {text || __('line breaks', 'pressedmail')}
                        </span>
                      </div>
                    </React.Fragment>
                  )
                )}

                {suggestionText2Array(suggestion.text!).map((text, index) => (
                  <React.Fragment key={index}>
                    <div className="flex items-start gap-2" key={index}>
                      <span className="text-muted-foreground text-sm">
                        {index === 0
                          ? __('Replace:', 'pressedmail')
                          : __('Delete:', 'pressedmail')}
                      </span>
                      <span className="text-sm">
                        {text || __('line breaks', 'pressedmail')}
                      </span>
                    </div>
                  </React.Fragment>
                ))}
              </div>
            )}

            {suggestion.type === 'update' && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-sm">
                  {Object.keys(suggestion.properties).map((key) => (
                    <span key={key}>
                      {sprintf(
                        /* translators: %s: a formatting name, such as Bold. */
                        __('Remove %s', 'pressedmail'),
                        formattingName(key),
                      )}
                    </span>
                  ))}

                  {Object.keys(suggestion.newProperties).map((key) => (
                    <span key={key}>{formattingName(key)}</span>
                  ))}
                </span>
                <span className="text-sm">{suggestion.newText}</span>
              </div>
            )}
          </div>
        </div>

        {suggestion.comments.map((comment, index) => (
          <Comment
            comment={comment}
            discussionLength={suggestion.comments.length}
            documentContent="__suggestion__"
            editingId={editingId}
            index={index}
            key={comment.id ?? index}
            setEditingId={setEditingId}
          />
        ))}

        {hovering && (
          <div className="absolute top-4 right-4 flex gap-2">
            <Button
              aria-label={__('Accept suggestion', 'pressedmail')}
              className="size-6 p-1 text-muted-foreground"
              onClick={() => accept(suggestion)}
              variant="ghost"
            >
              <CheckIcon className="size-4" />
            </Button>

            <Button
              aria-label={__('Reject suggestion', 'pressedmail')}
              className="size-6 p-1 text-muted-foreground"
              onClick={() => reject(suggestion)}
              variant="ghost"
            >
              <XIcon className="size-4" />
            </Button>
          </div>
        )}

        <CommentCreateForm discussionId={suggestion.suggestionId} />
      </div>

      {!isLast && <div className="h-px w-full bg-muted" />}
    </div>
  );
}

export const isResolvedSuggestion = (
  suggestion: ResolvedSuggestion | TDiscussion
): suggestion is ResolvedSuggestion => 'suggestionId' in suggestion;
