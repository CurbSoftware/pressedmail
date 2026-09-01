import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import { PanelBody, SelectControl, TextControl } from "@wordpress/components";

const FIELD_OPTIONS = [
  { label: __("Site Name", "pressedmail"), value: "site_name" },
  { label: __("Site URL", "pressedmail"), value: "site_url" },
  { label: __("Site Description", "pressedmail"), value: "site_description" },
  { label: __("Admin Email", "pressedmail"), value: "admin_email" },
  { label: __("Current Date", "pressedmail"), value: "current_date" },
];

const PREVIEW_VALUES = {
  site_name: "My Website",
  site_url: "https://example.com",
  site_description: "Just another WordPress site",
  admin_email: "admin@example.com",
  current_date: new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  }),
};

export default function Edit({ attributes, setAttributes }) {
  const { field, format, dateFormat } = attributes;
  const blockProps = useBlockProps({
    style: format === "inline" ? { display: "inline" } : {},
  });

  const fieldLabel =
    FIELD_OPTIONS.find((o) => o.value === field)?.label || field;
  const previewValue = PREVIEW_VALUES[field] || field;

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Site Info Settings", "pressedmail")}>
          <SelectControl
            label={__("Field", "pressedmail")}
            value={field}
            options={FIELD_OPTIONS}
            onChange={(val) => setAttributes({ field: val })}
          />
          <SelectControl
            label={__("Display Format", "pressedmail")}
            value={format}
            options={[
              { label: __("Inline", "pressedmail"), value: "inline" },
              { label: __("Block", "pressedmail"), value: "block" },
            ]}
            onChange={(val) => setAttributes({ format: val })}
          />
          {field === "current_date" && (
            <TextControl
              label={__("Date Format", "pressedmail")}
              help={__(
                "PHP date format string (e.g. F j, Y for March 29, 2026)",
                "pressedmail",
              )}
              value={dateFormat}
              onChange={(val) => setAttributes({ dateFormat: val })}
            />
          )}
        </PanelBody>
      </InspectorControls>

      {format === "inline" ? (
        <span
          {...blockProps}
          style={{
            display: "inline",
            backgroundColor: "#e8f4fd",
            color: "#0073aa",
            padding: "2px 6px",
            borderRadius: "3px",
            fontFamily: "monospace",
            fontSize: "13px",
            border: "1px solid #b3d7ff",
          }}>
          [{fieldLabel}]
        </span>
      ) : (
        <div
          {...blockProps}
          style={{
            padding: "8px 12px",
            backgroundColor: "#e8f4fd",
            borderRadius: "4px",
            border: "1px dashed #b3d7ff",
            fontSize: "14px",
          }}>
          <span
            style={{
              fontSize: "11px",
              color: "#666",
              textTransform: "uppercase",
              letterSpacing: "0.5px",
            }}>
            {fieldLabel}:
          </span>
          <br />
          <span style={{ color: "#0073aa" }}>{previewValue}</span>
        </div>
      )}
    </>
  );
}
