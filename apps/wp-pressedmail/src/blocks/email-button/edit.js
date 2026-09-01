import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import {
  PanelBody,
  TextControl,
  RangeControl,
  ColorPicker,
  SelectControl,
} from "@wordpress/components";

export default function Edit({ attributes, setAttributes }) {
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

  const blockProps = useBlockProps();

  const buttonStyle = {
    backgroundColor,
    color: textColor,
    borderRadius: `${borderRadius}px`,
    fontSize: `${fontSize}px`,
    padding: `${paddingVertical}px ${paddingHorizontal}px`,
    textDecoration: "none",
    display: "inline-block",
    fontFamily: "Arial, Helvetica, sans-serif",
    fontWeight: "bold",
    textAlign: "center",
    border: "none",
    cursor: "pointer",
  };

  const wrapperStyle = {
    textAlign: align,
  };

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Button Settings", "pressedmail")}>
          <TextControl
            label={__("Button Text", "pressedmail")}
            value={text}
            onChange={(val) => setAttributes({ text: val })}
          />
          <TextControl
            label={__("URL", "pressedmail")}
            value={url}
            onChange={(val) => setAttributes({ url: val })}
            type="url"
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
        <PanelBody title={__("Style", "pressedmail")} initialOpen={false}>
          <RangeControl
            label={__("Font Size", "pressedmail")}
            value={fontSize}
            onChange={(val) => setAttributes({ fontSize: val })}
            min={10}
            max={32}
          />
          <RangeControl
            label={__("Border Radius", "pressedmail")}
            value={borderRadius}
            onChange={(val) => setAttributes({ borderRadius: val })}
            min={0}
            max={50}
          />
          <RangeControl
            label={__("Vertical Padding", "pressedmail")}
            value={paddingVertical}
            onChange={(val) => setAttributes({ paddingVertical: val })}
            min={4}
            max={40}
          />
          <RangeControl
            label={__("Horizontal Padding", "pressedmail")}
            value={paddingHorizontal}
            onChange={(val) => setAttributes({ paddingHorizontal: val })}
            min={8}
            max={60}
          />
        </PanelBody>
        <PanelBody title={__("Colors", "pressedmail")} initialOpen={false}>
          <p>{__("Background Color", "pressedmail")}</p>
          <ColorPicker
            color={backgroundColor}
            onChangeComplete={(val) =>
              setAttributes({ backgroundColor: val.hex })
            }
            disableAlpha
          />
          <p>{__("Text Color", "pressedmail")}</p>
          <ColorPicker
            color={textColor}
            onChangeComplete={(val) => setAttributes({ textColor: val.hex })}
            disableAlpha
          />
        </PanelBody>
      </InspectorControls>
      <div {...blockProps} style={wrapperStyle}>
        <span style={buttonStyle}>{text}</span>
      </div>
    </>
  );
}
