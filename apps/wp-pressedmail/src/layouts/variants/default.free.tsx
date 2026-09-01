import { Folder } from "lucide-react";

import { PageTopBar } from "@/components/application-layout/PageTopBar";
import { EmailActionBar } from "@/components/inbox/EmailActionBar";
import { ComposeManager } from "@/components/inbox/compose/ComposeManager";
import { MailList } from "@/components/inbox/mail-list";
import { Nav } from "@/components/inbox/nav";
import { SearchTrigger } from "@/components/search";
import { GlobalNavBar } from "./default/inbox/GlobalNavBar";
import { DefaultLayout } from "./default/inbox/Layout";
import type {
  ActionBarProps,
  ComposerToolbarProps,
  FolderItemProps,
  FolderNavProps,
  InboxLayoutParts,
  LayoutRegistryEntry,
  MailItemProps,
} from "../types";

const FreeInboxMailList: InboxLayoutParts["MailList"] = (props) => (
  <MailList items={props.items} />
);

const FreeMailItem = ({ message, onClick, selected }: MailItemProps) => (
  <div
    className={`cursor-pointer border-b p-2 ${selected ? "bg-accent" : ""}`}
    onClick={() => onClick?.(message)}>
    <div className="truncate text-sm font-medium">
      {message.from || "Unknown"}
    </div>
    <div className="truncate text-sm">{message.subject}</div>
  </div>
);

const FreeFolderNav = ({
  selectedNav,
  onSelectNav,
  folders,
}: FolderNavProps) => (
  <Nav
    isCollapsed={false}
    links={(folders ?? []).map((folder) => ({
      title: folder.name,
      variant: selectedNav === folder.path ? "default" : "ghost",
      label: folder.count?.toString(),
      icon: Folder,
      onClick: () => onSelectNav?.(folder.path),
    }))}
  />
);

const FreeFolderItem = ({
  name,
  count,
  selected,
  onClick,
}: FolderItemProps) => (
  <div
    data-test="folder-item"
    data-folder={name}
    className={`flex cursor-pointer justify-between rounded p-2 ${
      selected ? "bg-accent" : "hover:bg-muted"
    }`}
    onClick={onClick}>
    <span>{name}</span>
    {count !== undefined ? (
      <span className="text-sm text-muted-foreground">{count}</span>
    ) : null}
  </div>
);

const FreeComposerToolbar = ({ onToggleFormat }: ComposerToolbarProps) => (
  <div className="flex gap-1 border-b p-1">
    {(["bold", "italic", "underline"] as const).map((format) => (
      <button
        key={format}
        type="button"
        className="rounded p-1 hover:bg-muted"
        onClick={() => onToggleFormat?.(format)}>
        {format[0]?.toUpperCase()}
      </button>
    ))}
  </div>
);

const FreeBulkActionBar = ({
  selectedCount,
  onArchive,
  onDelete,
}: ActionBarProps) => {
  if (!selectedCount) return null;

  return (
    <div className="flex gap-2 bg-muted p-2">
      <span>{selectedCount} selected</span>
      <button type="button" onClick={onArchive}>
        Archive
      </button>
      <button type="button" onClick={onDelete}>
        Delete
      </button>
    </div>
  );
};

const Placeholder = () => null;
const MessageView = () => <div>Message View</div>;
const AdvancedSearch = () => <div>Advanced Search</div>;
const AccountSelector = () => <div>Account Selector</div>;
const SettingsLink = () => <div>Settings</div>;

export const defaultFreeLayoutParts: LayoutRegistryEntry = {
  inbox: {
    Layout: DefaultLayout,
    MailList: FreeInboxMailList,
    MailItem: FreeMailItem,
    Search: SearchTrigger,
    Header: PageTopBar,
    Sidebar: Nav,
    FolderNav: FreeFolderNav,
    FolderItem: FreeFolderItem,
    Composer: ComposeManager,
    ComposerToolbar: FreeComposerToolbar,
    Actions: EmailActionBar,
    ActionBar: FreeBulkActionBar,
    MessageView,
    AdvancedSearch,
    AccountSelector,
    SettingsLink,
    VerticalIconMenu: GlobalNavBar,
  },
  contacts: {
    Layout: Placeholder,
    Manager: Placeholder,
    Lists: Placeholder,
    ContactCard: Placeholder,
    ContactDetail: Placeholder,
    ContactForm: Placeholder,
    ContactNav: Placeholder,
    SearchBar: Placeholder,
    GroupManagement: Placeholder,
  },
  calendar: {
    Layout: Placeholder,
    Events: Placeholder,
    MonthView: Placeholder,
    WeekView: Placeholder,
    DayView: Placeholder,
    MiniCalendar: Placeholder,
    EventCard: Placeholder,
    EventForm: Placeholder,
    EventDetail: Placeholder,
  },
};
