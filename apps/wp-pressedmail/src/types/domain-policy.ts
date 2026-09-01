export const DOMAIN_POLICY_VERSION = 1 as const;

export type ManagedSecurity = "SSL/TLS" | "STARTTLS" | "None";
export type UsernameFormat = "full_email" | "local_part";
export type CredentialMode = "shared" | "separate";

export interface ManagedProtocolConfig {
  host: string;
  port: number;
  security: ManagedSecurity;
  username_format: UsernameFormat;
}

export interface ManagedDomainConfig {
  domain: string;
  imap: ManagedProtocolConfig;
  smtp: ManagedProtocolConfig;
  credential_mode: CredentialMode;
}

export interface DomainPolicyV1 {
  version: typeof DOMAIN_POLICY_VERSION;
  enabled: boolean;
  domains: ManagedDomainConfig[];
}

export interface ManagedProtocolDraft {
  host: string;
  port: number;
  security: ManagedSecurity | "";
  username_format: UsernameFormat | "";
}

export interface ManagedDomainDraft {
  domain: string;
  imap: ManagedProtocolDraft;
  smtp: ManagedProtocolDraft;
  credential_mode: CredentialMode | "";
}

export interface DomainPolicyDraftV1 {
  version: typeof DOMAIN_POLICY_VERSION;
  enabled: boolean;
  domains: ManagedDomainDraft[];
}

export interface ManagedDomainSetupRuntime {
  enabled: boolean;
  domains: Array<{
    domain: string;
    imap_username_format: UsernameFormat;
    smtp_username_format: UsernameFormat;
    credential_mode: CredentialMode;
  }>;
  revision: string;
}

type ManagedDomainAccountExclusions = {
  email?: never;
  displayName?: never;
  firstName?: never;
  lastName?: never;
  appPassword?: never;
  provider?: never;
  imapHost?: never;
  imapPort?: never;
  imapSecurity?: never;
  imapUsername?: never;
  smtpHost?: never;
  smtpPort?: never;
  smtpSecurity?: never;
  smtpUsername?: never;
  useSeparateCredentials?: never;
  useOAuth?: never;
  outgoingProviderType?: never;
  outgoingProviderConfig?: never;
  credentialMode?: never;
  nonce?: never;
};

export type ManagedDomainAccountInput = ManagedDomainAccountExclusions &
  (
    | {
        managed: true;
        localPart: string;
        domain: string;
        senderName: string;
        password: string;
        imapPassword?: never;
        smtpPassword?: never;
      }
    | {
        managed: true;
        localPart: string;
        domain: string;
        senderName: string;
        password?: never;
        imapPassword: string;
        smtpPassword: string;
      }
  );

export type DomainPolicyFieldErrors = Record<string, string>;

export interface AdminConnectedAccountRow {
  account_id: number;
  user: {
    id: number;
    login: string;
    display_name: string;
    email: string;
  };
  account_email: string;
  sender_name: string;
  provider: string;
  health: {
    status: string;
    failure_count: number;
    error_at: string | null;
    retry_after: string | null;
  };
  last_sync: string | null;
  created_at: string;
  compliance:
    | "compliant"
    | "out_of_policy"
    | "policy_disabled"
    | "policy_invalid";
}

export interface AdminConnectedAccountsPage {
  items: AdminConnectedAccountRow[];
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface PurgeConfirmationPreview {
  status: "error";
  code: "PURGE_CONFIRMATION_REQUIRED";
  affected_count: number;
  confirmation_id: string;
  expires_at: string;
}

export interface PurgeResult {
  status: "success" | "partial";
  requested_count: number;
  purged_count: number;
  failed_count: number;
  failures: Array<{ account_id: number; code: string }>;
}
