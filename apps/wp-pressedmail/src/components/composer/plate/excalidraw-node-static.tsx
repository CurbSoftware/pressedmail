import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';
import { __ } from '@wordpress/i18n';

/**
 * Email-safe static drawing. The interactive component stores a PNG snapshot of
 * the scene on `element.png`; email emits it as an <img>. If no snapshot exists
 * yet, a small placeholder is shown (the scene data itself can't be rendered at
 * serialize time without the canvas library).
 */
export function ExcalidrawElementStatic(props: SlateElementProps) {
  const png = (props.element as { png?: string }).png;

  return (
    <SlateElement {...props}>
      <div style={{ margin: '8px 0', textAlign: 'center' }}>
        {png ? (
          <img
            alt={__('Drawing', 'pressedmail')}
            src={png}
            style={{ maxWidth: '100%', height: 'auto' }}
          />
        ) : (
          <span style={{ color: '#888', fontStyle: 'italic' }}>
            {__('[Drawing]', 'pressedmail')}
          </span>
        )}
      </div>
      {props.children}
    </SlateElement>
  );
}
