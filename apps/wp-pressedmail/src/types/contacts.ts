/**
 * Contact Types
 *
 * TypeScript definitions for the Contacts feature.
 * Available in all tiers with tier-based limits (Free: 25, Starter: 100, Pro: unlimited).
 *
 * @since 1.1.0
 */

/**
 * Contact status.
 */
export type ContactStatus =
  | "active"
  | "inactive"
  | "bounced"
  | "unsubscribed"
  /** Double opt-in signup that nobody has confirmed yet. */
  | "pending";

/**
 * A member's state on one list. `contact.lists` says who is on a list; this
 * says whether they get its mail. Only `subscribed` does. An unsubscribed
 * member stays on the list. Eligible own opt-outs can rejoin only through
 * a confirmed Ultimate campaign signup.
 */
export type ListSubscriptionState = "pending" | "subscribed" | "unsubscribed";

/** What the server said about one list's members in one state. */
export interface ListStateMembers {
  members: Contact[];
  /** True when there were more members than the read would follow. */
  truncated: boolean;
}

/** How a member came to be on a list. `legacy` is a member from before lists tracked this. */
export type ListMembershipSource = "manual" | "import" | "form" | "legacy";

/** One list's subscription detail for one contact. */
export interface ListMembership {
  state: ListSubscriptionState;
  source: ListMembershipSource;
  /** When the member entered this state (UTC, `Y-m-d H:i:s`), or null when unknown. */
  since: string | null;
}

/** How a contact was added to the address book. */
export type ContactSource =
  | "manual"
  | "imported"
  | "synced"
  | "detected"
  | "form";

export const CONTACT_SOURCES: readonly ContactSource[] = [
  "manual",
  "imported",
  "synced",
  "detected",
  "form",
] as const;

// ============================================
// EXTENDED CONTACT FIELD TYPES
// ============================================

/**
 * Phone entry type.
 */
export type PhoneType = "mobile" | "work" | "home" | "other";

/**
 * Phone entry with type.
 */
export interface PhoneEntry {
  type: PhoneType;
  number: string;
  is_primary?: boolean;
}

/**
 * Email entry type.
 */
export type EmailType = "personal" | "work" | "other";

/**
 * Email entry with type.
 */
export interface EmailEntry {
  type: EmailType;
  address: string;
  is_primary?: boolean;
}

/**
 * Address type.
 */
export type AddressType = "home" | "work" | "other";

/**
 * Contact address with structured fields.
 */
export interface ContactAddress {
  street?: string;
  street2?: string;
  city?: string;
  state?: string;
  postal_code?: string;
  country?: string;
  type: AddressType;
}

/**
 * Social platform type.
 */
export type SocialPlatform =
  | "linkedin"
  | "twitter"
  | "facebook"
  | "instagram"
  | "github"
  | "other";

/**
 * Social profile entry.
 */
export interface SocialProfile {
  platform: SocialPlatform;
  url: string;
  username?: string;
}

/**
 * Important date type.
 */
export type ImportantDateType = "birthday" | "anniversary" | "other";

/**
 * Important date entry.
 */
export interface ImportantDate {
  type: ImportantDateType;
  date: string;
  label?: string;
}

/**
 * Contact interface.
 */
export interface Contact {
  /** Unique contact ID */
  id: number;
  /** WordPress user ID */
  user_id: number;
  /** Email account ID (optional, for account-specific contacts) */
  account_id: number | null;
  /** Contact email address */
  email: string;
  /** First name */
  first_name: string | null;
  /** Last name */
  last_name: string | null;
  /** Company/organization name */
  company: string | null;
  /** Phone number */
  phone: string | null;
  /** Job title */
  job_title: string | null;
  /** Website URL */
  website: string | null;
  /** Contact keywords stored in the legacy `tags` payload field for compatibility. */
  tags: string[];
  /** Custom fields (key-value pairs) */
  custom_fields: Record<string, string>;
  /** Notes about the contact */
  notes: string | null;
  /** Contact status */
  status: ContactStatus;
  /** How the contact was added (manual, imported, synced, detected, form). */
  source?: ContactSource;
  /** List IDs this contact belongs to */
  lists: number[];
  /**
   * The contact's state on each list it is on, by list ID. A list missing
   * here has no state to show. Set by the server, never by the app.
   */
  list_status?: Record<number, ListSubscriptionState>;
  /**
   * Source and date behind each `list_status` entry, by list ID. Also holds an
   * unsubscribed entry for a list the contact has since left: the opt-out is
   * kept on record, though the list is in neither `lists` nor `list_status`.
   */
  list_memberships?: Record<number, ListMembership>;
  /** Whether contact is favorite/starred */
  is_favorite: boolean;
  /** Last contacted date */
  last_contacted_at: string | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;

