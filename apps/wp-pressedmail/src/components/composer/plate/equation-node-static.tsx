import type { TEquationElement } from '@kit/plate';
import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';
import { __ } from '@wordpress/i18n';

/**
 * Email-safe static equations. KaTeX HTML relies on its own stylesheet and
 * MathML support is inconsistent across email clients, so we serialize the
 * LaTeX source as readable monospace text instead (mirrors the playground's
 * DOCX-compatible equation variant). No external CSS dependency.
 */
export function EquationElementStatic(
  props: SlateElementProps<TEquationElement>,
) {
  const { element } = props;

  if (!element.texExpression) {
    return (
      <SlateElement {...props}>
        <p style={{ color: '#888', fontStyle: 'italic' }}>{__('[Empty equation]', 'pressedmail')}</p>
        {props.children}
      </SlateElement>
    );
  }

  return (
    <SlateElement {...props}>
      <p
        style={{
          fontFamily: 'Cambria Math, Consolas, monospace',
          fontSize: '12pt',
          margin: '8px 0',
          textAlign: 'center',
        }}
      >
        {element.texExpression}
      </p>
      {props.children}
    </SlateElement>
  );
}

export function InlineEquationElementStatic(
  props: SlateElementProps<TEquationElement>,
) {
  const { element } = props;

  return (
    <SlateElement {...props} as="span">
      <span style={{ fontFamily: 'Cambria Math, Consolas, monospace' }}>
        {element.texExpression || '[equation]'}
      </span>
      {props.children}
    </SlateElement>
  );
}
