/**
 * Feature Types
 *
 * TypeScript types for the feature flag and license tier management system.
 * Simplified to entitlement-based system with Free and paid builds only.
 *
 * @since 1.1.0
 * @updated 2.0.0 - Simplified to entitlement-based gating
 * @updated 4.0.0 - Disabled extended feature tier; all paid licenses share one baseline
 * @updated 4.1.0 - Ultimate tier gate: the server resolves every feature through
 *                  the license gate (including `extended_value` for is_ultimate)
 *                  and ships the answer as `entitlements.features`. The client
 *                  obeys that map and never re-derives tier policy locally.
 */

// ==========================================
// ROADMAP FEATURE CONFIGURATION
// ==========================================

/**
 * Ultimate-tier feature keys.
 * These resolve through `extended_value` in the PHP flag registry, so a valid
 * licence receives them only when the sealed payload carries `is_ultimate`.
 * They are NOT disabled here. The server decides, via `entitlements.features`.
 *
 * To add an ultimate-tier feature:
 * 1. Add the slug here
 * 2. Update EXTENDED_FEATURE_DEFINITIONS below for UI display
 * 3. Add the flag with `extended_value => true` in
 *    plugin-files/includes/Config/feature-flags.php (the actual gate)
 */
export const EXTENDED_FEATURE_SLUGS = [
  // Ultimate UI features
  "whitelabelling",
  "custom_themes",
] as const;

export type ExtendedFeatureSlug = (typeof EXTENDED_FEATURE_SLUGS)[number];

/**
 * Features with no backend at all yet. The client refuses these outright, even
 * if a server map were to report them enabled. Ultimate-tier slugs are NOT
 * listed here. Those are gated by the server, not disabled.
 */
export const DISABLED_FEATURE_SLUGS = [
  "templates",
  "template_variables",
  "template_categories",
  "template_sharing",
] as const;

export type DisabledFeatureSlug = (typeof DISABLED_FEATURE_SLUGS)[number];

/**
 * Check if a feature slug is part of the roadmap-disabled legacy set.
 */
export function isRoadmapDisabledFeatureSlug(
  slug: string,
): slug is ExtendedFeatureSlug {
  return EXTENDED_FEATURE_SLUGS.includes(slug as ExtendedFeatureSlug);
}

/**
 * Check if a feature slug is disabled/roadmapped.
 */
export function isDisabledFeature(slug: string): slug is DisabledFeatureSlug {
  return DISABLED_FEATURE_SLUGS.includes(slug as DisabledFeatureSlug);
}

/**
 * Roadmap feature definitions for UI display.
 * Update this when adding or removing disabled roadmap features.
 */
export const EXTENDED_FEATURE_DEFINITIONS: Array<{
  slug: ExtendedFeatureSlug;
  label: string;
  description: string;
}> = [
  // UI features
  {
    slug: "whitelabelling",
    label: "White Labelling",
    description:
      "Custom branding with logos and colors for client-facing deployments",
  },
];

// ==========================================
// LICENSE ENTITLEMENTS
// ==========================================

/**
 * Entitlements response from the plugin's /features/flags endpoint.
 * `features` is the server's resolved per-slug answer and is authoritative.
 */
export interface LicenseEntitlements {
  license_id: string;
  license_valid: boolean;
  plan_slug: string | null;
  is_ultimate?: boolean;
  schema_version: string;
  features?: Record<string, boolean>;
  message?: string;
}

/**
 * Schema version this client is written against. The PHP flags endpoint
 * (`plugin-files/includes/Controllers/Features/Actions.php`) stamps the same
 * string onto every entitlements payload, including its fail-closed fallback,
 * so a mismatch means the payload shape has moved on without the client.
 */
export const ENTITLEMENTS_SCHEMA_VERSION = "pressedmail.features.v4";

