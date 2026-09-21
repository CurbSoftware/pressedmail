import type { CSSProperties } from "react";

// Docked forms whose Save footer is pinned to the bottom (contact, event) sit
// above floating navigation, or the bottom-right speed dial swallows clicks on
// Save. The docked composer does not use this: its actions are at the top, and
// lifting it covered the speed dial and the list pane's resize grip.
// Shared dialog/popover primitives remain above all of these at z-50.
export const FLOATING_NAVIGATION_Z_INDEX = 30;
export const DOCKED_EDITOR_STYLE = {
  position: "relative",
  zIndex: 40,
} satisfies CSSProperties;
