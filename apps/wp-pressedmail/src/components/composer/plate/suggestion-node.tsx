'use client';

/**
 * Suggestion (tracked changes) leaf + block wrappers (template
 * suggestion-node.tsx port).
 *
 * Colour adaptation: the template's literal diff colours (emerald for
 * insertions, red for deletions) are replaced with PressedMail theme
 * tokens, insertions use `primary`, deletions use `destructive`, so the
 * marks follow the active theme. The void-remove overlay variants lived in
 * the template's suggestion-node-static.tsx (not vendored here, the email
 * kit strips suggestions entirely), so they are inlined below.
 */

import { SuggestionPlugin } from '@kit/plate/suggestion/react';

import { cva } from 'class-variance-authority';
import { CornerDownLeftIcon } from 'lucide-react';
import type {
  AnyPluginConfig,
  TElement,
  TSuggestionData,
  TSuggestionText,
  WithRequiredKey,
} from '@kit/plate';
import { KEYS } from '@kit/plate';
import type {
  PlateEditor,
  PlateLeafProps,
  RenderNodeWrapper,
} from '@kit/plate/react';
import { PlateLeaf, useEditorPlugin, usePluginOption } from '@kit/plate/react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import type { SuggestionConfig } from './suggestion-kit';

const suggestionPlugin = SuggestionPlugin as WithRequiredKey<SuggestionConfig>;

export const suggestionVariants = cva(
  cn('bg-primary/10 text-primary no-underline transition-colors duration-200'),
  {
    defaultVariants: {
      insertActive: false,
      remove: false,
      removeActive: false,
    },
    variants: {
      insertActive: {
        false: '',
        true: 'bg-primary/20',
      },
      remove: {
        false: '',
        true: 'bg-destructive/10 text-destructive',
      },
      removeActive: {
        false: '',
        true: 'bg-destructive/20 no-underline',
      },
    },
  }
);

/**
 * Inlined from the template's suggestion-node-static.tsx (token colours:
 * red-500 → destructive, red-300 → destructive/40, zinc-950 →
 * muted-foreground).
 */
export const voidRemoveSuggestionOverlayVariants = cva(
  'pointer-events-none absolute inset-0 z-20 overflow-hidden rounded-[inherit]',
  {
    defaultVariants: {
      active: false,
    },
    variants: {
      active: {
        false: 'hidden',
        true: 'before:pointer-events-none before:absolute before:top-1/2 before:left-1/2 before:z-20 before:flex before:size-10 before:-translate-x-1/2 before:-translate-y-1/2 before:items-center before:justify-center before:rounded-full before:bg-destructive/90 before:font-semibold before:text-2xl before:text-destructive-foreground before:shadow-lg before:content-["X"] after:pointer-events-none after:absolute after:inset-0 after:z-10 after:rounded-[inherit] after:border after:border-destructive/40 after:bg-muted-foreground/35 after:content-[""]',
      },
    },
  }
);

export function getBlockSuggestionWrapperClassName({
  elementType,
  isActive,
  isHover,
  isInsert,
  isRemove,
}: {
  elementType?: string;
  isActive: boolean;
  isHover: boolean;
  isInsert: boolean;
  isRemove: boolean;
}) {
  return cn(
    elementType === KEYS.columnGroup && 'flex size-full rounded',
    suggestionVariants({
      insertActive: isInsert && (isActive || isHover),
      remove: isRemove,
      removeActive: (isActive || isHover) && isRemove,
    })
  );
}

export function isVoidRemoveSuggestion(editor: PlateEditor, element: TElement) {
  return (
    editor.getApi(SuggestionPlugin).suggestion.suggestionData(element)?.type ===
    'remove'
  );
}

export function VoidRemoveSuggestionOverlay({
  editor,
  element,
}: {
  editor: PlateEditor;
  element: TElement;
}) {
  const active =
    editor.api.isVoid(element) &&
    !editor.api.isInline(element) &&
    isVoidRemoveSuggestion(editor, element);

  if (!active) return null;

  return (
    <div
      className={voidRemoveSuggestionOverlayVariants({ active })}
      contentEditable={false}
      data-slot="void-remove-suggestion"
    />
  );
}

export function SuggestionLineBreakAnchor({
  badgeProps,
  children,
  className,
}: {
  badgeProps?: React.ComponentProps<'span'>;
  children: React.ReactNode;
  className?: string;
}) {
  const badge = (
    <span
      {...badgeProps}
      className={cn(
        'inline-flex h-[calc(1lh+2px)] w-[1lh] shrink-0 items-center justify-center leading-none',
        badgeProps?.className,
        className
      )}
      contentEditable={false}
    >
      <CornerDownLeftIcon className="relative top-px size-4" />
    </span>
  );

  return (
    <>
      {children}
      {badge}
    </>
  );
}

