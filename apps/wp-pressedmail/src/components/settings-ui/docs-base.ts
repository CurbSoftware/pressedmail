export const DOCS_BASE_URL = "https://pressedmail.com/docs";

export function docsHref(slug: string): string {
  const trimmed = slug.replace(/^\/+/, "").replace(/\/+$/, "");
  return `${DOCS_BASE_URL}/${trimmed}`;
}
