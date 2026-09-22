/**
 * Central type definitions for PressedMail
 */

import type { Dispatch, ReactNode, SetStateAction } from "react";

import type { ImapFolder } from "@/services/interfaces";
import type { LucideIcon } from "lucide-react";
import type { ManagedDomainAccountInput } from "./domain-policy";
import type { ContactListRecipientDescriptor } from "./recipients";

// ============== Email & Message Types ==============

/**
 * Minimal user-defined tag projection attached to an `EmailMessage` for
 * list-view rendering. Sourced from `wp_pressedmail_message_tags` ↔
 * `wp_pressedmail_tags` and intentionally kept small (no AI prompt, etc.).
 */
export interface EmailMessageTag {
  id: number;
  name: string;
  color: string;
  icon?: string | null;
}

export type EmailContentType = "html" | "plain";

/**
 * Who decided a message is important: the sender's own high-priority header,
 * the provider's importance marker, or the user's own toggle. Null or absent
 * means the message is not important and there is nothing to explain.
 */
export type EmailImportanceSource = "sender" | "provider" | "override";

export interface DraftDocument {
  version: 1;
  dialect: "markdown" | "rich_text";
  value: import("@kit/plate").Value;
}

export interface EmailMessage {
  id: string | number;
  uid?: string | number;
  subject: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  /** Local-only contact-list labels. Resolved member addresses are never exposed. */
  contactLists?: ContactListRecipientDescriptor[];
  contact_lists?: ContactListRecipientDescriptor[];
  date: string;
  body?: string;
  htmlBody?: string;
  plainBody?: string;
  textBody?: string;
  /** Site-local editor state for this exact IMAP draft. Never part of MIME. */
  draftDocument?: DraftDocument;
  /** Normalized MIME body kind (camelCase and REST-compatible snake_case). */
  contentType?: EmailContentType;
  content_type?: EmailContentType;
  /** Completeness of the live MIME detail response. */
  bodyState?: "pending" | "partial" | "full";
  bodyOmitted?: boolean;
  body_state?: "pending" | "partial" | "full";
  text?: string;
  name?: string;
  email?: string;
  msg_no?: string | number;
  /**
   * Read state. Absent when the server has not observed the message's \Seen
   * flag, which is every live detail fetch whose provider returned no Seen
   * value. The reading pane merges a detail into its list row with
   * array_replace, so an absent flag leaves the previously known state alone.
   */
  read?: boolean;
  starred?: boolean;
  /** Whether the sender marked this email as high priority (read-only) */
  important?: boolean;
  /** Legacy backend key for sender-marked high priority rows. */
  is_important?: boolean;
  /**
   * Why `important` is set. Null when the message is not important, so a row
   * can say who flagged it instead of a bare "Important".
   */
  importanceSource?: EmailImportanceSource | null;
  labels?: string[];
  /** User-defined tags applied to this message (cross-folder classification). */
  tags?: EmailMessageTag[];
  attachments?: EmailAttachment[];
  attachmentsMeta?: EmailAttachmentMeta[];
  hasAttachments?: boolean;
  snippet?: string;
  preview?: string;
  folder?: string;
  folderLabel?: string;
  messageId?: string;
  message_id?: string;
  uidValidity?: string | number;
  uid_validity?: string | number;
  inReplyTo?: string;
  references?: string;
  /** Account ID - present in consolidated inbox view. */
  accountId?: number;
  /** Account email address - present in consolidated inbox view. */
  accountEmail?: string;
  /** Account provider (gmail, outlook, imap) - present in consolidated inbox view. */
  accountProvider?: string;
  /** Account display label - present in consolidated inbox view. */
  accountLabel?: string;
  /** Composite unique ID (accountId:uid) for disambiguating messages across accounts. */
  consolidatedUid?: string;
  /** Thread ID - present when threading is enabled. */
  threadId?: string;
  /** Total messages represented by this row when server-side threading is active. */
  threadCount?: number;
  /** Unread messages represented by this row when server-side threading is active. */
  threadUnreadCount?: number;
  /** Message identifiers included in this server-side thread. */
  threadMessageIds?: Array<string | number>;
  /** Parsed iTip envelope when the message carries a text/calendar METHOD. */
  itip?: import("./itip").ITipEvent;
  /**
   * Scheduled-send metadata. The server annotates mirrored Drafts rows that back
   * a scheduled email so the Scheduled view can show the send time + actions.
   */
  isScheduled?: boolean;
  scheduledEmailId?: number;
  scheduledAt?: string;
  scheduledStatus?: "pending" | "sending" | "sent" | "failed" | "cancelled";
  draftUid?: number;
  draftFolder?: string;
  /** Local Snoozed view: durable record ID, never an IMAP UID. */
  snoozed?: boolean;
  snooze_id?: number;
  snooze_until?: string;
  original_folder?: string;
  [key: string]: any;
}

