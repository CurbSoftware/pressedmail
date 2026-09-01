import type * as React from 'react';
import type { TTableCellElement, TTableElement } from '@kit/plate';
import { BaseTablePlugin } from '@kit/plate/table';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

import {
  getTableCellBorderStyles,
  type TableCellBorders,
} from './table-border-styles';

export function TableElementStatic({
  children,
  ...props
}: SlateElementProps<TTableElement>) {
  const { disableMarginLeft } = props.editor.getOptions(BaseTablePlugin);
  const marginLeft = disableMarginLeft ? 0 : props.element.marginLeft;

  return (
    <SlateElement
      {...props}
      style={{ paddingLeft: typeof marginLeft === 'number' ? marginLeft : 0 }}
    >
      <table
        style={{
          borderCollapse: 'collapse',
          margin: '8px 0',
          tableLayout: 'fixed',
          width: '100%',
        }}
      >
        <tbody>{children}</tbody>
      </table>
    </SlateElement>
  );
}

export function TableRowElementStatic(props: SlateElementProps) {
  return (
    <SlateElement {...props} as="tr">
      {props.children}
    </SlateElement>
  );
}

export function TableCellElementStatic({
  isHeader,
  ...props
}: SlateElementProps<TTableCellElement> & {
  isHeader?: boolean;
}) {
  const { editor, element } = props;
  const { api } = editor.getPlugin(BaseTablePlugin);
  const { minHeight, width } = api.table.getCellSize({ element });
  const backgroundColor = element.background || undefined;
  const borders = api.table.getCellBorders({ element });
  const borderStyles = getTableCellBorderStyles(
    borders as TableCellBorders | undefined,
    false
  );

  return (
    <SlateElement
      {...props}
      as={isHeader ? 'th' : 'td'}
      attributes={{
        ...props.attributes,
        colSpan: api.table.getColSpan(element),
        rowSpan: api.table.getRowSpan(element),
      }}
      style={
        {
          backgroundColor,
          ...borderStyles,
          fontWeight: isHeader ? 600 : undefined,
          maxWidth: width || 240,
          minHeight,
          minWidth: width || 120,
          padding: '6px 8px',
          textAlign: isHeader ? 'left' : undefined,
          verticalAlign: 'top',
        } as React.CSSProperties
      }
    >
      {props.children}
    </SlateElement>
  );
}

export function TableCellHeaderElementStatic(
  props: SlateElementProps<TTableCellElement>
) {
  return <TableCellElementStatic {...props} isHeader />;
}
