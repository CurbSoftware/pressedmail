import type { FormHTMLAttributes, ReactNode } from "react";

import { MAILBOX_LOCK_USERNAME } from "@/lib/sensitive-input-props";

type LockFieldsFormProps = Omit<
  FormHTMLAttributes<HTMLFormElement>,
  "onSubmit"
> & {
  children: ReactNode;
  onSubmit?: () => void;
};

/**
 * A form of its own around the PressedMail Lock passphrase fields.
 *
 * Password managers pair a password field with the nearest username field in
 * the same form. Left loose on a wp-admin page, the passphrase was paired with
 * the WordPress login, so the browser filled the WordPress password in and
 * offered to overwrite the saved login with the passphrase. The hidden
 * username gives them a separate entry to file it under.
 */
export function LockFieldsForm({
  children,
  onSubmit,
  ...rest
}: LockFieldsFormProps) {
  return (
    <form
      autoComplete="off"
      {...rest}
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit?.();
      }}>
      <input
        type="hidden"
        name="username"
        autoComplete="username"
        value={MAILBOX_LOCK_USERNAME}
      />
      {children}
    </form>
  );
}
