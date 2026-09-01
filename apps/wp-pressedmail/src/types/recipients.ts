/**
 * Recipient Types
 *
 * TypeScript definitions for the recipient input component used in compose.
 *
 * @since 1.3.0
 */

import type { ReactNode } from "react";

import type { Contact, ContactList } from "./contacts";

/**
 * Avatar color palette for consistent coloring.
 */
const AVATAR_COLORS = [
  "bg-blue-500",
  "bg-green-500",
  "bg-purple-500",
  "bg-orange-500",
  "bg-pink-500",
  "bg-teal-500",
  "bg-indigo-500",
  "bg-red-500",
] as const;

/**
 * Recipient type - can be a contact, list, or raw email.
 */
export type RecipientType = "contact" | "list" | "email";

/**
 * A recipient in the compose form.
 */
export interface Recipient {
  /** Unique ID for the recipient (for React key) */
  id: string;
  /** Type of recipient */
  type: RecipientType;
  /** Email address (for contact or raw email) */
  email: string;
  /** Display name */
  displayName: string;
  /** Original contact (if type is contact) */
  contact?: Contact;
  /** Original list (if type is list) */
  list?: ContactList;
  /** Member count (for lists) */
  memberCount?: number;
  /** Avatar URL (if available) */
  avatarUrl?: string | null;
}

/** Minimal, durable list identity carried through compose, drafts, and queues. */
export interface ContactListRecipientDescriptor {
  id: number;
  name: string;
  memberCount?: number;
}

/**
 * Suggestion item in the autocomplete dropdown.
 */
export interface RecipientSuggestion {
  /** Unique ID */
  id: string;
  /** Type of suggestion */
  type: RecipientType;
  /** Primary display text (name or email) */
  primaryText: string;
  /** Secondary display text (email if name is primary) */
  secondaryText?: string;
  /** Original contact */
  contact?: Contact;
  /** Original list */
  list?: ContactList;
  /** Member count for lists */
  memberCount?: number;
  /** Avatar URL */
  avatarUrl?: string | null;
}

/**
 * Props for RecipientInput component.
 */
export interface RecipientInputProps {
  /** Label for the field (To, Cc, Bcc) */
  label: string;
  /** Current recipients */
  value: Recipient[];
  /** Higher-priority recipients that this input must not add again */
  dedupeRecipients?: Recipient[];
  /** Callback when recipients change */
  onChange: (recipients: Recipient[]) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Whether to show list suggestions (Pro feature) */
  showListSuggestions?: boolean;
  /** Whether the input is disabled */
  disabled?: boolean;
  /** Additional class name */
  className?: string;
  /** Auto focus on mount */
  autoFocus?: boolean;
  /** Optional trailing action buttons rendered beside the picker */
  trailingActions?: ReactNode;
}

/**
 * Props for RecipientToken component.
 */
export interface RecipientTokenProps {
  /** The recipient to display */
  recipient: Recipient;
  /** Callback to remove the recipient */
  onRemove: () => void;
  /** Whether the token is selected/focused */
  selected?: boolean;
  /** Whether removal is disabled */
  disabled?: boolean;
}

/**
 * Validate that a URL is safe for use as an image source.
 * Only allows http/https protocols to prevent javascript: and data: URI attacks.
 */
export function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Get initials from a display name for avatar fallback.
 */
export function getRecipientInitials(name: string): string {
  if (!name) return "?";
  const parts = name.split(" ").filter(Boolean);
  if (parts.length >= 2) {
    const first = parts[0]?.[0] ?? "";
    const last = parts[parts.length - 1]?.[0] ?? "";
    return (first + last).toUpperCase();
  }
  return name.slice(0, 2).toUpperCase();
}

/**
 * Get a consistent avatar background color based on name.
 */
export function getRecipientAvatarColor(name: string): string {
  const hash = name
    .split("")
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  const index = hash % AVATAR_COLORS.length;
  return AVATAR_COLORS[index] ?? "bg-blue-500";
}

