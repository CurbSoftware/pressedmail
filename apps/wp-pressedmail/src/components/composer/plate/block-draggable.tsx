'use client';

/**
 * Block drag handle + drop-line, vendored from the Plate playground and rewired
 * to @kit/ui/plugin primitives. Interactive-only chrome, no email-serialization
 * impact. Renders via DndKit's `render.aboveNodes`.
 */

import * as React from 'react';
import { DndPlugin, useDraggable, useDropLine } from '@kit/plate/dnd';
import { expandListItemsWithChildren } from '@kit/plate/list';
import { BlockSelectionPlugin } from '@kit/plate/selection/react';
import { GripVertical } from 'lucide-react';
import { getPluginByType, isType, KEYS, type TElement } from '@kit/plate';
import {
  MemoizedChildren,
  type PlateEditor,
  type PlateElementProps,
  type RenderNodeWrapper,
  useEditorRef,
  useEditorSelector,
  useElement,
  usePluginOption,
  useSelected,
} from '@kit/plate/react';

import {
  Button,
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@kit/ui/plugin';

import { cn } from '@/lib/utils';

const UNDRAGGABLE_KEYS = [KEYS.column, KEYS.tr, KEYS.td];

export const BlockDraggable: RenderNodeWrapper = (props) => {
  const { editor, element, path } = props;

  const enabled = React.useMemo(() => {
    if (editor.dom.readOnly) return false;

    if (path.length === 1 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      return true;
    }
    if (path.length === 3 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      const block = editor.api.some({
        at: path,
        match: { type: editor.getType(KEYS.column) },
      });
      if (block) return true;
    }
    if (path.length === 4 && !isType(editor, element, UNDRAGGABLE_KEYS)) {
      const block = editor.api.some({
        at: path,
        match: { type: editor.getType(KEYS.table) },
      });
      if (block) return true;
    }

    return false;
  }, [editor, element, path]);

  if (!enabled) return;

  return (dragProps) => <Draggable {...dragProps} />;
};

function Draggable(props: PlateElementProps) {
  const { children, editor, element, path } = props;
  const blockSelectionApi = editor.getApi(BlockSelectionPlugin).blockSelection;

  const { isAboutToDrag, isDragging, nodeRef, previewRef, handleRef } =
    useDraggable({
      element,
      onDropHandler: (_, { dragItem }) => {
        const id = (dragItem as { id: string[] | string }).id;
        if (blockSelectionApi) blockSelectionApi.add(id);
        resetPreview();
      },
    });

  const isInColumn = path.length === 3;

  const [previewTop, setPreviewTop] = React.useState(0);

  const resetPreview = () => {
    if (previewRef.current) {
      previewRef.current.replaceChildren();
      previewRef.current?.classList.add('hidden');
    }
  };

  React.useEffect(() => {
    if (!isDragging) resetPreview();

  }, [isDragging]);

  React.useEffect(() => {
    if (isAboutToDrag) previewRef.current?.classList.remove('opacity-0');

  }, [isAboutToDrag]);

  // Pins a handle on the block the caret is in (plus any selected block) so the
  // current line always shows its grip. Other blocks reveal on hover (see
  // Gutter), which is what keeps every block, including nested ones (column
  // paragraphs, table cells), draggable. `editor.api.block()` resolves to the
  // innermost block at the caret, so the pin lands on the exact nested block.
  const isActiveBlock = useEditorSelector(
    (ed) => {
      if (!ed.selection) return false;
      const entry = ed.api.block();

      return !!entry && entry[0].id === element.id;
    },
    [],
  );

  // Vertically center the grip on the block's first text line, NOT the whole
  // block, so tall blocks (callouts, multi-line) stay grabbable from their
  // first line. Measured from the DOM because line heights differ per block
  // type (heading vs paragraph vs callout).
  const [handleTop, setHandleTop] = React.useState(0);

  React.useEffect(() => {
    setHandleTop(calcFirstLineCenter(editor, element));
  }, [editor, element]);

  return (
    <div
      className={cn(
        'relative',
        isDragging && 'opacity-50',
        getPluginByType(editor, element.type)?.node.isContainer
          ? 'group/container'
          : 'group',
      )}
    >
      {/* Block drag handle. Rendered for every draggable block including the
          content inside table cells (path length 4) and columns (path length
          3), so items can be dragged in and out of nested containers. */}
      <Gutter isActiveBlock={isActiveBlock}>
        <div
          className={cn(
            'slate-blockToolbarWrapper',
            'flex h-[1.5em]',
            isInColumn && 'h-4',
          )}
        >
          <div
            className={cn(
              'slate-blockToolbar relative w-4.5',
              'pointer-events-auto mr-1 flex items-center',
              isInColumn && 'mr-1.5',
            )}
          >
            <Button
              className="absolute -left-0 h-6 w-full -translate-y-1/2 p-0"
              data-plate-prevent-deselect
              ref={handleRef}
              style={{ top: `${handleTop}px` }}
              variant="ghost"
            >
              <DragHandle
                isDragging={isDragging}
                previewRef={previewRef}
                resetPreview={resetPreview}
                setPreviewTop={setPreviewTop}
              />
            </Button>
          </div>
        </div>
      </Gutter>

      <div
        className={cn('absolute -left-0 hidden w-full')}
        contentEditable={false}
        ref={previewRef}
        style={{ top: `${-previewTop}px` }}
      />

      <div className="slate-blockWrapper flow-root" ref={nodeRef}>
        <MemoizedChildren>{children}</MemoizedChildren>
        <DropLine />
      </div>
    </div>
  );
}

function Gutter({
  children,
  className,
  isActiveBlock,
  ...props
}: React.ComponentProps<'div'> & { isActiveBlock: boolean }) {
  const editor = useEditorRef();
  const element = useElement();
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    'isSelectionAreaVisible',
  );
  const selected = useSelected();
  // The caret's block (and any selected block) stays pinned visible. Every
  // other block still reveals on hover, so ANY block, including nested ones
  // (a paragraph inside a column, a table cell, etc.), can be grabbed and
  // dragged. This is the playground behavior; caret-only visibility broke
  // dragging nested blocks because only one handle could ever show.
  const pinned = isActiveBlock || selected;

  return (
    <div
      {...props}
      className={cn(
        'slate-gutterLeft',
        'absolute top-0 z-50 flex h-full -translate-x-full cursor-grab hover:opacity-100',
        getPluginByType(editor, element.type)?.node.isContainer
          ? 'group-hover/container:opacity-100'
          : 'group-hover:opacity-100',
        isSelectionAreaVisible && 'hidden',
        !pinned && 'sm:opacity-0',
        !pinned && 'opacity-0',
        className,
      )}
      contentEditable={false}
    >
      {children}
    </div>
  );
}