  // Extended fields (optional)
  /** Multiple email addresses */
  emails?: EmailEntry[];
  /** Multiple phone numbers */
  phones?: PhoneEntry[];
  /** Addresses */
  addresses?: ContactAddress[];
  /** Social media profiles */
  social_profiles?: SocialProfile[];
  /** Important dates (birthday, anniversary, etc.) */
  important_dates?: ImportantDate[];
  /** Avatar/photo URL */
  avatar_url?: string | null;
  /** Nickname */
  nickname?: string | null;
  /**
   * A member of a list someone else shared with the current user (Ultimate).
   * The server sends card fields only: no notes, tags, custom fields or history.
   */
  is_shared?: boolean;
}

/**
 * Contact list interface (for organizing contacts).
 */
export interface ContactList {
  /** Unique list ID */
  id: number;
  /** WordPress user ID */
  user_id: number;
  /** List name */
  name: string;
  /** List description */
  description: string | null;
  /** Number of contacts in list */
  contact_count: number;
  /** Members who are subscribed. Pending and unsubscribed members are on the list but not mailed. */
  subscribed_count?: number;
  /** Subscribed members a send to the list reaches: a bounced or unconfirmed contact is not one. */
  deliverable_count?: number;
  /** Members who have not confirmed yet. */
  pending_count?: number;
  /** List color (for UI display) */
  color: string | null;
  /** Creation timestamp */
  created_at: string;
  /** Last update timestamp */
  updated_at: string;
  /** Set when another user shared this list with the current user (Ultimate). */
  is_shared?: boolean;
  share?: ContactListShare;
  /** How many teammates the owner shared this list with. */
  share_count?: number;
}

/** The current user's access to a contact list someone else shared with them. */
export interface ContactListShare {
  role: "viewer" | "editor";
  owner_id: number;
  owner_name: string;
}

/** The card fields a teammate may see and, as an Editor, set on a shared list's member. */
export interface SharedMemberFields {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  job_title?: string;
  website?: string;
}

/**
 * Contact capabilities (tier-based limits).
 */
export interface ContactCapabilities {
  /** Whether contacts feature is available */
  available: boolean;
  /** Whether user can create new contacts (within limit) */
  create: boolean;
  /** Whether user can import contacts (Pro only - unlimited tier) */
  import: boolean;
  /** Whether user can export contacts */
  export: boolean;
  /** Maximum contacts allowed (-1 for unlimited) */
  max_contacts: number;
  /** Whether contacts are unlimited */
  is_unlimited: boolean;
  /** Current contact count */
  current_count: number;
  /** Remaining contacts that can be created (-1 if unlimited) */
  remaining: number;
  /** Maximum lists allowed (-1 for unlimited, 0 for disabled) */
  max_lists: number;
  /** Whether contact lists feature is available (false when max_lists = 0) */
  lists_available: boolean;
  /** Current list count */
  list_count: number;
  /** Remaining lists that can be created (-1 if unlimited) */
  lists_remaining: number;
}

/**
 * Data for creating a new contact.
 */
export interface CreateContactData {
  email: string;
  first_name?: string;
  last_name?: string;
  company?: string;
  phone?: string;
  job_title?: string;
  website?: string;
  tags?: string[];
  custom_fields?: Record<string, string>;
  notes?: string;
  lists?: number[];
  account_id?: number | null;
  // Extended fields
  emails?: EmailEntry[];
  phones?: PhoneEntry[];
  addresses?: ContactAddress[];
  social_profiles?: SocialProfile[];
  important_dates?: ImportantDate[];
  avatar_url?: string | null;
  nickname?: string;
}