export type EmailThreadGroupMap = Record<string, EmailMessage[]>;

/**
 * Represents a conversation thread containing multiple messages.
 */
export interface EmailThread {
  /** Unique thread identifier */
  id: string;
  /** Normalized subject line (without Re:, Fwd: prefixes) */
  subject: string;
  /** List of participant email addresses */
  participants: string[];
  /** Messages in the thread, sorted by date (oldest first) */
  messages: EmailMessage[];
  /** Date of the most recent message */
  latestDate: string;
  /** Date of the earliest message */
  earliestDate: string;
  /** Number of unread messages in the thread */
  unreadCount: number;
  /** Whether any message has attachments */
  hasAttachments: boolean;
  /** Combined labels from all messages */
  labels: string[];
  /** Total number of messages in thread */
  messageCount: number;
  /** Preview text from the latest message */
  preview: string;
  /** Sender of the latest message */
  latestSender: string;
}

export interface EmailAttachment {
  id?: string;
  wpAttachmentId?: number;
  /** Exact bytes approved for a queued delivery. */
  sha256?: string;
  filename: string;
  mimeType: string;
  size: number;
  url?: string;
  data?: string | ArrayBuffer;
  mime?: string;
  source?: "received" | "media-library";
  inline?: boolean;
  part?: string | null;
  part_format?: string | null;
  metadata_format?: string | null;
}

export interface EmailAttachmentMeta {
  filename: string;
  mime: string;
  size: number;
  inline?: boolean;
  part?: string | null;
  part_format?: string | null;
  metadata_format?: string | null;
}

/** Stable mailbox context retained while composing a reply. */
export interface ComposeReplySource {
  identity: string;
  accountId?: string | number;
  folder?: string;
  uid?: string | number;
  msgNo?: string | number;
}

export interface ComposeData {
  /** Explicit consent for this message, bound to the current server revision. */
  readReceipt?: { requested: boolean; revision: string };
  /** RFC threading headers preserved through draft and delivery paths. */
  inReplyTo?: string;
  references?: string;
  /** Selected sender survives switching between compact and desktop composers. */
  fromAccount?: string;
  to: string;
  cc: string;
  bcc: string;
  /** Private list recipients shown by name and resolved by the server at send time. */
  contactLists?: ContactListRecipientDescriptor[];
  subject: string;
  body: string;
  draftDocument?: DraftDocument;
  /** MIME body mode. Missing legacy drafts are treated as HTML. */
  contentType?: EmailContentType;
  /** Persisted compose intent so forwards do not reopen as new messages. */
  mode?: "new" | "reply" | "reply-all" | "forward";
  bodyBackgroundColor?: string;
  /** Composer canvas pane color (editing aid only. Never sent or saved). */
  canvasBackgroundColor?: string;
  attachments: Array<EmailAttachment | File>;
  /** IMAP UID of the draft being edited, used to replace the old draft copy on save. */
  draftUid?: string;
  /** IMAP folder path of the draft being edited, paired with draftUid. */
  draftFolder?: string;
  /** Account that owns draftUid/draftFolder, independent of the mutable From account. */
  draftAccountId?: string | number;
  /** UIDVALIDITY of the Drafts mailbox when draftUid was read. */
  draftUidValidity?: string | number;
  /** RFC Message-ID of the draft, including angle brackets. */
  draftMessageId?: string;
  /** False when the server reported attachments without exact MIME part coordinates. */
  draftAttachmentManifestComplete?: boolean;
  /** One-shot: set when a server draft is opened, cleared by the composer once it records the clean state. */
  draftOpened?: boolean;
  scheduledEmailId?: number;
  scheduledAccountId?: number;
  scheduledAt?: string;
  /** Originating message used by reply-only post-send actions. */
  replySource?: ComposeReplySource;
}

export interface GroupedMessage {
  name: string;
  count: number;
  emails: EmailMessage | EmailMessage[];
  icon?: LucideIcon;
}

