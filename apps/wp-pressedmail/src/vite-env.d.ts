/// <reference types="vite/client" />

/**
 * Build-time plugin variant constants.
 * These are replaced at compile time by Vite's define option.
 * - Free build: __IS_FREE__ = true, __IS_PRO__ = false
 * - Pro build: __IS_FREE__ = false, __IS_PRO__ = true
 * - DB mailbox rollout: __USE_DB_MAILBOX__ = true enables canonical mirror-backed reads
 */
declare const __PLUGIN_VARIANT__: "free" | "pro";
declare const __IS_FREE__: boolean;
declare const __IS_PRO__: boolean;
declare const __USE_DB_MAILBOX__: boolean;

/**
 * Mailbox and signature capacity, named after the shape rather than the
 * edition. The Free build is a single-mailbox, single-signature client: there
 * is one slot and connecting or saving moves it. Guarding on capacity rather
 * than on __IS_FREE__ keeps the intent readable, and the branches these guard
 * are dropped from the Free bundle rather than hidden at runtime.
 */
declare const __SINGLE_MAILBOX__: boolean;
declare const __SINGLE_SIGNATURE__: boolean;
/** One person holds the mailbox, so there is no access policy to configure. */
declare const __SINGLE_SEAT__: boolean;

// =============================================================================
// CORE FEATURE FLAGS (Always available - Free)
// =============================================================================

/** Core email client functionality (Free) */
declare const __ENABLE_EMAIL_CLIENT__: boolean;

/** Contacts feature (Pro) */
declare const __ENABLE_CONTACTS__: boolean;

/** Calendar feature (Pro) */
declare const __ENABLE_CALENDAR__: boolean;

/** Dark mode theme support (Free) */
declare const __ENABLE_DARK_MODE__: boolean;

/** AI-powered phishing detection and security scanning (Pro) */
declare const __ENABLE_PHISHING_DETECTION__: boolean;

// =============================================================================
// STANDARD FEATURE FLAGS (Free - No Limits)
// =============================================================================

/** Email tagging system (Free) */
declare const __ENABLE_TAGS__: boolean;

/** Email signature management (Free) */
declare const __ENABLE_SIGNATURES__: boolean;

/** Folder management (Free) */
declare const __ENABLE_FOLDERS__: boolean;

/** Email snooze functionality (Pro) */
declare const __ENABLE_SNOOZE__: boolean;

/** Keyboard navigation shortcuts (Free) */
declare const __ENABLE_KEYBOARD_SHORTCUTS__: boolean;

/** Email scheduling (Pro) */
declare const __ENABLE_SCHEDULED_EMAILS__: boolean;

// =============================================================================
// CALENDAR FEATURE FLAGS
// =============================================================================

/** Basic calendar browsing (Pro) */
declare const __ENABLE_CALENDAR_BASIC__: boolean;

/** Auto-detect meetings from emails (Pro) */
declare const __ENABLE_CALENDAR_MEETING_DETECTION__: boolean;

/** Multiple calendar management (Pro) */
declare const __ENABLE_MULTIPLE_CALENDARS__: boolean;

/** CalDAV calendar sync (Pro) */
declare const __ENABLE_CALENDAR_SYNC__: boolean;

/** Recurring calendar events (Pro) */
declare const __ENABLE_CALENDAR_RECURRING__: boolean;

/** Free/busy view across calendars (Pro) */
declare const __ENABLE_CALENDAR_FREEBUSY__: boolean;

// =============================================================================
// CONTACTS FEATURE FLAGS
// =============================================================================

/** Basic contact management (Pro) */
declare const __ENABLE_CONTACTS_BASIC__: boolean;

/** Contact list management (Pro) */
declare const __ENABLE_CONTACT_LISTS__: boolean;

/** Contact import and export (Pro) */
declare const __ENABLE_CONTACT_IMPORT_EXPORT__: boolean;

/** Track email history and notes for contacts (Pro) */
declare const __ENABLE_CONTACT_ACTIVITIES__: boolean;

/** Custom fields for contacts (Pro) */
declare const __ENABLE_CONTACT_CUSTOM_FIELDS__: boolean;

