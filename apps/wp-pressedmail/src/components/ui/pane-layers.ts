import type { CSSProperties } from "react";

// Docked editors must receive pointer events ahead of floating navigation.
// Shared dialog/popover primitives remain above both at z-50.
export const FLOATING_NAVIGATION_Z_INDEX = 30;
export const DOCKED_EDITOR_STYLE = {
  position: "relative",
  zIndex: 40,
} satisfies CSSProperties;