/**
 * Data for updating an existing contact.
 */
export interface UpdateContactData {
  email?: string;
  first_name?: string | null;
  last_name?: string | null;
  company?: string | null;
  phone?: string | null;
  job_title?: string | null;
  website?: string | null;
  tags?: string[];
  custom_fields?: Record<string, string>;
  notes?: string | null;
  status?: ContactStatus;
  lists?: number[];
  is_favorite?: boolean;
  // Extended fields
  emails?: EmailEntry[];
  phones?: PhoneEntry[];
  addresses?: ContactAddress[];
  social_profiles?: SocialProfile[];
  important_dates?: ImportantDate[];
  avatar_url?: string | null;
  nickname?: string | null;
}

/**
 * Data for creating a contact list.
 */
export interface CreateContactListData {
  name: string;
  description?: string;
  color?: string;
}

/**
 * Data for updating a contact list.
 */
export interface UpdateContactListData {
  name?: string;
  description?: string | null;
  color?: string | null;
}

/**
 * Contact import result.
 */
export interface ContactImportResult {
  success: boolean;
  imported: number;
  skipped: number;
  errors: string[];
}

/**
 * API response types.
 */
export interface ContactsResponse {
  status: "success" | "error";
  contacts: Contact[];
  total: number;
  capabilities?: ContactCapabilities;
  message?: string;
}

export interface ContactResponse {
  status: "success" | "error";
  contact?: Contact;
  message?: string;
}

export interface ContactOperationResponse {
  status: "success" | "error";
  contact?: Contact;
  message?: string;
}

export interface ContactListsResponse {
  status: "success" | "error";
  lists: ContactList[];
  message?: string;
}

/**
 * Contacts context value interface.
 */
