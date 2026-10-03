/**
 * Free has one inbox layout and no admin layout policy, so the layout is a
 * constant. The Pro hook, with the other layouts and the whitelabel lock, is
 * useLayout.ts.
 */
import { LayoutConfigs } from "@/types/features";
import type { LayoutConfig, LayoutId } from "@/types/features";

const FREE_LAYOUT = {
  currentLayout: "pressedm" as LayoutId,
  config: LayoutConfigs.pressedm as LayoutConfig,
};

export function useLayout(): typeof FREE_LAYOUT {
  return FREE_LAYOUT;
}

export default useLayout;
