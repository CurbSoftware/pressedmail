/**
 * Additive inbox tag-filter helpers.
 *
 * The inbox tag filter keys on tag id (string) and ANDs every selected tag.
 * Clicking a tag chip anywhere (sidebar, email row, reading pane) toggles that
 * id in/out of the active set, so the same helper drives every surface.
 */

/** Toggle a tag id in/out of the current filter set (add if absent, remove if present). */
export function toggleTagFilterId(current: string[], id: string): string[] {
  return current.includes(id)
    ? current.filter((tagId) => tagId !== id)
    : [...current, id];
}
