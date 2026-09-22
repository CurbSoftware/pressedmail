'use client';

import { useDraggable, useDropLine } from '@kit/plate/dnd';
import { resizeLengthClampStatic } from '@kit/plate/resizable';
import {
  BlockSelectionPlugin,
  useBlockSelected,
} from '@kit/plate/selection/react';
import {
  findCellByIndexes,
  getCellTypes,
  getCellIndices,
  getCellIndicesWithSpans,
  getSelectedCellsBoundingBox,
  getTableColumnCount,
  getTableEntries,
  setCellBackground,
  setTableColSize,
  setTableMarginLeft,
  setTableRowSize,
} from '@kit/plate/table';
import {
  roundCellSizeToStep,
  TablePlugin,
  TableProvider,
  useCellIndices,
  useOverrideColSize,
  useOverrideMarginLeft,
  useOverrideRowSize,
  useTableCellBorders,
  useTableColSizes,
  useTableElement,
  useTableMergeState,
  useTableSelectionDom,
  useTableValue,
} from '@kit/plate/table/react';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  CombineIcon,
  EraserIcon,
  Grid2X2Icon,
  GripVertical,
  PaintBucketIcon,
  SquareSplitHorizontalIcon,
  Trash2Icon,
  XIcon,
} from 'lucide-react';
import {
  KEYS,
  PathApi,
  type SlateEditor,
  type TElement,
  type TTableCellElement,
  type TTableElement,
  type TTableRowElement,
} from '@kit/plate';
import {
  PlateElement,
  type PlateElementProps,
  useComposedRef,
  useEditorPlugin,
  useEditorRef,
  useEditorSelector,
  useElement,
  useElementSelector,
  useFocusedLast,
  usePluginOption,
  useReadOnly,
  useRemoveNodeButton,
  useSelected,
  withHOC,
} from '@kit/plate/react';
import * as React from 'react';

import { __, sprintf } from '@wordpress/i18n';
import {
  Button,
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuPortal,
  DropdownMenuRadioItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  Popover,
  PopoverAnchor,
  PopoverContent,
} from '@kit/ui/plugin';
import { PressedPopoverContent } from '@/components/ui/pressed-overlay';
import { cn } from '@/lib/utils';

import { blockSelectionVariants } from './block-selection';
import {
  BorderAllIcon,
  BorderBottomIcon,
  BorderLeftIcon,
  BorderNoneIcon,
  BorderRightIcon,
  BorderTopIcon,
} from './table-icons';
import {
  Toolbar,
  ToolbarButton,
  ToolbarGroup,
  ToolbarMenuGroup,
} from '@/components/composer/toolbar';
import {
  getTableCellBorderStyles,
  TABLE_BORDER_DEFAULT_COLOR,
  TABLE_BORDER_SIDES,
  type TableBorderSide,
  type TableCellBorders,
} from './table-border-styles';

type TColor = { name: string; value: string };

/** Cell background palette (minimal; the composer ships no font-color kit). */
// Built on call: a module-level __() runs before the locale catalog loads,
// so these names would always be English.
const getDefaultColors = (): TColor[] => [
  { name: __('Dark grey', 'pressedmail'), value: '#434343' },
  { name: __('Grey', 'pressedmail'), value: '#999999' },
  { name: __('Light grey', 'pressedmail'), value: '#cccccc' },
  { name: __('White', 'pressedmail'), value: '#ffffff' },
  { name: __('Red', 'pressedmail'), value: '#dc2626' },
  { name: __('Orange', 'pressedmail'), value: '#ea580c' },
  { name: __('Amber', 'pressedmail'), value: '#d97706' },
  { name: __('Green', 'pressedmail'), value: '#16a34a' },
  { name: __('Blue', 'pressedmail'), value: '#2563eb' },
  { name: __('Purple', 'pressedmail'), value: '#7c3aed' },
  { name: __('Pink', 'pressedmail'), value: '#db2777' },
];

const getBorderColors = (): TColor[] => [
  { name: __('Default', 'pressedmail'), value: TABLE_BORDER_DEFAULT_COLOR },
  ...getDefaultColors(),
];

const getBorderStyles = () => [
  { label: __('Solid', 'pressedmail'), value: 'solid' },
  { label: __('Dashed', 'pressedmail'), value: 'dashed' },
  { label: __('Dotted', 'pressedmail'), value: 'dotted' },
  { label: __('Double', 'pressedmail'), value: 'double' },
] as const;

const BORDER_SIZES = [1, 2, 3, 4] as const;

export function ColorDropdownMenuItems({
  ariaLabelPrefix,
  className,
  colors,
  keepOpen = false,
  updateColor,
}: {
  ariaLabelPrefix?: string;
  className?: string;
  colors: TColor[];
  keepOpen?: boolean;
  updateColor: (color: string) => void;
}) {
  return (
    <div className={cn('grid grid-cols-6 gap-1', className)}>
      {colors.map(({ name, value }) => {
        const label = ariaLabelPrefix ? `${ariaLabelPrefix}: ${name}` : name;

        return (
          <DropdownMenuItem
            aria-label={label}
            className="size-5 rounded-sm border border-border p-0"
            key={value}
            onSelect={(event) => {
              if (keepOpen) event.preventDefault();
              updateColor(value);
            }}
            style={{ backgroundColor: value }}
            title={label}
          >
            <span className="sr-only">{label}</span>
          </DropdownMenuItem>
        );
      })}
    </div>
  );
}

type TableResizeDirection = 'bottom' | 'left' | 'right';

type TableResizeStartOptions = {
  colIndex: number;
  direction: TableResizeDirection;
  handleKey: string;
  rowIndex: number;
};

type TableResizeDragState = {
  colIndex: number;
  direction: TableResizeDirection;
  initialPosition: number;
  initialSize: number;
  marginLeft: number;
  rowIndex: number;
};

type TableResizeContextValue = {
  disableMarginLeft: boolean;
  clearResizePreview: (handleKey: string) => void;
  setResizePreview: (
    event: React.PointerEvent<HTMLDivElement>,
    options: TableResizeStartOptions
  ) => void;
  startResize: (
    event: React.PointerEvent<HTMLDivElement>,
    options: TableResizeStartOptions
  ) => void;
};

const TABLE_CONTROL_COLUMN_WIDTH = 8;
const TABLE_DEFAULT_COLUMN_WIDTH = 120;
const TABLE_DEFERRED_COLUMN_RESIZE_CELL_COUNT = 1200;
const TABLE_MULTI_SELECTION_TOOLBAR_DELAY_MS = 150;

const TableResizeContext = React.createContext<TableResizeContextValue | null>(
  null
);

function useTableResizeContext() {
  const context = React.useContext(TableResizeContext);

  if (!context) {
    throw new Error('TableResizeContext is missing');
  }

  return context;
}