/**
 * Lifecycle of the entitlements answer.
 *
 * `loading` means we have not yet heard from `/features/flags` at all;
 * `ready` means the server answered and the entitlements are its answer;
 * `error` means every attempt failed (or the server told us it could not
 * resolve the licence) and the entitlements are the last thing we knew.
 *
 * Gate Pro-only surfaces on this rather than on `licenseValid` alone: without
 * it, "we have not asked yet" is indistinguishable from "you are not licensed".
 */
export type EntitlementsStatus = "loading" | "ready" | "error";

/**
 * Normalized runtime entitlements with defaults applied.
 */
export interface RuntimeEntitlements {
  licenseValid: boolean;
  planSlug: string | null;
  isUltimate: boolean;
  schemaVersion: string;
  /** Server-resolved per-feature answers. Empty when the server sent none. */
  features: Record<string, boolean>;
}

/**
 * All entitlements default to false (invalid license fallback).
 */
export const DEFAULT_ENTITLEMENTS: RuntimeEntitlements = {
  licenseValid: false,
  planSlug: null,
  isUltimate: false,
  schemaVersion: ENTITLEMENTS_SCHEMA_VERSION,
  features: {},
};

/**
 * Normalize license server response to runtime entitlements.
 * Invalid license -> all defaults.
 */
export function normalizeEntitlements(
  response: Partial<LicenseEntitlements> | null | undefined,
): RuntimeEntitlements {
  if (!response || response.license_valid !== true) {
    return DEFAULT_ENTITLEMENTS;
  }

  return {
    licenseValid: true,
    planSlug: response.plan_slug ?? null,
    isUltimate: response.is_ultimate === true,
    schemaVersion: response.schema_version ?? ENTITLEMENTS_SCHEMA_VERSION,
    features: response.features ?? {},
  };
}

/**
 * Check if a specific feature is available.
 * - An invalid license has nothing
 * - Features with no backend yet are refused outright
 * - Otherwise the server's resolved answer wins; it already applied the license
 *   gate, including `extended_value` for is_ultimate
 * - Slugs the server does not report fall back to license validity
 */
export function hasFeature(
  entitlements: RuntimeEntitlements,
  featureSlug: string,
): boolean {
  if (!entitlements.licenseValid) return false;

  // Not built yet. Never grant, whatever the server says.
  if (isDisabledFeature(featureSlug)) {
    return false;
  }

  // The server is authoritative for every slug it reports.
  if (Object.prototype.hasOwnProperty.call(entitlements.features, featureSlug)) {
    return entitlements.features[featureSlug] === true;
  }

  // Unreported slug: any valid paid license.
  return true;
}

/**
 * Check if the ultimate (is_ultimate) license tier is active.
 * Prefer hasFeature() for per-feature checks; use this only for tier-level UI
 * such as upsell copy.
 */
export function hasUltimateAccess(entitlements: RuntimeEntitlements): boolean {
  return entitlements.licenseValid && entitlements.isUltimate === true;
}

// ==========================================
// ENTITLEMENT ALIASES (used by EntitlementGate + FeaturesContext)
// ==========================================

/** Pro entitlement key: alias of ExtendedFeatureSlug used by EntitlementGate. */
export type ProEntitlementKey = ExtendedFeatureSlug;

/** Display metadata for entitlement keys, derived from extended feature definitions. */
export const PRO_ENTITLEMENT_DEFINITIONS = EXTENDED_FEATURE_DEFINITIONS.map(
  (def) => ({
    key: def.slug as ProEntitlementKey,
    label: def.label,
    description: def.description,
  }),
);

/** Check entitlement by key. Delegates to hasFeature. */
export function hasEntitlement(
  entitlements: RuntimeEntitlements,
  key: ProEntitlementKey,
): boolean {
  return hasFeature(entitlements, key);
}

// ==========================================
// FEATURE FLAG TYPES
// ==========================================

/**
 * Feature flag identifiers.
 */
