/**
 * Layout Types
 *
 * Comprehensive type definitions for the multi-layout UI architecture.
 * Each layout (Default, PressedG, PressedOut) provides its own implementations
 * of these interfaces while sharing business logic through hooks.
 *
 * @since 1.0.0
 * @updated 2.0.0 - Expanded for multi-layout architecture
 */

import type { ComponentProps, ComponentType, ReactNode } from "react";
import type { MailProps, EmailMessage } from "@/types";
import type { Contact, ContactList } from "@/types/contacts";
import type {
  CalendarEvent,
  CalendarView,
  LocalCalendarEvent,
} from "@/types/calendar";
import type { SearchTriggerProps } from "@/types/search";
import type {
  LayoutConfig,
  LayoutId,
  ContactsLayoutConfig,
  ContactsLayoutId,
  CalendarLayoutConfig,
  CalendarLayoutId,
  CalendarViewMode,
} from "@/types/features";
import type { NavProps } from "@/components/inbox/nav";
import type { EmailActionBarProps } from "@/components/inbox/EmailActionBar";
import type { PageTopBar } from "@/components/application-layout/PageTopBar";
import type { ComposeManager } from "@/components/inbox/compose/ComposeManager";
import type {
  ContactListsManagerProps,
  ContactManagerProps,
} from "@/types/contacts";
import type { WeekCalendarProps } from "@/types/calendar";

// ============================================================================
// INBOX LAYOUT TYPES
// ============================================================================

/**
 * Main inbox layout component props.
 */
export interface InboxLayoutProps extends Omit<MailProps, "mails"> {
  mails?: MailProps["mails"];
  layoutConfig?: LayoutConfig;
}

/**
 * Mail list component props.
 */
export interface InboxMailListProps {
  items?: EmailMessage[];
  pageSize?: 50 | 100;
}

/**
 * Individual mail item component props.
 */
