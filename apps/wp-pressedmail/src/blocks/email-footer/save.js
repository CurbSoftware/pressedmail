import { RichText } from "@wordpress/block-editor";

export default function save({ attributes }) {
  const { content, showUnsubscribe, textColor, backgroundColor, fontSize } =
    attributes;

  const textStyle = {
    color: textColor,
    fontSize: `${fontSize}px`,
    fontFamily: "Arial, Helvetica, sans-serif",
    lineHeight: "1.5",
    margin: 0,
  };

  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      style={{
        width: "100%",
        backgroundColor: backgroundColor || undefined,
      }}>
      <tbody>
        <tr>
          <td
            style={{
              textAlign: "center",
              padding: "20px",
            }}>
            <RichText.Content
              tagName="div"
              className="pm-email-footer-content"
              style={textStyle}
              value={content}
            />
            {showUnsubscribe && (
              <p style={{ ...textStyle, marginTop: "10px" }}>
                <a
                  href="{{unsubscribe_url}}"
                  style={{
                    color: textColor,
                    textDecoration: "underline",
                  }}>
                  Unsubscribe
                </a>
              </p>
            )}
          </td>
        </tr>
      </tbody>
    </table>
  );
}
