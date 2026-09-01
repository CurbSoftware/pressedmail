export default function save({ attributes }) {
  const { variableName, fallback } = attributes;
  const placeholder = fallback
    ? `{{${variableName}|${fallback}}}`
    : `{{${variableName}}}`;

  return <span data-pm-var={variableName}>{placeholder}</span>;
}
