/**
 * Snooze hook contract.
 *
 * Lives here rather than beside the implementation because both editions need
 * it: the Free build swaps in an inert `useSnooze`, and a type import reaching
 * back into the Pro module would drag that module into the published Free
 * source tree.
 */

export interface SnoozePreset {
  id: string;
  label: string;
  time: string;
  relative: string;
}

export interface SnoozedEmail {
  id: number;
  user_id: number;
  account_id: number;
  message_uid: string;
  original_folder: string;
  snooze_until: string;
  status: "snoozed" | "unsnoozed" | "expired";
  message_subject: string | null;
  message_from: string | null;
  message_date: string | null;
}

export interface SnoozeCapabilities {
  enabled: boolean;
  snoozed_count: number;
  tier_required: string;
}

export interface UseSnoozeReturn {
  snoozedEmails: SnoozedEmail[];
  isLoading: boolean;
  error: string | null;
  presets: SnoozePreset[];
  capabilities: SnoozeCapabilities | null;
  snoozeEmail: (data: {
    account_id: number;
    message_uid: string;
    source_uidvalidity: string | number;
    source_message_id: string;
    snooze_until: string;
    folder: string;
    subject?: string;
    from?: string;
    date?: string;
  }) => Promise<{ success: boolean; data?: SnoozedEmail; error?: string }>;
  unsnoozeEmail: (
    snoozeId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  updateSnooze: (
    snoozeId: number,
    snoozeUntil: string,
  ) => Promise<{ success: boolean; error?: string }>;
  deleteSnooze: (
    snoozeId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  fetchSnoozedEmails: (accountId?: number) => Promise<void>;
  fetchPresets: () => Promise<void>;
  fetchCapabilities: () => Promise<void>;
  isMessageSnoozed: (
    accountId: number,
    messageUid: string,
  ) => Promise<SnoozedEmail | false>;
}
