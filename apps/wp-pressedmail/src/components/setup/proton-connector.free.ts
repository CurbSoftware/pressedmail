/**
 * Free has no Proton companion, so Add Account never shows its form. See
 * proton-connector.pro.ts.
 */
export interface ProtonConnector {
  restBase: string;
  canManage: boolean;
}

export function useProtonConnector(): ProtonConnector | null {
  return null;
}

export function ProtonBridgeStep(_props: Record<string, unknown>): null {
  return null;
}
