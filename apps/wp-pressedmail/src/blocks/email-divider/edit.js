import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import {
  PanelBody,
  RangeControl,
  ColorPicker,
  SelectControl,
} from "@wordpress/components";

const WIDTH_OPTIONS = [
  { label: "100%", value: "100%" },
  { label: "80%", value: "80%" },
  { label: "60%", value: "60%" },
  { label: "40%", value: "40%" },
];

export default function Edit({ attributes, setAttributes }) {
  const { color, height, width, align } = attributes;
  const blockProps = useBlockProps();

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Divider Settings", "pressedmail")}>
          <SelectControl
            label={__("Width", "pressedmail")}
            value={width}
            options={WIDTH_OPTIONS}
            onChange={(val) => setAttributes({ width: val })}
          />
          <RangeControl
            label={__("Height (px)", "pressedmail")}
            value={height}
            onChange={(val) => setAttributes({ height: val })}
            min={1}
            max={10}
          />
          <SelectControl
            label={__("Alignment", "pressedmail")}
            value={align}
            options={[
              { label: __("Left", "pressedmail"), value: "left" },
              { label: __("Center", "pressedmail"), value: "center" },
              { label: __("Right", "pressedmail"), value: "right" },
            ]}
            onChange={(val) => setAttributes({ align: val })}
          />
        </PanelBody>
        <PanelBody title={__("Color", "pressedmail")} initialOpen={false}>
          <ColorPicker
            color={color}
            onChangeComplete={(val) => setAttributes({ color: val.hex })}
            disableAlpha
          />
        </PanelBody>
      </InspectorControls>
      <div {...blockProps} style={{ textAlign: align }}>
        <hr
          style={{
            border: "none",
            borderTop: `${height}px solid ${color}`,
            width,
            margin: align === "center" ? "0 auto" : 0,
            marginLeft: align === "right" ? "auto" : undefined,
          }}
        />
      </div>
    </>
  );
}