export type FeatureId =
  // Users & Limits
  | "email_accounts"
  | "sites"
  | "users"
  // Inbox Organization
  | "tags"
  | "folders"
  // Email Features
  | "signatures"
  | "composer"
  | "templates"
  // Settings
  | "user_roles"
  | "support_level"
  // Integrations
  | "backend_integration"
  | "contacts"
  | "calendar"
  | "ai_integration"
  // UI Design
  | "dark_mode"
  | "themes"
  | "whitelabelling"
  | "custom_themes"
  | "composer_palettes"
  | "mobile_layouts"
  | "color_schemes"
  | "layouts"
  // Core
  | "email_client"
  | "combined_inbox"
  | "microsoft_oauth"
  // Pro: Contact Features
  | "contact_activities"
  | "contact_custom_fields"
  | "contact_import_export"
  | "contact_lists"
  // Pro: Calendar Features
  | "calendar_sync"
  | "multiple_calendars"
  | "calendar_recurring"
  | "calendar_freebusy"
  | "calendar_meeting_detection"
  | "calendars"
  // Pro: Template Features
  | "template_categories"
  | "template_variables"
  // Pro: Email Enhancement Features
  | "email_snooze"
  | "email_undo_send"
  | "email_saved_views"
  | "email_followups"
  // Productivity Features
  | "scheduled_emails"
  | "undo_send"
  | "email_tracking"
  | "auto_followups"
  | "auto_replies"
  | "sender_aliases"
  | "snippets"
  | "content_blocks"
  | "snooze"
  // Security Features
  | "prevent_impersonation"
  // AI Granular Features
  | "ai_settings"
  | "ai_drafting"
  | "ai_replies"
  | "ai_suggestions"
  | "ai_summarize"
  | "ai_enhance"
  | "ai_auto_tagger"
  | "auto_tagger"
  | "ai_inbox_organizer"
  | "smart_inbox"
  // Developer Features
  | "audit_logs"
  | "api_webhooks"
  // Notifications
  | "wp_admin_bar_notifications";

/**
 * Feature flag types.
 */
export type FlagType = "boolean" | "limit_based" | "enum";

/**
 * Feature categories.
 */
export type FeatureCategory =
  | "core"
  | "limits"
  | "inbox"
  | "email"
  | "settings"
  | "integrations"
  | "marketing"
  | "ui"
  | "pro"
  | "productivity"
  | "security"
  | "developer"
  | "notifications";

/**
 * Feature setting types for configuration UI.
 */
export interface FeatureSettings {
  [key: string]: {
    type:
      | "text"
      | "number"
      | "checkbox"
      | "select"
      | "multiselect"
      | "password";
    label: string;
    default?: unknown;
    options?: Record<string, string>;
  };
}

/**
 * Feature flag definition.
 */
export interface FeatureFlag {
  id: FeatureId;
  name: string;
  description: string;
  type: FlagType;
  category: FeatureCategory;
  default: unknown;
  enumLimits?: Record<string, number>;
  themeAccess?: Record<string, string[]>;
  dependencies: FeatureId[];
}

/**
 * Evaluated feature flag value.
 */
export interface FeatureFlagValue {
  id: FeatureId;
  name: string;
  description: string;
  type: FlagType;
  category: FeatureCategory;
  value: unknown;
  available: boolean;
  limit: number | null;
}

/**
 * Legacy Feature interface (for backward compatibility).
 */
export interface Feature {
  id: FeatureId;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
  available: boolean;
  requires_license: boolean;
  category: FeatureCategory;
  dependencies: FeatureId[];
  settings: FeatureSettings;
}

/**
 * Legacy FeatureStatus interface (for backward compatibility).
 */
export interface FeatureStatus {
  all: Record<string, Feature>;
  loaded: Record<string, Feature>;
  available: Record<string, Feature>;
  unavailable: Record<string, Feature>;
}

/**
 * Enhanced feature status from the new API.
 */
export interface EnhancedFeatureStatus {
  isPro: boolean;
  isLicensed: boolean;
  features: Partial<Record<FeatureId, FeatureFlagValue>>;
  limits: Record<string, number>;
}

/**
 * Feature context value.
 */
/**
 * Admin-configured throttles for bulk AI operations, surfaced to the email
 * client through the feature-flags payload. Caps bound how many emails a single
 * bulk run may process (avoiding PHP long-script timeouts); `warnThreshold` is
 * the count above which the client confirms before starting a long run.
 */
