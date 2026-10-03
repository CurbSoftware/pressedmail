/**
 * Free build scheduled-email edit client.
 *
 * Scheduled sending ships in the Pro edition only, so the Free plugin has no
 * `scheduled-emails/edit` route to call. The Free build resolves this module
 * instead of `scheduled-email-edit.ts`, which keeps the endpoint out of the
 * Free bundle entirely.
 *
 * Both call sites are compiled out of the Free build, so this body is never
 * bundled. It throws rather than resolving so a future Free caller fails loudly,
 * and it carries no user-facing copy.
 */
import type { DraftComposeIdentity } from "@/lib/draft-compose";

export async function requestScheduledDraftHandoff(
  _scheduledEmailId: number,
  _identity: DraftComposeIdentity,
): Promise<unknown> {
  throw new Error("scheduled-email-edit");
}
