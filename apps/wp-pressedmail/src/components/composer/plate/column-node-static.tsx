import type { TColumnElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

/**
 * Email-safe static columns. Email clients render flexbox unreliably, so the
 * column group serializes to a fixed-layout <table> and each column to a <td>
 * with an explicit width, all inline styles (survives stripClassNames).
 * Mirrors the playground's DOCX-compatible column variant.
 */
export function ColumnGroupElementStatic(props: SlateElementProps) {
  return (
    <SlateElement
      {...props}
      attributes={{ ...props.attributes, 'data-pm-block': 'column_group' }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: 'none',
          tableLayout: 'fixed',
        }}
      >
        <tbody>
          <tr>{props.children}</tr>
        </tbody>
      </table>
    </SlateElement>
  );
}

export function ColumnElementStatic(props: SlateElementProps<TColumnElement>) {
  const { width } = props.element;

  return (
    <SlateElement
      {...props}
      as="td"
      attributes={{
        ...props.attributes,
        'data-pm-block': 'column',
        ...(width ? { 'data-width': String(width) } : {}),
      }}
      style={{
        width: width ?? 'auto',
        verticalAlign: 'top',
        padding: '4px 8px',
        border: 'none',
      }}
    >
      {props.children}
    </SlateElement>
  );
}
