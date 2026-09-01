import type { EmailAccount, EmailMessage } from "@/types";

function titleCase(input: string): string {
  if (!input) return "";
  return input
    .split(/[._-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
    .join(" ");
}

function localPart(email: string): string {
  const at = email.indexOf("@");
  return at > 0 ? email.slice(0, at) : email;
}

/**
 * Returns a short display label for an account.
 * Precedence: explicit label > explicit name > title-cased local-part of email.
 */
export function getAccountLabel(account: EmailAccount): string {
  if (account.label && account.label.trim()) return account.label.trim();
  if (account.name && account.name.trim()) return account.name.trim();
  return titleCase(localPart(account.email ?? ""));
}

/**
 * Returns the badge label for a message's account, or null if none.
 * Detects the case where accountLabel was set to the full email and re-derives.
 */
export function getAccountBadgeLabel(message: EmailMessage): string | null {
  const accountEmail = message.accountEmail ?? "";
  const accountLabel = message.accountLabel ?? "";
  if (!accountEmail && !accountLabel) return null;
  if (accountLabel && accountLabel.includes("@")) {
    return titleCase(localPart(accountLabel));
  }
  if (accountLabel) return accountLabel;
  return titleCase(localPart(accountEmail)) || accountEmail || null;
}
