'use client';

/**
 * Discussion comment item + create form (template comment.tsx port).
 *
 * Adaptations:
 * - The template's shared Editor/EditorContainer (variant="comment") is
 *   replaced with an inline mini Plate sub-editor (CommentEditor below)
 *   running a minimal bold/italic/underline plugin list, the full app kit
 *   is not needed for composing a comment. The template's
 *   `has-[[data-slate-editor]:focus]` container variant becomes a plain
 *   `focus-within:` ring (this build does not emit has-[...] variants, see
 *   toolbar.tsx).
 * - Avatars render initials via AvatarFallback only, no avatar URLs.
 * - brand/highlight/subtle-foreground tokens → primary/muted-foreground.
 */

import { getCommentKey, getDraftCommentKey } from '@kit/plate/comment';
import { CommentPlugin, useCommentId } from '@kit/plate/comment/react';
import {
  BoldPlugin,
  ItalicPlugin,
  UnderlinePlugin,
} from '@kit/plate/basic-nodes/react';
import {
  differenceInDays,
  differenceInHours,
  differenceInMinutes,
  format,
} from 'date-fns';
import {
  ArrowUpIcon,
  CheckIcon,
  MoreHorizontalIcon,
  PencilIcon,
  TrashIcon,
  XIcon,
} from 'lucide-react';
import {
  KEYS,
  NodeApi,
  type NodeEntry,
  nanoid,
  type TCommentText,
  type Value,
} from '@kit/plate';
import type { CreatePlateEditorOptions, PlateContentProps } from '@kit/plate/react';
import {
  Plate,
  PlateContent,
  useEditorPlugin,
  useEditorRef,
  usePlateEditor,
  usePluginOption,
} from '@kit/plate/react';
import * as React from 'react';
import { __ } from '@wordpress/i18n';

import {
  Avatar,
  AvatarFallback,
  Button,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';
import { cn } from '@/lib/utils';

import { discussionPlugin, type TDiscussion } from './discussion-kit';

export type TComment = {
  id: string;
  contentRich: Value;
  createdAt: Date;
  discussionId: string;
  isEdited: boolean;
  userId: string;
};

/** Initials for AvatarFallback (first letters of up to two name parts). */
export const getUserInitials = (name?: string) =>
  (name ?? '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join('') || '?';

/**
 * Mini comment sub-editor: minimal mark plugins only (template uses
 * BasicMarksKit; bold/italic/underline keep keyboard shortcuts working
 * without pulling in the full composer kit).
 */
const useCommentEditor = (
  options: Omit<CreatePlateEditorOptions, 'plugins'> = {},
  deps: any[] = []
) => {
  const commentEditor = usePlateEditor(
    {
      id: 'comment',
      plugins: [BoldPlugin, ItalicPlugin, UnderlinePlugin],
      value: [],
      ...options,
    },
    deps
  );

  return commentEditor;
};

/** Template EditorContainer variant="comment" equivalent. */
function CommentEditorContainer({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'relative flex w-full cursor-text select-text flex-wrap justify-between gap-1 rounded-md border-[1.5px] border-transparent bg-transparent px-1 py-0.5 text-sm caret-primary',
        'focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/30',
        className
      )}
    >
      {children}
    </div>
  );
}

/** Template Editor variant="comment" equivalent (PlateContent). */
function CommentEditorContent({ className, ...props }: PlateContentProps) {
  return (
    <PlateContent
      {...props}
      className={cn(
        'relative w-full cursor-text select-text overflow-x-hidden whitespace-pre-wrap break-words rounded-none border-none bg-transparent text-sm focus-visible:outline-none [&_strong]:font-bold',
        className
      )}
      disableDefaultStyles
    />
  );
}

