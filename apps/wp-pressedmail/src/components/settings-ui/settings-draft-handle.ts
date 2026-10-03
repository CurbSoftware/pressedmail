export interface SettingsDraftHandle {
  dirty: boolean;
  saving: boolean;
  /**
   * Holds input the server would refuse. A page's one Save stops before its
   * first write when any draft is invalid, then asks that draft to report it
   * through its own `save()`, which sends nothing.
   */
  invalid?: boolean;
  save: () => Promise<boolean>;
  cancel: () => void;
}

export type RegisterSettingsDraft = (
  key: string,
  draft: SettingsDraftHandle | null,
) => void;
