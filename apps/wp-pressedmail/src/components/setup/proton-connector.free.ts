/**
 * Free has no Proton provider, so Add Account never shows the companion's form
 * or the step that points to it. See proton-connector.pro.ts.
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

export function ProtonCompanionStep(): null {
  return null;
}
