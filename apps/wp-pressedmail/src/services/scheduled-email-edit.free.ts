/**
 * Free build scheduled-email edit client.
 *
 * Scheduled sending ships in the Pro edition only, so the Free plugin has no
 * `scheduled-emails/edit` route to call. The Free build resolves this module
 * instead of `scheduled-email-edit.ts`, which keeps the endpoint out of the
 * Free bundle entirely.
 *
 * Throwing rather than resolving keeps a future Free caller loud: the two call
 * sites only reach here through the scheduled context, which is a stub in Free,
 * so this is a guard against a wiring mistake and not a user-facing path.
 */
import type { DraftComposeIdentity } from "@/lib/draft-compose";

export async function requestScheduledDraftHandoff(
  _scheduledEmailId: number,
  _identity: DraftComposeIdentity,
): Promise<unknown> {
  throw new Error("Scheduled sending is not included in this build.");
}