export interface AiBulkLimits {
  phishing: number;
  summary: number;
  autotag: number;
  warnThreshold: number;
}

export interface FeatureContextValue {
  // State
  features: EnhancedFeatureStatus | null;
  /**
   * Whether the entitlements answer is still pending, settled, or unreachable.
   * `loading` and `error` below are derived from this and kept only so existing
   * consumers keep compiling.
   */
  entitlementsStatus: EntitlementsStatus;
  /** Alias of `entitlementsStatus === "loading"`. */
  loading: boolean;
  /** The terminal failure, but only while `entitlementsStatus === "error"`. */
  error: Error | null;
  /** Admin bulk AI operation caps + warn threshold (numbers only). */
  aiBulkLimits: AiBulkLimits;

  // Entitlements (Pro feature gating)
  entitlements: RuntimeEntitlements;
  /** Check entitlement by key (low-level). Prefer hasFeatureAccess for feature-slug checks. */
  isEntitlementEnabled: (key: ProEntitlementKey) => boolean;
  /** Check if a feature slug is available (roadmapped features are disabled) */
  hasFeatureAccess: (featureSlug: string) => boolean;
  /** Whether the license is valid (Pro activated) */
  isPro: boolean;

  // Feature checks (legacy feature ID system)
  isFeatureAvailable: (featureId: FeatureId) => boolean;
  isFeatureEnabled: (featureId: FeatureId) => boolean;
  getFeatureValue: <T = unknown>(featureId: FeatureId) => T | undefined;
  getFeatureLimit: (featureId: FeatureId) => number;

  // Theme access (all themes available in Pro)
  getAvailableThemes: () => string[];
  isThemeAvailable: (themeId: string) => boolean;

  // Inbox Layout access (all layouts available in Pro)
  getAvailableLayouts: () => LayoutId[];
  isLayoutAvailable: (layoutId: LayoutId) => boolean;
  getLayoutConfig: (layoutId: LayoutId) => LayoutConfig;

  // Contacts Layout access (all layouts available in Pro)
  getAvailableContactsLayouts: () => ContactsLayoutId[];
  isContactsLayoutAvailable: (layoutId: ContactsLayoutId) => boolean;
  getContactsLayoutConfig: (layoutId: ContactsLayoutId) => ContactsLayoutConfig;

  // Calendar Layout access (all layouts available in Pro)
  getAvailableCalendarLayouts: () => CalendarLayoutId[];
  isCalendarLayoutAvailable: (layoutId: CalendarLayoutId) => boolean;
  getCalendarLayoutConfig: (layoutId: CalendarLayoutId) => CalendarLayoutConfig;

  // Legacy methods (for backward compatibility)
  isFeatureLoaded: (featureId: FeatureId) => boolean;
  getFeature: (featureId: FeatureId) => Feature | null;

  // Actions
  refreshFeatures: () => Promise<void>;
}

/**
 * Feature flag ID constants for type-safe access.
 */
