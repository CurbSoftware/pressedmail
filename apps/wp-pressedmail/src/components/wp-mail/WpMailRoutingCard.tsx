import { __ } from "@wordpress/i18n";

import { Label, RadioGroup, RadioGroupItem } from "@kit/ui/plugin";

import { SettingsSectionCard } from "@/components/settings-ui";

export interface WpMailRoutingCardProps {
  /** Whether WordPress email is set to go through PressedMail SMTP. */
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  /** At least one connection exists. */
  hasConnection: boolean;
  /** The default connection is enabled and complete, so the switch can be turned on. */
  hasUsableDefault: boolean;
  /** Another whole-option save is running. */
  disabled: boolean;
  /**
   * What to say when there is no connection, and when there is one that is not
   * ready. Both name the tab that holds the connections, and that tab is called
   * something different in each edition, so the tab owns the words.
   */
  noConnectionHint: string;
  notReadyHint: string;
  /**
   * What "PressedMail SMTP" means on this page, in the edition's own word for the
   * thing you set up: a mail server in Free, an SMTP account in Pro.
   */
  pressedmailDescription: string;
  /**
   * The option's name. "PressedMail SMTP" unless the site also sends through
   * a service another plugin provides, which the tab knows.
   */
  pressedmailTitle?: string;
}

/**
 * The master switch: does WordPress send its own email through PHP mail() or
 * through PressedMail SMTP. Both editions show it, in whichever panel decides
 * where WordPress sends its email.
 *
 * Mailbox mail is not affected either way, and the card says so.
 */
export function WpMailRoutingCard({
  enabled,
  onEnabledChange,
  hasConnection,
  hasUsableDefault,
  disabled,
  noConnectionHint,
  notReadyHint,
  pressedmailDescription,
  pressedmailTitle = __("PressedMail SMTP", "pressedmail"),
}: WpMailRoutingCardProps) {
  return (
    <SettingsSectionCard
      title={__("Where WordPress sends its own email", "pressedmail")}
      description={__(
        "Password resets, new user notices, WooCommerce order mail, form notifications: anything WordPress, a plugin or a theme sends.",
        "pressedmail",
      )}>
      <RadioGroup
        value={enabled ? "pressedmail" : "wordpress"}
        data-test="wp-mail-mailer-choice"
        onValueChange={(value) => {
          if (value === "pressedmail" && !hasUsableDefault) return;
          onEnabledChange(value === "pressedmail");
        }}
        className="space-y-3">
        <Label
          htmlFor="wp-mail-mailer-wordpress"
          className="flex cursor-pointer items-start gap-3 rounded-md border p-3 has-[input:checked]:border-primary/50 has-[input:checked]:bg-primary/5">
          {/* Base UI does not put this id on the element with the radio role,
              so the label around it does not name it: the spans do. */}
          <RadioGroupItem
            id="wp-mail-mailer-wordpress"
            data-test="wp-mail-mailer-wordpress"
            value="wordpress"
            disabled={disabled}
            aria-labelledby="wp-mail-mailer-wordpress-title"
            aria-describedby="wp-mail-mailer-wordpress-description"
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span id="wp-mail-mailer-wordpress-title" className="block text-sm font-medium">
              {__("WordPress default", "pressedmail")}
            </span>
            <span id="wp-mail-mailer-wordpress-description" className="block text-xs text-muted-foreground">
              {__(
                "PHP mail(). Fine on hosts that deliver it, and quietly dropped on the ones that do not.",
                "pressedmail",
              )}
            </span>
          </span>
        </Label>

        <Label
          htmlFor="wp-mail-mailer-pressedmail"
          data-test="wp-mail-mailer-pressedmail-option"
          // A disabled radio that keeps a pointer cursor and full-strength
          // text reads as available. Dim the whole option so the state is
          // visible before it is clicked.
          className={`flex items-start gap-3 rounded-md border p-3 has-[input:checked]:border-primary/50 has-[input:checked]:bg-primary/5 ${
            hasUsableDefault ? "cursor-pointer" : "cursor-not-allowed opacity-60"
          }`}>
          <RadioGroupItem
            id="wp-mail-mailer-pressedmail"
            data-test="wp-mail-enabled"
            value="pressedmail"
            disabled={disabled || !hasUsableDefault}
            aria-labelledby="wp-mail-mailer-pressedmail-title"
            aria-describedby="wp-mail-mailer-pressedmail-description"
            className="mt-0.5"
          />
          <span className="space-y-1">
            <span id="wp-mail-mailer-pressedmail-title" className="block text-sm font-medium">
              {pressedmailTitle}
            </span>
            <span id="wp-mail-mailer-pressedmail-description" className="block text-xs text-muted-foreground">
              {pressedmailDescription}
            </span>
            {!hasConnection ? (
              <span
                className="block text-xs text-warning"
                data-test="wp-mail-mailer-blocked"
                data-testid="wp-mail-mailer-blocked">
                {noConnectionHint}
              </span>
            ) : !hasUsableDefault ? (
              <span
                className="block text-xs text-warning"
                data-test="wp-mail-mailer-blocked"
                data-testid="wp-mail-mailer-blocked">
                {notReadyHint}
              </span>
            ) : null}
          </span>
        </Label>
      </RadioGroup>

      <p
        className="mt-4 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground"
        data-test="wp-mail-inbox-note"
        data-testid="wp-mail-inbox-note">
        {__(
          "Your PressedMail inboxes are not affected either way. Mail you send from an inbox always goes out through that account's own server, so it stays authorised for its domain.",
          "pressedmail",
        )}
      </p>
    </SettingsSectionCard>
  );
}
