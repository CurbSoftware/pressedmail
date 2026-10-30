/**
 * Mark <html> with how the person last moved through the page:
 * `data-pm-modality="pointer"` or `"keyboard"`.
 *
 * Menus and selects (Radix) move focus to whatever item the pointer rests on,
 * so a plain hover matched :focus-visible and drew the keyboard focus outline,
 * in --pm-focus-ring rather than the theme's highlight. The focus contract in
 * tailwind-base.css reads this to drop that outline while the pointer is
 * driving. Keyboard navigation keeps it: on some palettes the item highlight
 * alone is 1.44:1 against the menu. With no mark yet, the outline shows.
 */
export function installInputModality(doc: Document = document): () => void {
  const root = doc.documentElement;
  const mark = (mode: "pointer" | "keyboard") => {
    if (root.dataset.pmModality !== mode) root.dataset.pmModality = mode;
  };
  const onPointer = () => mark("pointer");
  // Ctrl, Alt and Cmd chords are browser and app commands, not navigation.
  const onKey = (event: KeyboardEvent) => {
    if (!event.ctrlKey && !event.altKey && !event.metaKey) mark("keyboard");
  };

  doc.addEventListener("pointerdown", onPointer, true);
  doc.addEventListener("pointermove", onPointer, { capture: true, passive: true });
  doc.addEventListener("keydown", onKey, true);
  return () => {
    doc.removeEventListener("pointerdown", onPointer, true);
    doc.removeEventListener("pointermove", onPointer, true);
    doc.removeEventListener("keydown", onKey, true);
  };
}
