export interface SettingsDraftHandle {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  cancel: () => void;
}

export type RegisterSettingsDraft = (
  key: string,
  draft: SettingsDraftHandle | null,
) => void;
