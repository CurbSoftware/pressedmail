import { normalizeComposerLinkColor } from "./plate/link-style";

/** Capture pending edits without Plate's surrounding editor controls. */
export function getComposerDomHtml(
  container: HTMLElement | null,
): string | null {
  const editable = container?.querySelector('[data-slate-editor="true"]');
  if (!editable) return null;

  const body = editable.cloneNode(true) as HTMLElement;
  // Immediate Preview/Send can precede structured serialization. Rewrite the
  // attribute text, since assigning style.color would expand hex back to RGB.
  body.querySelectorAll("a[style]").forEach((link) => {
    link.setAttribute("style", link.getAttribute("style")!.replace(
      /(^|;)(\s*(?:color|background-color)\s*:\s*)([^;]+)/gi,
      (_declaration, separator, property, value: string) => `${separator}${property}${normalizeComposerLinkColor(value)}`,
    ));
  });
  // An inline void whose label is not what gets sent (a merge-field chip)
  // names its serialized text here.
  body.querySelectorAll<HTMLElement>("[data-pm-dom-text]").forEach((node) => {
    node.replaceWith(node.dataset.pmDomText ?? "");
  });
  // Noneditable figures and inline voids contain authored content. Remove
  // explicit decorations only, never all contenteditable="false" elements.
  body
    .querySelectorAll(
      '[data-pm-editor-chrome], [data-pm-decoration], .pm-signature-label, .pm-quote-header, [data-slate-placeholder="true"], [data-slate-spacer="true"]',
    )
    .forEach((node) => node.remove());
  body.querySelectorAll("[data-slate-zero-width]").forEach((node) => {
    // A browser edit can reach this span before Slate replaces its marker.
    // Keep that text and any line break, removing only Slate's sentinel.
    node.childNodes.forEach((child) => {
      if (child.nodeType === 3) {
        child.textContent = child.textContent?.replace(/\uFEFF/g, "") ?? "";
      }
    });
    node.replaceWith(...node.childNodes);
  });
  return body.innerHTML;
}