const DragHandle = React.memo(function DragHandle({
  isDragging,
  previewRef,
  resetPreview,
  setPreviewTop,
}: {
  isDragging: boolean;
  previewRef: React.RefObject<HTMLDivElement | null>;
  resetPreview: () => void;
  setPreviewTop: (top: number) => void;
}) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="flex size-full items-center justify-center"
            data-plate-prevent-deselect
            onClick={(e) => {
              e.preventDefault();
              editor.getApi(BlockSelectionPlugin).blockSelection.focus();
            }}
            onMouseDown={(e) => {
              resetPreview();

              if ((e.button !== 0 && e.button !== 2) || e.shiftKey) return;

              const blockSelection = editor
                .getApi(BlockSelectionPlugin)
                .blockSelection.getNodes({ sort: true });

              let selectionNodes =
                blockSelection.length > 0
                  ? blockSelection
                  : editor.api.blocks({ mode: 'highest' });

              if (!selectionNodes.some(([node]) => node.id === element.id)) {
                selectionNodes = [[element, editor.api.findPath(element)!]];
              }

              const blocks = expandListItemsWithChildren(
                editor,
                selectionNodes,
              ).map(([node]) => node);

              if (blockSelection.length === 0) {
                editor.tf.blur();
                editor.tf.collapse();
              }

              const elements = createDragPreviewElements(editor, blocks);
              previewRef.current?.append(...elements);
              previewRef.current?.classList.remove('hidden');
              previewRef.current?.classList.add('opacity-0');
              editor.setOption(DndPlugin, 'multiplePreviewRef', previewRef);

              editor
                .getApi(BlockSelectionPlugin)
                .blockSelection.set(blocks.map((block) => block.id as string));
            }}
            onMouseEnter={() => {
              if (isDragging) return;

              const blockSelection = editor
                .getApi(BlockSelectionPlugin)
                .blockSelection.getNodes({ sort: true });

              let selectedBlocks =
                blockSelection.length > 0
                  ? blockSelection
                  : editor.api.blocks({ mode: 'highest' });

              if (!selectedBlocks.some(([node]) => node.id === element.id)) {
                selectedBlocks = [[element, editor.api.findPath(element)!]];
              }

              const processedBlocks = expandListItemsWithChildren(
                editor,
                selectedBlocks,
              );

              const ids = processedBlocks.map((block) => block[0].id as string);

              if (ids.length > 1 && ids.includes(element.id as string)) {
                const top = calculatePreviewTop(editor, {
                  blocks: processedBlocks.map((block) => block[0]),
                  element,
                });
                setPreviewTop(top);
              } else {
                setPreviewTop(0);
              }
            }}
            onMouseUp={() => resetPreview()}
            role="button"
          >
            <GripVertical className="text-muted-foreground" />
          </div>
        </TooltipTrigger>
        <TooltipContent>Drag to move</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

const DropLine = React.memo(function DropLine({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      {...props}
      className={cn(
        'slate-dropLine',
        'absolute inset-x-0 h-0.5 opacity-100 transition-opacity',
        'bg-primary/50',
        dropLine === 'top' && '-top-px',
        dropLine === 'bottom' && '-bottom-px',
        className,
      )}
    />
  );
});

const createDragPreviewElements = (
  editor: PlateEditor,
  blocks: TElement[],
): HTMLElement[] => {
  const elements: HTMLElement[] = [];
  const ids: string[] = [];

  const removeDataAttributes = (element: HTMLElement) => {
    Array.from(element.attributes).forEach((attr) => {
      if (
        attr.name.startsWith('data-slate') ||
        attr.name.startsWith('data-block-id')
      ) {
        element.removeAttribute(attr.name);
      }
    });

    Array.from(element.children).forEach((child) => {
      removeDataAttributes(child as HTMLElement);
    });
  };

  const resolveElement = (node: TElement, index: number) => {
    const domNode = editor.api.toDOMNode(node)!;
    const newDomNode = domNode.cloneNode(true) as HTMLElement;

    const applyScrollCompensation = (
      original: Element,
      cloned: HTMLElement,
    ) => {
      const scrollLeft = original.scrollLeft;

      if (scrollLeft > 0) {
        const scrollWrapper = document.createElement('div');
        scrollWrapper.style.overflow = 'hidden';
        scrollWrapper.style.width = `${original.clientWidth}px`;

        const innerContainer = document.createElement('div');
        innerContainer.style.transform = `translateX(-${scrollLeft}px)`;
        innerContainer.style.width = `${original.scrollWidth}px`;

        while (cloned.firstChild) {
          innerContainer.append(cloned.firstChild);
        }

        const originalStyles = window.getComputedStyle(original);
        cloned.style.padding = '0';
        innerContainer.style.padding = originalStyles.padding;

        scrollWrapper.append(innerContainer);
        cloned.append(scrollWrapper);
      }
    };

    applyScrollCompensation(domNode, newDomNode);

    ids.push(node.id as string);
    const wrapper = document.createElement('div');
    wrapper.append(newDomNode);
    wrapper.style.display = 'flow-root';

    const lastDomNode = blocks[index - 1];

    if (lastDomNode) {
      const lastDomNodeRect = editor.api
        .toDOMNode(lastDomNode)!
        .parentElement!.getBoundingClientRect();

      const domNodeRect = domNode.parentElement!.getBoundingClientRect();

      const distance = domNodeRect.top - lastDomNodeRect.bottom;

      if (distance > 15) {
        wrapper.style.marginTop = `${distance}px`;
      }
    }

    removeDataAttributes(newDomNode);
    elements.push(wrapper);
  };

  blocks.forEach((node, index) => {
    resolveElement(node, index);
  });

  editor.setOption(DndPlugin, 'draggingId', ids);

  return elements;
};

const calculatePreviewTop = (
  editor: PlateEditor,
  { blocks, element }: { blocks: TElement[]; element: TElement },
): number => {
  const child = editor.api.toDOMNode(element)!;
  const editable = editor.api.toDOMNode(editor)!;
  const firstSelectedChild = blocks[0]!;

  const firstDomNode = editor.api.toDOMNode(firstSelectedChild)!;
  const editorPaddingTop = Number(
    window.getComputedStyle(editable).paddingTop.replace('px', ''),
  );

  const firstNodeToEditorDistance =
    firstDomNode.getBoundingClientRect().top -
    editable.getBoundingClientRect().top -
    editorPaddingTop;

  const firstMarginTopString = window.getComputedStyle(firstDomNode).marginTop;
  const marginTop = Number(firstMarginTopString.replace('px', ''));

  const currentToEditorDistance =
    child.getBoundingClientRect().top -
    editable.getBoundingClientRect().top -
    editorPaddingTop;

  const currentMarginTopString = window.getComputedStyle(child).marginTop;
  const currentMarginTop = Number(currentMarginTopString.replace('px', ''));

  return (
    currentToEditorDistance -
    firstNodeToEditorDistance +
    marginTop -
    currentMarginTop
  );
};

/**
 * Vertical offset (from the block wrapper's top) of the center of the block's
 * first text line. Used to vertically center the drag grip on the first line
 * regardless of the block's total height or line-height.
 */
const calcFirstLineCenter = (
  editor: PlateEditor,
  element: TElement,
): number => {
  const dom = editor.api.toDOMNode(element);
  if (!dom) return 0;

  const style = window.getComputedStyle(dom);
  const marginTop = parseFloat(style.marginTop) || 0;
  const paddingTop = parseFloat(style.paddingTop) || 0;
  const lineHeight = parseFloat(style.lineHeight);
  // line-height may resolve to the keyword "normal" (NaN); fall back to ~1.5em
  // of the block's font size.
  const halfLine = Number.isNaN(lineHeight)
    ? (parseFloat(style.fontSize) || 16) * 0.75
    : lineHeight / 2;

  return marginTop + paddingTop + halfLine;
};
