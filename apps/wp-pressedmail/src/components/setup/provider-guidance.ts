import { __ } from "@wordpress/i18n";

import type { SetupFormData } from "./types";

export interface ProviderGuidanceEntry {
  /** Short heading, e.g. "Yahoo needs an app password". */
  title: string;
  /** Numbered walkthrough. Empty for prose-only guidance. */
  steps: string[];
  /** External deep link into the provider's security settings. */
  link?: { href: string; label: string };
  /** Highlighted "not your normal password" style warning. */
  warning?: string;
  /** Plain supporting text rendered below the steps. */
  note?: string;
}

/**
 * Per-provider credential guidance for the wizard's credentials step.
 * Providers without app-password flows (custom) get a short note only.
 */
export function getProviderGuidance(
  provider: SetupFormData["provider"],
  email: string,
): ProviderGuidanceEntry | null {
  const domain = email.split("@")[1]?.toLowerCase() ?? "";

  if (provider === "gmail") {
    if (domain && domain !== "gmail.com" && domain !== "googlemail.com") {
      return {
        title: __("Google Workspace account", "pressedmail"),
        steps: [],
        note: __(
          "Google Workspace accounts may require an app password or admin-enabled IMAP access.",
          "pressedmail",
        ),
        link: {
          href: "https://myaccount.google.com/apppasswords",
          label: __("Google app passwords", "pressedmail"),
        },
      };
    }
    return {
      title: __(
        "Use a generated Gmail app password, not your regular Google password.",
        "pressedmail",
      ),
      steps: [
        __(
          "Turn on 2-Step Verification for your Google account (required before app passwords appear).",
          "pressedmail",
        ),
        __(
          'Open Google app passwords and create one named "PressedMail".',
          "pressedmail",
        ),
        __(
          "Copy the 16-character password and paste it below. Spaces are removed automatically.",
          "pressedmail",
        ),
      ],
      link: {
        href: "https://myaccount.google.com/apppasswords",
        label: __("Google app passwords", "pressedmail"),
      },
    };
  }

  if (provider === "yahoo") {
    return {
      title: __("Yahoo needs an app password", "pressedmail"),
      steps: [
        __("Sign in to Yahoo and open Account Security.", "pressedmail"),
        __(
          'Under "External connections", choose Create app password and name it "PressedMail".',
          "pressedmail",
        ),
        __("Copy the generated password and paste it below.", "pressedmail"),
      ],
      link: {
        href: "https://login.yahoo.com/account/security",
        label: __("Yahoo Account Security", "pressedmail"),
      },
      warning: __(
        "Use the generated app password, not your regular Yahoo password.",
        "pressedmail",
      ),
    };
  }

  if (provider === "icloud") {
    return {
      title: __("iCloud needs an app-specific password", "pressedmail"),
      steps: [
        __(
          "Make sure two-factor authentication is enabled for your Apple Account (required).",
          "pressedmail",
        ),
        __(
          'Open your Apple Account, go to Sign-In and Security → App-Specific Passwords, and create one named "PressedMail".',
          "pressedmail",
        ),
        __(
          "Copy the password and paste it below. Keep the dashes exactly as shown.",
          "pressedmail",
        ),
      ],
      link: {
        href: "https://account.apple.com/account/manage",
        label: __("Apple Account", "pressedmail"),
      },
      warning: __(
        "Use the app-specific password, not your Apple Account password.",
        "pressedmail",
      ),
      note: __(
        "Your username is usually your full iCloud address. If sign-in fails, try just the part before the @.",
        "pressedmail",
      ),
    };
  }

  if (provider === "outlook") {
    // No guidance box: the Connect Microsoft Account button is the flow.
    return null;
  }

  if (provider === "protonmail") {
    return {
      title: __("Proton Mail uses Bridge credentials", "pressedmail"),
      steps: [],
      note: __(
        "You will enter the IMAP/SMTP settings and credentials shown in your Proton Mail Bridge app in the next step.",
        "pressedmail",
      ),
    };
  }

  if (provider === "custom") {
    return {
      title: __("Custom email server", "pressedmail"),
      steps: [],
      note: __(
        "Server settings and credentials will be configured in the next step.",
        "pressedmail",
      ),
    };
  }

  if (!provider) {
    return null;
  }

  return {
    title: __("Provider credentials", "pressedmail"),
    steps: [],
    note: __(
      "Use the account password or app password required by this provider.",
      "pressedmail",
    ),
  };
}
