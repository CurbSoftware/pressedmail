import type { InputHTMLAttributes } from "react";

export type PressedMailSensitiveField =
  | "ai-api-key"
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
    autoComplete: "off",
    autoCorrect: "off",
    "data-1p-ignore": "true",
    "data-form-type": "other",
    "data-lpignore": "true",
    "data-pressedmail-sensitive-field": field,
    spellCheck: false,
  };
}
