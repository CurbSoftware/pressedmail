import DOMPurify from "dompurify";

export interface ComposerHtmlDeserializerApi {
  deserialize: (options: { element: HTMLElement | string }) => unknown;
}

/**
 * Sanitize composer HTML and hand it back as an element of an inert document.
 *
 * Plate's own string path is `document.createElement("body").innerHTML = html`.
 * That element belongs to the live document, so an `<img src=x onerror=...>`
 * inside it fetches the image and runs the handler the moment the string is
 * assigned, before any deserializer has looked at a node. DOMPurify parses into
 * a document with no browsing context instead: `ownerDocument.defaultView` is
 * null, so nothing there loads and nothing there fires. Depending on the
 * environment it reaches that via `new DOMParser().parseFromString(...)`,
 * falling back to `document.implementation.createHTMLDocument()`; both are
 * inert. It also strips the handlers and script elements on the way through, so
 * what the editor deserializes is both inert and clean.
 *
 * The configuration is deliberately permissive. Composer HTML is our own
 * markup, so styles, data-pm-* attributes and table layout all have to survive;
 * the point here is executable content, not an allow-list.
 */
export function parseComposerHtmlInert(html: string): HTMLElement {
  return DOMPurify.sanitize(html, {
    RETURN_DOM: true,
    ALLOW_DATA_ATTR: true,
  }) as unknown as HTMLElement;
}

/**
 * Wrap a Plate HTML API so every string it is given is sanitized and parsed
 * inertly first. The wrapper keeps the string-only signature the email editor
 * controller expects while passing Plate the element it also accepts.
 */
export function createInertHtmlDeserializer(
  api: ComposerHtmlDeserializerApi,
): { deserialize: (options: { element: string }) => unknown } {
  return {
    deserialize: ({ element }) =>
      api.deserialize({ element: parseComposerHtmlInert(element) }),
  };
}
