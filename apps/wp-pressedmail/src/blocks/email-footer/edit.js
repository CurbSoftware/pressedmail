import { __ } from "@wordpress/i18n";
import {
  useBlockProps,
  InspectorControls,
  RichText,
} from "@wordpress/block-editor";
import {
  PanelBody,
  RangeControl,
  ToggleControl,
  ColorPicker,
} from "@wordpress/components";

export default function Edit({ attributes, setAttributes }) {
  const { content, showUnsubscribe, textColor, backgroundColor, fontSize } =
    attributes;

  const blockProps = useBlockProps();

  const wrapperStyle = {
    backgroundColor: backgroundColor || undefined,
    padding: "20px",
    textAlign: "center",
  };

  const textStyle = {
    color: textColor,
    fontSize: `${fontSize}px`,
    fontFamily: "Arial, Helvetica, sans-serif",
    lineHeight: "1.5",
  };

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Footer Settings", "pressedmail")}>
          <ToggleControl
            label={__("Show Unsubscribe Link", "pressedmail")}
            checked={showUnsubscribe}
            onChange={(val) => setAttributes({ showUnsubscribe: val })}
          />
          <RangeControl
            label={__("Font Size", "pressedmail")}
            value={fontSize}
            onChange={(val) => setAttributes({ fontSize: val })}
            min={8}
            max={20}
          />
        </PanelBody>
        <PanelBody title={__("Colors", "pressedmail")} initialOpen={false}>
          <p>{__("Text Color", "pressedmail")}</p>
          <ColorPicker
            color={textColor}
            onChangeComplete={(val) => setAttributes({ textColor: val.hex })}
            disableAlpha
          />
          <p>{__("Background Color", "pressedmail")}</p>
          <ColorPicker
            color={backgroundColor}
            onChangeComplete={(val) =>
              setAttributes({ backgroundColor: val.hex })
            }
            disableAlpha
          />
        </PanelBody>
      </InspectorControls>
      <div {...blockProps} style={wrapperStyle}>
        <RichText
          tagName="div"
          className="pm-email-footer-content"
          style={textStyle}
          value={content}
          onChange={(val) => setAttributes({ content: val })}
          placeholder={__(
            "Footer text (e.g. company address, legal info)",
            "pressedmail",
          )}
        />
        {showUnsubscribe && (
          <p
            style={{
              ...textStyle,
              marginTop: "10px",
            }}>
            <a
              href="#"
              style={{ color: textColor, textDecoration: "underline" }}
              onClick={(e) => e.preventDefault()}>
              {__("Unsubscribe", "pressedmail")}
            </a>
          </p>
        )}
      </div>
    </>
  );
}
