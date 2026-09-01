import { createContext, useContext, useEffect, type ReactNode } from "react";

export type LayoutType = "pressedm" | "pressedg" | "pressedout";

export interface LayoutConfig {
  id: LayoutType;
  name: string;
  description: string;
  defaultPanelSizes: [number, number, number];
  navCollapsedSize: number;
  layoutVariant: "classic" | "roundcube";
  listVariant: "default" | "paginated";
  pageSize?: 50 | 100;
}

const DEFAULT_LAYOUT: LayoutType = "pressedm";
const FREE_LAYOUT: LayoutConfig = {
  id: DEFAULT_LAYOUT,
  name: "PressedM",
  description: "Classic webmail with rounded panels and inline compose",
  defaultPanelSizes: [200, 360, 800],
  navCollapsedSize: 4,
  layoutVariant: "roundcube",
  listVariant: "default",
};

export const LAYOUTS = { pressedm: FREE_LAYOUT };

interface LayoutContextValue {
  currentLayout: LayoutType;
  setLayout: (layoutId: LayoutType) => void;
  layoutConfig: LayoutConfig;
  isLayoutAvailable: (layoutId: LayoutType) => boolean;
  availableLayouts: LayoutType[];
}

const value: LayoutContextValue = {
  currentLayout: DEFAULT_LAYOUT,
  setLayout: () => undefined,
  layoutConfig: FREE_LAYOUT,
  isLayoutAvailable: (layoutId) => layoutId === DEFAULT_LAYOUT,
  availableLayouts: [DEFAULT_LAYOUT],
};

const LayoutContext = createContext<LayoutContextValue>(value);

export function LayoutProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    if (typeof document === "undefined") return;
    const roots = [
      document.body,
      document.getElementById("pressedmail-plugin"),
      document.getElementById("pressedmail-plugin-frontend"),
    ];
    for (const root of roots) {
      if (!root) continue;
      for (const className of Array.from(root.classList)) {
        if (className.startsWith("layout-")) root.classList.remove(className);
      }
      root.classList.add("layout-pressedm");
    }
  }, []);

  return (
    <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>
  );
}

export function useLayout(): LayoutContextValue {
  return useContext(LayoutContext);
}

export const useLayoutConfig = () => useLayout().layoutConfig;
export const useAvailableLayouts = () => useLayout().availableLayouts;
export const useIsLayoutAvailable = (layoutId: LayoutType) =>
  useLayout().isLayoutAvailable(layoutId);
