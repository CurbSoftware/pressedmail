/**
 * Preheader: hidden text that appears in email client inbox previews.
 * Uses display:none + zero height to hide from the rendered email body.
 * Whitespace padding prevents email clients from pulling body content
 * into the preview.
 */
export default function save({ attributes }) {
  const { text } = attributes;

  if (!text) {
    return null;
  }

  // Zero-width spaces + non-breaking spaces to pad out the preview.
  const padding = "\u200C\u00A0".repeat(80);

  return (
    <div
      style={{
        display: "none",
        maxHeight: 0,
        overflow: "hidden",
        fontSize: "1px",
        lineHeight: "1px",
        color: "#ffffff",
      }}>
      {text}
      {padding}
    </div>
  );
}
