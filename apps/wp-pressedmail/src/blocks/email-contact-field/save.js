/**
 * Static save for email-contact-field block.
 *
 * Outputs a {{variable}} placeholder that gets resolved during
 * variable substitution when the email is sent.
 */
export default function save({ attributes }) {
  const { fieldName, fallback } = attributes;
  const code = fallback ? `{{${fieldName}|${fallback}}}` : `{{${fieldName}}}`;

  return (
    <span
      data-pm-contact-field={fieldName}
      data-pm-fallback={fallback || undefined}
      style={{ display: "inline" }}>
      {code}
    </span>
  );
}
