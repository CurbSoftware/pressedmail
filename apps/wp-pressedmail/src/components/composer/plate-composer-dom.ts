/** Capture pending edits without Plate's surrounding editor controls. */
export function getComposerDomHtml(
  container: HTMLElement | null,
): string | null {
  const editable = container?.querySelector('[data-slate-editor="true"]');
  if (!editable) return null;

  const body = editable.cloneNode(true) as HTMLElement;
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
