import { __ } from "@wordpress/i18n";

import { GmailIcon, OutlookIcon } from "@/components/Icons/providers";
import { PressedMailLaunchIcon } from "@/components/Icons/PressedMailLaunchIcon";

import type { ProviderConfig, ProviderKey } from "./types";

export const PROVIDERS = {
  gmail: {
    name: "Gmail",
    icon: GmailIcon,
    imap: { host: "imap.gmail.com", port: 993, security: "SSL/TLS" },
    smtp: { host: "smtp.gmail.com", port: 587, security: "STARTTLS" },
    oauth: false,
    docUrl: "https://pressedmail.com/docs/gmail-google-workspace",
  },
  outlook: {
    name: "Outlook/Hotmail",
    icon: OutlookIcon,
    imap: { host: "outlook.office365.com", port: 993, security: "SSL/TLS" },
    smtp: { host: "smtp-mail.outlook.com", port: 587, security: "STARTTLS" },
    oauth: true,
    docUrl: "https://pressedmail.com/docs/outlook-microsoft-365",
  },
  custom: {
    name: __("Custom email", "pressedmail"),
    icon: PressedMailLaunchIcon,
    imap: { host: "", port: 993, security: "SSL/TLS" },
    smtp: { host: "", port: 587, security: "STARTTLS" },
    oauth: false,
    docUrl: "https://pressedmail.com/docs/custom-imap-smtp",
  },
} as Record<ProviderKey, ProviderConfig>;

export function normalizeProvider(provider?: string): ProviderKey | "" {
  if (!provider) return "";
  return provider in PROVIDERS ? (provider as ProviderKey) : "custom";
}

export function isAdvancedProvider(provider?: string): boolean {
  return provider === "custom";
}

const PROVIDER_DOMAINS: Record<string, "gmail" | "outlook"> = {
  "gmail.com": "gmail",
  "googlemail.com": "gmail",
  "msn.com": "outlook",
};

export function detectProviderFromEmail(email: string): ProviderKey | null {
  const atIndex = email.lastIndexOf("@");
  if (atIndex < 1) return null;

  const domain = email.slice(atIndex + 1).trim().toLowerCase();
  if (!domain || !domain.includes(".")) return null;

  const exact = PROVIDER_DOMAINS[domain];
  if (exact) return exact;

  const family = domain.split(".")[0];
  return family === "outlook" || family === "hotmail" || family === "live"
    ? "outlook"
    : null;
}
