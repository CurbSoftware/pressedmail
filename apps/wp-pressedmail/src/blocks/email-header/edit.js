/* eslint-disable @next/next/no-img-element -- WordPress email blocks emit raw email markup. */
import { __ } from "@wordpress/i18n";
import {
  useBlockProps,
  InspectorControls,
  MediaUpload,
  MediaUploadCheck,
} from "@wordpress/block-editor";
import {
  PanelBody,
  TextControl,
  RangeControl,
  ColorPicker,
  Button,
  SelectControl,
} from "@wordpress/components";

export default function Edit({ attributes, setAttributes }) {
  const {
    logoUrl,
    logoAlt,
    logoWidth,
    align,
    backgroundColor,
    paddingVertical,
  } = attributes;

  const blockProps = useBlockProps();

  const wrapperStyle = {
    backgroundColor: backgroundColor || undefined,
    padding: `${paddingVertical}px 0`,
    textAlign: align,
  };

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Header Settings", "pressedmail")}>
          <MediaUploadCheck>
            <MediaUpload
              onSelect={(media) =>
                setAttributes({
                  logoUrl: media.url,
                  logoAlt: media.alt || "",
                })
              }
              allowedTypes={["image"]}
              render={({ open }) => (
                <div style={{ marginBottom: "16px" }}>
                  <Button
                    onClick={open}
                    variant="secondary"
                    style={{ width: "100%", justifyContent: "center" }}>
                    {logoUrl
                      ? __("Replace Logo", "pressedmail")
                      : __("Select Logo", "pressedmail")}
                  </Button>
                  {logoUrl && (
                    <Button
                      onClick={() =>
                        setAttributes({
                          logoUrl: "",
                          logoAlt: "",
                        })
                      }
                      variant="link"
                      isDestructive
                      style={{ marginTop: "8px" }}>
                      {__("Remove Logo", "pressedmail")}
                    </Button>
                  )}
                </div>
              )}
            />
          </MediaUploadCheck>
          <TextControl
            label={__("Alt Text", "pressedmail")}
            value={logoAlt}
            onChange={(val) => setAttributes({ logoAlt: val })}
          />
          <RangeControl
            label={__("Logo Width (px)", "pressedmail")}
            value={logoWidth}
            onChange={(val) => setAttributes({ logoWidth: val })}
            min={50}
            max={600}
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
          <RangeControl
            label={__("Vertical Padding", "pressedmail")}
            value={paddingVertical}
            onChange={(val) => setAttributes({ paddingVertical: val })}
            min={0}
            max={60}
          />
        </PanelBody>
        <PanelBody
          title={__("Background Color", "pressedmail")}
          initialOpen={false}>
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
        {logoUrl ? (
          <img
            src={logoUrl}
            alt={logoAlt}
            style={{ width: `${logoWidth}px`, height: "auto", border: 0 }}
          />
        ) : (
          <div
            style={{
              padding: "40px 20px",
              border: "2px dashed #ccc",
              color: "#999",
              textAlign: "center",
            }}>
            {__("Click to add a logo image", "pressedmail")}
          </div>
        )}
      </div>
    </>
  );
}
