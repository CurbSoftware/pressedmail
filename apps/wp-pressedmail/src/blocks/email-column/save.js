import { InnerBlocks } from "@wordpress/block-editor";

export default function save({ attributes }) {
  const { width, verticalAlign } = attributes;

  return (
    <td
      style={{
        width,
        verticalAlign,
        padding: "0 5px",
      }}>
      <InnerBlocks.Content />
    </td>
  );
}