export function Comment(props: {
  comment: TComment;
  discussionLength: number;
  editingId: string | null;
  index: number;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  documentContent?: string;
  showDocumentContent?: boolean;
  onEditorClick?: () => void;
}) {
  const {
    comment,
    discussionLength,
    documentContent,
    editingId,
    index,
    setEditingId,
    showDocumentContent = false,
    onEditorClick,
  } = props;

  const editor = useEditorRef();
  const userInfo = usePluginOption(discussionPlugin, 'user', comment.userId);
  const currentUserId = usePluginOption(discussionPlugin, 'currentUserId');

  const resolveDiscussion = async (id: string) => {
    const updatedDiscussions = editor
      .getOption(discussionPlugin, 'discussions')
      .map((discussion) => {
        if (discussion.id === id) {
          return { ...discussion, isResolved: true };
        }
        return discussion;
      });
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  const removeDiscussion = async (id: string) => {
    const updatedDiscussions = editor
      .getOption(discussionPlugin, 'discussions')
      .filter((discussion) => discussion.id !== id);
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  const updateComment = async (input: {
    id: string;
    contentRich: Value;
    discussionId: string;
    isEdited: boolean;
  }) => {
    const updatedDiscussions = editor
      .getOption(discussionPlugin, 'discussions')
      .map((discussion) => {
        if (discussion.id === input.discussionId) {
          const updatedComments = discussion.comments.map((comment) => {
            if (comment.id === input.id) {
              return {
                ...comment,
                contentRich: input.contentRich,
                isEdited: true,
                updatedAt: new Date(),
              };
            }
            return comment;
          });
          return { ...discussion, comments: updatedComments };
        }
        return discussion;
      });
    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
  };

  const { tf } = useEditorPlugin(CommentPlugin);

  const isMyComment = currentUserId === comment.userId;

  const initialValue = comment.contentRich;

  const commentEditor = useCommentEditor(
    {
      id: comment.id,
      value: initialValue,
    },
    [initialValue]
  );

  const onCancel = () => {
    setEditingId(null);
    commentEditor.tf.replaceNodes(initialValue, {
      at: [],
      children: true,
    });
  };

  const onSave = () => {
    void updateComment({
      id: comment.id,
      contentRich: commentEditor.children,
      discussionId: comment.discussionId,
      isEdited: true,
    });
    setEditingId(null);
  };

  const onResolveComment = () => {
    void resolveDiscussion(comment.discussionId);
    tf.comment.unsetMark({ id: comment.discussionId });
  };

  const isFirst = index === 0;
  const isLast = index === discussionLength - 1;
  const isEditing = editingId && editingId === comment.id;

  const [hovering, setHovering] = React.useState(false);
  const [dropdownOpen, setDropdownOpen] = React.useState(false);

  return (
    <div
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
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
            {formatCommentDate(new Date(comment.createdAt))}
          </span>
          {comment.isEdited && <span>{__('(edited)', 'pressedmail')}</span>}
        </div>

        {isMyComment && (hovering || dropdownOpen) && (
          <div className="absolute top-0 right-0 flex space-x-1">
            {index === 0 && (
              <Button
                aria-label={__('Resolve comment', 'pressedmail')}
                className="h-6 p-1 text-muted-foreground"
                onClick={onResolveComment}
                type="button"
                variant="ghost"
              >
                <CheckIcon className="size-4" />
              </Button>
            )}

            <CommentMoreDropdown
              comment={comment}
              dropdownOpen={dropdownOpen}
              onCloseAutoFocus={() => {
                setTimeout(() => {
                  commentEditor.tf.focus({ edge: 'endEditor' });
                }, 0);
              }}
              onRemoveComment={() => {
                if (discussionLength === 1) {
                  tf.comment.unsetMark({ id: comment.discussionId });
                  void removeDiscussion(comment.discussionId);
                }
              }}
              setDropdownOpen={setDropdownOpen}
              setEditingId={setEditingId}
            />
          </div>
        )}
      </div>

      {isFirst && showDocumentContent && (
        <div className="relative mt-1 flex pl-[32px] text-sm text-muted-foreground">
          {discussionLength > 1 && (
            <div className="absolute top-[5px] left-3 h-full w-0.5 shrink-0 bg-muted" />
          )}
          <div className="my-px w-0.5 shrink-0 bg-primary" />
          {documentContent && <div className="ml-2">{documentContent}</div>}
        </div>
      )}

      <div className="relative my-1 pl-[26px]">
        {!isLast && (
          <div className="absolute top-0 left-3 h-full w-0.5 shrink-0 bg-muted" />
        )}
        <Plate editor={commentEditor} readOnly={!isEditing}>
          <CommentEditorContainer>
            <CommentEditorContent
              className="w-auto grow"
              onClick={() => onEditorClick?.()}
            />

            {isEditing && (
              <div className="ml-auto flex shrink-0 gap-1">
                <Button
                  aria-label={__('Cancel editing', 'pressedmail')}
                  className="size-[28px]"
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    void onCancel();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-[50%] bg-primary/40">
                    <XIcon className="size-3 stroke-[3px] text-background" />
                  </div>
                </Button>

                <Button
                  aria-label={__('Save comment', 'pressedmail')}
                  onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
                    e.stopPropagation();
                    void onSave();
                  }}
                  size="icon"
                  variant="ghost"
                >
                  <div className="flex size-5 shrink-0 items-center justify-center rounded-[50%] bg-primary">
                    <CheckIcon className="size-3 stroke-[3px] text-background" />
                  </div>
                </Button>
              </div>
            )}
          </CommentEditorContainer>
        </Plate>
      </div>
    </div>
  );
}

