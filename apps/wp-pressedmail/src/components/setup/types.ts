import type { FC, SVGProps } from "react";

export type IconComponent =
  | FC<SVGProps<SVGSVGElement>>
  | FC<{ className?: string }>;

export type ProviderKey =
  | "gmail"
  | "outlook"
  | "yahoo"
  | "icloud"
  | "protonmail"
  | "custom";

export interface ProviderConfig {
  name: string;
  icon: IconComponent;
  imap: {
    host: string;
    port: number;
    security: string;
  };
  smtp: {
    host: string;
    port: number;
    security: string;
  };
  oauth: boolean;
  /** Preset is a starting point only. The wizard exposes editable server fields (like custom). */
  advanced?: boolean;
  /** Renders an "Experimental" badge on the provider card. */
  experimental?: boolean;
  /** Absolute URL to provider-specific connection documentation; renders a "Docs" chip on the card. */
  docUrl?: string;
}

export type OutgoingProviderType =
  | "smtp"
  | "sendgrid"
  | "ses"
  | "mailgun"
  | "postmark";

export interface SetupFormData {
  provider: ProviderKey | "";
  email: string;
  password: string;
  displayName: string;
  imapHost: string;
  imapPort: number;
  imapSecurity: string;
  imapUsername: string;
  imapPassword: string;
  smtpHost: string;
  smtpPort: number;
  smtpSecurity: string;
  smtpUsername: string;
  smtpPassword: string;
  useSeparateCredentials: boolean;
  useOAuth: boolean;
  testConnection: boolean;
  /** Phase B: outgoing-provider override. Default "smtp" preserves legacy behavior. */
  outgoingProviderType: OutgoingProviderType;
  /** Provider-specific bag (SendGrid stores api_key here). */
  outgoingProviderConfig: Record<string, string>;
}

export interface ManagedSetupFormData {
  localPart: string;
  domain: string;
  senderName: string;
  credentialMode: "shared" | "separate";
  password: string;
  imapPassword: string;
  smtpPassword: string;
}

export interface ManagedSetupFormErrors {
  localPart?: string;
  domain?: string;
  senderName?: string;
  password?: string;
  imapPassword?: string;
  smtpPassword?: string;
  test?: string;
  submit?: string;
}

export interface SetupFormErrors {
  provider?: string;
  email?: string;
  displayName?: string;
  password?: string;
  imapHost?: string;
  smtpHost?: string;
  imapPort?: string;
  smtpPort?: string;
  imapUsername?: string;
  imapPassword?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  outgoingProviderApiKey?: string;
  outgoingProviderAccessKeyId?: string;
  outgoingProviderSecretAccessKey?: string;
  outgoingProviderRegion?: string;
  outgoingProviderDomain?: string;
  outgoingProviderServerToken?: string;
  test?: string;
  submit?: string;
}

export interface ConnectionStatus {
  success: boolean;
  message: string;
  suggestion?: string;
}

export interface ConnectionTestState {
  imapStatus: "pending" | "testing" | "success" | "error";
  imapMessage: string;
  smtpStatus: "pending" | "testing" | "success" | "error";
  smtpMessage: string;
}