export const FeatureIds = {
  // Users & Limits
  EMAIL_ACCOUNTS: "email_accounts",
  SITES: "sites",
  USERS: "users",

  // Inbox Organization
  TAGS: "tags",
  FOLDERS: "folders",

  // Email Features
  SIGNATURES: "signatures",
  COMPOSER: "composer",
  TEMPLATES: "templates",

  // Settings
  USER_ROLES: "user_roles",
  SUPPORT_LEVEL: "support_level",

  // Integrations
  BACKEND_INTEGRATION: "backend_integration",
  CONTACTS: "contacts",
  CALENDAR: "calendar",
  AI_INTEGRATION: "ai_integration",

  // UI Design
  DARK_MODE: "dark_mode",
  THEMES: "themes",
  WHITELABELLING: "whitelabelling",
  CUSTOM_THEMES: "custom_themes",
  COMPOSER_PALETTES: "composer_palettes",
  MOBILE_LAYOUTS: "mobile_layouts",
  COLOR_SCHEMES: "color_schemes",
  LAYOUTS: "layouts",

  // Core
  EMAIL_CLIENT: "email_client",

  // Pro: Contact Features
  CONTACT_ACTIVITIES: "contact_activities",
  CONTACT_CUSTOM_FIELDS: "contact_custom_fields",
  CONTACT_IMPORT_EXPORT: "contact_import_export",
  CONTACT_LISTS: "contact_lists",

  // Pro: Calendar Features
  CALENDAR_SYNC: "calendar_sync",
  MULTIPLE_CALENDARS: "multiple_calendars",
  CALENDAR_RECURRING: "calendar_recurring",
  CALENDAR_FREEBUSY: "calendar_freebusy",
  CALENDAR_MEETING_DETECTION: "calendar_meeting_detection",
  CALENDARS: "calendars",

  // Pro: Template Features
  TEMPLATE_CATEGORIES: "template_categories",
  TEMPLATE_VARIABLES: "template_variables",

  // Pro: Email Enhancement Features
  EMAIL_SNOOZE: "email_snooze",
  EMAIL_UNDO_SEND: "email_undo_send",
  EMAIL_SAVED_VIEWS: "email_saved_views",
  EMAIL_FOLLOWUPS: "email_followups",

  // Productivity Features
  SCHEDULED_EMAILS: "scheduled_emails",
  UNDO_SEND: "undo_send",
  EMAIL_TRACKING: "email_tracking",
  AUTO_FOLLOWUPS: "auto_followups",
  AUTO_REPLIES: "auto_replies",
  SENDER_ALIASES: "sender_aliases",
  SNIPPETS: "snippets",
  CONTENT_BLOCKS: "content_blocks",
  SNOOZE: "snooze",

  // Security Features
  PREVENT_IMPERSONATION: "prevent_impersonation",

  // AI Granular Features
  AI_SETTINGS: "ai_settings",
  AI_DRAFTING: "ai_drafting",
  AI_REPLIES: "ai_replies",
  AI_SUGGESTIONS: "ai_suggestions",
  AI_SUMMARIZE: "ai_summarize",
  AI_ENHANCE: "ai_enhance",
  AI_AUTO_TAGGER: "ai_auto_tagger",
  AI_INBOX_ORGANIZER: "ai_inbox_organizer",
  SMART_INBOX: "smart_inbox",

  // Developer Features
  AUDIT_LOGS: "audit_logs",
  API_WEBHOOKS: "api_webhooks",

  // Notifications
  WP_ADMIN_BAR_NOTIFICATIONS: "wp_admin_bar_notifications",
} as const;

/**
 * Theme IDs available in the system.
 */
export type ThemeId =
  | "default"
  | "curb"
  | "pretty"
  | "pressedout"
  | "pressedg"
  | "pressedcube"
  | "tokyo"
  | "executive"
  | "minimalist"
  | "contrast";

/**
 * Composer level type.
 */
export type ComposerLevel = "basic" | "rich";

/**
 * Tags level type.
 */
export type TagsLevel = "basic" | "standard" | "unlimited";

/**
 * Tags limit by level.
 */
export const TagsLimits: Record<TagsLevel, number> = {
  basic: 5,
  standard: 20,
  unlimited: -1,
};

/**
 * Folders level type.
 */
export type FoldersLevel = "imap_only" | "custom";

/**
 * AI integration level type.
 */
export type AIIntegrationLevel = false | "basic" | "advanced";

/**
 * Support level type.
 */
export type SupportLevel = "community" | "standard" | "priority" | "vip";

/**
 * User roles level type.
 */
export type UserRolesLevel = "admin_only" | "all_users" | "custom";

/**
 * Backend integration level type.
 */
export type BackendIntegrationLevel = "basic" | "advanced";

/**
 * Mobile layouts level type.
 */
export type MobileLayoutsLevel = "basic" | "enhanced";

/**
 * Inbox layout identifiers.
 */
export type LayoutId = "pressedm" | "pressedg" | "pressedout";