/** External contact provider sync: unavailable in production */
declare const __ENABLE_CONTACTS_SYNC__: boolean;

// =============================================================================
// AI FEATURE FLAGS
// =============================================================================

/** AI configuration panel (Pro) */
declare const __ENABLE_AI_SETTINGS__: boolean;

/** AI-powered draft generation (Pro) */
declare const __ENABLE_AI_DRAFTING__: boolean;

/** AI-powered reply suggestions (Pro) */
declare const __ENABLE_AI_REPLIES__: boolean;

/** Smart AI suggestions (Pro) */
declare const __ENABLE_AI_SUGGESTIONS__: boolean;

/** Email summarization (Pro) */
declare const __ENABLE_AI_SUMMARIZE__: boolean;

/** Text enhancement (Pro) */
declare const __ENABLE_AI_ENHANCE__: boolean;

/** AI auto tagging with custom prompts (Pro) */
declare const __ENABLE_AI_AUTO_TAGGER__: boolean;

/** Runtime route gate alias for AI auto tagging (Pro) */
declare const __ENABLE_AUTO_TAGGER__: boolean;

/** AI-powered email classification and folder automation (Pro) */
declare const __ENABLE_AI_INBOX_ORGANIZER__: boolean;

/** AI-powered email categorization and priority detection (Pro) */
declare const __ENABLE_SMART_INBOX__: boolean;

// =============================================================================
// SHARED MAILBOXES FEATURE FLAGS
// =============================================================================

// =============================================================================
// MARKETING FEATURE FLAGS
// =============================================================================

/** Legacy analytics page flag (parked) */
declare const __ENABLE_ANALYTICS__: boolean;

// =============================================================================
// PRO UI FEATURE FLAGS
// =============================================================================

/** Pro color themes (Pro, Free gets 'pressedm' only) */
declare const __ENABLE_THEMES__: boolean;

/** Pro inbox layouts (Pro, Free gets 'pressedm' only) */
declare const __ENABLE_LAYOUTS__: boolean;

/** Create and customize own themes (Pro) */
declare const __ENABLE_CUSTOM_THEMES__: boolean;

/** Responsive mobile layouts (Free) */
declare const __ENABLE_MOBILE_LAYOUTS__: boolean;

// =============================================================================
// EXTENDED FEATURE FLAGS (Frontend Integration)
// =============================================================================

// =============================================================================
// PRODUCTIVITY FEATURE FLAGS
// =============================================================================

/** Send delay and undo (Pro) */
declare const __ENABLE_UNDO_SEND__: boolean;

/** Email Rules: rule builder, receive-time automation, and scheduled runs */
declare const __ENABLE_EMAIL_RULES__: boolean;

/** Email read receipts (Pro) */
declare const __ENABLE_EMAIL_TRACKING__: boolean;

/** Automatic follow-up reminders (Pro) */
declare const __ENABLE_AUTO_FOLLOWUPS__: boolean;

/** Per-account automatic replies and vacation responders (Pro) */
declare const __ENABLE_AUTO_REPLIES__: boolean;

/** Conditional signatures (Pro) */

/** Multiple sender identities (Pro) */
declare const __ENABLE_SENDER_ALIASES__: boolean;

/** Quick text blocks (Pro) */
declare const __ENABLE_SNIPPETS__: boolean;

// =============================================================================
// SECURITY FEATURE FLAGS
// =============================================================================

/** Prevent access via user impersonation plugins (Free) */
declare const __ENABLE_PREVENT_IMPERSONATION__: boolean;

/** Plugin file integrity checks (Pro) */

// =============================================================================
// NOTIFICATIONS FEATURE FLAGS
// =============================================================================

/** New mail indicator in WordPress admin bar */
declare const __ENABLE_WP_ADMIN_BAR_NOTIFICATIONS__: boolean;

// =============================================================================
// DEVELOPER FEATURE FLAGS
// =============================================================================

/** External API access and webhook notifications (Pro) */
declare const __ENABLE_API_WEBHOOKS__: boolean;

/** User activity and security event tracking (Pro) */
declare const __ENABLE_AUDIT_LOGS__: boolean;
