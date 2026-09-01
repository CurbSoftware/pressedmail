import { __ } from "@wordpress/i18n";
import { useBlockProps, InspectorControls } from "@wordpress/block-editor";
import { PanelBody, SelectControl, TextControl } from "@wordpress/components";

const VARIABLE_OPTIONS = [
  {
    label: __("--- Sender ---", "pressedmail"),
    value: "",
    disabled: true,
  },
  { label: __("Sender Name", "pressedmail"), value: "sender_name" },
  { label: __("Sender Email", "pressedmail"), value: "sender_email" },
  {
    label: __("--- Recipient ---", "pressedmail"),
    value: "",
    disabled: true,
  },
  { label: __("Recipient Name", "pressedmail"), value: "recipient_name" },
  {
    label: __("Recipient Email", "pressedmail"),
    value: "recipient_email",
  },
  {
    label: __("--- Contact ---", "pressedmail"),
    value: "",
    disabled: true,
  },
  {
    label: __("Contact First Name", "pressedmail"),
    value: "contact_first_name",
  },
  {
    label: __("Contact Last Name", "pressedmail"),
    value: "contact_last_name",
  },
  {
    label: __("Contact Full Name", "pressedmail"),
    value: "contact_full_name",
  },
  {
    label: __("Contact Email", "pressedmail"),
    value: "contact_email",
  },
  {
    label: __("Contact Company", "pressedmail"),
    value: "contact_company",
  },
  {
    label: __("Contact Phone", "pressedmail"),
    value: "contact_phone",
  },
  {
    label: __("Contact Job Title", "pressedmail"),
    value: "contact_job_title",
  },
  {
    label: __("Contact Website", "pressedmail"),
    value: "contact_website",
  },
  {
    label: __("--- General ---", "pressedmail"),
    value: "",
    disabled: true,
  },
  { label: __("Current Date", "pressedmail"), value: "current_date" },
  { label: __("Company Name", "pressedmail"), value: "company_name" },
  { label: __("Website URL", "pressedmail"), value: "website_url" },
];

export default function Edit({ attributes, setAttributes }) {
  const { variableName, fallback } = attributes;
  const blockProps = useBlockProps({
    style: { display: "inline" },
  });

  const display = fallback
    ? `{{${variableName}|${fallback}}}`
    : `{{${variableName}}}`;

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("Variable Settings", "pressedmail")}>
          <SelectControl
            label={__("Variable", "pressedmail")}
            value={variableName}
            options={VARIABLE_OPTIONS}
            onChange={(val) => setAttributes({ variableName: val })}
          />
          <TextControl
            label={__("Fallback Value", "pressedmail")}
            help={__("Shown when the variable has no value.", "pressedmail")}
            value={fallback}
            onChange={(val) => setAttributes({ fallback: val })}
          />
        </PanelBody>
      </InspectorControls>
      <span
        {...blockProps}
        style={{
          display: "inline",
          backgroundColor: "#fff3cd",
          color: "#856404",
          padding: "2px 6px",
          borderRadius: "3px",
          fontFamily: "monospace",
          fontSize: "13px",
          border: "1px solid #ffc107",
        }}>
        {display}
      </span>
    </>
  );
}
