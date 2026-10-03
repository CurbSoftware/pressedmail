/**
 * Free-edition field kit: empty.
 *
 * Templates are Pro. Free ships no chip, no picker and no normalizer, so a
 * `{{contact.first_name}}` token in Free is just the text it is, and the
 * serializer round-trips it untouched.
 */
export const TemplateVariableKit = [];
export const TemplateVariableStaticKit = [];
export const templateVariablesToText = <T>(nodes: T): T => nodes;