function SuggestionLineBreakElementAnchor({
  badgeProps,
  children,
  className,
}: {
  badgeProps?: React.ComponentProps<'span'>;
  children: React.ReactElement<any>;
  className?: string;
}) {
  if (!React.isValidElement(children)) return children;
  const badge = (
    <span
      {...badgeProps}
      className={cn(
        'inline-flex h-[calc(1lh+2px)] w-[1lh] shrink-0 items-center justify-center leading-none',
        badgeProps?.className,
        className
      )}
      contentEditable={false}
    >
      <CornerDownLeftIcon className="relative top-px size-4" />
    </span>
  );

  if (children.type === 'ol' || children.type === 'ul') {
    const childNodes = React.Children.toArray(
      (children.props as { children?: React.ReactNode }).children
    );
    const lastIndex = childNodes.length - 1;
    const lastChild = childNodes[lastIndex];

    if (!React.isValidElement(lastChild) || lastChild.type !== 'li') {
      return children;
    }

    const nextLastChild = React.cloneElement(
      lastChild as React.ReactElement<any>,
      {
        children: (
          <>
            {(lastChild.props as { children?: React.ReactNode }).children}
            {badge}
          </>
        ),
      }
    );

    return React.cloneElement(children as React.ReactElement<any>, {
      children: [...childNodes.slice(0, lastIndex), nextLastChild],
    });
  }

  if (typeof children.type === 'string') {
    return (
      <>
        {children}
        {badge}
      </>
    );
  }

  return React.cloneElement(children as React.ReactElement<any>, {
    lineBreakBadge: badge,
  });
}

export function SuggestionLeaf(props: PlateLeafProps<TSuggestionText>) {
  const { api, setOption } = useEditorPlugin(suggestionPlugin);
  const leaf = props.leaf;

  const leafId: string = api.suggestion.nodeId(leaf) ?? '';
  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const hoverSuggestionId = usePluginOption(suggestionPlugin, 'hoverId');
  const dataList = api.suggestion.dataList(leaf);

  const hasRemove = dataList.some((data) => data.type === 'remove');
  const hasActive = dataList.some((data) => data.id === activeSuggestionId);
  const hasHover = dataList.some((data) => data.id === hoverSuggestionId);

  const diffOperation = { type: hasRemove ? 'delete' : 'insert' } as const;

  const Component = ({ delete: 'del', insert: 'ins', update: 'span' } as const)[
    diffOperation.type
  ];

  return (
    <PlateLeaf
      {...props}
      as={Component}
      attributes={{
        ...props.attributes,
        onMouseEnter: () => setOption('hoverId', leafId),
        onMouseLeave: () => setOption('hoverId', null),
      }}
      className={cn(
        suggestionVariants({
          insertActive: hasActive || hasHover,
          remove: hasRemove,
          removeActive: (hasActive || hasHover) && hasRemove,
        })
      )}
    >
      {props.children}
    </PlateLeaf>
  );
}
export const SuggestionLineBreak: RenderNodeWrapper<AnyPluginConfig> = ({
  api,
  element,
}) => {
  if (!api.suggestion.isBlockSuggestion(element)) return;

  const suggestionData = element.suggestion as TSuggestionData;

  return function Component({ children }) {
    return (
      <SuggestionLineBreakContent
        elementType={element.type}
        suggestionData={suggestionData}
      >
        {children}
      </SuggestionLineBreakContent>
    );
  };
};

export function SuggestionLineBreakContent({
  children,
  elementType,
  suggestionData,
}: {
  children: React.ReactNode;
  elementType?: string;
  suggestionData: TSuggestionData;
}) {
  const { isLineBreak, type } = suggestionData;
  const isRemove = type === 'remove';
  const isInsert = type === 'insert';

  const activeSuggestionId = usePluginOption(suggestionPlugin, 'activeId');
  const hoverSuggestionId = usePluginOption(suggestionPlugin, 'hoverId');

  const isActive = activeSuggestionId === suggestionData.id;
  const isHover = hoverSuggestionId === suggestionData.id;

  const { setOption } = useEditorPlugin(suggestionPlugin);
  const lineBreakBadgeClassName = cn(
    isInsert && 'bg-transparent! text-primary! transition-colors duration-200',
    isInsert && (isActive || isHover) && 'bg-transparent! text-primary!',
    isRemove &&
      'bg-transparent! text-destructive! transition-colors duration-200',
    isRemove && (isActive || isHover) && 'bg-transparent! text-destructive!'
  );

  return (
    <>
      {isLineBreak ? (
        React.isValidElement(children) && typeof children.type !== 'string' ? (
          <SuggestionLineBreakElementAnchor
            badgeProps={{
              onClick: (event) => {
                event.stopPropagation();
                setOption('activeId', suggestionData.id);
              },
              onMouseDown: (event) => {
                event.preventDefault();
              },
            }}
            className={lineBreakBadgeClassName}
          >
            {children}
          </SuggestionLineBreakElementAnchor>
        ) : React.isValidElement(children) &&
          (children.type === 'ol' || children.type === 'ul') ? (
          <SuggestionLineBreakElementAnchor
            badgeProps={{
              onClick: (event) => {
                event.stopPropagation();
                setOption('activeId', suggestionData.id);
              },
              onMouseDown: (event) => {
                event.preventDefault();
              },
            }}
            className={lineBreakBadgeClassName}
          >
            {children}
          </SuggestionLineBreakElementAnchor>
        ) : (
          <SuggestionLineBreakAnchor
            badgeProps={{
              onClick: (event) => {
                event.stopPropagation();
                setOption('activeId', suggestionData.id);
              },
              onMouseDown: (event) => {
                event.preventDefault();
              },
            }}
            className={lineBreakBadgeClassName}
          >
            {children}
          </SuggestionLineBreakAnchor>
        )
      ) : (
        <div
          className={getBlockSuggestionWrapperClassName({
            elementType,
            isActive,
            isHover,
            isInsert,
            isRemove,
          })}
          data-block-suggestion="true"
          onMouseEnter={() => setOption('hoverId', suggestionData.id)}
          onMouseLeave={() => setOption('hoverId', null)}
        >
          {children}
        </div>
      )}
    </>
  );
}
