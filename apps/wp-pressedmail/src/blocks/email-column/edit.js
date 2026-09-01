import { __ } from "@wordpress/i18n";
import {
  useBlockProps,
  InspectorControls,
  useInnerBlocksProps,
} from "@wordpress/block-editor";
import { PanelBody, SelectControl } from "@wordpress/components";

export default function Edit({ attributes, setAttributes }) {
  const { width, verticalAlign } = attributes;
  const blockProps = useBlockProps({
    style: {
      width,
      verticalAlign,
      flex: `0 0 ${width}`,
    },
  });

  const innerBlocksProps = useInnerBlocksProps(blockProps, {
    renderAppender: true,
  });

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Column Settings", "pressedmail")}>
          <SelectControl
            label={__("Vertical Alignment", "pressedmail")}
            value={verticalAlign}
            options={[
              { label: __("Top", "pressedmail"), value: "top" },
              {
                label: __("Middle", "pressedmail"),
                value: "middle",
              },
              {
                label: __("Bottom", "pressedmail"),
                value: "bottom",
              },
            ]}
            onChange={(val) => setAttributes({ verticalAlign: val })}
          />
        </PanelBody>
      </InspectorControls>
      <div {...innerBlocksProps} />
    </>
  );
}
