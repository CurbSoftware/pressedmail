export default function save({ attributes }) {
  const { color, height, width, align } = attributes;

  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      style={{ width: "100%" }}>
      <tbody>
        <tr>
          <td style={{ textAlign: align, padding: "10px 0" }}>
            <div
              style={{
                borderTop: `${height}px solid ${color}`,
                width,
                margin: align === "center" ? "0 auto" : 0,
                marginLeft: align === "right" ? "auto" : undefined,
                fontSize: "1px",
                lineHeight: "1px",
              }}>
              &nbsp;
            </div>
          </td>
        </tr>
      </tbody>
    </table>
  );
}
