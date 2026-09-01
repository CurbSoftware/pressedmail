import { __ } from "@wordpress/i18n";
import {
  useBlockProps,
  InspectorControls,
  useInnerBlocksProps,
} from "@wordpress/block-editor";
import { PanelBody, RangeControl } from "@wordpress/components";
import { useEffect } from "@wordpress/element";
import { useSelect, useDispatch } from "@wordpress/data";

function getColumnWidths(count) {
  const pct = Math.floor(100 / count);
  return Array.from({ length: count }, () => `${pct}%`);
}

export default function Edit({ attributes, setAttributes, clientId }) {
  const { columns } = attributes;
  const blockProps = useBlockProps();

  const { replaceInnerBlocks } = useDispatch("core/block-editor");
  const { createBlock } = wp.blocks;
  const innerBlockCount = useSelect(
    (select) =>
      select("core/block-editor").getBlock(clientId)?.innerBlocks?.length ?? 0,
    [clientId],
  );

  // Sync inner blocks when column count changes.
  useEffect(() => {
    if (innerBlockCount !== columns) {
      const widths = getColumnWidths(columns);
      const blocks = widths.map((w) =>
        createBlock("pressedmail/email-column", { width: w }),
      );
      replaceInnerBlocks(clientId, blocks, false);
    }
  }, [clientId, columns, createBlock, innerBlockCount, replaceInnerBlocks]);

  const innerBlocksProps = useInnerBlocksProps(blockProps, {
    allowedBlocks: ["pressedmail/email-column"],
    orientation: "horizontal",
    renderAppender: false,
  });

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Column Settings", "pressedmail")}>
          <RangeControl
            label={__("Columns", "pressedmail")}
            value={columns}
            onChange={(val) => setAttributes({ columns: val })}
            min={1}
            max={4}
          />
        </PanelBody>
      </InspectorControls>
      <div
        {...innerBlocksProps}
        style={{
          display: "flex",
          gap: "10px",
        }}
      />
    </>
  );
}