function useTableResizeController({
  deferColumnResize,
  dragIndicatorRef,
  hoverIndicatorRef,
  marginLeft,
  controlColumnWidth,
  tablePath,
  tableRef,
  wrapperRef,
}: {
  deferColumnResize: boolean;
  dragIndicatorRef: React.RefObject<HTMLDivElement | null>;
  hoverIndicatorRef: React.RefObject<HTMLDivElement | null>;
  marginLeft: number;
  controlColumnWidth: number;
  tablePath: number[];
  tableRef: React.RefObject<HTMLTableElement | null>;
  wrapperRef: React.RefObject<HTMLDivElement | null>;
}) {
  const { editor, getOptions } = useEditorPlugin(TablePlugin);
  const { disableMarginLeft = false, minColumnWidth = 0 } = getOptions();
  const colSizes = useTableColSizes({
    disableOverrides: true,
  });
  const effectiveColSizes = React.useMemo(
    () => colSizes.map((colSize) => colSize || TABLE_DEFAULT_COLUMN_WIDTH),
    [colSizes]
  );
  const effectiveColSizesRef = React.useRef(effectiveColSizes);
  const activeHandleKeyRef = React.useRef<string | null>(null);
  const activeRowElementRef = React.useRef<HTMLTableRowElement | null>(null);
  const cleanupListenersRef = React.useRef<(() => void) | null>(null);
  const marginLeftRef = React.useRef(marginLeft);
  const dragStateRef = React.useRef<TableResizeDragState | null>(null);
  const frozenRowIndicesRef = React.useRef<number[] | null>(null);
  const previewHandleKeyRef = React.useRef<string | null>(null);
  const overrideColSize = useOverrideColSize();
  const overrideMarginLeft = useOverrideMarginLeft();
  const overrideRowSize = useOverrideRowSize();

  // Rendered px per raw colSize px. Below 1 when the table is width-capped to
  // the compose pane (colgroup uses proportional calc() widths), so indicator
  // offsets and pointer deltas must translate between the two domains.
  const getRenderScale = React.useCallback(() => {
    const table = tableRef.current;

    if (!table) return 1;

    const rawWidth = effectiveColSizesRef.current.reduce(
      (total, colSize) => total + colSize,
      0
    );

    if (!rawWidth) return 1;

    const renderedWidth =
      table.getBoundingClientRect().width - controlColumnWidth;

    if (renderedWidth <= 0) return 1;

    return Math.min(1, renderedWidth / rawWidth);
  }, [controlColumnWidth, tableRef]);

  React.useEffect(() => {
    effectiveColSizesRef.current = effectiveColSizes;
  }, [effectiveColSizes]);

  React.useEffect(() => {
    marginLeftRef.current = marginLeft;
  }, [marginLeft]);

  const hideDeferredResizeIndicator = React.useCallback(() => {
    const indicator = dragIndicatorRef.current;

    if (!indicator) return;

    indicator.style.display = 'none';
    indicator.style.removeProperty('left');
  }, [dragIndicatorRef]);

  const showDeferredResizeIndicator = React.useCallback(
    (offset: number) => {
      const indicator = dragIndicatorRef.current;

      if (!indicator) return;

      indicator.style.display = 'block';
      indicator.style.left = `${offset}px`;
    },
    [dragIndicatorRef]
  );

  const hideResizeIndicator = React.useCallback(() => {
    const indicator = hoverIndicatorRef.current;

    if (!indicator) return;

    indicator.style.display = 'none';
    indicator.style.removeProperty('left');
  }, [hoverIndicatorRef]);

  const clearFrozenRowHeights = React.useCallback(() => {
    const frozenRowIndices = frozenRowIndicesRef.current;

    if (!frozenRowIndices) return;

    frozenRowIndicesRef.current = null;

    frozenRowIndices.forEach((rowIndex) => {
      overrideRowSize(rowIndex, null);
    });
  }, [overrideRowSize]);

  const freezeRowHeights = React.useCallback(() => {
    const table = tableRef.current;

    if (!table || deferColumnResize) return;

    clearFrozenRowHeights();

    const frozenRowIndices: number[] = [];

    Array.from(table.rows).forEach((row, rowIndex) => {
      const height = row.getBoundingClientRect().height;

      if (!height) return;

      overrideRowSize(rowIndex, height);
      frozenRowIndices.push(rowIndex);
    });

    frozenRowIndicesRef.current = frozenRowIndices;
  }, [clearFrozenRowHeights, deferColumnResize, overrideRowSize, tableRef]);

  const showResizeIndicatorAtOffset = React.useCallback(
    (offset: number) => {
      const indicator = hoverIndicatorRef.current;

      if (!indicator) return;

      indicator.style.display = 'block';
      indicator.style.left = `${offset}px`;
    },
    [hoverIndicatorRef]
  );

  const showResizeIndicator = React.useCallback(
    ({
      event,
      direction,
    }: Pick<TableResizeStartOptions, 'direction'> & {
      event: React.PointerEvent<HTMLDivElement>;
    }) => {
      if (direction === 'bottom') return;

      const wrapper = wrapperRef.current;

      if (!wrapper) return;

      const handleRect = event.currentTarget.getBoundingClientRect();
      const wrapperRect = wrapper.getBoundingClientRect();
      const boundaryOffset =
        handleRect.left - wrapperRect.left + handleRect.width / 2;

      showResizeIndicatorAtOffset(boundaryOffset);
    },
    [showResizeIndicatorAtOffset, wrapperRef]
  );

  const setResizePreview = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      options: TableResizeStartOptions
    ) => {
      if (activeHandleKeyRef.current) return;

      previewHandleKeyRef.current = options.handleKey;
      showResizeIndicator({ ...options, event });
    },
    [showResizeIndicator]
  );

  const clearResizePreview = React.useCallback(
    (handleKey: string) => {
      if (activeHandleKeyRef.current) return;
      if (previewHandleKeyRef.current !== handleKey) return;

      previewHandleKeyRef.current = null;
      hideResizeIndicator();
    },
    [hideResizeIndicator]
  );

  const commitColSize = React.useCallback(
    (colIndex: number, width: number) => {
      setTableColSize(editor, { colIndex, width }, { at: tablePath });
      setTimeout(() => overrideColSize(colIndex, null), 0);
    },
    [editor, overrideColSize, tablePath]
  );

  const commitRowSize = React.useCallback(
    (rowIndex: number, height: number) => {
      setTableRowSize(editor, { height, rowIndex }, { at: tablePath });
      setTimeout(() => overrideRowSize(rowIndex, null), 0);
    },
    [editor, overrideRowSize, tablePath]
  );

  const commitMarginLeft = React.useCallback(
    (nextMarginLeft: number) => {
      setTableMarginLeft(
        editor,
        { marginLeft: nextMarginLeft },
        { at: tablePath }
      );
      setTimeout(() => overrideMarginLeft(null), 0);
    },
    [editor, overrideMarginLeft, tablePath]
  );

  const getColumnBoundaryOffset = React.useCallback(
    (colIndex: number, currentWidth: number) =>
      controlColumnWidth +
      (effectiveColSizesRef.current
        .slice(0, colIndex)
        .reduce((total, colSize) => total + colSize, 0) +
        currentWidth) *
        getRenderScale(),
    [controlColumnWidth, getRenderScale]
  );

  const applyResize = React.useCallback(
    (event: PointerEvent, finished: boolean) => {
      const dragState = dragStateRef.current;

      if (!dragState) return;

      const currentPosition =
        dragState.direction === 'bottom' ? event.clientY : event.clientX;
      const pointerDelta = currentPosition - dragState.initialPosition;
      // Column deltas apply to raw colSizes, which render scaled when the
      // table is width-capped, divide so the drag tracks the pointer 1:1.
      const delta =
        dragState.direction === 'bottom'
          ? pointerDelta
          : pointerDelta / getRenderScale();

      if (dragState.direction === 'bottom') {
        const newHeight = roundCellSizeToStep(
          dragState.initialSize + delta,
          undefined
        );

        if (finished) {
          commitRowSize(dragState.rowIndex, newHeight);
        } else {
          overrideRowSize(dragState.rowIndex, newHeight);
        }

        return;
      }

      if (dragState.direction === 'left') {
        const initial =
          effectiveColSizesRef.current[dragState.colIndex] ??
          dragState.initialSize;
        const complement = (width: number) =>
          initial + dragState.marginLeft - width;
        const nextMarginLeft = roundCellSizeToStep(
          resizeLengthClampStatic(dragState.marginLeft + delta, {
            max: complement(minColumnWidth),
            min: 0,
          }),
          undefined
        );
        const nextWidth = complement(nextMarginLeft);

        if (finished) {
          commitMarginLeft(nextMarginLeft);
          commitColSize(dragState.colIndex, nextWidth);
        } else if (deferColumnResize) {
          showDeferredResizeIndicator(
            controlColumnWidth + (nextMarginLeft - dragState.marginLeft)
          );
        } else {
          showResizeIndicatorAtOffset(
            controlColumnWidth + (nextMarginLeft - dragState.marginLeft)
          );
          overrideMarginLeft(nextMarginLeft);
          overrideColSize(dragState.colIndex, nextWidth);
        }

        return;
      }

      const currentInitial =
        effectiveColSizesRef.current[dragState.colIndex] ??
        dragState.initialSize;
      const nextInitial =
        effectiveColSizesRef.current[dragState.colIndex + 1] ?? 0;
      const complement = (width: number) =>
        currentInitial + nextInitial - width;
      const currentWidth = roundCellSizeToStep(
        resizeLengthClampStatic(currentInitial + delta, {
          max: nextInitial ? complement(minColumnWidth) : undefined,
          min: minColumnWidth,
        }),
        undefined
      );
      const nextWidth = nextInitial ? complement(currentWidth) : undefined;

      if (finished) {
        commitColSize(dragState.colIndex, currentWidth);

        if (nextWidth !== undefined) {
          commitColSize(dragState.colIndex + 1, nextWidth);
        }
      } else if (deferColumnResize) {
        showDeferredResizeIndicator(
          getColumnBoundaryOffset(dragState.colIndex, currentWidth)
        );
      } else {
        showResizeIndicatorAtOffset(
          getColumnBoundaryOffset(dragState.colIndex, currentWidth)
        );
        overrideColSize(dragState.colIndex, currentWidth);

        if (nextWidth !== undefined) {
          overrideColSize(dragState.colIndex + 1, nextWidth);
        }
      }
    },
    [
      commitColSize,
      commitMarginLeft,
      commitRowSize,
      controlColumnWidth,
      deferColumnResize,
      getColumnBoundaryOffset,
      getRenderScale,
      showDeferredResizeIndicator,
      showResizeIndicatorAtOffset,
      minColumnWidth,
      overrideColSize,
      overrideMarginLeft,
      overrideRowSize,
    ]
  );

  const stopResize = React.useCallback(() => {
    cleanupListenersRef.current?.();
    cleanupListenersRef.current = null;
    activeHandleKeyRef.current = null;
    previewHandleKeyRef.current = null;
    dragStateRef.current = null;

    if (activeRowElementRef.current) {
      delete activeRowElementRef.current.dataset.tableResizing;
      activeRowElementRef.current = null;
    }

    hideDeferredResizeIndicator();
    hideResizeIndicator();
    clearFrozenRowHeights();
  }, [clearFrozenRowHeights, hideDeferredResizeIndicator, hideResizeIndicator]);

  React.useEffect(() => stopResize, [stopResize]);

  const startResize = React.useCallback(
    (
      event: React.PointerEvent<HTMLDivElement>,
      { colIndex, direction, handleKey, rowIndex }: TableResizeStartOptions
    ) => {
      const rowHeight =
        tableRef.current?.rows.item(rowIndex)?.getBoundingClientRect().height ??
        0;

      dragStateRef.current = {
        colIndex,
        direction,
        initialPosition: direction === 'bottom' ? event.clientY : event.clientX,
        initialSize:
          direction === 'bottom'
            ? rowHeight
            : (effectiveColSizesRef.current[colIndex] ??
              TABLE_DEFAULT_COLUMN_WIDTH),
        marginLeft: marginLeftRef.current,
        rowIndex,
      };
      activeHandleKeyRef.current = handleKey;
      previewHandleKeyRef.current = null;

      const rowElement = tableRef.current?.rows.item(rowIndex) ?? null;

      if (
        activeRowElementRef.current &&
        activeRowElementRef.current !== rowElement
      ) {
        delete activeRowElementRef.current.dataset.tableResizing;
      }

      activeRowElementRef.current = rowElement;

      if (rowElement) {
        rowElement.dataset.tableResizing = 'true';
      }

      cleanupListenersRef.current?.();

      if (direction !== 'bottom') {
        freezeRowHeights();
      }

      const handlePointerMove = (pointerEvent: PointerEvent) => {
        applyResize(pointerEvent, false);
      };

      const handlePointerEnd = (pointerEvent: PointerEvent) => {
        applyResize(pointerEvent, true);
        stopResize();
      };

      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerEnd);
      window.addEventListener('pointercancel', handlePointerEnd);

      cleanupListenersRef.current = () => {
        window.removeEventListener('pointermove', handlePointerMove);
        window.removeEventListener('pointerup', handlePointerEnd);
        window.removeEventListener('pointercancel', handlePointerEnd);
      };

      if (deferColumnResize && direction !== 'bottom') {
        hideResizeIndicator();
        showDeferredResizeIndicator(
          direction === 'left'
            ? controlColumnWidth
            : getColumnBoundaryOffset(
                colIndex,
                effectiveColSizesRef.current[colIndex] ??
                  TABLE_DEFAULT_COLUMN_WIDTH
              )
        );
      } else {
        showResizeIndicator({ direction, event });
      }

      event.preventDefault();
      event.stopPropagation();
    },
    [
      controlColumnWidth,
      deferColumnResize,
      getColumnBoundaryOffset,
      hideResizeIndicator,
      showDeferredResizeIndicator,
      showResizeIndicator,
      stopResize,
      tableRef,
      applyResize,
      freezeRowHeights,
    ]
  );

  return React.useMemo(
    () => ({
      clearResizePreview,
      disableMarginLeft,
      setResizePreview,
      startResize,
    }),
    [clearResizePreview, disableMarginLeft, setResizePreview, startResize]
  );
}

