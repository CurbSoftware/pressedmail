import { useBlockProps, InnerBlocks } from "@wordpress/block-editor";

export default function save() {
  return (
    <table
      role="presentation"
      cellPadding="0"
      cellSpacing="0"
      {...useBlockProps.save()}
      style={{ width: "100%" }}>
      <tbody>
        <tr>
          <InnerBlocks.Content />
        </tr>
      </tbody>
    </table>
  );
}