/**
 * The main inbox layout was historically id "default"; it is now "pressedm".
 * Normalize stored/legacy values so old preferences keep resolving.
 * NOTE: only the inbox layout is renamed. Contacts/Calendar keep their own "default".
 */
export function normalizeLegacyInboxLayoutId(value: string): LayoutId {
  return (value === "default" ? "pressedm" : value) as LayoutId;
}

/**
 * Message list display variant.
 */
export type ListVariant = "default" | "paginated" | "table";

/**
 * Compose UI style variant.
 */
export type ComposeStyle = "modal" | "floating" | "pane" | "inline";

/**
 * Navigation panel style variant.
 */
export type NavVariant = "folder" | "label" | "tree";

/**
 * Layout configuration for each inbox layout.
 */
export interface LayoutConfig {
  id: LayoutId;
  name: string;
  description: string;
  listVariant: ListVariant;
  composeStyle: ComposeStyle;
  navVariant: NavVariant;
  showCommandRibbon: boolean;
  showTopSearchBar: boolean;
  threadedView: boolean;
  showStatusBar: boolean;
}

/**
 * All available layouts for Pro users.
 */
export const ALL_LAYOUTS: LayoutId[] = ["pressedm", "pressedg", "pressedout"];

/**
 * Layouts available for Free users.
 */
export const FREE_LAYOUTS: LayoutId[] = ["pressedm"];

/**
 * Layout configurations with their properties.
 */
export const LayoutConfigs: Record<LayoutId, LayoutConfig> = {
  pressedm: {
    id: "pressedm",
    name: "PressedM",
    description: "Clean, balanced three-pane layout with resizable panels",
    listVariant: "default",
    composeStyle: "modal",
    navVariant: "folder",
    showCommandRibbon: false,
    showTopSearchBar: false,
    threadedView: false,
    showStatusBar: false,
  },
  pressedg: {
    id: "pressedg",
    name: "PressedG",
    description:
      "Gmail-inspired layout with threaded conversations and floating composer",
    listVariant: "paginated",
    composeStyle: "floating",
    navVariant: "label",
    showCommandRibbon: false,
    showTopSearchBar: true,
    threadedView: true,
    showStatusBar: false,
  },
  pressedout: {
    id: "pressedout",
    name: "PressedOut",
    description:
      "Outlook-inspired layout with command ribbon and high-density table view",
    listVariant: "table",
    composeStyle: "pane",
    navVariant: "tree",
    showCommandRibbon: true,
    showTopSearchBar: false,
    threadedView: false,
    showStatusBar: true,
  },
};

/**
 * Get layout configuration by ID.
 */
export function getLayoutConfig(layoutId: LayoutId): LayoutConfig {
  return LayoutConfigs[layoutId] || LayoutConfigs.pressedm;
}

// ============================================================================
// CONTACTS LAYOUT TYPES
// ============================================================================

/**
 * Contacts layout identifiers.
 */
export type ContactsLayoutId = "default" | "pressedg" | "pressedout";

/**
 * Contacts view mode options.
 */
export type ContactsViewMode = "list" | "grid" | "table";

/**
 * Contacts navigation variant.
 */
export type ContactsNavVariant = "groups" | "labels" | "folders";

/**
 * Contacts layout configuration.
 */
export interface ContactsLayoutConfig {
  id: ContactsLayoutId;
  name: string;
  description: string;
  viewMode: ContactsViewMode;
  navVariant: ContactsNavVariant;
  showDetailPane: boolean;
  inlineEditing: boolean;
  showSearchBar: boolean;
  showBulkActions: boolean;
}

/**
 * All available contacts layouts for Pro users.
 */
export const ALL_CONTACTS_LAYOUTS: ContactsLayoutId[] = [
  "default",
  "pressedg",
  "pressedout",
];

/**
 * Contacts layouts available for Free users.
 */
export const FREE_CONTACTS_LAYOUTS: ContactsLayoutId[] = ["default"];

/**
 * Contacts layout configurations.
 */
