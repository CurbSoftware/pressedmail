import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import { PanelBody, TextareaControl } from "@wordpress/components";

export default function Edit({ attributes, setAttributes }) {
  const { text } = attributes;
  const blockProps = useBlockProps();

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Preheader Settings", "pressedmail")}>
          <TextareaControl
            label={__("Preview Text", "pressedmail")}
            help={__(
              "This text appears in inbox previews but is hidden in the email body. Keep it under 100 characters for best results.",
              "pressedmail",
            )}
            value={text}
            onChange={(val) => setAttributes({ text: val })}
            rows={3}
          />
        </PanelBody>
      </InspectorControls>
      <div
        {...blockProps}
        style={{
          padding: "10px 14px",
          backgroundColor: "#f0f0f0",
          border: "1px dashed #999",
          color: "#666",
          fontSize: "13px",
          fontFamily: "monospace",
        }}>
        <strong>{__("Preheader:", "pressedmail")}</strong>{" "}
        {text || <em>{__("(empty, add preview text)", "pressedmail")}</em>}
      </div>
    </>
  );
}
