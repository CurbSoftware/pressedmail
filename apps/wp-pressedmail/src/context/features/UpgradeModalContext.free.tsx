import type { ReactNode } from "react";

const INACTIVE_STATE = {
  isOpen: false,
  feature: null as string | null,
  openUpgradeModal: (_feature?: string) => {},
  closeUpgradeModal: () => {},
};

export function UpgradeModalProvider({ children }: { children: ReactNode }) {
  return <>{children}</>;
}

export function useUpgradeModal() {
  return INACTIVE_STATE;
}
