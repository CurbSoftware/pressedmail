/**
 * Free-edition snooze hook: inert.
 *
 * The Free interface does not include snooze controls, but shared inbox code
 * still imports this hook.
 */
import { __ } from "@wordpress/i18n";
import type { UseSnoozeReturn } from "@/types/snooze";

const failure = async () => ({
  success: false,
  error: __("Snooze is unavailable.", "pressedmail"),
});

export function useSnooze(): UseSnoozeReturn {
  return {
    snoozedEmails: [],
    isLoading: false,
    error: null,
    presets: [],
    capabilities: null,
    snoozeEmail: failure,
    unsnoozeEmail: failure,
    updateSnooze: failure,
    deleteSnooze: failure,
    fetchSnoozedEmails: async () => undefined,
    fetchPresets: async () => undefined,
    fetchCapabilities: async () => undefined,
    isMessageSnoozed: async () => false as const,
  } as UseSnoozeReturn;
}
