/**
 * Recipient arithmetic for Reply and Reply All.
 *
 * The rules are RFC 5322 section 3.6.3 and long-standing mail-client practice:
 *
 *  - Reply goes to Reply-To when the sender asked for it, otherwise to From.
 *    Mailing lists, ticket systems and no-reply senders all depend on this.
 *  - Reply All keeps every other recipient of the original: the reply target
 *    plus the original To line, with the original Cc line as Cc.
 *  - The account doing the replying drops out of both lists. Nobody wants a
 *    copy of their own reply.
 *  - Display names are re-quoted on the way out. A name like "Müller, Hans"
 *    carries a comma, and a bare comma inside an address list is a recipient
 *    separator, which is how one Outlook-style contact could reject a send.
 */

export interface MailAddress {
  name: string;
  email: string;
}

/** Characters that force a display name to be a quoted-string (RFC 5322). */
const SPECIALS = /[()<>[\]:;@\\,."]/;

/**
 * Split an address list on the commas that actually separate addresses, not on
 * the ones inside a quoted display name or an angle-addr.
 */
function splitEntries(value: string): string[] {
  const entries: string[] = [];
  let current = "";
  let inQuotes = false;
  let inAngle = false;
  let escaped = false;

  for (const char of value) {
    if (escaped) {
      current += char;
      escaped = false;
      continue;
    }

    if (char === "\\" && inQuotes) {
      current += char;
      escaped = true;
      continue;
    }

    if (char === '"') {
      inQuotes = !inQuotes;
      current += char;
      continue;
    }

    if (!inQuotes && char === "<") inAngle = true;
    if (!inQuotes && char === ">") inAngle = false;

    if (char === "," && !inQuotes && !inAngle) {
      entries.push(current);
      current = "";
      continue;
    }

    current += char;
  }

  entries.push(current);
  return entries.map((entry) => entry.trim()).filter(Boolean);
}

/**
 * Put "Doe, John <john@example.test>" back together.
 *
 * A bare comma is a separator, so strictly that is two entries, and strictly
 * the server should have quoted the name. It does not: the mirror emits
 * unquoted Outlook-style "Last, First" names, and splitting them produced "Doe"
 * as a recipient, which the send rejected as an invalid address.
 *
 * The rule is deliberately narrow: a fragment with no "@" immediately before an
 * angle-addr entry is that address's display name, and nothing else merges.
 */
function rejoinUnquotedDisplayNames(entries: string[]): string[] {
  const merged: string[] = [];

  for (const entry of entries) {
    const previous = merged[merged.length - 1];
    const isAngleAddr = /<[^>]*>\s*$/.test(entry);

    if (previous !== undefined && isAngleAddr && !previous.includes("@")) {
      merged[merged.length - 1] = `${previous}, ${entry}`;
      continue;
    }

    merged.push(entry);
  }

  return merged;
}

function unquoteName(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.length >= 2 && trimmed.startsWith('"') && trimmed.endsWith('"')) {
    return trimmed.slice(1, -1).replace(/\\(["\\])/g, "$1");
  }
  return trimmed;
}

/** Parse a header value into addresses, tolerating whatever the server sent. */
export function parseAddressList(
  value: string | null | undefined,
): MailAddress[] {
  if (typeof value !== "string" || value.trim() === "") return [];

  return (
    rejoinUnquotedDisplayNames(splitEntries(value))
      .map((entry) => {
        const open = entry.lastIndexOf("<");
        const close = entry.lastIndexOf(">");

        if (open !== -1 && close > open) {
          return {
            name: unquoteName(entry.slice(0, open)),
            email: entry.slice(open + 1, close).trim(),
          };
        }

        return { name: "", email: entry.trim() };
      })
      // Never hand the composer something that is not an address: a stray name
      // fragment reaching the send is what fails the whole message.
      .filter((address) => address.email.includes("@"))
  );
}

/** Render one address, quoting the display name when RFC 5322 requires it. */
export function formatAddress(address: MailAddress): string {
  const name = address.name.trim();
  if (name === "") return address.email;

  if (SPECIALS.test(name)) {
    const escaped = name.replace(/([\\"])/g, "\\$1");
    return `"${escaped}" <${address.email}>`;
  }

  return `${name} <${address.email}>`;
}

/** Render an address list for a To/Cc header or a composer field. */
export function formatAddressList(addresses: MailAddress[]): string {
  return addresses.map(formatAddress).join(", ");
}

function normalize(email: string): string {
  return email.trim().toLowerCase();
}

function dedupe(addresses: MailAddress[], exclude: Set<string>): MailAddress[] {
  const seen = new Set(exclude);
  const result: MailAddress[] = [];

  for (const address of addresses) {
    const key = normalize(address.email);
    if (key === "" || seen.has(key)) continue;
    seen.add(key);
    result.push(address);
  }

  return result;
}

export interface ReplySourceHeaders {
  from?: string | null;
  replyTo?: string | null;
  to?: string | null;
  cc?: string | null;
}

export interface ReplyRecipients {
  to: string;
  cc: string;
}

/**
 * Build the To and Cc for a reply.
 *
 * `ownAddresses` is every address that belongs to the sending account,
 * aliases included, so the replier is never copied on their own reply.
 */
export function buildReplyRecipients(
  headers: ReplySourceHeaders,
  options: { replyAll: boolean; ownAddresses?: readonly string[] },
): ReplyRecipients {
  const own = new Set(
    (options.ownAddresses ?? [])
      .map(normalize)
      .filter((address) => address !== ""),
  );

  // Reply-To exists precisely so the sender can redirect replies. Honour it.
  const replyTarget = parseAddressList(headers.replyTo);
  const primary =
    replyTarget.length > 0 ? replyTarget : parseAddressList(headers.from);

  if (!options.replyAll) {
    // A plain reply goes to the sender even when that is one of your own
    // addresses (replying to your own sent mail is a real thing).
    return { to: formatAddressList(dedupe(primary, new Set())), cc: "" };
  }

  const originalTo = parseAddressList(headers.to);
  let toList = dedupe([...primary, ...originalTo], own);

  // Replying to your own message: everyone on the original To line is the
  // audience. If that is empty too, keep the sender so the reply has a To.
  if (toList.length === 0) {
    toList = dedupe(primary, new Set());
  }

  const alreadyAddressed = new Set([
    ...own,
    ...toList.map((address) => normalize(address.email)),
  ]);
  const ccList = dedupe(parseAddressList(headers.cc), alreadyAddressed);

  return { to: formatAddressList(toList), cc: formatAddressList(ccList) };
}