function CommentMoreDropdown(props: {
  comment: TComment;
  dropdownOpen: boolean;
  setDropdownOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setEditingId: React.Dispatch<React.SetStateAction<string | null>>;
  onCloseAutoFocus?: () => void;
  onRemoveComment?: () => void;
}) {
  const {
    comment,
    dropdownOpen,
    setDropdownOpen,
    setEditingId,
    onCloseAutoFocus,
    onRemoveComment,
  } = props;

  const editor = useEditorRef();

  const selectedEditCommentRef = React.useRef<boolean>(false);

  const onDeleteComment = React.useCallback(() => {
    if (!comment.id)
      return alert(
        __('You are operating too quickly, please try again later.', 'pressedmail')
      );

    // Find and update the discussion
    const updatedDiscussions = editor
      .getOption(discussionPlugin, 'discussions')
      .map((discussion) => {
        if (discussion.id !== comment.discussionId) {
          return discussion;
        }

        const commentIndex = discussion.comments.findIndex(
          (c) => c.id === comment.id
        );
        if (commentIndex === -1) {
          return discussion;
        }

        return {
          ...discussion,
          comments: [
            ...discussion.comments.slice(0, commentIndex),
            ...discussion.comments.slice(commentIndex + 1),
          ],
        };
      });

    editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);
    onRemoveComment?.();
  }, [comment.discussionId, comment.id, editor, onRemoveComment]);

  const onEditComment = React.useCallback(() => {
    selectedEditCommentRef.current = true;

    if (!comment.id)
      return alert(
        __('You are operating too quickly, please try again later.', 'pressedmail')
      );

    setEditingId(comment.id);
  }, [comment.id, setEditingId]);

  return (
    <DropdownMenu
      modal={false}
      onOpenChange={setDropdownOpen}
      open={dropdownOpen}
    >
      <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
        <Button
          aria-label={__('Comment actions', 'pressedmail')}
          className={cn('h-6 p-1 text-muted-foreground')}
          variant="ghost"
        >
          <MoreHorizontalIcon className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        className="w-48"
        onCloseAutoFocus={(e) => {
          if (selectedEditCommentRef.current) {
            onCloseAutoFocus?.();
            selectedEditCommentRef.current = false;
          }

          return e.preventDefault();
        }}
      >
        <DropdownMenuGroup>
          <DropdownMenuItem onClick={onEditComment}>
            <PencilIcon className="size-4" />
            {__('Edit comment', 'pressedmail')}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onDeleteComment}>
            <TrashIcon className="size-4" />
            {__('Delete comment', 'pressedmail')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function CommentCreateForm({
  autoFocus = false,
  className,
  discussionId: discussionIdProp,
  focusOnMount = false,
}: {
  autoFocus?: boolean;
  className?: string;
  discussionId?: string;
  focusOnMount?: boolean;
}) {
  const discussions = usePluginOption(discussionPlugin, 'discussions');

  const editor = useEditorRef();
  const commentId = useCommentId();
  const discussionId = discussionIdProp ?? commentId;

  const userInfo = usePluginOption(discussionPlugin, 'currentUser');
  const [commentValue, setCommentValue] = React.useState<Value | undefined>();
  const commentContent = React.useMemo(
    () =>
      commentValue
        ? NodeApi.string({ children: commentValue, type: KEYS.p })
        : '',
    [commentValue]
  );
  const commentEditor = useCommentEditor();

  React.useEffect(() => {
    if (commentEditor && focusOnMount) {
      commentEditor.tf.focus();
    }
  }, [commentEditor, focusOnMount]);

  const onAddComment = React.useCallback(async () => {
    if (!commentValue) return;

    commentEditor.tf.reset();

    if (discussionId) {
      // Get existing discussion
      const discussion = discussions.find((d) => d.id === discussionId);
      if (!discussion) {
        // Create suggestion-backed discussion (editor-local, in-memory)
        const newDiscussion: TDiscussion = {
          id: discussionId,
          comments: [
            {
              id: nanoid(),
              contentRich: commentValue,
              createdAt: new Date(),
              discussionId,
              isEdited: false,
              userId: editor.getOption(discussionPlugin, 'currentUserId'),
            },
          ],
          createdAt: new Date(),
          isResolved: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        };

        editor.setOption(discussionPlugin, 'discussions', [
          ...discussions,
          newDiscussion,
        ]);
        return;
      }

      // Create reply comment
      const comment: TComment = {
        id: nanoid(),
        contentRich: commentValue,
        createdAt: new Date(),
        discussionId,
        isEdited: false,
        userId: editor.getOption(discussionPlugin, 'currentUserId'),
      };

      // Add reply to discussion comments
      const updatedDiscussion = {
        ...discussion,
        comments: [...discussion.comments, comment],
      };

      // Filter out old discussion and add updated one
      const updatedDiscussions = discussions
        .filter((d) => d.id !== discussionId)
        .concat(updatedDiscussion);

      editor.setOption(discussionPlugin, 'discussions', updatedDiscussions);

      return;
    }

    const commentsNodeEntry = editor
      .getApi(CommentPlugin)
      .comment.nodes({ at: [], isDraft: true });

    if (commentsNodeEntry.length === 0) return;

    const documentContent = commentsNodeEntry
      .map(([node, _path]: NodeEntry<TCommentText>) => node.text)
      .join('');

    const _discussionId = nanoid();
    // Create new discussion (editor-local, in-memory)
    const newDiscussion: TDiscussion = {
      id: _discussionId,
      comments: [
        {
          id: nanoid(),
          contentRich: commentValue,
          createdAt: new Date(),
          discussionId: _discussionId,
          isEdited: false,
          userId: editor.getOption(discussionPlugin, 'currentUserId'),
        },
      ],
      createdAt: new Date(),
      documentContent,
      isResolved: false,
      userId: editor.getOption(discussionPlugin, 'currentUserId'),
    };

    editor.setOption(discussionPlugin, 'discussions', [
      ...discussions,
      newDiscussion,
    ]);

    const id = newDiscussion.id;

    commentsNodeEntry.forEach(([, path]: NodeEntry<TCommentText>) => {
      editor.tf.setNodes(
        {
          [getCommentKey(id)]: true,
        },
        { at: path, split: true }
      );
      editor.tf.unsetNodes([getDraftCommentKey()], { at: path });
    });
  }, [commentValue, commentEditor.tf, discussionId, editor, discussions]);

  return (
    <div className={cn('flex w-full', className)}>
      <div className="mt-2 mr-1 shrink-0">
        <Avatar className="size-5">
          <AvatarFallback className="text-[10px]">
            {getUserInitials(userInfo?.name)}
          </AvatarFallback>
        </Avatar>
      </div>

      <div className="relative flex grow gap-2">
        <Plate
          editor={commentEditor}
          onChange={({ value }) => {
            setCommentValue(value);
          }}
        >
          <CommentEditorContainer>
            <CommentEditorContent
              autoComplete="off"
              autoFocus={autoFocus}
              className="min-h-[25px] grow pt-0.5 pr-8"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  onAddComment();
                }
              }}
              placeholder={__('Reply...', 'pressedmail')}
            />

            <Button
              className="absolute right-0.5 bottom-0.5 ml-auto size-6 shrink-0"
              disabled={commentContent.trim().length === 0}
              onClick={(e) => {
                e.stopPropagation();
                onAddComment();
              }}
              size="icon"
              variant="ghost"
            >
              <div className="flex size-6 items-center justify-center rounded-full">
                <ArrowUpIcon />
              </div>
            </Button>
          </CommentEditorContainer>
        </Plate>
      </div>
    </div>
  );
}

export const formatCommentDate = (date: Date) => {
  const now = new Date();
  const diffMinutes = differenceInMinutes(now, date);
  const diffHours = differenceInHours(now, date);
  const diffDays = differenceInDays(now, date);

  if (diffMinutes < 60) {
    return `${diffMinutes}m`;
  }
  if (diffHours < 24) {
    return `${diffHours}h`;
  }
  if (diffDays < 2) {
    return `${diffDays}d`;
  }

  return format(date, 'MM/dd/yyyy');
};