export const TableElement = withHOC(
  TableProvider,
  function TableElement({
    children,
    ...props
  }: PlateElementProps<TTableElement>) {
    const readOnly = useReadOnly();
    const isSelectionAreaVisible = usePluginOption(
      BlockSelectionPlugin,
      'isSelectionAreaVisible'
    );
    const hasControls = !readOnly && !isSelectionAreaVisible;
    const { marginLeft, props: tableProps } = useTableElement();
    const colSizes = useTableColSizes();
    const controlColumnWidth = hasControls ? TABLE_CONTROL_COLUMN_WIDTH : 0;
    const dragIndicatorRef = React.useRef<HTMLDivElement>(null);
    const hoverIndicatorRef = React.useRef<HTMLDivElement>(null);
    const deferColumnResize =
      colSizes.length * props.element.children.length >
      TABLE_DEFERRED_COLUMN_RESIZE_CELL_COUNT;
    const tablePath = useElementSelector(([, path]) => path, [], {
      key: KEYS.table,
    });
    const tableRef = React.useRef<HTMLTableElement>(null);
    const wrapperRef = React.useRef<HTMLDivElement>(null);
    useTableSelectionDom(tableRef);
    const resizeController = useTableResizeController({
      controlColumnWidth,
      deferColumnResize,
      dragIndicatorRef,
      hoverIndicatorRef,
      marginLeft,
      tablePath,
      tableRef,
      wrapperRef,
    });
    const resolvedColSizes = React.useMemo(() => {
      if (colSizes.length > 0) {
        return colSizes.map((colSize) => colSize || TABLE_DEFAULT_COLUMN_WIDTH);
      }

      return Array.from(
        { length: getTableColumnCount(props.element) },
        () => TABLE_DEFAULT_COLUMN_WIDTH
      );
    }, [colSizes, props.element]);
    const totalColSize = React.useMemo(
      () => resolvedColSizes.reduce((total, colSize) => total + colSize, 0),
      [resolvedColSizes]
    );
    // colSizes are authoring-time px. The table renders at that natural width
    // but is capped at the compose pane; under table-layout: fixed a px
    // colgroup can never shrink (used width = max(width, Σ cols)), so data
    // columns carry proportional calc() widths that share whatever width the
    // cap leaves after the fixed control column.
    const tableStyle = React.useMemo(
      () =>
        ({
          width: `min(${totalColSize + controlColumnWidth}px, 100%)`,
        }) as React.CSSProperties,
      [controlColumnWidth, totalColSize]
    );

    const isSelectingTable = useBlockSelected(props.element.id as string);

    const content = (
      <PlateElement
        {...props}
        className={cn(
          'overflow-x-auto py-5',
          hasControls && '-ml-2 *:data-[slot=block-selection]:left-2'
        )}
        style={{ paddingLeft: marginLeft }}
      >
        <TableResizeContext.Provider value={resizeController}>
          <div
            className="group/table relative w-fit max-w-full overflow-x-clip"
            ref={wrapperRef}
          >
            <div
              className="pointer-events-none absolute inset-y-0 z-36 hidden w-[3px] -translate-x-[1.5px] bg-ring/70"
              contentEditable={false}
              ref={dragIndicatorRef}
            />
            <div
              className="pointer-events-none absolute inset-y-0 z-35 hidden w-[3px] -translate-x-[1.5px] bg-ring/80"
              contentEditable={false}
              ref={hoverIndicatorRef}
            />
            <table
              className={cn(
                'pm-composer-table mr-0 ml-px table h-px max-w-full table-fixed border-collapse',
                'data-[table-selecting=true]:[&_*::selection]:!bg-transparent',
                'data-[table-selecting=true]:[&_*::selection]:!text-inherit',
                'data-[table-selecting=true]:[&_*::-moz-selection]:!bg-transparent',
                'data-[table-selecting=true]:[&_*::-moz-selection]:!text-inherit',
                'data-[table-selecting=true]:[&_*]:!caret-transparent'
              )}
              ref={tableRef}
              style={tableStyle}
              {...tableProps}
            >
              {resolvedColSizes.length > 0 && (
                <colgroup>
                  {hasControls && (
                    <col style={{ width: TABLE_CONTROL_COLUMN_WIDTH }} />
                  )}
                  {resolvedColSizes.map((colSize, index) => (
                    <col
                      key={index}
                      style={{
                        width: `calc((100% - ${controlColumnWidth}px) * ${
                          colSize / (totalColSize || 1)
                        })`,
                      }}
                    />
                  ))}
                </colgroup>
              )}
              <tbody className="min-w-full">{children}</tbody>
            </table>

            {isSelectingTable && (
              <div
                className={blockSelectionVariants()}
                contentEditable={false}
              />
            )}
          </div>
        </TableResizeContext.Provider>
      </PlateElement>
    );

    if (readOnly) {
      return content;
    }

    return <TableFloatingToolbar>{content}</TableFloatingToolbar>;
  }
);

