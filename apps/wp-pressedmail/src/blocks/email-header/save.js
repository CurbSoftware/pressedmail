/* eslint-disable @next/next/no-img-element -- WordPress email blocks emit raw email markup. */
export default function save({ attributes }) {
  const {
    logoUrl,
    logoAlt,
    logoWidth,
    align,
    backgroundColor,
    paddingVertical,
  } = attributes;

  if (!logoUrl) {
    return null;
  }

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
              textAlign: align,
              padding: `${paddingVertical}px 0`,
            }}>
            <img
              src={logoUrl}
              alt={logoAlt}
              width={logoWidth}
              style={{
                width: `${logoWidth}px`,
                height: "auto",
                border: 0,
                display: "inline-block",
              }}
            />
          </td>
        </tr>
      </tbody>
    </table>
  );
}
