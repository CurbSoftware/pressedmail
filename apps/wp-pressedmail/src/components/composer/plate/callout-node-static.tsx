import type { SlateElementProps } from '@kit/plate/static';
import { SlateElement } from '@kit/plate/static';

const EMOJI_FONT_FAMILY =
  '"Apple Color Emoji", "Segoe UI Emoji", NotoColorEmoji, "Noto Color Emoji", "Segoe UI Symbol", "Android Emoji", EmojiSymbols';

/**
 * Email-safe static callout. Uses a table layout with fully inline styles so it
 * survives `serializeHtml({ stripClassNames: true })` and renders consistently
 * across email clients (which handle tables far better than flexbox).
 * Mirrors the playground's DOCX-compatible callout variant.
 */
export function CalloutElementStatic({ children, ...props }: SlateElementProps) {
  const backgroundColor =
    (props.element.backgroundColor as string) || '#f4f4f5';
  const icon = (props.element.icon as string) || '💡';

  return (
    <SlateElement
      {...props}
      attributes={{
        ...props.attributes,
        'data-pm-block': 'callout',
        ...(props.element.backgroundColor
          ? { 'data-background': String(props.element.backgroundColor) }
          : {}),
        ...(props.element.icon
          ? { 'data-icon': String(props.element.icon) }
          : {}),
      }}>
      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          border: 'none',
          backgroundColor,
          borderRadius: '4px',
          marginTop: '4px',
          marginBottom: '4px',
        }}
      >
        <tbody>
          <tr>
            <td
              style={{
                width: '30px',
                verticalAlign: 'top',
                padding: '8px 4px 8px 8px',
                border: 'none',
                fontSize: '18px',
                fontFamily: EMOJI_FONT_FAMILY,
              }}
            >
              <span>{icon}</span>
            </td>
            <td
              style={{
                verticalAlign: 'top',
                padding: '8px 8px 8px 4px',
                border: 'none',
              }}
            >
              {children}
            </td>
          </tr>
        </tbody>
      </table>
    </SlateElement>
  );
}