/**
 * Contact type extended with optional avatar_url field.
 */
type ContactWithAvatar = Contact & { avatar_url?: string | null };

/**
 * Helper to create a recipient from a contact.
 */
export function createRecipientFromContact(contact: Contact): Recipient {
  const displayName =
    contact.first_name || contact.last_name
      ? `${contact.first_name || ""} ${contact.last_name || ""}`.trim()
      : contact.email;

  // Safely access avatar_url if it exists on the contact
  const contactWithAvatar = contact as ContactWithAvatar;
  const avatarUrl = contactWithAvatar.avatar_url ?? null;

  return {
    id: `contact-${contact.id}`,
    type: "contact",
    email: contact.email,
    displayName,
    contact,
    avatarUrl: isValidImageUrl(avatarUrl) ? avatarUrl : null,
  };
}

/**
 * Helper to create a recipient from a contact list.
 */
export function createRecipientFromList(list: ContactList): Recipient {
  return {
    id: `list-${list.id}`,
    type: "list",
    email: "", // Lists don't have a single email
    displayName: list.name,
    list,
    memberCount: list.contact_count,
  };
}

export function createRecipientFromListDescriptor(
  descriptor: ContactListRecipientDescriptor,
): Recipient {
  return {
    id: `list-${descriptor.id}`,
    type: "list",
    email: "",
    displayName: descriptor.name,
    list: {
      id: descriptor.id,
      name: descriptor.name,
      contact_count: descriptor.memberCount ?? 0,
    } as ContactList,
    memberCount: descriptor.memberCount,
  };
}

export function getContactListRecipientDescriptors(
  recipients: Recipient[],
): ContactListRecipientDescriptor[] {
  return recipients.flatMap((recipient) => {
    if (recipient.type !== "list" || !recipient.list) return [];
    return [
      {
        id: recipient.list.id,
        name: recipient.list.name,
        memberCount: recipient.memberCount ?? recipient.list.contact_count,
      },
    ];
  });
}

export function recipientsFromComposeData(
  addresses: string,
  lists: ContactListRecipientDescriptor[] = [],
): Recipient[] {
  return [
    ...parseEmailString(addresses),
    ...lists.map(createRecipientFromListDescriptor),
  ];
}

/**
 * Strip an RFC 5322 quoted-string wrapper from a display name, unescaping any
 * backslash-escaped characters. A bare (unquoted) name is returned as-is.
 */
function unquoteDisplayName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(.)/g, "$1");
  }
  return trimmed;
}

/**
 * Helper to create a recipient from a raw email address.
 */
export function createRecipientFromEmail(email: string): Recipient {
  // Check if email has a name part like "John Doe <john@example.com>" or a
  // quoted name that may contain commas like '"Doe, John" <john@example.com>'.
  const match = email.match(/^(.*)<([^<>]+)>\s*$/);
  if (match && match[2]) {
    const extractedEmail = match[2].trim();
    const extractedName = unquoteDisplayName(match[1] ?? "");
    return {
      id: `email-${extractedEmail}-${Date.now()}`,
      type: "email",
      email: extractedEmail,
      displayName: extractedName || extractedEmail,
    };
  }

  return {
    id: `email-${email}-${Date.now()}`,
    type: "email",
    email: email.trim(),
    displayName: email.trim(),
  };
}

/**
 * Validate an email address.
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

/**
 * Split a comma/semicolon/newline-separated address list into individual
 * entries WITHOUT breaking a display name that carries a comma inside a quoted
 * string ('"Doe, John" <j@x.com>') or, defensively, inside the angle-bracketed
 * addr-spec. Mirrors the server-side RecipientAddressList splitter so the
 * composer round-trips exactly what it sends.
 */
