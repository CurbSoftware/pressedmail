/**
 * Style element manager.
 *
 * Manages dynamic <style> elements in <head> for theme overrides.
 */

/**
 * Create or update a style element by ID.
 * Returns the element reference.
 */
export function upsertStyleElement(
  id: string,
  css: string,
): HTMLStyleElement | null {
  if (typeof document === 'undefined') return null;

  let el = document.getElementById(id) as HTMLStyleElement | null;
  if (!el) {
    el = document.createElement('style');
    el.id = id;
    document.head.appendChild(el);
  }
  el.textContent = css;
  return el;
}

/**
 * Remove a style element by ID.
 */
export function removeStyleElement(id: string): void {
  if (typeof document === 'undefined') return;
  const el = document.getElementById(id);
  if (el) el.remove();
}

/**
 * Temporarily replace a style element and restore the previous contents on
 * cleanup. New elements are removed; pre-existing elements are preserved.
 */
export function replaceStyleElement(id: string, css: string): () => void {
  if (typeof document === 'undefined') return () => {};
  const existing = document.getElementById(id) as HTMLStyleElement | null;
  const previousText = existing?.textContent ?? null;
  upsertStyleElement(id, css);
  let active = true;

  return () => {
    if (!active) return;
    active = false;
    if (existing) {
      existing.textContent = previousText;
    } else {
      removeStyleElement(id);
    }
  };
}
