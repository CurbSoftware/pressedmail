'use client';

/**
 * Table dropdown (template table-toolbar-button.tsx port): grid picker plus
 * cell/row/column/table actions. Disabled styling uses the `disabled` prop
 * (the plugin DropdownMenu primitives already style disabled state) instead
 * of the template's `data-[disabled]:` arbitrary variants.
 */

import * as React from 'react';
import { TablePlugin, useTableMergeState } from '@kit/plate/table/react';
import type { DropdownMenuProps } from '@radix-ui/react-dropdown-menu';
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Combine,
  Grid3x3Icon,
  Table,
  Trash2Icon,
  Ungroup,
  XIcon,
} from 'lucide-react';
import { KEYS } from '@kit/plate';
import { useEditorPlugin, useEditorSelector } from '@kit/plate/react';

import { __ } from '@wordpress/i18n';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@kit/ui/plugin';

import { cn } from '@/lib/utils';
import {
  COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS,
  COMPOSER_TOOLBAR_ICON_CLASS,
  ToolbarButton,
} from '@/components/composer/toolbar';

export function TableToolbarButton(props: DropdownMenuProps) {
  const tableSelected = useEditorSelector(
    (editor) => editor.api.some({ match: { type: KEYS.table } }),
    [],
  );

  const { editor, tf } = useEditorPlugin(TablePlugin);
  const [open, setOpen] = React.useState(false);
  const mergeState = useTableMergeState();

  return (
    <DropdownMenu modal={false} onOpenChange={setOpen} open={open} {...props}>
      <DropdownMenuTrigger
        asChild
        className={COMPOSER_TOOLBAR_DROPDOWN_BUTTON_CLASS}
      >
        <ToolbarButton
          isDropdown
          pressed={open}
          tooltip={__('Table', 'pressedmail')}
        >
          <Table className={COMPOSER_TOOLBAR_ICON_CLASS} />
        </ToolbarButton>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        align="start"
        className="flex w-[180px] min-w-0 flex-col"
      >
        <DropdownMenuGroup>
          <DropdownMenuItem
            className="min-w-[180px] gap-2"
            onSelect={() => {
              tf.insert.table({ colCount: 2, rowCount: 2 }, { select: true });
              editor.tf.focus();
            }}
          >
            <Grid3x3Icon className="size-4" />
            <span>{__('Insert 2 x 2 table', 'pressedmail')}</span>
          </DropdownMenuItem>
          <DropdownMenuItem
            className="min-w-[180px] gap-2"
            onSelect={() => {
              tf.insert.table({ colCount: 3, rowCount: 3 }, { select: true });
              editor.tf.focus();
            }}
          >
            <Grid3x3Icon className="size-4" />
            <span>{__('Insert 3 x 3 table', 'pressedmail')}</span>
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className="gap-2">
              <Grid3x3Icon className="size-4" />
              <span>{__('Table', 'pressedmail')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="m-0 p-0">
              <TablePicker />
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                'gap-2',
                !tableSelected && 'pointer-events-none opacity-50',
              )}
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>{__('Cell', 'pressedmail')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canMerge}
                onSelect={() => {
                  tf.table.merge();
                  editor.tf.focus();
                }}
              >
                <Combine />
                {__('Merge cells', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!mergeState.canSplit}
                onSelect={() => {
                  tf.table.split();
                  editor.tf.focus();
                }}
              >
                <Ungroup />
                {__('Split cell', 'pressedmail')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                'gap-2',
                !tableSelected && 'pointer-events-none opacity-50',
              )}
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>{__('Row', 'pressedmail')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowUp />
                {__('Insert row before', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableRow();
                  editor.tf.focus();
                }}
              >
                <ArrowDown />
                {__('Insert row after', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableRow();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                {__('Delete row', 'pressedmail')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSub>
            <DropdownMenuSubTrigger
              className={cn(
                'gap-2',
                !tableSelected && 'pointer-events-none opacity-50',
              )}
              disabled={!tableSelected}
            >
              <div className="size-4" />
              <span>{__('Column', 'pressedmail')}</span>
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn({ before: true });
                  editor.tf.focus();
                }}
              >
                <ArrowLeft />
                {__('Insert column before', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.insert.tableColumn();
                  editor.tf.focus();
                }}
              >
                <ArrowRight />
                {__('Insert column after', 'pressedmail')}
              </DropdownMenuItem>
              <DropdownMenuItem
                className="min-w-[180px]"
                disabled={!tableSelected}
                onSelect={() => {
                  tf.remove.tableColumn();
                  editor.tf.focus();
                }}
              >
                <XIcon />
                {__('Delete column', 'pressedmail')}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuItem
            className="min-w-[180px]"
            disabled={!tableSelected}
            onSelect={() => {
              tf.remove.table();
              editor.tf.focus();
            }}
          >
            <Trash2Icon />
            {__('Delete table', 'pressedmail')}
          </DropdownMenuItem>
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function TablePicker() {
  const { editor, tf } = useEditorPlugin(TablePlugin);

  const [tablePicker, setTablePicker] = React.useState<{
    grid: number[][];
    size: { colCount: number; rowCount: number };
  }>({
    grid: Array.from({ length: 8 }, () =>
      Array.from({ length: 8 }, () => 0),
    ),
    size: { colCount: 0, rowCount: 0 },
  });

  const onCellMove = (rowIndex: number, colIndex: number) => {
    const newGrid = tablePicker.grid.map((row, i) =>
      row.map((_, j) => (i <= rowIndex && j <= colIndex ? 1 : 0)),
    );

    setTablePicker({
      grid: newGrid,
      size: { colCount: colIndex + 1, rowCount: rowIndex + 1 },
    });
  };

  return (
    <div
      className="m-0 flex flex-col p-0"
      onClick={() => {
        const size =
          tablePicker.size.rowCount > 0 && tablePicker.size.colCount > 0
            ? tablePicker.size
            : { colCount: 2, rowCount: 2 };
        tf.insert.table(size, { select: true });
        editor.tf.focus();
      }}
      role="button"
    >
      <div className="grid size-[130px] grid-cols-8 gap-0.5 p-1">
        {tablePicker.grid.map((rows, rowIndex) =>
          rows.map((value, columIndex) => (
            <div
              className={cn(
                'col-span-1 size-3 border border-solid bg-secondary',
                !!value && 'border-current',
              )}
              key={`(${rowIndex},${columIndex})`}
              onMouseMove={() => {
                onCellMove(rowIndex, columIndex);
              }}
            />
          )),
        )}
      </div>

      <div className="text-center text-xs text-current">
        {tablePicker.size.rowCount} x {tablePicker.size.colCount}
      </div>
    </div>
  );
}
