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

export function sensitiveInputProps(
  field: PressedMailSensitiveField,
): SensitiveInputProps {
  return {
    autoCapitalize: "off",
    // Chrome and Firefox ignore "off" on a password field and fill it with the
    // WordPress login. "new-password" is the one value they respect.
    autoComplete: field === "mail-account-password" ? "new-password" : "off",
    autoCorrect: "off",
    "data-1p-ignore": "true",
    "data-form-type": "other",
    "data-lpignore": "true",
    "data-pressedmail-sensitive-field": field,
    spellCheck: false,
  };
}
