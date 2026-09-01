/**
 * Bulletproof email button using table-based layout.
 * Works across all major email clients including Outlook.
 */
export default function save({ attributes }) {
  const {
    text,
    url,
    backgroundColor,
    textColor,
    borderRadius,
    fontSize,
    paddingVertical,
    paddingHorizontal,
    align,
  } = attributes;

  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      style={{ width: "100%" }}>
      <tbody>
        <tr>
          <td style={{ textAlign: align }}>
            <table
              role="presentation"
              cellPadding="0"
              cellSpacing="0"
              style={{ display: "inline-table" }}>
              <tbody>
                <tr>
                  <td
                    style={{
                      backgroundColor,
                      borderRadius: `${borderRadius}px`,
                      textAlign: "center",
                    }}>
                    <a
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        backgroundColor,
                        color: textColor,
                        fontSize: `${fontSize}px`,
                        fontFamily: "Arial, Helvetica, sans-serif",
                        fontWeight: "bold",
                        textDecoration: "none",
                        padding: `${paddingVertical}px ${paddingHorizontal}px`,
                        borderRadius: `${borderRadius}px`,
                        display: "inline-block",
                      }}>
                      {text}
                    </a>
                  </td>
                </tr>
              </tbody>
            </table>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
