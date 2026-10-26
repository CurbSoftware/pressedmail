import type { InputHTMLAttributes } from "react";

export type PressedMailSensitiveField =
  | "ai-api-key"
  | "captcha-secret-key"
  | "license-key"
  | "mail-account-password"
  | "mailbox-lock-passphrase"
  | "mailbox-lock-passphrase-confirm"
  | "mailbox-lock-passphrase-new"
  | "mailbox-lock-passphrase-new-confirm"
  | "oauth-client-secret"
  | "sending-api-key"
  | "wordpress-password";

type SensitiveInputProps = InputHTMLAttributes<HTMLInputElement> & {
  "data-1p-ignore": "true";
  "data-form-type": "other";
  "data-lpignore": "true";
  "data-pressedmail-sensitive-field": PressedMailSensitiveField;
};

const NEW_PASSWORD_FIELDS: ReadonlySet<PressedMailSensitiveField> = new Set([
  "mail-account-password",
  "mailbox-lock-passphrase",
  "mailbox-lock-passphrase-confirm",
  "mailbox-lock-passphrase-new",
  "mailbox-lock-passphrase-new-confirm",
]);

function autoCompleteFor(field: PressedMailSensitiveField): string {
  if (field === "wordpress-password") return "current-password";
  return NEW_PASSWORD_FIELDS.has(field) ? "new-password" : "off";
}

/**
 * Username a password manager files the lock passphrase under, so it never
 * lands on (or is offered from) the WordPress login entry.
 */
export const MAILBOX_LOCK_USERNAME = "pressedmail-lock";

export function sensitiveInputProps(
  field: PressedMailSensitiveField,
): SensitiveInputProps {
  return {
    autoCapitalize: "off",
    // Chrome and Firefox ignore "off" on a password field and fill it with the
    // WordPress login. "new-password" is the one value they respect, so every
    // password-like field that is not the WordPress password gets it. The
    // WordPress password itself is the one field where filling it is right.
    autoComplete: autoCompleteFor(field),
    autoCorrect: "off",
    "data-1p-ignore": "true",
    "data-form-type": "other",
    "data-lpignore": "true",
    "data-pressedmail-sensitive-field": field,
    spellCheck: false,
  };
}