// ============== Account Types ==============

export interface EmailAccount {
  id: string | number;
  email: string;
  provider:
    | "gmail"
    | "outlook"
    | "yahoo"
    | "icloud"
    | "protonmail"
    | "zoho"
    | "aol"
    | "custom"
    | "other";
  label?: string;
  first_name?: string;
  last_name?: string;
  name?: string;
  icon?: ReactNode;

  // IMAP Configuration
  imapHost?: string;
  imapPort?: number;
  imapUsername?: string;
  imapPassword?: string;
  imapSecurity?: "SSL" | "TLS" | "STARTTLS" | "none";
  imap_host?: string;
  imap_port?: number;
  imap_security?: "SSL" | "TLS" | "STARTTLS" | "none" | "SSL/TLS" | "None";
  imap_username?: string;

  // SMTP Configuration
  smtpHost?: string;
  smtpPort?: number;
  smtpUsername?: string;
  smtpPassword?: string;
  smtpSecurity?: "SSL" | "TLS" | "STARTTLS" | "none";
  smtp_host?: string;
  smtp_port?: number;
  smtp_security?: "SSL" | "TLS" | "STARTTLS" | "none" | "SSL/TLS" | "None";
  smtp_username?: string;

  // Separate credentials mode
  useSeparateCredentials?: boolean;
  use_separate_credentials?: boolean | number | string;

  // Phase B: outgoing-provider override.
  outgoing_provider_type?: "smtp" | "sendgrid" | "ses" | "mailgun" | "postmark";

  // OAuth
  accessToken?: string;
  refreshToken?: string;
  tokenExpiry?: string;

  // Metadata
  createdAt?: string;
  updatedAt?: string;
  isActive?: boolean;
  /** Whether this account is the user's default (server-stamped on /accounts/get). */
  is_default?: boolean;

  // Shared Account Properties
  is_shared?: boolean;
  permission?: "view_only" | "reply" | "full";
  owner_name?: string;
  shared_by?: string | number;
  shared_at?: string;
}

export interface AccountFormData {
  email: string;
  provider:
    | "gmail"
    | "outlook"
    | "yahoo"
    | "icloud"
    | "protonmail"
    | "zoho"
    | "aol"
    | "custom"
    | "other";
  displayName?: string;

  // IMAP fields
  imapHost: string;
  imapPort: number;
  imapUsername: string;
  imapPassword: string;
  imapSecurity: "SSL" | "TLS" | "STARTTLS" | "none";

  // SMTP fields
  smtpHost: string;
  smtpPort: number;
  smtpUsername: string;
  smtpPassword: string;
  smtpSecurity: "SSL" | "TLS" | "STARTTLS" | "none";
}

// ============== Context Types ==============

export interface AppUser {
  id: number;
  name: string;
  email: string;
  hasCompletedSetup: boolean;
  avatar?: string;
  username?: string;
}

export interface OrdinaryAccountData {
  managed?: never;
  email: string;
  displayName: string;
  password?: string;
  provider:
    | "gmail"
    | "outlook"
    | "yahoo"
    | "icloud"
    | "protonmail"
    | "zoho"
    | "aol"
    | "custom"
    | "other";
  imapHost?: string;
  imapPort?: number;
  imapSecurity?: string;
  imapUsername?: string;
  imapPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  useSeparateCredentials?: boolean;
  useOAuth?: boolean;
  /** Phase B: outgoing-provider selector. Default "smtp" preserves legacy. */
  outgoingProviderType?: "smtp" | "sendgrid" | "ses" | "mailgun" | "postmark";
  /** Adapter-specific bag (e.g. SendGrid api_key). Omit when type is smtp. */
  outgoingProviderConfig?: Record<string, string>;
  /** Opaque, owner-bound claim required only when Free creates an account. */
}

export type AccountData = OrdinaryAccountData | ManagedDomainAccountInput;

export interface OrdinaryAccountUpdateInput {
  managed?: never;
  firstName?: string;
  lastName?: string;
  email?: string;
  appPassword?: string;
  provider?: EmailAccount["provider"];
  imapHost?: string;
  imapPort?: number;
  imapSecurity?: string;
  imapUsername?: string;
  imapPassword?: string;
  smtpHost?: string;
  smtpPort?: number;
  smtpSecurity?: string;
  smtpUsername?: string;
  smtpPassword?: string;
  useSeparateCredentials?: boolean;
  useOAuth?: boolean;
  outgoingProviderType?: "smtp" | "sendgrid" | "ses" | "mailgun" | "postmark";
  outgoingProviderConfig?: Record<string, string>;
}