export interface ContactsContextValue {
  /** All contacts */
  contacts: Contact[];
  /** Contact lists */
  lists: ContactList[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Capabilities */
  capabilities: ContactCapabilities | null;
  /** Fetch all contacts */
  fetchContacts: (listId?: number) => Promise<void>;
  /** Get a single contact */
  getContact: (contactId: number) => Promise<Contact | null>;
  /** Create a new contact */
  createContact: (
    data: CreateContactData,
  ) => Promise<{ success: boolean; contact?: Contact; error?: string }>;
  /** Update a contact */
  updateContact: (
    contactId: number,
    data: UpdateContactData,
  ) => Promise<{ success: boolean; contact?: Contact; error?: string }>;
  /** Replace the full list membership for a contact and refresh list counts */
  replaceContactListMembership: (
    contactId: number,
    listIds: number[],
  ) => Promise<{ success: boolean; contact?: Contact; error?: string }>;
  /** Delete a contact */
  deleteContact: (
    contactId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Search contacts */
  searchContacts: (query: string) => Promise<Contact[]>;
  /** Toggle favorite status */
  toggleFavorite: (
    contactId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Fetch contact lists */
  fetchLists: () => Promise<void>;
  /** Create a contact list */
  createList: (
    data: CreateContactListData,
  ) => Promise<{ success: boolean; list?: ContactList; error?: string }>;
  /** Update a contact list */
  updateList: (
    listId: number,
    data: UpdateContactListData,
  ) => Promise<{ success: boolean; list?: ContactList; error?: string }>;
  /** Delete a contact list */
  deleteList: (listId: number) => Promise<{ success: boolean; error?: string }>;
  /** Add contact to list */
  addToList: (
    contactId: number,
    listId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Remove contact from list */
  removeFromList: (
    contactId: number,
    listId: number,
  ) => Promise<{ success: boolean; error?: string }>;

  // Ultimate: shared contact lists
  /** Members of the shared list last loaded with fetchSharedListMembers. */
  sharedMembers: Contact[];
  /** Load a shared list's members (card fields only); null clears them. */
  fetchSharedListMembers: (listId: number | null) => Promise<void>;
  /**
   * Members of one of the user's own lists in one subscription state, filtered
   * by the server, page by page to the end. `truncated` is true when the list
   * was too long to read in full, so the caller never shows a part as the whole.
   * Null when the read failed. Stops early, with null, once `signal` aborts.
   */
  fetchListMembersByState: (
    listId: number,
    state: ListSubscriptionState,
    signal?: AbortSignal,
  ) => Promise<ListStateMembers | null>;
  /** Add a member to a list the user owns or edits; the row belongs to the list owner. */
  addListMember: (
    listId: number,
    fields: SharedMemberFields,
  ) => Promise<{ success: boolean; contact?: Contact; error?: string }>;
  /** Owner, or Editor of a shared list. */
  canEditList: (listId: number) => boolean;

  // Pro: Activity Tracking
  /** Get activities for a contact */
  getContactActivities: (
    contactId: number,
    options?: { type?: ContactActivityType; limit?: number },
  ) => Promise<{
    success: boolean;
    activities?: ContactActivity[];
    error?: string;
  }>;
  /** Add activity to a contact */
  addContactActivity: (
    contactId: number,
    data: CreateContactActivityData,
  ) => Promise<{
    success: boolean;
    activity?: ContactActivity;
    error?: string;
  }>;
  /** Get recent emails between the user and a contact */
  getContactRecentEmails: (
    contactId: number,
    options?: { limit?: number; offset?: number },
  ) => Promise<{
    success: boolean;
    emails?: ContactRecentEmail[];
    error?: string;
  }>;

  // Pro: Custom Fields
  /** Get custom field definitions */
  getCustomFields: () => Promise<{
    success: boolean;
    fields?: ContactCustomField[];
    error?: string;
  }>;
  /** Create a custom field definition */
  createCustomField: (data: CreateContactCustomFieldData) => Promise<{
    success: boolean;
    field?: ContactCustomField;
    error?: string;
  }>;
  /** Delete a custom field definition */
  deleteCustomField: (
    fieldId: number,
  ) => Promise<{ success: boolean; error?: string }>;

  // Pro: Import/Export
  /** Import contacts from file */
  importContacts: (
    file: File,
    options?: { list_id?: number; update_existing?: boolean },
  ) => Promise<{
    success: boolean;
    result?: ContactImportResult;
    error?: string;
  }>;
  /** Export contacts to file */
  exportContacts: (
    format: "csv" | "vcard",
    options?: { list_id?: number; contact_ids?: number[] },
  ) => Promise<{
    success: boolean;
    data?: string;
    filename?: string;
    error?: string;
  }>;

  // Pro: Sync
  /** Get sync status */
  getSyncStatus: () => Promise<{
    success: boolean;
    status?: ContactSyncStatus;
    error?: string;
  }>;
  /** Get the OAuth authorization URL for a contacts provider */
  getSyncAuthUrl: (
    provider: SyncProvider,
  ) => Promise<{ success: boolean; url?: string; error?: string }>;
  /** Connect to sync provider */
  connectSyncProvider: (
    provider: SyncProvider,
    authCode: string,
    password?: string,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Connect a CardDAV server with URL + Basic Auth credentials (no OAuth). */
  connectCardDAV: (params: {
    url: string;
    username: string;
    password: string;
    displayName?: string;
  }) => Promise<{ success: boolean; error?: string }>;
  /** Disconnect sync provider */
  disconnectSyncProvider: (
    provider: SyncProvider,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Trigger sync */
  triggerSync: (
    provider: SyncProvider,
    direction?: "push" | "pull" | "both",
  ) => Promise<{ success: boolean; result?: SyncResult; error?: string }>;

  // Contact keyword library (string-based)
  /** Sorted, normalized, deduped list of keywords used across all contacts */
  allContactKeywords: string[];
  /** Rename a contact keyword across every contact owned by the user */
  renameContactKeyword: (
    oldName: string,
    newName: string,
  ) => Promise<{ success: boolean; affected?: number; error?: string }>;
  /** Delete a contact keyword from every contact owned by the user */
  deleteContactKeyword: (
    name: string,
  ) => Promise<{ success: boolean; affected?: number; error?: string }>;

  // Flag filter (ephemeral UI state shared across sidebar, cards, and detail)
  /** Normalized flag names the contact list is currently filtered by (AND). */
  flagFilter: string[];
  /** Add the flag to the active filter, or remove it if already active. */
  toggleFlagFilter: (name: string) => void;
  /** Clear every active flag filter. */
  clearFlagFilter: () => void;
}

// ============================================
// PRO FEATURE TYPES
// ============================================

/**
 * Contact activity type.
 */
export type ContactActivityType =
  | "email_sent"
  | "email_received"
  | "note_added"
  | "updated"
  | "created"
  | "call"
  | "meeting"
  | "email_opened"
  | "email_clicked"
  | "email_bounced"
  | "email_complaint";

/**
 * Contact activity interface.
 */
export interface ContactActivity {
  id: number;
  contact_id: number;
  user_id: number;
  type: ContactActivityType;
  title: string;
  description: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

/**
 * Recent email between the current user and a contact, as returned by the
 * GET /contacts/{id}/recent-emails route.
 */
export interface ContactRecentEmail {
  id: number;
  subject: string;
  from_email: string;
  from_name: string | null;
  received_at: string;
  is_read: boolean;
  folder_id: number | null;
  direction: "inbound" | "outbound";
}

export interface ContactRecentEmailsResponse {
  status: "success" | "error";
  emails?: ContactRecentEmail[];
  message?: string;
}

/**
 * Data for creating a contact activity.
 */
export interface CreateContactActivityData {
  type: ContactActivityType;
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Custom field type.
 */
export type CustomFieldType =
  | "text"
  | "number"
  | "date"
  | "select"
  | "multiselect"
  | "checkbox"
  | "url"
  | "email";

/**
 * Contact custom field definition.
 */
export interface ContactCustomField {
  id: number;
  user_id: number;
  name: string;
  label: string;
  type: CustomFieldType;
  options: string[] | null;
  required: boolean;
  default_value: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Data for creating a custom field.
 */
export interface CreateContactCustomFieldData {
  name: string;
  label: string;
  type: CustomFieldType;
  options?: string[];
  required?: boolean;
  default_value?: string;
}

/**
 * Sync provider type.
 */
export type SyncProvider = "google" | "outlook" | "carddav";

/**
 * Contact sync status.
 */
export interface ContactSyncStatus {
  google: {
    connected: boolean;
    last_synced_at: string | null;
    contact_count: number;
  } | null;
  outlook: {
    connected: boolean;
    last_synced_at: string | null;
    contact_count: number;
  } | null;
  carddav: {
    connected: boolean;
    last_synced_at: string | null;
    contact_count: number;
  } | null;
}

/**
 * Sync result.
 */
export interface SyncResult {
  imported: number;
  exported: number;
  updated: number;
  skipped: number;
  errors: string[];
}

/**
 * Layout slot props for the contacts screens.
 *
 * Declared here rather than derived from the components with
 * `ComponentProps<typeof ContactManager>`. That derivation was a type-only
 * edge from `src/layouts/types.ts` into the contacts implementation, and it was
 * enough to drag the whole contacts UI, upgrade prompts and all, into the
 * published Free source tree even though the Free build compiles none of it.
 */
export interface ContactManagerProps {
  /** Callback when user should upgrade */
  onUpgrade?: () => void;
  /** Callback when a contact is selected for composing email */
  onComposeToContact?: (contact: Contact) => void;
  /** Filter by list ID */
  filterByListId?: number | null;
  /** Available lists for filtering and form */
  availableLists?: ContactList[];
  /** Additional class names */
  className?: string;
}

export interface ContactListsManagerProps {
  /** Callback when a list is selected to filter contacts */
  onSelectList?: (listId: number | null) => void;
  /** Currently selected list ID */
  selectedListId?: number | null;
  /** Additional class names */
  className?: string;
}