export const ContactsLayoutConfigs: Record<
  ContactsLayoutId,
  ContactsLayoutConfig
> = {
  default: {
    id: "default",
    name: "Default",
    description:
      "Three-pane layout with groups sidebar, contact list, and detail panel",
    viewMode: "list",
    navVariant: "groups",
    showDetailPane: true,
    inlineEditing: false,
    showSearchBar: true,
    showBulkActions: true,
  },
  pressedg: {
    id: "pressedg",
    name: "PressedG",
    description:
      "Gmail-style single pane with search-first interface and slide-in details",
    viewMode: "grid",
    navVariant: "labels",
    showDetailPane: false, // Uses drawer instead
    inlineEditing: true,
    showSearchBar: true,
    showBulkActions: false,
  },
  pressedout: {
    id: "pressedout",
    name: "PressedOut",
    description:
      "Outlook-style table layout with command ribbon and folder tree",
    viewMode: "table",
    navVariant: "folders",
    showDetailPane: true,
    inlineEditing: false,
    showSearchBar: true,
    showBulkActions: true,
  },
};

/**
 * Get contacts layout configuration by ID.
 */
export function getContactsLayoutConfig(
  layoutId: ContactsLayoutId,
): ContactsLayoutConfig {
  return ContactsLayoutConfigs[layoutId] || ContactsLayoutConfigs.default;
}

// ============================================================================
// CALENDAR LAYOUT TYPES
// ============================================================================

/**
 * Calendar layout identifiers.
 */
export type CalendarLayoutId = "default" | "pressedg" | "pressedout";

/**
 * Calendar view mode options.
 */
export type CalendarViewMode = "month" | "week" | "day" | "agenda" | "list";

/**
 * Calendar navigation variant.
 */
export type CalendarNavVariant = "mini" | "sidebar" | "ribbon";

/**
 * Calendar layout configuration.
 */
export interface CalendarLayoutConfig {
  id: CalendarLayoutId;
  name: string;
  description: string;
  defaultView: CalendarViewMode;
  navVariant: CalendarNavVariant;
  showMiniCalendar: boolean;
  showEventList: boolean;
  showDetailPane: boolean;
  dragEnabled: boolean;
  showTimezone: boolean;
}

/**
 * All available calendar layouts for Pro users.
 */
export const ALL_CALENDAR_LAYOUTS: CalendarLayoutId[] = [
  "default",
  "pressedg",
  "pressedout",
];

/**
 * Calendar layouts available for Free users.
 */
export const FREE_CALENDAR_LAYOUTS: CalendarLayoutId[] = ["default"];

/**
 * Calendar layout configurations.
 */
export const CalendarLayoutConfigs: Record<
  CalendarLayoutId,
  CalendarLayoutConfig
> = {
  default: {
    id: "default",
    name: "Default",
    description:
      "Three-pane layout with mini calendar, main view, and event detail",
    defaultView: "month",
    navVariant: "mini",
    showMiniCalendar: true,
    showEventList: false,
    showDetailPane: true,
    dragEnabled: false,
    showTimezone: false,
  },
  pressedg: {
    id: "pressedg",
    name: "PressedG",
    description: "Gmail-style calendar overlay integrated with inbox",
    defaultView: "week",
    navVariant: "sidebar",
    showMiniCalendar: true,
    showEventList: true,
    showDetailPane: false, // Uses popover instead
    dragEnabled: true,
    showTimezone: true,
  },
  pressedout: {
    id: "pressedout",
    name: "PressedOut",
    description:
      "Outlook-style full calendar with command ribbon and high-density grid",
    defaultView: "week",
    navVariant: "ribbon",
    showMiniCalendar: true,
    showEventList: false,
    showDetailPane: true,
    dragEnabled: true,
    showTimezone: true,
  },
};

/**
 * Get calendar layout configuration by ID.
 */
export function getCalendarLayoutConfig(
  layoutId: CalendarLayoutId,
): CalendarLayoutConfig {
  return CalendarLayoutConfigs[layoutId] || CalendarLayoutConfigs.default;
}
