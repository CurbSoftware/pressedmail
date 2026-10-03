/**
 * Free-edition snooze hook: nothing.
 *
 * Snooze is Pro. Shared inbox code still destructures this hook, but every
 * read of its members sits behind a Pro define, so Free returns an empty value
 * rather than a stand-in for the Pro API.
 */
import type { UseSnoozeReturn } from "@/types/snooze";

const NO_SNOOZE = {} as UseSnoozeReturn;

export function useSnooze(): UseSnoozeReturn {
  return NO_SNOOZE;
}