export function splitAddressList(input: string): string[] {
  const entries: string[] = [];
  let buffer = "";
  let inQuote = false;
  let inAngle = false;

  for (const char of input) {
    if (char === '"' && !inAngle) {
      inQuote = !inQuote;
      buffer += char;
      continue;
    }
    if (!inQuote) {
      if (char === "<") {
        inAngle = true;
      } else if (char === ">") {
        inAngle = false;
      } else if ((char === "," || char === ";" || char === "\n") && !inAngle) {
        entries.push(buffer);
        buffer = "";
        continue;
      }
    }
    buffer += char;
  }
  entries.push(buffer);

  return entries.map((e) => e.trim()).filter(Boolean);
}

/**
 * Extract the bare addr-spec from a single entry (bare address or name-addr).
 */
function extractEmailFromEntry(entry: string): string {
  const match = entry.match(/<([^<>]+)>/);
  return (match?.[1] ?? entry).trim();
}

/**
 * Parse a comma-separated string of emails into recipients.
 */
export function parseEmailString(input: string): Recipient[] {
  if (!input.trim()) return [];

  return splitAddressList(input)
    .filter((entry) => isValidEmail(extractEmailFromEntry(entry)))
    .map(createRecipientFromEmail);
}

/**
 * RFC 5322 "specials" that force a display name to be quoted when serialized in
 * a comma-separated address list. A bare comma in a name (e.g. "Doe, John")
 * would otherwise be read as a recipient separator by both the client parser
 * and the server, splitting one recipient into invalid fragments.
 */
const NAME_NEEDS_QUOTING = /[,;<>@"\\]/;

/**
 * Serialize a display name as an RFC 5322 quoted-string when it contains
 * specials (or surrounding whitespace); otherwise return it verbatim.
 */
function formatDisplayName(name: string): string {
  if (NAME_NEEDS_QUOTING.test(name) || name.trim() !== name) {
    return `"${name.replace(/(["\\])/g, "\\$1")}"`;
  }
  return name;
}

/**
 * Convert recipients array to a comma-separated string for the API.
 */
export function recipientsToString(recipients: Recipient[]): string {
  return recipients
    .filter((r) => r.type !== "list") // Lists need to be expanded separately
    .map((r) => {
      if (r.displayName && r.displayName !== r.email) {
        return `${formatDisplayName(r.displayName)} <${r.email}>`;
      }
      return r.email;
    })
    .join(", ");
}

/**
 * Case-insensitive email identity for recipient dedupe.
 */
export function getRecipientEmailKey(recipient: Recipient): string | null {
  const email = recipient.email?.trim().toLowerCase();
  return email || null;
}

/**
 * Keep each deliverable email once while preserving first-seen order.
 */
export function dedupeRecipientsByEmail(
  recipients: Recipient[],
  seenEmails: Set<string> = new Set(),
): Recipient[] {
  const seenIds = new Set<string>();
  const deduped: Recipient[] = [];

  for (const recipient of recipients) {
    if (seenIds.has(recipient.id)) {
      continue;
    }
    seenIds.add(recipient.id);

    const emailKey = getRecipientEmailKey(recipient);
    if (emailKey) {
      if (seenEmails.has(emailKey)) {
        continue;
      }
      seenEmails.add(emailKey);
    }

    deduped.push(recipient);
  }

  return deduped;
}

export interface RecipientGroups {
  to: Recipient[];
  cc: Recipient[];
  bcc: Recipient[];
}

/**
 * Dedupe address fields with To > Cc > Bcc priority.
 */
export function dedupeRecipientGroupsByEmail(
  groups: RecipientGroups,
): RecipientGroups {
  const seenEmails = new Set<string>();

  return {
    to: dedupeRecipientsByEmail(groups.to, seenEmails),
    cc: dedupeRecipientsByEmail(groups.cc, seenEmails),
    bcc: dedupeRecipientsByEmail(groups.bcc, seenEmails),
  };
}

/**
 * Get list IDs from recipients (for expansion).
 */
export function getListIdsFromRecipients(recipients: Recipient[]): number[] {
  return recipients
    .filter((r) => r.type === "list" && r.list)
    .map((r) => r.list!.id);
}
