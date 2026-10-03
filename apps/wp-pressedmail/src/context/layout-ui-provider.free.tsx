/**
 * Free has one layout and no PressedOut UI state. See layout-ui-provider.pro.ts.
 */
import type { ReactNode } from "react";

export function LayoutUiProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