export type AccountUpdateInput =
  | OrdinaryAccountUpdateInput
  | ManagedDomainAccountInput;

export interface AppContextType {
  user: AppUser | null;
  setUser: Dispatch<SetStateAction<AppUser | null>>;
  accounts: EmailAccount[];
  setAccounts: Dispatch<SetStateAction<EmailAccount[]>>;
  addAccount: (accountData: AccountData) => Promise<EmailAccount>;
  removeAccount: (accountId: string | number) => Promise<void>;
  removeSelectedAccount: (selectedAccount: string) => Promise<void>;
  updateAccount: (
    accountId: string | number,
    updates: AccountUpdateInput,
  ) => Promise<any>;
  reloadAccounts: () => Promise<void>;
  isLoading: boolean;
  error: string | null;
  setError: Dispatch<SetStateAction<string | null>>;
  hasCompletedSetup: boolean;
  onComplete: (formData: AccountData) => Promise<EmailAccount>;
  createAccount: () => void;
  isAddAccount: boolean;
  setIsAddAccount: (isAdd: boolean) => void;
  editingAccount: EmailAccount | null;
  setEditingAccount: Dispatch<SetStateAction<EmailAccount | null>>;
  selectedAccount: string | null;
  setSelectedAccount: (email: string | null) => void;
  selectedConsolidatedAccountIds: number[];
  setSelectedConsolidatedAccountIds: Dispatch<SetStateAction<number[]>>;
  /** The user's default account id (server source of truth), or null when none. */
  defaultAccountId: number | null;
  /** Set the user's default account; POSTs /accounts/set-default and syncs context. */
  setDefaultAccount: (accountId: number | string) => Promise<void>;
  selectedMessage: EmailMessage | null;
  setSelectedMessage: Dispatch<SetStateAction<EmailMessage | null>>;
  clearSelectedMessage: () => void;
  setNumberOfMessages: Dispatch<SetStateAction<number>>;
  numberOfMessages: number;
}

export interface PageState {
  querySet: any[];
  page: number;
  window: number;
  rows: number;
}

// ============== Component Props ==============

export interface StepProps {
  stepCount?: (step: number) => void;
  setProvider?: (provider: string) => void;
}

export interface NavLink {
  title: string;
  label?: string;
  icon: LucideIcon;
  variant?: "default" | "ghost";
  onClick?: () => void;
}

export interface MailProps {
  accounts: EmailAccount[];
  mails: EmailMessage[];
  defaultLayout?: number[];
  defaultCollapsed?: boolean;
  navCollapsedSize: number;
  layoutVariant?: "classic" | "roundcube";
  listVariant?: "default" | "paginated";
  pageSize?: 50 | 100;
  showComposer?: boolean;
}

// ============== API Response Types ==============

export interface ApiSuccessResponse<T = any> {
  success: true;
  data: T;
  message?: string;
}

export interface ApiErrorResponse {
  success: false;
  error: string;
  message: string;
  code?: string | number;
}

export type ApiResponse<T = any> = ApiSuccessResponse<T> | ApiErrorResponse;

export interface MessagesLoadResponse {
  emails: EmailMessage[];
  grouped_messages?: GroupedMessage[];
  total?: number;
  page?: number;
  pages?: number;
}

export interface AccountConnectionTestResponse {
  success: boolean;
  message: string;
  imap?: boolean;
  smtp?: boolean;
}

// ============== Theme Types ==============

export interface ThemeColors {
  container: string;
  panel: string;
  tabsHeader: string;
  tabsTitle: string;
  tabsActions: string;
  tabsButtons: string;
  tabsButton: string;
  searchContainer: string;
  searchForm: string;
  searchIcon: string;
  searchInput: string;
  mailList: string;
  mailItem: string;
  mailItemSelected: string;
  mailDisplay: string;
  [key: string]: string;
}

export type ThemeType = "light" | "dark" | "gmail" | "outlook" | "custom";

// ============== Utility Types ==============

export type Nullable<T> = T | null;
export type Optional<T> = T | undefined;
export type Maybe<T> = T | null | undefined;

// WordPress integration types are declared in types/shims.d.ts

// ============== Search Types ==============
export * from "./search";
