/**
 * Free-edition phishing helpers: inert.
 *
 * Phishing detection is Pro. The generic message helpers that shared inbox
 * components need (`getMessageRequestId`, `resolveMessageAccountId`) moved to
 * `lib/message-identity.ts`, so only the phishing-specific data shaping remains
 * here and it never needs to run in Free.
 */
import type { EmailMessage } from "@/types";
import type { PhishingEmailData } from "@/types/phishing";

// The real module re-exports these; shared inbox code imports them from here in
// places, so the stub must keep the surface identical or the Free build fails.
export {
  getMessageIdentityKey,
  getMessageRequestId,
  resolveMessageAccountId,
} from "@/lib/message-identity";

export function toPhishingEmailData(_message: EmailMessage): PhishingEmailData {
  return {} as PhishingEmailData;
}

export function extractPhishingSenderEmail(_from: string | undefined): string {
  return "";
}

export function extractPhishingSenderName(_from: string | undefined): string {
  return "";
}
