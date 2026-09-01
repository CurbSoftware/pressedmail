'use client';

/**
 * Comment mark leaf (template comment-node.tsx port).
 *
 * The template tints comments with its `highlight` theme token, which this
 * app does not define. PressedMail uses the `primary` token instead so the
 * mark follows the active theme.
 */

import { getCommentCount } from '@kit/plate/comment';

import type { TCommentText } from '@kit/plate';
import type { PlateLeafProps } from '@kit/plate/react';
import { PlateLeaf, useEditorPlugin, usePluginOption } from '@kit/plate/react';

import { cn } from '@/lib/utils';
import { commentPlugin } from './comment-kit';

export function CommentLeaf(props: PlateLeafProps<TCommentText>) {
  const { children, leaf } = props;

  const { api, setOption } = useEditorPlugin(commentPlugin);
  const hoverId = usePluginOption(commentPlugin, 'hoverId');
  const activeId = usePluginOption(commentPlugin, 'activeId');

  const isOverlapping = getCommentCount(leaf) > 1;
  const currentId = api.comment.nodeId(leaf);
  const isActive = activeId === currentId;
  const isHover = hoverId === currentId;

  return (
    <PlateLeaf
      {...props}
      attributes={{
        ...props.attributes,
        onClick: () => setOption('activeId', currentId ?? null),
        onMouseEnter: () => setOption('hoverId', currentId ?? null),
        onMouseLeave: () => setOption('hoverId', null),
      }}
      className={cn(
        'border-b-2 border-b-primary/[.36] bg-primary/[.13] transition-colors duration-200',
        (isHover || isActive) && 'border-b-primary bg-primary/25',
        isOverlapping && 'border-b-2 border-b-primary/[.7] bg-primary/25',
        (isHover || isActive) &&
          isOverlapping &&
          'border-b-primary bg-primary/45'
      )}
    >
      {children}
    </PlateLeaf>
  );
}
