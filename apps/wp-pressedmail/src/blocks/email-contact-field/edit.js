import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import { PanelBody, SelectControl, TextControl } from "@wordpress/components";

const FIELD_OPTIONS = [
  {
    label: __("--- Contact Fields ---", "pressedmail"),
    value: "",
    disabled: true,
  },
  { label: __("First Name", "pressedmail"), value: "first_name" },
  { label: __("Last Name", "pressedmail"), value: "last_name" },
  { label: __("Full Name", "pressedmail"), value: "full_name" },
  { label: __("Email", "pressedmail"), value: "email" },
  { label: __("Company", "pressedmail"), value: "company" },
  { label: __("Job Title", "pressedmail"), value: "job_title" },
  { label: __("Phone", "pressedmail"), value: "phone" },
  { label: __("Website", "pressedmail"), value: "website" },
];

export default function Edit({ attributes, setAttributes }) {
  const { fieldName, fallback } = attributes;
  const blockProps = useBlockProps({
    style: { display: "inline" },
  });

  const display = fallback
    ? `{{${fieldName}|${fallback}}}`
    : `{{${fieldName}}}`;

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Contact Field Settings", "pressedmail")}>
          <SelectControl
            label={__("Field", "pressedmail")}
            value={fieldName}
            options={FIELD_OPTIONS}
            onChange={(val) => setAttributes({ fieldName: val })}
          />
          <TextControl
            label={__("Fallback Value", "pressedmail")}
            help={__(
              "Shown when the contact field has no value (e.g. 'there' for 'Hi {{first_name}}')",
              "pressedmail",
            )}
            value={fallback}
            onChange={(val) => setAttributes({ fallback: val })}
          />
        </PanelBody>
      </InspectorControls>
      <span
        {...blockProps}
        style={{
          display: "inline",
          backgroundColor: "#d4edda",
          color: "#155724",
          padding: "2px 6px",
          borderRadius: "3px",
          fontFamily: "monospace",
          fontSize: "13px",
          border: "1px solid #28a745",
        }}>
        {display}
      </span>
    </>
  );
}
