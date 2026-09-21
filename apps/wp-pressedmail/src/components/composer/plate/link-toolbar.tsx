'use client';

/**
 * Floating link insert/edit UI (template link-toolbar.tsx port). Rendered
 * via LinkPlugin render.afterEditable in plate-composer-react-kit.tsx.
 */

import * as React from 'react';
import {
  flip,
  offset,
  type UseVirtualFloatingOptions,
} from '@kit/plate/floating';
import { getLinkAttributes } from '@kit/plate/link';
import {
  FloatingLinkUrlInput,
  type LinkFloatingToolbarState,
  useFloatingLinkEdit,
  useFloatingLinkEditState,
  useFloatingLinkInsert,
  useFloatingLinkInsertState,
} from '@kit/plate/link/react';
import { cva } from 'class-variance-authority';
import { ExternalLink, Link, Text, Unlink } from 'lucide-react';
import type { TLinkElement } from '@kit/plate';
import { KEYS } from '@kit/plate';
import {
  useEditorRef,
  useEditorSelection,
  useFormInputProps,
  usePluginOption,
} from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import { Separator, buttonVariants } from '@kit/ui/plugin';

const popoverVariants = cva(
  'z-50 w-auto rounded-md border border-border bg-popover p-1 text-popover-foreground shadow-md outline-none',
);

const inputVariants = cva(
  'flex h-[28px] w-full rounded-md border-none bg-transparent px-1.5 py-1 text-base placeholder:text-muted-foreground md:text-sm',
);

export function LinkFloatingToolbar({
  state,
}: {
  state?: LinkFloatingToolbarState;
}) {
  const activeCommentId = usePluginOption({ key: KEYS.comment }, 'activeId');
  const activeSuggestionId = usePluginOption(
    { key: KEYS.suggestion },
    'activeId',
  );

  const floatingOptions: UseVirtualFloatingOptions = React.useMemo(
    () => ({
      middleware: [
        offset(8),
        flip({
          fallbackPlacements: ['bottom-end', 'top-start', 'top-end'],
          padding: 12,
        }),
      ],
      placement:
        activeSuggestionId || activeCommentId ? 'top-start' : 'bottom-start',
    }),
    [activeCommentId, activeSuggestionId],
  );

  const insertState = useFloatingLinkInsertState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    hidden,
    props: insertProps,
    ref: insertRef,
    textInputProps,
  } = useFloatingLinkInsert(insertState);

  const editState = useFloatingLinkEditState({
    ...state,
    floatingOptions: {
      ...floatingOptions,
      ...state?.floatingOptions,
    },
  });
  const {
    editButtonProps,
    props: editProps,
    ref: editRef,
    unlinkButtonProps,
  } = useFloatingLinkEdit(editState);
  const inputProps = useFormInputProps({
    preventDefaultOnEnterKeydown: true,
  });

  if (hidden) return null;

  const input = (
    <div className="flex w-[330px] flex-col" {...inputProps}>
      <div className="flex items-center">
        <div className="flex items-center pl-2 pr-1 text-muted-foreground">
          <Link className="size-4" />
        </div>

        <FloatingLinkUrlInput
          className={inputVariants()}
          data-plate-focus
          placeholder={__('Paste link', 'pressedmail')}
        />
      </div>
      <Separator className="my-1" />
      <div className="flex items-center">
        <div className="flex items-center pl-2 pr-1 text-muted-foreground">
          <Text className="size-4" />
        </div>
        <input autoComplete="off"
          className={inputVariants()}
          data-plate-focus
          placeholder={__('Text to display', 'pressedmail')}
          {...textInputProps}
        />
      </div>
    </div>
  );

  const editContent = editState.isEditing ? (
    input
  ) : (
    <div className="box-content flex items-center">
      <button
        className={buttonVariants({ size: 'sm', variant: 'ghost' })}
        type="button"
        {...editButtonProps}
      >
        {__('Edit link', 'pressedmail')}
      </button>

      <Separator orientation="vertical" />

      <LinkOpenButton />

      <Separator orientation="vertical" />

      <button
        className={buttonVariants({ size: 'sm', variant: 'ghost' })}
        type="button"
        aria-label={__('Remove link', 'pressedmail')}
        {...unlinkButtonProps}
      >
        <Unlink width={18} />
      </button>
    </div>
  );

  return (
    <>
      <div className={popoverVariants()} ref={insertRef} {...insertProps}>
        {input}
      </div>

      <div className={popoverVariants()} ref={editRef} {...editProps}>
        {editContent}
      </div>
    </>
  );
}

function LinkOpenButton() {
  const editor = useEditorRef();
  const selection = useEditorSelection();

  const attributes = React.useMemo(
    () => {
      const entry = editor.api.node<TLinkElement>({
        match: { type: editor.getType(KEYS.link) },
      });
      if (!entry) {
        return {};
      }
      const [element] = entry;
      return getLinkAttributes(editor, element);
    },
    [editor, selection],
  );

  return (
    <a
      {...attributes}
      aria-label={__('Open link in a new tab', 'pressedmail')}
      className={buttonVariants({ size: 'sm', variant: 'ghost' })}
      onMouseOver={(e) => {
        e.stopPropagation();
      }}
      target="_blank"
    >
      <ExternalLink width={18} />
    </a>
  );
}