export interface MailItemProps {
  /** The email message to display */
  message: EmailMessage;
  /** Whether the item is selected */
  selected?: boolean;
  /** Callback when item is clicked */
  onClick?: (message: EmailMessage) => void;
  /** Callback when item is double-clicked */
  onDoubleClick?: (message: EmailMessage) => void;
  /** Callback when checkbox is toggled */
  onSelect?: (message: EmailMessage, selected: boolean) => void;
  /** Callback when star is toggled */
  onToggleStar?: (message: EmailMessage) => void;
  /** Compact mode for narrow panels */
  compact?: boolean;
  /** Show hover actions inline */
  showHoverActions?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Folder navigation component props.
 */
export interface FolderNavProps {
  /** Currently selected folder/nav item */
  selectedNav?: string;
  /** Callback when folder is selected */
  onSelectNav?: (nav: string) => void;
  /** IMAP folders from account */
  folders?: Array<{ name: string; path: string; count?: number }>;
  /** Tags/labels for Gmail-style navigation */
  tags?: Array<{ id: string; name: string; color?: string; count?: number }>;
  /** Navigation variant style */
  variant?: "folder" | "label" | "tree";
  /** Whether navigation is collapsed */
  collapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Individual folder item component props.
 */
export interface FolderItemProps {
  /** Folder name */
  name: string;
  /** Folder path/ID */
  path: string;
  /** Icon to display */
  icon?: ReactNode;
  /** Unread count */
  count?: number;
  /** Whether folder is selected */
  selected?: boolean;
  /** Callback when folder is clicked */
  onClick?: () => void;
  /** Nesting level for tree view */
  level?: number;
  /** Whether folder has children */
  hasChildren?: boolean;
  /** Whether folder is expanded */
  expanded?: boolean;
  /** Callback when expand state changes */
  onExpandChange?: (expanded: boolean) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Composer toolbar component props.
 */
export interface ComposerToolbarProps {
  /** Whether bold is active */
  bold?: boolean;
  /** Whether italic is active */
  italic?: boolean;
  /** Whether underline is active */
  underline?: boolean;
  /** Callback when formatting is toggled */
  onToggleFormat?: (
    format: "bold" | "italic" | "underline" | "strikethrough",
  ) => void;
  /** Callback when link is inserted */
  onInsertLink?: () => void;
  /** Callback when image is inserted */
  onInsertImage?: () => void;
  /** Callback when attachment is added */
  onAddAttachment?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Action bar component props (bulk actions, message actions).
 */
export interface ActionBarProps {
  /** Selected message IDs */
  selectedIds?: Set<string>;
  /** Total selected count */
  selectedCount?: number;
  /** Callback when archive is clicked */
  onArchive?: () => void;
  /** Callback when delete is clicked */
  onDelete?: () => void;
  /** Callback when mark read is clicked */
  onMarkRead?: () => void;
  /** Callback when mark unread is clicked */
  onMarkUnread?: () => void;
  /** Callback when move is clicked */
  onMove?: () => void;
  /** Callback when label is clicked */
  onLabel?: () => void;
  /** Callback when snooze is clicked */
  onSnooze?: () => void;
  /** Whether snooze is available */
  snoozeEnabled?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Filter component props.
 */
export interface FilterProps {
  /** Current filter state */
  filter?: {
    readStatus?: "all" | "read" | "unread";
    starred?: boolean;
    hasAttachments?: boolean;
    dateRange?: { start: Date; end: Date };
  };
  /** Callback when filter changes */
  onFilterChange?: (filter: FilterProps["filter"]) => void;
  /** Callback when filter is cleared */
  onClearFilter?: () => void;
  /** Filter display variant */
  variant?: "dropdown" | "chips" | "ribbon";
  /** Additional class names */
  className?: string;
}

/**
 * Menu component props (context menu, action menu).
 */
export interface MenuProps {
  /** Menu trigger element */
  trigger?: ReactNode;
  /** Menu items */
  items?: Array<{
    id: string;
    label: string;
    icon?: ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    destructive?: boolean;
    separator?: boolean;
  }>;
  /** Menu alignment */
  align?: "start" | "center" | "end";
  /** Additional class names */
  className?: string;
}

/**
 * Status bar component props (PressedOut layout).
 */
export interface StatusBarProps {
  /** Total message count */
  totalMessages?: number;
  /** Unread message count */
  unreadCount?: number;
  /** Selected message count */
  selectedCount?: number;
  /** Current folder name */
  currentFolder?: string;
  /** Sync status */
  syncStatus?: "synced" | "syncing" | "error";
  /** Last sync time */
  lastSyncTime?: Date;
  /** Additional class names */
  className?: string;
}

/**
 * Command ribbon component props (PressedOut layout).
 */
export interface CommandRibbonProps {
  /** Active tab */
  activeTab?: "home" | "view" | "folder" | "tools";
  /** Callback when tab changes */
  onTabChange?: (tab: CommandRibbonProps["activeTab"]) => void;
  /** Selected message for context-sensitive actions */
  selectedMessage?: EmailMessage;
  /** Callback for message actions */
  onMessageAction?: (action: string) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Message view component props.
 */
export interface MessageViewProps {
  /** The message to display */
  message?: EmailMessage | null;
  /** Whether loading */
  loading?: boolean;
  /** Callback for message actions */
  onAction?: (action: string, message: EmailMessage) => void;
  /** Additional class names */
  className?: string;
}

/**
 * Advanced search component props.
 */
export interface AdvancedSearchProps extends SearchTriggerProps {
  /** Callback when filters change */
  onFiltersChange?: (filters: any) => void;
  /** Whether search is realtime */
  realtime?: boolean;
}

/**
 * Account selector component props.
 */
export interface AccountSelectorProps {
  /** Available accounts */
  accounts?: Array<{
    id: string;
    name: string;
    email: string;
    provider: string;
    unreadCount?: number;
  }>;
  /** Current account ID */
  selectedAccountId?: string;
  /** Callback when account is selected */
  onSelectAccount?: (accountId: string) => void;
  /** Display variant */
  variant?: "dropdown" | "list";
  /** Additional class names */
  className?: string;
}

/**
 * WordPress toggle component props (PressedG layout).
 */
export interface WordPressToggleProps {
  /** Callback to toggle WP sidebar */
  onToggleSidebar?: () => void;
  /** Callback for full screen toggle */
  onToggleFullScreen?: () => void;
  /** Callback to hide WP admin menus */
  onToggleAdminMenus?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Vertical icon menu component props (PressedG layout).
 */
export interface VerticalIconMenuProps {
  /** Active item ID */
  activeId?: string;
  /** Callback when item is clicked */
  onItemClick?: (id: string) => void;
  /** Available items */
  items?: Array<{ id: string; icon: ReactNode; label: string; href?: string }>;
  /** Additional class names */
  className?: string;
}

/**
 * Settings link component props.
 */
export interface SettingsLinkProps {
  /** Whether user is admin */
  isAdmin?: boolean;
  /** Callback when clicked */
  onClick?: () => void;
  /** Additional class names */
  className?: string;
}

// Existing type aliases for compatibility
export type InboxSearchProps = SearchTriggerProps;
export type InboxHeaderProps = ComponentProps<typeof PageTopBar>;
export type InboxSidebarProps = NavProps;
export type InboxComposerProps = ComponentProps<typeof ComposeManager>;
export type InboxActionsProps = EmailActionBarProps;

// ============================================================================
// CONTACTS LAYOUT TYPES
// ============================================================================

/**
 * Main contacts layout component props.
 */
export interface ContactsLayoutProps {
  onUpgrade?: () => void;
  onComposeToContact?: (contact: Contact) => void;
  onComposeToContacts?: (contacts: Contact[]) => void;
  layoutConfig?: ContactsLayoutConfig;
  className?: string;
}

/**
 * Contact card component props.
 */
export interface ContactCardProps {
  /** The contact to display */
  contact: Contact;
  /** Callback when contact is clicked */
  onClick?: (contact: Contact) => void;
  /** Callback when edit is clicked */
  onEdit?: (contact: Contact) => void;
  /** Callback when delete is clicked */
  onDelete?: (contact: Contact) => void;
  /** Callback when favorite is toggled */
  onToggleFavorite?: (contact: Contact) => void;
  /** Callback when email is composed */
  onCompose?: (contact: Contact) => void;
  /** Whether the card is selected */
  selected?: boolean;
  /** Compact mode for narrow panels */
  compact?: boolean;
  /** Display variant */
  variant?: "list" | "grid" | "table";
  /** Additional class names */
  className?: string;
}

/**
 * Contact detail view component props.
 */
export interface ContactDetailProps {
  /** The contact to display */
  contact: Contact;
  /** Whether the detail view is open */
  open?: boolean;
  /** Callback when detail view is closed */
  onClose?: () => void;
  /** Callback when contact is updated */
  onUpdate?: (contact: Contact) => void;
  /** Callback when contact is deleted */
  onDelete?: (contact: Contact) => void;
  /** Callback to compose email to contact */
  onCompose?: (contact: Contact) => void;
  /** Available contact lists */
  lists?: ContactList[];
  /** Display variant */
  variant?: "panel" | "drawer" | "modal";
  /** Additional class names */
  className?: string;
}

/**
 * Contact form component props.
 */
export interface ContactFormProps {
  /** Contact to edit (undefined for new contact) */
  contact?: Contact;
  /** Callback when contact is saved */
  onSave?: (contact: Contact) => void;
  /** Callback when form is cancelled */
  onCancel?: () => void;
  /** Whether form is in saving state */
  saving?: boolean;
  /** Available contact lists */
  lists?: ContactList[];
  /** Additional class names */
  className?: string;
}

/**
 * Contact navigation component props.
 */
export interface ContactNavProps {
  /** Currently selected group/list */
  selectedGroup?: string;
  /** Callback when group is selected */
  onSelectGroup?: (groupId: string) => void;
  /** Contact lists */
  lists?: ContactList[];
  /** Navigation variant */
  variant?: "groups" | "labels" | "folders";
  /** Whether navigation is collapsed */
  collapsed?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Contact search bar component props.
 */
export interface ContactSearchProps {
  /** Current search query */
  query?: string;
  /** Callback when search query changes */
  onQueryChange?: (query: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Bulk actions component props for contacts.
 */
export interface ContactBulkActionsProps {
  /** Selected contact IDs */
  selectedIds?: Set<string>;
  /** Total selected count */
  selectedCount?: number;
  /** Callback when delete is clicked */
  onDelete?: () => void;
  /** Callback when add to list is clicked */
  onAddToList?: () => void;
  /** Callback when export is clicked */
  onExport?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Contact group management component props.
 */
export interface ContactGroupManagementProps {
  /** Available lists */
  lists?: ContactList[];
  /** Callback when list is created */
  onCreateList?: (name: string) => void;
  /** Callback when list is deleted */
  onDeleteList?: (id: string) => void;
  /** Additional class names */
  className?: string;
}

// Existing type aliases for compatibility
export type ContactsManagerProps = ContactManagerProps;
export type ContactListsProps = ContactListsManagerProps;

// ============================================================================
// CALENDAR LAYOUT TYPES
// ============================================================================

/**
 * Main calendar layout component props.
 */
export interface CalendarLayoutProps {
  onUpgrade?: () => void;
  onEventClick?: (eventId: number) => void;
  layoutConfig?: CalendarLayoutConfig;
  currentView?: CalendarViewMode;
  onViewChange?: (view: CalendarViewMode) => void;
  className?: string;
}

/**
 * Month view component props.
 */
export interface MonthViewProps {
  /** Current month to display */
  currentDate: Date;
  /** All events to display */
  events: CalendarEvent[];
  /** Called when a day is clicked */
  onDayClick?: (date: Date) => void;
  /** Called when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Maximum events to show per day before "+N more" */
  maxEventsPerDay?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Week view component props.
 */
export interface WeekViewProps {
  /** Current date (week containing this date will be shown) */
  currentDate: Date;
  /** All events to display */
  events: CalendarEvent[];
  /** Called when a time slot is clicked */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  /** Called when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Start hour (default 6 = 6 AM) */
  startHour?: number;
  /** End hour (default 22 = 10 PM) */
  endHour?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Day view component props.
 */
export interface DayViewProps {
  /** Current date to display */
  currentDate: Date;
  /** All events to display */
  events: CalendarEvent[];
  /** Called when a time slot is clicked */
  onTimeSlotClick?: (date: Date, hour: number) => void;
  /** Called when an event is clicked */
  onEventClick?: (event: CalendarEvent) => void;
  /** Start hour (default 6 = 6 AM) */
  startHour?: number;
  /** End hour (default 22 = 10 PM) */
  endHour?: number;
  /** Custom class name */
  className?: string;
}

/**
 * Mini calendar component props.
 */
export interface MiniCalendarProps {
  /** Currently selected date */
  selected?: Date;
  /** Callback when date is selected */
  onSelect?: (date: Date | undefined) => void;
  /** Default month to show */
  defaultMonth?: Date;
  /** Additional class names */
  className?: string;
}

/**
 * Event card component props.
 */
export interface EventCardProps {
  /** The event to display */
  event: CalendarEvent;
  /** Callback when event is clicked */
  onClick?: (event: CalendarEvent) => void;
  /** Callback when event is edited */
  onEdit?: (event: CalendarEvent) => void;
  /** Callback when event is deleted */
  onDelete?: (event: CalendarEvent) => void;
  /** Display variant */
  variant?: "chip" | "card" | "popover" | "row";
  /** Whether card is compact */
  compact?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Event form component props.
 */
export interface EventFormProps {
  /** Whether form is open */
  open?: boolean;
  /** Callback when open state changes */
  onOpenChange?: (open: boolean) => void;
  /** Event to edit (undefined for new event) */
  event?: LocalCalendarEvent | null;
  /** Default date for new events */
  defaultDate?: Date;
  /** Default hour for new events */
  defaultHour?: number;
  /** Callback when event is saved */
  onSuccess?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * View selector component props.
 */
export interface ViewSelectorProps {
  /** Current view */
  view: CalendarView;
  /** Callback when view changes */
  onViewChange: (view: CalendarView) => void;
  /** Available views */
  views?: CalendarView[];
  /** Display variant */
  variant?: "tabs" | "dropdown" | "ribbon";
  /** Additional class names */
  className?: string;
}

/**
 * Event detail component props.
 */
export interface EventDetailProps {
  /** The event to display */
  event: CalendarEvent;
  /** Whether open */
  open?: boolean;
  /** Callback when closed */
  onClose?: () => void;
  /** Callback when edit is clicked */
  onEdit?: (event: CalendarEvent) => void;
  /** Callback when delete is clicked */
  onDelete?: (event: CalendarEvent) => void;
  /** Additional class names */
  className?: string;
}

// Existing type aliases for compatibility
export type CalendarEventsProps = WeekCalendarProps;

// ============================================================================
// SHARED COMPONENT TYPES
// ============================================================================

/**
 * Loading state component props.
 */
export interface LoadingStateProps {
  /** Loading message */
  message?: string;
  /** Additional class names */
  className?: string;
}

/**
 * Empty state component props.
 */
export interface EmptyStateProps {
  /** Icon to display */
  icon?: ReactNode;
  /** Title text */
  title?: string;
  /** Description text */
  description?: string;
  /** Action button text */
  actionText?: string;
  /** Action button callback */
  onAction?: () => void;
  /** Additional class names */
  className?: string;
}

/**
 * Error state component props.
 */
export interface ErrorStateProps {
  /** Error title */
  title?: string;
  /** Error message */
  message?: string;
  /** Retry button callback */
  onRetry?: () => void;
  /** Additional class names */
  className?: string;
}

// ============================================================================
// LAYOUT PARTS INTERFACES
// ============================================================================

/**
 * Inbox layout component parts.
 * Each layout variant must provide implementations for all required parts.
 */
export interface InboxLayoutParts {
  /** Main layout container */
  Layout: ComponentType<InboxLayoutProps>;
  /** Message list component */
  MailList: ComponentType<InboxMailListProps>;
  /** Individual mail item component */
  MailItem: ComponentType<MailItemProps>;
  /** Search bar component */
  Search: ComponentType<InboxSearchProps>;
  /** Header/top bar component */
  Header: ComponentType<InboxHeaderProps>;
  /** Sidebar/navigation component */
  Sidebar: ComponentType<InboxSidebarProps>;
  /** Folder navigation component */
  FolderNav: ComponentType<FolderNavProps>;
  /** Individual folder item component */
  FolderItem: ComponentType<FolderItemProps>;
  /** Email composer component */
  Composer: ComponentType<InboxComposerProps>;
  /** Composer toolbar component */
  ComposerToolbar: ComponentType<ComposerToolbarProps>;
  /** Email action bar component */
  Actions: ComponentType<InboxActionsProps>;
  /** Bulk action bar component */
  ActionBar: ComponentType<ActionBarProps>;
  /** Filter panel component (deprecated/unused, not consumed by LayoutRouter) */
  Filter?: ComponentType<FilterProps>;
  /** Context/action menu component (deprecated/unused, not consumed by LayoutRouter) */
  Menu?: ComponentType<MenuProps>;
  /** Message view component */
  MessageView: ComponentType<MessageViewProps>;
  /** Advanced search component */
  AdvancedSearch: ComponentType<AdvancedSearchProps>;
  /** Account selector component */
  AccountSelector: ComponentType<AccountSelectorProps>;
  /** WordPress toggle component */
  WordPressToggle?: ComponentType<WordPressToggleProps>;
  /** Vertical icon menu component */
  VerticalIconMenu?: ComponentType<VerticalIconMenuProps>;
  /** Settings link component */
  SettingsLink: ComponentType<SettingsLinkProps>;
  /** Status bar component (PressedOut only) */
  StatusBar?: ComponentType<StatusBarProps>;
  /** Command ribbon component (PressedOut only) */
  CommandRibbon?: ComponentType<CommandRibbonProps>;
}

/**
 * Contacts layout component parts.
 * Each layout variant must provide implementations for all required parts.
 */
export interface ContactsLayoutParts {
  /** Main layout container */
  Layout: ComponentType<ContactsLayoutProps>;
  /** Contact manager component */
  Manager: ComponentType<ContactsManagerProps>;
  /** Contact lists manager component */
  Lists: ComponentType<ContactListsProps>;
  /** Individual contact card component */
  ContactCard: ComponentType<ContactCardProps>;
  /** Contact detail view component */
  ContactDetail: ComponentType<ContactDetailProps>;
  /** Contact form component */
  ContactForm: ComponentType<ContactFormProps>;
  /** Contact navigation component */
  ContactNav: ComponentType<ContactNavProps>;
  /** Contact search bar component */
  SearchBar: ComponentType<ContactSearchProps>;
  /** Group management component */
  GroupManagement?: ComponentType<ContactGroupManagementProps>;
  /** Bulk actions component (optional) */
  BulkActions?: ComponentType<ContactBulkActionsProps>;
}

/**
 * Calendar layout component parts.
 * Each layout variant must provide implementations for all required parts.
 */
export interface CalendarLayoutParts {
  /** Main layout container */
  Layout: ComponentType<CalendarLayoutProps>;
  /** Events list/grid component */
  Events: ComponentType<CalendarEventsProps>;
  /** Month view component */
  MonthView: ComponentType<MonthViewProps>;
  /** Week view component */
  WeekView: ComponentType<WeekViewProps>;
  /** Day view component */
  DayView: ComponentType<DayViewProps>;
  /** Mini calendar component */
  MiniCalendar: ComponentType<MiniCalendarProps>;
  /** Event card component */
  EventCard: ComponentType<EventCardProps>;
  /** Event form component */
  EventForm: ComponentType<EventFormProps>;
  /** View selector component (deprecated/unused, not consumed by LayoutRouter) */
  ViewSelector?: ComponentType<ViewSelectorProps>;
  /** Event detail component */
  EventDetail?: ComponentType<EventDetailProps>;
}

/**
 * Shared component parts available in all layouts.
 */
export interface SharedLayoutParts {
  /** Loading state component */
  LoadingState: ComponentType<LoadingStateProps>;
  /** Empty state component */
  EmptyState: ComponentType<EmptyStateProps>;
  /** Error state component */
  ErrorState: ComponentType<ErrorStateProps>;
}

// ============================================================================
// LAYOUT REGISTRY ENTRY
// ============================================================================

/**
 * Complete layout registry entry.
 * Maps a layout ID to all its component parts.
 */
export interface LayoutRegistryEntry {
  /** Inbox component parts */
  inbox: InboxLayoutParts;
  /** Contacts component parts */
  contacts: ContactsLayoutParts;
  /** Calendar component parts */
  calendar: CalendarLayoutParts;
  /** Shared component parts */
  shared?: SharedLayoutParts;
}

// ============================================================================
// GMAIL-STYLE ADVANCED SEARCH TYPES
// ============================================================================

/**
 * Gmail-style advanced search filters.
 * Used by AdvancedSearchPanel and useAdvancedSearch hook.
 */
export interface GmailStyleFilters {
  /** Filter by sender email/name */
  from?: string;
  /** Filter by recipient email/name */
  to?: string;
  /** Filter by subject line */
  subject?: string;
  /** Search for messages containing these words */
  hasWords?: string;
  /** Exclude messages containing these words */
  doesntHave?: string;
  /** Filter by message size */
  size?: {
    value: number;
    unit: "KB" | "MB";
    comparison: "greater" | "less";
  };
  /** Filter by date range */
  dateWithin?: {
    value: number;
    unit: "day" | "week" | "month" | "year";
  };
  /** Filter for messages with attachments */
  hasAttachment?: boolean;
}

/**
 * Props for Gmail-style advanced search panel.
 */
export interface AdvancedSearchPanelProps {
  /** Whether the panel is open */
  isOpen?: boolean;
  /** Callback when panel closes */
  onClose?: () => void;
  /** Current filter values */
  filters?: GmailStyleFilters;
  /** Callback when filters change */
  onFiltersChange?: (filters: GmailStyleFilters) => void;
  /** Callback when search is executed */
  onSearch?: () => void;
  /** Enable real-time search while typing */
  realtimeEnabled?: boolean;
  /** Minimum characters before triggering real-time search */
  minCharsForRealtime?: number;
  /** Additional class name */
  className?: string;
  /** Trigger element to open the panel */
  trigger?: React.ReactNode;
  /** Alignment of the popover */
  align?: "start" | "center" | "end";
}

// ============================================================================
// ACCOUNT SELECTOR WITH BADGES TYPES
// ============================================================================

/**
 * Account with notification badge information.
 */
export interface AccountWithBadge {
  /** Account ID */
  id: string;
  /** Display name */
  name: string;
  /** Email address */
  email: string;
  /** Email provider */
  provider: "imap" | "gmail" | "outlook" | "custom";
  /** Number of unread emails */
  unreadCount: number;
  /** Sync status indicator */
  syncStatus?: "synced" | "syncing" | "error" | "unknown";
  /** Whether this is a shared mailbox */
  isShared?: boolean;
}

/**
 * Props for account selector with notification badges.
 */
export interface AccountSelectorBadgesProps {
  /** List of accounts with badge info */
  accounts?: AccountWithBadge[];
  /** Currently selected account ID */
  selectedAccountId?: string;
  /** Callback when account is selected */
  onSelectAccount?: (accountId: string) => void;
  /** Whether to show unread badges */
  showBadges?: boolean;
  /** Whether to show sync status indicators */
  showSyncStatus?: boolean;
  /** Additional class name */
  className?: string;
}

// ============================================================================
// WHITELABEL TYPES
// ============================================================================

/**
 * Props for whitelabel-aware logo component.
 */
export interface WhitelabelLogoProps {
  /** Additional class name */
  className?: string;
  /** Logo variant for different backgrounds */
  variant?: "default" | "light";
}

// ============================================================================
// TYPE EXPORTS FOR LAYOUT IMPLEMENTATIONS
// ============================================================================

export type { LayoutId, ContactsLayoutId, CalendarLayoutId };
