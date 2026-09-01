import { decodeMimeWords } from "@/components/inbox/mail-display";

interface SenderFields {
  name?: string;
  from?: string;
  email?: string;
}

/**
 * Clean and extract a display-ready sender name from a message.
 *
 * Handles IMAP artifacts: surrounding slashes/quotes, angle-bracket
 * format leaks, and MIME-encoded words.
 */
export function parseSenderName(msg: SenderFields): string {
  let raw =
    msg.name ||
    msg.from?.split("<")[0]?.trim() ||
    msg.email ||
    "Unknown sender";

  // Strip surrounding slashes, quotes, and whitespace
  raw = raw.replace(/^[\\/"'<>]+|[\\/"'<>]+$/g, "").trim();

  // Decode MIME words (=?UTF-8?B?...?=)
  raw = decodeMimeWords(raw);

  return raw || "Unknown sender";
}

/**
 * Extract a clean email address from a message, handling IMAP artifacts.
 *
 * Handles corrupted data from Webklex IMAP driver where ENVELOPE fields
 * may contain protocol artifacts like `email.claude.comNILNILno-reply`.
 */
export function parseSenderEmail(msg: SenderFields): string {
  const raw = msg.email || msg.from || "";

  // If the field contains angle brackets, extract the email inside
  const angleMatch = raw.match(/<([^>]+)>/);
  if (angleMatch?.[1]) return validateEmail(angleMatch[1]);

  // Validate: extract first email-like pattern
  // TLD restricted to 2-20 lowercase letters to avoid matching IMAP artifacts like "comNILNILno"
  const emailMatch = raw.match(
    /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?(?:\.[a-zA-Z]{2,20})+/,
  );
  if (emailMatch) return validateEmail(emailMatch[0]);

  return raw;
}

/** Strip any trailing IMAP artifacts from an extracted email. */
function validateEmail(email: string): string {
  // If the domain part contains uppercase mid-word (e.g., comNILNILno), truncate
  const atIdx = email.indexOf("@");
  if (atIdx === -1) return email;

  const domain = email.slice(atIdx + 1);
  // Split on dots, validate each part, reject parts with mixed case like "comNILNILno"
  const parts = domain.split(".");
  const cleanParts: string[] = [];
  for (const part of parts) {
    // Valid domain parts are all-lowercase or all-uppercase (case-insensitive DNS)
    // Reject parts that mix lowercase and uppercase (IMAP artifact signal)
    if (/^[a-zA-Z0-9](?:[a-zA-Z0-9-]*[a-zA-Z0-9])?$/.test(part)) {
      // Check for mixed case, artifact like "comNILNILno" has lowercase then uppercase
      if (/[a-z]/.test(part) && /[A-Z]/.test(part)) {
        // Mixed case, likely IMAP artifact, truncate at the first uppercase transition
        const truncMatch = part.match(/^([a-z]+)/);
        if (truncMatch?.[1] && truncMatch[1].length >= 2) {
          cleanParts.push(truncMatch[1]);
        }
        break; // Stop processing further parts
      }
      cleanParts.push(part);
    } else {
      break; // Invalid part, stop
    }
  }

  if (cleanParts.length === 0) return email;
  return email.slice(0, atIdx + 1) + cleanParts.join(".");
}