function TableFloatingToolbar({
  children,
  ...props
}: React.ComponentProps<typeof PopoverContent>) {
  const selectedCellCount = useEditorSelector(
    (editor) =>
      editor.getApi(TablePlugin).table.getSelectedCellIds()?.length ?? 0,
    []
  );
  const selected = useSelected();
  const collapsedInside = useEditorSelector(
    (editor) => selected && editor.api.isCollapsed(),
    [selected]
  );
  const isFocusedLast = useFocusedLast();
  const [isExpandedSelectionToolbarReady, setIsExpandedSelectionToolbarReady] =
    React.useState(false);
  const isCollapsedToolbarOpen = isFocusedLast && collapsedInside;
  const isExpandedSelectionPending =
    isFocusedLast && !collapsedInside && selectedCellCount > 1;

  React.useEffect(() => {
    if (!isExpandedSelectionPending) {
      // Reset the delayed toolbar gate when selection is no longer expanded.
      setIsExpandedSelectionToolbarReady(false);

      return;
    }

    const timeoutId = window.setTimeout(() => {
      setIsExpandedSelectionToolbarReady(true);
    }, TABLE_MULTI_SELECTION_TOOLBAR_DELAY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [isExpandedSelectionPending]);

  const shouldRenderExpandedSelectionToolbar =
    isExpandedSelectionToolbarReady && isExpandedSelectionPending;
  const isToolbarOpen =
    isCollapsedToolbarOpen || shouldRenderExpandedSelectionToolbar;

  return (
    <Popover modal={false} open={isToolbarOpen}>
      <PopoverAnchor asChild>{children}</PopoverAnchor>
      {isCollapsedToolbarOpen && (
        <CollapsedTableFloatingToolbarContent {...props} />
      )}
      {shouldRenderExpandedSelectionToolbar && (
        <ExpandedSelectionTableFloatingToolbarContent {...props} />
      )}
    </Popover>
  );
}

function ExpandedSelectionTableFloatingToolbarContent(
  props: React.ComponentProps<typeof PopoverContent>
) {
  const { tf } = useEditorPlugin(TablePlugin);
  const { canMerge, canSplit } = useTableMergeState();

  if (!canMerge && !canSplit) return null;

  return (
    <TableFloatingToolbarContent
      canMerge={canMerge}
      canSplit={canSplit}
      onMerge={() => tf.table.merge()}
      onSplit={() => tf.table.split()}
      {...props}
    />
  );
}

function CollapsedTableFloatingToolbarContent(
  props: React.ComponentProps<typeof PopoverContent>
) {
  const { tf } = useEditorPlugin(TablePlugin);
  const element = useElement<TTableElement>();
  const { props: buttonProps } = useRemoveNodeButton({ element });
  const { canSplit } = useTableMergeState();

  return (
    <TableFloatingToolbarContent
      buttonProps={buttonProps}
      canSplit={canSplit}
      collapsedInside
      onDeleteColumn={() => {
        tf.remove.tableColumn();
      }}
      onDeleteRow={() => {
        tf.remove.tableRow();
      }}
      onInsertColumnAfter={() => {
        tf.insert.tableColumn();
      }}
      onInsertColumnBefore={() => {
        tf.insert.tableColumn({ before: true });
      }}
      onInsertRowAfter={() => {
        tf.insert.tableRow();
      }}
      onInsertRowBefore={() => {
        tf.insert.tableRow({ before: true });
      }}
      onSplit={() => tf.table.split()}
      {...props}
    />
  );
}

function TableFloatingToolbarContent({
  buttonProps,
  canMerge = false,
  canSplit = false,
  collapsedInside = false,
  onDeleteColumn,
  onDeleteRow,
  onInsertColumnAfter,
  onInsertColumnBefore,
  onInsertRowAfter,
  onInsertRowBefore,
  onMerge,
  onSplit,
  ...props
}: React.ComponentProps<typeof PopoverContent> & {
  buttonProps?: React.ComponentProps<typeof ToolbarButton>;
  canMerge?: boolean;
  canSplit?: boolean;
  collapsedInside?: boolean;
  onDeleteColumn?: () => void;
  onDeleteRow?: () => void;
  onInsertColumnAfter?: () => void;
  onInsertColumnBefore?: () => void;
  onInsertRowAfter?: () => void;
  onInsertRowBefore?: () => void;
  onMerge?: () => void;
  onSplit?: () => void;
}) {
  return (
    <PressedPopoverContent
      size="menu"
      className="w-auto max-w-[80vw] p-1 print:hidden"
      contentEditable={false}
      onOpenAutoFocus={(e) => e.preventDefault()}
      {...props}
    >
      <Toolbar
        className="scrollbar-hide flex w-auto flex-row overflow-x-auto"
        contentEditable={false}
      >
        <ToolbarGroup>
          <ColorDropdownMenu tooltip={__('Background color', 'pressedmail')}>
            <PaintBucketIcon />
          </ColorDropdownMenu>
          {canMerge && onMerge && (
            <ToolbarButton
              onClick={onMerge}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Merge cells', 'pressedmail')}
            >
              <CombineIcon />
            </ToolbarButton>
          )}
          {canSplit && onSplit && (
            <ToolbarButton
              onClick={onSplit}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Split cell', 'pressedmail')}
            >
              <SquareSplitHorizontalIcon />
            </ToolbarButton>
          )}

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger asChild>
              <ToolbarButton tooltip={__('Cell borders', 'pressedmail')}>
                <Grid2X2Icon />
              </ToolbarButton>
            </DropdownMenuTrigger>

            <DropdownMenuPortal>
              <TableBordersDropdownMenuContent />
            </DropdownMenuPortal>
          </DropdownMenu>

          {collapsedInside && (
            <ToolbarGroup>
              <ToolbarButton
                tooltip={__('Delete table', 'pressedmail')}
                {...buttonProps}
              >
                <Trash2Icon />
              </ToolbarButton>
            </ToolbarGroup>
          )}
        </ToolbarGroup>

        {collapsedInside && (
          <ToolbarGroup>
            <ToolbarButton
              onClick={onInsertRowBefore}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Insert row before', 'pressedmail')}
            >
              <ArrowUp />
            </ToolbarButton>
            <ToolbarButton
              onClick={onInsertRowAfter}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Insert row after', 'pressedmail')}
            >
              <ArrowDown />
            </ToolbarButton>
            <ToolbarButton
              onClick={onDeleteRow}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Delete row', 'pressedmail')}
            >
              <XIcon />
            </ToolbarButton>
          </ToolbarGroup>
        )}

        {collapsedInside && (
          <ToolbarGroup>
            <ToolbarButton
              onClick={onInsertColumnBefore}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Insert column before', 'pressedmail')}
            >
              <ArrowLeft />
            </ToolbarButton>
            <ToolbarButton
              onClick={onInsertColumnAfter}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Insert column after', 'pressedmail')}
            >
              <ArrowRight />
            </ToolbarButton>
            <ToolbarButton
              onClick={onDeleteColumn}
              onMouseDown={(e) => e.preventDefault()}
              tooltip={__('Delete column', 'pressedmail')}
            >
              <XIcon />
            </ToolbarButton>
          </ToolbarGroup>
        )}
      </Toolbar>
    </PressedPopoverContent>
  );
}

function getTableCellBorderTargets(
  editor: SlateEditor,
  cellPath: number[],
  side: TableBorderSide
) {
  const entries = getTableEntries(editor, { at: cellPath });
  if (!entries) return [];

  const cell = entries.cell[0] as TTableCellElement;
  const table = entries.table[0] as TTableElement;
  const start = getCellIndices(editor, cell);
  const end = getCellIndicesWithSpans(start, cell);
  const targets: Array<{
    node: TTableCellElement;
    path: number[];
    side: TableBorderSide;
  }> = [];
  const seen = new Set<TTableCellElement>();
  const addTarget = (node: TTableCellElement, targetSide: TableBorderSide) => {
    if (seen.has(node)) return;
    const path = editor.api.findPath(node);
    if (!path) return;
    seen.add(node);
    targets.push({ node, path, side: targetSide });
  };

  if (side === 'top' && start.row > 0) {
    for (let column = start.col; column <= end.col; column++) {
      const neighbor = findCellByIndexes(editor, table, start.row - 1, column);
      if (neighbor) addTarget(neighbor, 'bottom');
    }
    return targets;
  }

  if (side === 'left' && start.col > 0) {
    for (let row = start.row; row <= end.row; row++) {
      const neighbor = findCellByIndexes(editor, table, row, start.col - 1);
      if (neighbor) addTarget(neighbor, 'right');
    }
    return targets;
  }

  addTarget(cell, side);
  return targets;
}

function isCellOnSelectionPerimeter(
  editor: SlateEditor,
  cell: TTableCellElement,
  side: TableBorderSide,
  bounds: ReturnType<typeof getSelectedCellsBoundingBox>
) {
  const start = getCellIndices(editor, cell);
  const end = getCellIndicesWithSpans(start, cell);

  switch (side) {
    case 'top':
      return start.row === bounds.minRow;
    case 'right':
      return end.col === bounds.maxCol;
    case 'bottom':
      return end.row === bounds.maxRow;
    case 'left':
      return start.col === bounds.minCol;
  }
}

function getSelectedTableBorderTargets(
  editor: SlateEditor,
  cells: TTableCellElement[],
  side: TableBorderSide,
  perimeterOnly: boolean
) {
  const bounds = getSelectedCellsBoundingBox(editor, cells);
  const targets = new Map<
    string,
    ReturnType<typeof getTableCellBorderTargets>[number]
  >();

  cells.forEach((cell) => {
    if (
      perimeterOnly &&
      !isCellOnSelectionPerimeter(editor, cell, side, bounds)
    ) {
      return;
    }

    const path = editor.api.findPath(cell);
    if (!path) return;

    getTableCellBorderTargets(editor, path, side).forEach((target) => {
      targets.set(`${target.path.join('.')}:${target.side}`, target);
    });
  });

  return [...targets.values()];
}

function updateSelectedTableBorderSide(
  editor: SlateEditor,
  cells: TTableCellElement[],
  side: TableBorderSide,
  patch: Partial<NonNullable<TableCellBorders[TableBorderSide]>>,
  perimeterOnly: boolean
) {
  const targets = getSelectedTableBorderTargets(
    editor,
    cells,
    side,
    perimeterOnly
  );

  updateTableBorderTargets(editor, targets, patch);
}

function updateTableBorderTargets(
  editor: SlateEditor,
  targets: ReturnType<typeof getTableCellBorderTargets>,
  patch: Partial<NonNullable<TableCellBorders[TableBorderSide]>>
) {
  editor.tf.withoutNormalizing(() => {
    targets.forEach(({ path, side: targetSide }) => {
      const entry = editor.api.node(path);
      if (!entry) return;
      const node = entry[0] as TTableCellElement;

      editor.tf.setNodes(
        {
          borders: {
            ...node.borders,
            [targetSide]: { ...node.borders?.[targetSide], ...patch },
          },
        },
        { at: path }
      );
    });
  });
}

export function setTableBorderSideVisibility(
  editor: SlateEditor,
  side: TableBorderSide,
  visible: boolean
) {
  updateTableBorderSide(editor, side, { size: visible ? 1 : 0 });
}

export function updateTableBorderSide(
  editor: SlateEditor,
  side: TableBorderSide,
  patch: Partial<NonNullable<TableCellBorders[TableBorderSide]>>
) {
  const cells = getSelectedTableCells(editor);
  updateSelectedTableBorderSide(editor, cells, side, patch, true);
}

function getSelectedTableCells(editor: SlateEditor): TTableCellElement[] {
  const selectedCells = editor.getApi(TablePlugin).table.getSelectedCells();
  if (selectedCells?.length) return selectedCells;

  const currentCell = editor.api.block({
    match: { type: getCellTypes(editor) },
  });

  return currentCell ? [currentCell[0] as TTableCellElement] : [];
}

export function setTableBorderPreset(
  editor: SlateEditor,
  preset: 'none' | 'outer',
  enabled: boolean
) {
  const cells = getSelectedTableCells(editor);
  const targets = TABLE_BORDER_SIDES.flatMap((side) =>
    getSelectedTableBorderTargets(editor, cells, side, preset === 'outer')
  );
  const size = preset === 'none' ? (enabled ? 0 : 1) : enabled ? 1 : 0;

  updateTableBorderTargets(editor, targets, { size });
}

function hasTableBorderPreset(editor: SlateEditor, preset: 'none' | 'outer') {
  const cells = getSelectedTableCells(editor);
  const targets = TABLE_BORDER_SIDES.flatMap((side) =>
    getSelectedTableBorderTargets(editor, cells, side, preset === 'outer')
  );

  if (targets.length === 0) return false;

  return targets.every(({ node, side }) => {
    const size = node.borders?.[side]?.size ?? 1;
    return preset === 'none' ? size === 0 : size > 0;
  });
}

export function isTableBorderSideVisible(
  editor: SlateEditor,
  side: TableBorderSide
) {
  const targets = getSelectedTableBorderTargets(
    editor,
    getSelectedTableCells(editor),
    side,
    true
  );

  return (
    targets.length > 0 &&
    targets.every(({ node, side: targetSide }) => {
      return (node.borders?.[targetSide]?.size ?? 1) > 0;
    })
  );
}

function useTableBorderSideVisible(side: TableBorderSide) {
  return useEditorSelector(
    (editor) => isTableBorderSideVisible(editor, side),
    [side]
  );
}

function useTableBorderPreset(preset: 'none' | 'outer') {
  return useEditorSelector(
    (editor) => hasTableBorderPreset(editor, preset),
    [preset]
  );
}

export function updateTableBorderColor(editor: SlateEditor, color: string) {
  const cells = getSelectedTableCells(editor);
  const targets = TABLE_BORDER_SIDES.flatMap((side) =>
    getSelectedTableBorderTargets(editor, cells, side, false)
  );

  updateTableBorderTargets(editor, targets, { color });
}

function getTableBorderSideLabel(side: TableBorderSide) {
  switch (side) {
    case 'top':
      return __('Top border', 'pressedmail');
    case 'right':
      return __('Right border', 'pressedmail');
    case 'bottom':
      return __('Bottom border', 'pressedmail');
    case 'left':
      return __('Left border', 'pressedmail');
  }
}

function getTableBorderSidePresentation(
  editor: SlateEditor,
  side: TableBorderSide
) {
  const borders = getSelectedTableBorderTargets(
    editor,
    getSelectedTableCells(editor),
    side,
    true
  ).map(({ node, side: targetSide }) => node.borders?.[targetSide]);
  const sharedValue = <T,>(
    getValue: (border: (typeof borders)[number]) => T
  ) => {
    if (borders.length === 0) return undefined;

    const first = getValue(borders[0]);
    return borders.every((border) => getValue(border) === first)
      ? first
      : undefined;
  };

  return {
    color: sharedValue((border) => border?.color ?? TABLE_BORDER_DEFAULT_COLOR),
    size: sharedValue((border) => border?.size ?? 1),
    style: sharedValue((border) => border?.style ?? 'solid'),
  };
}

export function TableBorderSideMenuItems({
  editor,
  side,
}: {
  editor: SlateEditor;
  side: TableBorderSide;
}) {
  const [, refresh] = React.useReducer((value) => value + 1, 0);
  const label = getTableBorderSideLabel(side);
  const presentation = getTableBorderSidePresentation(editor, side);
  const update = React.useCallback(
    (patch: Partial<NonNullable<TableCellBorders[TableBorderSide]>>) => {
      updateTableBorderSide(editor, side, patch);
      refresh();
    },
    [editor, side]
  );

  return (
    <>
      <ToolbarMenuGroup label={`${label} ${__('color', 'pressedmail')}`}>
        <ColorDropdownMenuItems
          ariaLabelPrefix={`${label} ${__('color', 'pressedmail')}`}
          className="px-2 pb-2"
          colors={getBorderColors()}
          keepOpen
          updateColor={(color) => update({ color })}
        />
      </ToolbarMenuGroup>

      <ToolbarMenuGroup
        aria-label={`${label} ${__('style', 'pressedmail')}`}
        label={`${label} ${__('style', 'pressedmail')}`}
        onValueChange={(style) => update({ style })}
        value={presentation.style}
      >
        {getBorderStyles().map(({ label: styleLabel, value }) => (
          <DropdownMenuRadioItem
            key={value}
            onSelect={(event) => event.preventDefault()}
            value={value}
          >
            {styleLabel}
          </DropdownMenuRadioItem>
        ))}
      </ToolbarMenuGroup>

      <ToolbarMenuGroup
        aria-label={`${label} ${__('size', 'pressedmail')}`}
        label={`${label} ${__('size', 'pressedmail')}`}
        onValueChange={(size) => update({ size: Number(size) })}
        value={presentation.size?.toString()}
      >
        {BORDER_SIZES.map((size) => (
          <DropdownMenuRadioItem
            key={size}
            onSelect={(event) => event.preventDefault()}
            value={size.toString()}
          >
            {sprintf(
              /* translators: %d: border width in pixels. */
              __('%d px', 'pressedmail'),
              size,
            )}
          </DropdownMenuRadioItem>
        ))}
      </ToolbarMenuGroup>
    </>
  );
}

function TableBorderSideIcon({ side }: { side: TableBorderSide }) {
  switch (side) {
    case 'top':
      return <BorderTopIcon />;
    case 'right':
      return <BorderRightIcon />;
    case 'bottom':
      return <BorderBottomIcon />;
    case 'left':
      return <BorderLeftIcon />;
  }
}

function TableBordersDropdownMenuContent(
  props: React.ComponentProps<typeof DropdownMenuContent>
) {
  const editor = useEditorRef();
  const hasTopBorder = useTableBorderSideVisible('top');
  const hasRightBorder = useTableBorderSideVisible('right');
  const hasBottomBorder = useTableBorderSideVisible('bottom');
  const hasLeftBorder = useTableBorderSideVisible('left');
  const hasNoBorders = useTableBorderPreset('none');
  const hasOuterBorders = useTableBorderPreset('outer');

  const getOnCheckedChange = React.useCallback(
    (side: TableBorderSide) => (checked: boolean | 'indeterminate') => {
      setTableBorderSideVisibility(editor, side, checked === true);
    },
    [editor]
  );

  const getOnPresetCheckedChange = React.useCallback(
    (preset: 'none' | 'outer') => (checked: boolean | 'indeterminate') => {
      setTableBorderPreset(editor, preset, checked === true);
    },
    [editor]
  );

  const updateBorderColor = React.useCallback(
    (color: string) => {
      updateTableBorderColor(editor, color);
    },
    [editor]
  );

  return (
    <DropdownMenuContent
      align="start"
      className="min-w-[220px]"
      onCloseAutoFocus={(e) => {
        e.preventDefault();
        editor.tf.focus();
      }}
      side="right"
      sideOffset={0}
      {...props}
    >
      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem
          checked={hasTopBorder}
          onCheckedChange={getOnCheckedChange('top')}
        >
          <BorderTopIcon />
          <div>{__('Top Border', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasRightBorder}
          onCheckedChange={getOnCheckedChange('right')}
        >
          <BorderRightIcon />
          <div>{__('Right Border', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasBottomBorder}
          onCheckedChange={getOnCheckedChange('bottom')}
        >
          <BorderBottomIcon />
          <div>{__('Bottom Border', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasLeftBorder}
          onCheckedChange={getOnCheckedChange('left')}
        >
          <BorderLeftIcon />
          <div>{__('Left Border', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        <DropdownMenuCheckboxItem
          checked={hasNoBorders}
          onCheckedChange={getOnPresetCheckedChange('none')}
        >
          <BorderNoneIcon />
          <div>{__('No Border', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={hasOuterBorders}
          onCheckedChange={getOnPresetCheckedChange('outer')}
        >
          <BorderAllIcon />
          <div>{__('Outside Borders', 'pressedmail')}</div>
        </DropdownMenuCheckboxItem>
      </DropdownMenuGroup>

      <DropdownMenuGroup>
        {TABLE_BORDER_SIDES.map((side) => {
          const label = getTableBorderSideLabel(side);

          return (
            <DropdownMenuSub key={side}>
              <DropdownMenuSubTrigger>
                <TableBorderSideIcon side={side} />
                <div>{`${label} ${__('settings', 'pressedmail')}`}</div>
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="min-w-[240px]">
                <TableBorderSideMenuItems editor={editor} side={side} />
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          );
        })}
      </DropdownMenuGroup>

      <ToolbarMenuGroup label={__('Border color', 'pressedmail')}>
        <ColorDropdownMenuItems
          className="px-2 pb-2"
          colors={getBorderColors()}
          updateColor={updateBorderColor}
        />
      </ToolbarMenuGroup>
    </DropdownMenuContent>
  );
}

function ColorDropdownMenu({
  children,
  tooltip,
}: {
  children: React.ReactNode;
  tooltip: string;
}) {
  const [open, setOpen] = React.useState(false);

  const editor = useEditorRef();

  const onUpdateColor = React.useCallback(
    (color: string) => {
      setOpen(false);
      setCellBackground(editor, {
        color,
        selectedCells:
          editor.getApi(TablePlugin).table.getSelectedCells() ?? [],
      });
    },
    [editor]
  );

  const onClearColor = React.useCallback(() => {
    setOpen(false);
    setCellBackground(editor, {
      color: null,
      selectedCells: editor.getApi(TablePlugin).table.getSelectedCells() ?? [],
    });
  }, [editor]);

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open}>
      <DropdownMenuTrigger asChild>
        <ToolbarButton tooltip={tooltip}>{children}</ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="start">
        <ToolbarMenuGroup label={__('Colors', 'pressedmail')}>
          <ColorDropdownMenuItems
            className="px-2"
            colors={getDefaultColors()}
            updateColor={onUpdateColor}
          />
        </ToolbarMenuGroup>
        <DropdownMenuGroup>
          <DropdownMenuItem className="p-2" onClick={onClearColor}>
            <EraserIcon />
            <span>{__('Clear', 'pressedmail')}</span>
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function TableRowElement({
  children,
  ...props
}: PlateElementProps<TTableRowElement>) {
  const { element } = props;
  const readOnly = useReadOnly();
  const editor = useEditorRef();
  const rowIndex = useElementSelector(
    ([, path]) => path[path.length - 1] as number,
    [],
    {
      key: KEYS.tr,
    }
  );
  const rowSize = useElementSelector(
    ([node]) => (node as TTableRowElement).size,
    [],
    {
      key: KEYS.tr,
    }
  );
  const rowSizeOverrides = useTableValue('rowSizeOverrides');
  const rowMinHeight = rowSizeOverrides.get?.(rowIndex) ?? rowSize;
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    'isSelectionAreaVisible'
  );
  const hasControls = !readOnly && !isSelectionAreaVisible;

  const { isDragging, nodeRef, previewRef, handleRef } = useDraggable({
    element,
    type: element.type,
    canDropNode: ({ dragEntry, dropEntry }) =>
      PathApi.equals(
        PathApi.parent(dragEntry[1]),
        PathApi.parent(dropEntry[1])
      ),
    onDropHandler: (_, { dragItem }) => {
      const dragElement = (dragItem as { element: TElement }).element;

      if (dragElement) {
        editor.tf.select(dragElement);
      }
    },
  });

  return (
    <PlateElement
      {...props}
      as="tr"
      className={cn('group/row', isDragging && 'opacity-50')}
      ref={useComposedRef(props.ref, previewRef, nodeRef)}
      style={
        {
          ...props.style,
          '--tableRowMinHeight': rowMinHeight ? `${rowMinHeight}px` : undefined,
        } as React.CSSProperties
      }
    >
      {hasControls && (
        <td
          className="w-2 min-w-2 max-w-2 select-none p-0"
          contentEditable={false}
        >
          <RowDragHandle dragRef={handleRef} />
          <RowDropLine />
        </td>
      )}

      {children}
    </PlateElement>
  );
}

function useTableCellPresentation(element: TTableCellElement) {
  const { api } = useEditorPlugin(TablePlugin);
  const borders = useTableCellBorders({ element });
  const { col, row } = useCellIndices();

  const colSpan = api.table.getColSpan(element);
  const rowSpan = api.table.getRowSpan(element);

  return {
    borders,
    colIndex: col + colSpan - 1,
    colSpan,
    rowIndex: row + rowSpan - 1,
    rowSpan,
  };
}

function RowDragHandle({ dragRef }: { dragRef: React.Ref<any> }) {
  const editor = useEditorRef();
  const element = useElement();

  return (
    <Button
      className={cn(
        'absolute top-1/2 left-0 z-51 h-6 w-4 -translate-y-1/2 p-0',
        'cursor-grab active:cursor-grabbing',
        'opacity-0 transition-opacity duration-100 group-hover/row:opacity-100 focus-visible:opacity-100 group-data-[table-resizing=true]/row:opacity-0'
      )}
      aria-label={__('Move or select row', 'pressedmail')}
      onClick={() => {
        editor.tf.select(element);
      }}
      ref={dragRef}
      variant="outline"
    >
      <GripVertical className="text-muted-foreground" />
    </Button>
  );
}

function RowDropLine() {
  const { dropLine } = useDropLine();

  if (!dropLine) return null;

  return (
    <div
      className={cn(
        'absolute inset-x-0 left-2 z-50 h-0.5 bg-primary/50',
        dropLine === 'top' ? '-top-px' : '-bottom-px'
      )}
    />
  );
}

export function TableCellElement({
  isHeader,
  ...props
}: PlateElementProps<TTableCellElement> & {
  isHeader?: boolean;
}) {
  const readOnly = useReadOnly();
  const element = props.element;

  const tableId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.table,
  });
  const rowId = useElementSelector(([node]) => node.id as string, [], {
    key: KEYS.tr,
  });
  const isSelectingTable = useBlockSelected(tableId);
  const isSelectingRow = useBlockSelected(rowId) || isSelectingTable;
  const isSelectionAreaVisible = usePluginOption(
    BlockSelectionPlugin,
    'isSelectionAreaVisible'
  );

  const { borders, colIndex, colSpan, rowIndex, rowSpan } =
    useTableCellPresentation(element);

  return (
    <PlateElement
      {...props}
      as={isHeader ? 'th' : 'td'}
      attributes={{
        ...props.attributes,
        colSpan,
        'data-table-cell-id': element.id,
        rowSpan,
      }}
      className={cn(
        'relative h-full overflow-visible border-none p-0',
        element.background ? 'bg-[var(--cellBackground)]' : undefined,
        isHeader && 'text-left *:m-0',
        'before:size-full',
        'data-[table-cell-selected=true]:before:z-10',
        'data-[table-cell-selected=true]:before:bg-primary/5',
        "before:absolute before:box-border before:select-none before:content-['']"
      )}
      style={
        {
          '--cellBackground': element.background,
          ...getTableCellBorderStyles(
            borders as TableCellBorders | undefined,
            false
          ),
        } as React.CSSProperties
      }
    >
      <div
        className="relative z-20 box-border h-full px-3 py-2"
        style={
          rowSpan === 1
            ? { minHeight: 'var(--tableRowMinHeight, 0px)' }
            : undefined
        }
      >
        {props.children}
      </div>

      {!readOnly && !isSelectionAreaVisible && (
        <TableCellResizeControls colIndex={colIndex} rowIndex={rowIndex} />
      )}

      {isSelectingRow && (
        <div className={blockSelectionVariants()} contentEditable={false} />
      )}
    </PlateElement>
  );
}

export function TableCellHeaderElement(
  props: React.ComponentProps<typeof TableCellElement>
) {
  return <TableCellElement {...props} isHeader />;
}

const TableCellResizeControls = React.memo(function TableCellResizeControls({
  colIndex,
  rowIndex,
}: {
  colIndex: number;
  rowIndex: number;
}) {
  const {
    clearResizePreview,
    disableMarginLeft,
    setResizePreview,
    startResize,
  } = useTableResizeContext();
  const rightHandleKey = `right:${rowIndex}:${colIndex}`;
  const bottomHandleKey = `bottom:${rowIndex}:${colIndex}`;
  const leftHandleKey = `left:${rowIndex}:${colIndex}`;
  const isLeftHandle = colIndex === 0 && !disableMarginLeft;

  return (
    <div
      className="group/resize pointer-events-none absolute inset-0 z-30 select-none"
      contentEditable={false}
      suppressContentEditableWarning={true}
    >
      <div
        className="pointer-events-auto absolute -top-2 -right-1 z-40 h-[calc(100%_+_8px)] w-2 cursor-col-resize touch-none"
        onPointerDown={(event) => {
          startResize(event, {
            colIndex,
            direction: 'right',
            handleKey: rightHandleKey,
            rowIndex,
          });
        }}
        onPointerEnter={(event) => {
          setResizePreview(event, {
            colIndex,
            direction: 'right',
            handleKey: rightHandleKey,
            rowIndex,
          });
        }}
        onPointerLeave={() => {
          clearResizePreview(rightHandleKey);
        }}
      />
      <div
        className="pointer-events-auto absolute -bottom-1 left-0 z-40 h-2 w-full cursor-row-resize touch-none"
        onPointerDown={(event) => {
          startResize(event, {
            colIndex,
            direction: 'bottom',
            handleKey: bottomHandleKey,
            rowIndex,
          });
        }}
        onPointerEnter={(event) => {
          setResizePreview(event, {
            colIndex,
            direction: 'bottom',
            handleKey: bottomHandleKey,
            rowIndex,
          });
        }}
        onPointerLeave={() => {
          clearResizePreview(bottomHandleKey);
        }}
      />
      {isLeftHandle && (
        <div
          className="pointer-events-auto absolute top-0 -left-1 z-40 h-full w-2 cursor-col-resize touch-none"
          onPointerDown={(event) => {
            startResize(event, {
              colIndex,
              direction: 'left',
              handleKey: leftHandleKey,
              rowIndex,
            });
          }}
          onPointerEnter={(event) => {
            setResizePreview(event, {
              colIndex,
              direction: 'left',
              handleKey: leftHandleKey,
              rowIndex,
            });
          }}
          onPointerLeave={() => {
            clearResizePreview(leftHandleKey);
          }}
        />
      )}
    </div>
  );
});

TableCellResizeControls.displayName = 'TableCellResizeControls';
