'use client';

/**
 * Comment mark plugin (template comment-kit.tsx port).
 *
 * Extends BaseCommentPlugin with active/hover tracking and a setDraft
 * transform that selects the whole block when collapsed. Editor-local,
 * discussion data lives in discussion-kit.tsx. The static (email) kit
 * registers BaseCommentPlugin with a pass-through leaf so comment marks
 * never reach serialized email HTML.
 */

import {
  type BaseCommentConfig,
  BaseCommentPlugin,
  getDraftCommentKey,
} from '@kit/plate/comment';
import type { ExtendConfig, Path } from '@kit/plate';
import { toTPlatePlugin } from '@kit/plate/react';

import { CommentLeaf } from './comment-node';
import { getDiscussionClickTarget } from './discussion-kit';

type CommentConfig = ExtendConfig<
  BaseCommentConfig,
  {
    activeId: string | null;
    commentingBlock: Path | null;
    hoverId: string | null;
  }
>;

export const commentPlugin = toTPlatePlugin<CommentConfig>(BaseCommentPlugin, {
  handlers: {
    onClick: ({ api, event, setOption, type }) => {
      const activeTarget = getDiscussionClickTarget({
        selector: `.slate-${type}`,
        target: event.target,
      });

      if (!activeTarget) {
        setOption('activeId', null);
        return;
      }

      const commentEntry = api.comment?.node();

      setOption(
        'activeId',
        commentEntry ? (api.comment?.nodeId(commentEntry[0]) ?? null) : null
      );
    },
  },
  options: {
    activeId: null,
    commentingBlock: null,
    hoverId: null,
  },
})
  .extendTransforms(
    ({
      editor,
      setOption,
      tf: {
        comment: { setDraft },
      },
    }) => ({
      setDraft: () => {
        if (editor.api.isCollapsed()) {
          editor.tf.select(editor.api.block()![1]);
        }

        setDraft();

        editor.tf.collapse();
        setOption('activeId', getDraftCommentKey());
        setOption('commentingBlock', editor.selection!.focus.path.slice(0, 1));
      },
    })
  )
  // No keyboard shortcut: comments live only in editor memory and are never
  // saved or sent, so Mod+Shift+M used to open a UI whose content was lost.
  // The plugin stays registered because the AI menu uses its mark transforms.
  .configure({
    node: { component: CommentLeaf },
  });

export const CommentKit = [commentPlugin];
