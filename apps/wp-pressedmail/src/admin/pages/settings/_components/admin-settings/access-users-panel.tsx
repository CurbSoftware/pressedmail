import {
  Fragment,
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  ArrowDown,
  ArrowUp,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  ChevronsUpDown,
  Lock,
  Search,
  X,
  type LucideIcon,
} from "lucide-react";

import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Badge,
  Button,
  Checkbox,
  Input,
  NativeSelect,
  NativeSelectOption,
  cn,
} from "@kit/ui/plugin";
import {
  SettingsEmptyState,
  SettingsSectionCard,
} from "@/components/settings-ui";
import { FilterChip } from "@/components/ui/filter-chip";
import { StatusPill, type StatusTone } from "@/components/ui/status-pill";
import { routeApiPrefix } from "@/context/Strings";
import { notifyAutosaveError } from "@/hooks/useAutosaveSetting";
import { apiFetch } from "@/lib/api-client";

import {
  AccessOverrideControl,
  type AccessOverrideChoice,
} from "./access-override-control";
import type {
  RegisterAccessControlDraft,
  StagedRoleGrants,
} from "./access-tab";
import {
  nameList as namesOf,
  useAccessLossConfirm,
} from "./access-loss-confirm";
import { AccessProblem } from "./access-problem";
import { AccessStagedNotice } from "./access-staged-notice";
import {
  MAX_SEARCH_LENGTH,
  PAGE_SIZES,
  SORTS,
  isScanSort,
  usersViewKey,
  type AccessFilter,
  type OverrideFilter,
  type SortKey,
  type UsersView,
} from "./access-view";
import { useRetryFocus } from "./use-retry-focus";

export type AccessReason =
  | "administrator"
  | "override_allow"
  | "override_deny"
  | "role"
  | "no_read"
  | "none";

export interface AccessUserRole {
  slug: string;
  name: string;
  /** Whether this role can open PressedMail on its own. */
  grants: boolean;
}

export interface AccessUser {
  id: number;
  name: string;
  email: string;
  avatar_url: string;
  roles: AccessUserRole[];
  /** The setting stored on this person: allow, deny, or null to follow the role. */
  override: "allow" | "deny" | null;
  effective: boolean;
  reason: AccessReason;
  /** Administrators always have access, so there is nothing to set. */
  locked: boolean;
  /** Whether they can read the site. Nobody without it can open PressedMail, so Allow means nothing for them. */
  can_read: boolean;
}

interface AccessRoleOption {
  slug: string;
  name: string;
}

/** The whole site at a glance, whatever the list is filtered to. */
interface PeopleCounts {
  members: number;
  /** Allowed by name. */
  allow: number;
  /** Denied by name. */
  deny: number;
}

interface PeoplePage {
  users: AccessUser[];
  roles: AccessRoleOption[];
  /** Null from a server that does not say, so the summary shows no numbers rather than wrong ones. */
  counts: PeopleCounts | null;
  /**
   * Whether the list can be filtered and ordered by what people can do. Only
   * the server can work that out person by person, so it says so for a site
   * this size. Anything but a clear yes is a no.
   */
  canScan: boolean;
  total: number;
  totalPages: number;
  /** The page and page size these rows are, which the request in flight may not match. */
  page: number;
  perPage: number;
}

/** A change waiting for Save. The user is kept so the change survives paging and filtering. */
interface PendingChange {
  user: AccessUser;
  override: "allow" | "deny" | null;
  /** When it was staged, so a list of names reads in the order they were chosen. */
  order: number;
}

const SEARCH_DEBOUNCE_MS = 300;
/** The most changes the server takes in one request. */
const MAX_CHANGES = 100;
/**
 * Pager buttons meet the 44px touch target on a narrow panel and the control
 * height on a wide one. Both are important: the Button's own size-control and
 * size-11 are two classes tailwind-merge cannot tell are in conflict, so the
 * stylesheet's order would decide, and it decided against the touch target.
 */
const PAGER_BUTTON =
  "size-11! @2xl/people:size-control! @2xl/people:pointer-coarse:size-11!";
/** Role chips shown before the rest collapse into "+N". */
const VISIBLE_ROLE_CHIPS = 2;

/** A text link that is a full touch target on a phone and a line of text beside it on a wide panel. */
const LINK_BUTTON =
  "h-auto min-h-11 justify-start p-0 text-xs @2xl/people:min-h-control";

/**
 * A person's row is a stack on a phone, and on a wider panel a grid that puts
 * the choice before its result, so the eye goes from who, to what they get from
 * their role, to what you set, to what that does.
 *
 * - From 42rem: two columns. The person and their roles stack on the left, the
 *   setting and its result stack on the right. Nothing is squeezed into a third
 *   column, so a name and an email keep their room beside the checkbox. The
 *   column is 15rem so "Can open" and "Allowed for this user" share a line.
 * - From 56rem: four columns, one line. The person takes three shares of the
 *   free width and the rest take one each, and the person's column is the only
 *   one without a floor: an email is the field that tells two similar names
 *   apart, so it gets what is left after the roles and the result have their
 *   smallest useful width (6.5rem holds "Support Agent", 9.5rem holds the pill
 *   and its Unsaved cue). At 1440px that is 42 characters of address, up from 31.
 *
 * The setting is 14rem in the four-column row: wide enough that "Allow" and its
 * check fit whole in a third of it, which 13rem was not.
 *
 * The shell's floating navigation button sits over the right edge of whatever
 * scrolls beneath it. A choice under it cannot be pressed, and a result under
 * it is cut off mid-word ("Denied for this use"), so a row keeps 3rem clear on
 * that side in two columns and in four. The header keeps the same, so the
 * columns still line up with it.
 */
const WIDE_COLUMNS =
  "@4xl/people:grid-cols-[minmax(0,3fr)_minmax(6.5rem,1fr)_14rem_minmax(9.5rem,1.2fr)]";
// A template, not cn(): a call at the top of a module is a side effect a bundler
// cannot prove away, and it would keep this Pro-only module in the Free build.
const ROW_GRID = `grid gap-x-4 gap-y-2 @2xl/people:grid-cols-[minmax(0,1fr)_15rem] @2xl/people:items-center ${WIDE_COLUMNS}`;
/** Room, at the end of every row wider than a phone, for the shell's floating button. */
const FLOATING_BUTTON_GUTTER = "@2xl/people:pe-12";
const CELL = {
  person:
    "@2xl/people:col-start-1 @2xl/people:row-start-1 @4xl/people:col-start-1",
  roles:
    "@2xl/people:col-start-1 @2xl/people:row-start-2 @4xl/people:col-start-2 @4xl/people:row-start-1",
  setting:
    "@2xl/people:col-start-2 @2xl/people:row-start-1 @4xl/people:col-start-3",
  access:
    "@2xl/people:col-start-2 @2xl/people:row-start-2 @4xl/people:col-start-4 @4xl/people:row-start-1",
} as const;

/** The status colours as text on their own tint, pulled toward the foreground so every palette clears AA with room to spare. */
const PASS_TEXT =
  "text-[color-mix(in_oklab,var(--pm-success-text,var(--success))_75%,var(--foreground))]";
const FAIL_TEXT =
  "text-[color-mix(in_oklab,var(--pm-destructive-text,var(--destructive))_75%,var(--foreground))]";
const WARN_TEXT =
  "text-[color-mix(in_oklab,var(--pm-warning-text,var(--warning))_75%,var(--foreground))]";

/** Room for the magnifier at the start of the search field, and for the clear button at the end once there is something to clear. */
const SEARCH_PADDING_START = "2.25rem";
const SEARCH_PADDING_END = "2.75rem";

/**
 * The edge of a filter that is on, the same line the selected segment draws, so
 * a list that has been narrowed says so where the narrowing was done and not
 * only in the count.
 */
const ACTIVE_FILTER = "border-foreground/60";

const jsonHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * How wide the fade is where a row that scrolls sideways has more to show. A
 * row cut hard at the edge ("Denied by n") looks finished, and the chip that is
 * off-screen is never found.
 */
const SCROLL_FADE = "1.5rem";

/**
 * Which ends of a row that scrolls sideways have more beyond them, kept up to
 * date as it scrolls and as its contents change size (the counts arrive after
 * the chips are drawn, which widens them).
 */
function useScrollEdges() {
  const ref = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: false, end: false });

  const measure = useCallback(() => {
    const row = ref.current;
    if (!row) return;

    // Negative from the start in a right-to-left page, so the distance is what counts.
    const from = Math.abs(row.scrollLeft);
    const next = {
      start: from > 1,
      end: row.scrollWidth - row.clientWidth - from > 1,
    };

    setEdges((current) =>
      current.start === next.start && current.end === next.end ? current : next,
    );
  }, []);

  useEffect(() => {
    const row = ref.current;
    if (!row) return undefined;

    measure();
    if (typeof ResizeObserver === "undefined") return undefined;

    const observer = new ResizeObserver(measure);
    observer.observe(row);
    Array.from(row.children).forEach((child) => observer.observe(child));

    return () => observer.disconnect();
  }, [measure]);

  return { ref, edges, onScroll: measure };
}

/** A request the server answered, and said no to, in words the admin can read. */
class RequestFailed extends Error {}

/** The page size a person starts with. A row is four blocks tall on a phone, so a phone starts with a shorter page. */
export function defaultPerPage(): number {
  return window.matchMedia?.("(max-width: 767px)")?.matches ? 10 : 25;
}

/** Whether a role lets its people in, once any change waiting for Save on the Roles tab is applied. */
function roleGrants(role: AccessUserRole, staged: StagedRoleGrants): boolean {
  return staged[role.slug] ?? role.grants;
}

/** Would this person get in on their role alone. */
function inheritedAllowed(user: AccessUser, staged: StagedRoleGrants): boolean {
  return user.locked || user.roles.some((role) => roleGrants(role, staged));
}

/** The choice a row shows: what is staged, else what is saved. */
export function choiceFor(
  user: AccessUser,
  change: PendingChange | undefined,
): AccessOverrideChoice {
  const value = change ? change.override : user.override;
  return value ?? "inherit";
}

/**
 * What a person's access will be, with everything waiting for Save applied, on
 * this tab and on the Roles tab, so the badge tells the truth about what Save
 * is about to do and not only what is stored.
 */
export function projectAccess(
  user: AccessUser,
  change: PendingChange | undefined,
  staged: StagedRoleGrants = {},
): { effective: boolean; reason: AccessReason } {
  const roleChanged = user.roles.some((role) => role.slug in staged);

  if (user.locked || (!change && !roleChanged)) {
    return { effective: user.effective, reason: user.reason };
  }

  const override = change ? change.override : user.override;

  if (override === "deny") {
    return { effective: false, reason: "override_deny" };
  }

  if (override !== "allow" && !inheritedAllowed(user, staged)) {
    return { effective: false, reason: "none" };
  }

  // Someone who cannot read is refused by every route, whatever would let them in.
  if (!user.can_read) {
    return { effective: false, reason: "no_read" };
  }

  return {
    effective: true,
    reason: override === "allow" ? "override_allow" : "role",
  };
}

function reasonText(
  user: AccessUser,
  reason: AccessReason,
  staged: StagedRoleGrants,
): string {
  switch (reason) {
    case "administrator":
      return __("Administrator", "pressedmail");
    case "override_allow":
      return __("Allowed for this user", "pressedmail");
    case "override_deny":
      return __("Denied for this user", "pressedmail");
    case "no_read":
      return __("Needs a role with read access", "pressedmail");
    case "role":
      return sprintf(
        /* translators: %s: the role names that let this person in. */
        __("Role: %s", "pressedmail"),
        user.roles
          .filter((role) => roleGrants(role, staged))
          .map((role) => role.name)
          .join(", "),
      );
    default:
      return user.roles.length > 0
        ? __("Role not allowed", "pressedmail")
        : __("No role on this site", "pressedmail");
  }
}

function pillTone(effective: boolean, reason: AccessReason): StatusTone {
  if (effective) return "pass";
  return reason === "override_deny" ? "fail" : "info";
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const letters =
    parts.length > 1 ? [parts[0], parts[parts.length - 1]] : parts;
  return letters
    .map((part) => Array.from(part ?? "")[0] ?? "")
    .join("")
    .toUpperCase();
}

function parseCounts(value: unknown): PeopleCounts | null {
  if (!value || typeof value !== "object") return null;

  const counts = value as Record<string, unknown>;
  const members = Number(counts.members);

  if (!Number.isFinite(members) || members < 0) return null;

  return {
    members,
    allow: Math.max(0, Number(counts.allow) || 0),
    deny: Math.max(0, Number(counts.deny) || 0),
  };
}

function parsePage(
  data: unknown,
  fallback: { page: number; perPage: number },
): PeoplePage {
  const body = (data ?? {}) as Record<string, unknown>;

  return {
    users: Array.isArray(body.users) ? (body.users as AccessUser[]) : [],
    roles: Array.isArray(body.roles) ? (body.roles as AccessRoleOption[]) : [],
    counts: parseCounts(body.counts),
    canScan: body.scan_available === true,
    total: Number(body.total) || 0,
    totalPages: Math.max(1, Number(body.total_pages) || 1),
    page: Math.max(1, Number(body.page) || fallback.page),
    perPage: Math.max(1, Number(body.per_page) || fallback.perPage),
  };
}

/** A server message as a sentence: core's end in a full stop already, and ours may not. */
function withStop(message: string): string {
  return /[.!?]$/.test(message) ? message : `${message}.`;
}

/**
 * What the server said when it refused. A save leads with what was being done,
 * so a bare "Sorry, you are not allowed to do that." is never the whole message;
 * a list that failed to load already has a heading that says so. With no message
 * to give, the status is all there is to report.
 */
async function errorMessage(
  response: Response,
  fallback: string,
  lead = false,
): Promise<string> {
  try {
    const body = await response.json();
    if (typeof body?.message === "string" && body.message) {
      return lead ? `${withStop(fallback)} ${withStop(body.message)}` : body.message;
    }
  } catch {
    // The body was not JSON, so the status is all there is to report.
  }
  return `${fallback} (${response.status})`;
}

/** What to say when a request never got an answer: nothing the admin can act on but their connection. */
function unreachable(fallback: string | null): string {
  const advice = __("Check your connection and try again.", "pressedmail");

  return fallback === null ? advice : `${withStop(fallback)} ${advice}`;
}

/**
 * The text with the first match of the search wrapped in a mark, so the admin
 * sees why a row is in the list. A pattern built from the term is escaped, and
 * matched without regard to case, so what the server matched is what is marked.
 */
function Highlight({
  text,
  term,
  breakable = false,
}: {
  text: string;
  term: string;
  /** An address, which has no spaces to wrap at: let it wrap after its separators. */
  breakable?: boolean;
}) {
  const plain = (part: string): ReactNode =>
    breakable ? softBreaks(part) : part;

  if (!term) return <>{plain(text)}</>;

  const found = new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i").exec(
    text,
  );

  if (!found) return <>{plain(text)}</>;

  const end = found.index + found[0].length;

  return (
    <>
      {plain(text.slice(0, found.index))}
      <mark className="rounded-sm bg-primary/15 text-inherit">
        {text.slice(found.index, end)}
      </mark>
      {plain(text.slice(end))}
    </>
  );
}

/**
 * An address with a place to break after the @ and after each dot, dash,
 * underscore or plus. An email has no spaces, so the browser would otherwise
 * break it wherever the line ran out, in the middle of a word. A break is only
 * taken when the address is wider than its column; the text itself is unchanged.
 */
function softBreaks(text: string): ReactNode {
  return text.split(/([@._+-])/).map((part, index) =>
    index % 2 === 1 ? (
      <Fragment key={index}>
        {part}
        <wbr />
      </Fragment>
    ) : (
      part
    ),
  );
}

/** Put the cursor on the control that holds a person's setting, or the first button in their row. */
function focusRow(userId: number): void {
  const row = document.querySelector(`[data-user-id="${userId}"]`);

  (
    row?.querySelector<HTMLElement>('[role="radio"][tabindex="0"]') ??
    row?.querySelector<HTMLElement>("button")
  )?.focus();
}

/** Up to two names, then how many more, for a sentence about a few people. */
function nameList(people: AccessUser[]): string {
  return namesOf(people.map((user) => user.name));
}

interface AccessUsersPanelProps {
  registerDraft?: RegisterAccessControlDraft;
  /** Whether this tab is showing. Nothing is fetched until it first is. */
  active: boolean;
  /** How many times the Roles tab has saved. Each save changes who the roles let in, so the list is read again. */
  rolesSaves?: number;
  /** What the Roles tab will grant once it is saved, so the badges preview it. */
  stagedRoles?: StagedRoleGrants;
  /**
   * The search, filters, order and page the address names. The tab opens with
   * it, and follows it when it changes under the tab (a link pasted into the
   * same tab, an in-app link), unless the change is the one the tab just wrote.
   */
  view?: Partial<UsersView>;
  /** Told whenever what the list shows changes, while this tab is showing, so the address can follow. */
  onViewChange?: (view: UsersView) => void;
}

/**
 * The Users tab: who can open PressedMail, person by person.
 *
 * Every person follows their role unless an administrator has set them to
 * Allow or Deny, and a setting on a person beats their role. Edits are staged
 * and saved with the page's one Save, so the panel registers as a draft and
 * keeps its staged changes across paging, searching and filtering.
 */
const NO_STAGED_ROLES: StagedRoleGrants = {};

export function AccessUsersPanel({
  registerDraft,
  active,
  rolesSaves = 0,
  stagedRoles = NO_STAGED_ROLES,
  view,
  onViewChange,
}: AccessUsersPanelProps) {
  const [activated, setActivated] = useState(active);
  const [searchInput, setSearchInput] = useState(view?.q ?? "");
  const [search, setSearch] = useState(view?.q ?? "");
  const [role, setRole] = useState(view?.role ?? "");
  const [overrideFilter, setOverrideFilter] = useState<OverrideFilter>(
    view?.setting ?? "",
  );
  const [access, setAccess] = useState<AccessFilter>(view?.access ?? "");
  const [sort, setSort] = useState<SortKey>(view?.sort ?? "name_asc");
  const [page, setPage] = useState(view?.page ?? 1);
  const [perPage, setPerPage] = useState<number>(
    () => view?.perPage ?? defaultPerPage(),
  );
  const [people, setPeople] = useState<PeoplePage | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [pending, setPending] = useState<Record<number, PendingChange>>({});
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});
  const [saveError, setSaveError] = useState("");
  // People whose change was dropped because they are no longer on this site.
  const [dropped, setDropped] = useState<AccessUser[]>([]);
  const [saving, setSaving] = useState(false);
  // The people ticked for a bulk change, by id. They are the page's, so any
  // change to what the list shows puts them away: a Deny must never land on
  // someone the admin can no longer see.
  const [selected, setSelected] = useState<Map<number, AccessUser>>(
    () => new Map(),
  );
  // What the last bulk change did, said in the toolbar's own words.
  const [bulkNote, setBulkNote] = useState("");
  // A role the address named that no longer exists, so the list says why it
  // shows everyone instead of the role the link was made for.
  const [staleRole, setStaleRole] = useState("");
  // The same for an access filter or order the address named on a site too big
  // for the server to offer them.
  const [scanDropped, setScanDropped] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const stagedCount = useRef(0);
  const searchRef = useRef<HTMLInputElement>(null);
  const selectAllRef = useRef<HTMLButtonElement>(null);
  // The toolbar and the table, which a page change brings back into view.
  const listRef = useRef<HTMLDivElement>(null);
  const alertRef = useRef<HTMLSpanElement>(null);
  // Set when a save is refused, and kept until the alert has been put in front
  // of the admin, which can only happen once this tab is showing.
  const needsAttention = useRef(false);
  // The person "Show" was asked for, to put the cursor in their row once it is listed.
  const focusAfterLoad = useRef<number | null>(null);
  const helpId = useId();
  const results = useRetryFocus<HTMLDivElement>(loading, loadError !== "");
  const chips = useScrollEdges();
  const { confirm, dialog: lossDialog } = useAccessLossConfirm();

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  // The address and the tab agree on one view at a time. The key says which: the
  // last one this tab wrote, or took from the address. The address names a view
  // the tab did not write (a link pasted into the same tab) when its key is not
  // that one, and then the tab follows it.
  const addressKey = usersViewKey(view ?? {}, defaultPerPage());
  const agreedKey = useRef(addressKey);
  const wasActive = useRef(active);
  const addressView = useRef(view);
  addressView.current = view;

  useEffect(() => {
    const before = wasActive.current;
    wasActive.current = active;

    if (!active || addressKey === agreedKey.current) return;
    // An empty address on the way into this tab is the tab strip's doing, not a
    // request: leaving a tab clears its view from the address, and the tab puts
    // its own back below. Only a tab already showing takes an empty address as
    // "start again".
    if (addressKey === "" && !before) return;

    const next = addressView.current ?? {};

    agreedKey.current = addressKey;
    setSearchInput(next.q ?? "");
    setSearch(next.q ?? "");
    setRole(next.role ?? "");
    setStaleRole("");
    setScanDropped(false);
    setOverrideFilter(next.setting ?? "");
    setAccess(next.access ?? "");
    setSort(next.sort ?? "name_asc");
    setPage(next.page ?? 1);
    setPerPage(next.perPage ?? defaultPerPage());
  }, [active, addressKey]);

  // The address follows what the list shows, but only while this tab is the one
  // showing: a tab that is hidden has no say over it. Coming back to the tab
  // puts its view back in the address.
  useEffect(() => {
    if (!active) return;

    const shown: UsersView = {
      q: search,
      role,
      setting: overrideFilter,
      access,
      sort,
      page,
      perPage,
    };

    agreedKey.current = usersViewKey(shown, defaultPerPage());
    onViewChange?.(shown);
  }, [
    access,
    active,
    onViewChange,
    overrideFilter,
    page,
    perPage,
    role,
    search,
    sort,
  ]);

  // Typing is instant; the request waits for a pause.
  useEffect(() => {
    if (searchInput.trim() === search) return undefined;

    const timer = window.setTimeout(() => {
      setSearch(searchInput.trim());
      setPage(1);
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [search, searchInput]);

  // The ticks belong to the list that was on screen when they were made.
  useEffect(() => {
    setSelected((current) => (current.size === 0 ? current : new Map()));
    setBulkNote("");
  }, [access, overrideFilter, page, perPage, role, search, sort]);

  const load = useCallback(async () => {
    controller.current?.abort();
    const current = new AbortController();
    controller.current = current;
    setLoading(true);

    const params = new URLSearchParams({
      page: String(page),
      per_page: String(perPage),
      orderby: SORTS[sort].orderby,
      order: SORTS[sort].order,
    });
    if (search) params.set("search", search);
    if (role) params.set("role", role);
    if (overrideFilter) params.set("override", overrideFilter);
    if (access) params.set("access", access);

    try {
      const response = await apiFetch(
        `${routeApiPrefix}/plugin/settings/access-users?${params.toString()}`,
        {
          credentials: "include",
          headers: jsonHeaders(),
          signal: current.signal,
        },
      );

      if (!response.ok) {
        throw new RequestFailed(
          await errorMessage(
            response,
            __("The people list could not be loaded", "pressedmail"),
          ),
        );
      }

      const next = parsePage(await response.json(), { page, perPage });
      if (current.signal.aborted) return;
      // Past the last page (people were removed since): step back to it. The
      // list on screen stays until that page arrives, so no empty state flashes.
      if (page > next.totalPages) {
        setPage(next.totalPages);
        return;
      }
      // An old link can name a role that has been deleted since. The server
      // answers a role nobody holds with an empty page, which would read as "No
      // one matches" under a role filter that says All roles. So the role is let
      // go, the list reads again for everyone, and the page says what happened.
      // The list on screen stays until then, as above.
      if (
        role &&
        next.roles.length > 0 &&
        !next.roles.some((option) => option.slug === role)
      ) {
        setStaleRole(role);
        setRole("");
        setPage(1);
        return;
      }
      // The same for an access filter or order, on a site the server will not
      // work those out for: it listed everyone by name, so the page lets them go
      // and says why, and reads again.
      if (!next.canScan && (access || isScanSort(sort))) {
        setScanDropped(true);
        setAccess("");
        if (isScanSort(sort)) setSort("name_asc");
        setPage(1);
        return;
      }
      // The error stays up while a load is in flight, so a Retry that is
      // pressed keeps its button, and its focus, until there is something better.
      setLoadError("");
      setPeople(next);
      setLoading(false);
    } catch (caught) {
      // A newer request took over. It owns the loading state now.
      if (current.signal.aborted) return;
      setLoadError(
        caught instanceof RequestFailed ? caught.message : unreachable(null),
      );
      setLoading(false);
    }
  }, [access, overrideFilter, page, perPage, role, search, sort]);

  // The list is read on the tab's first visit, whenever what it asks for
  // changes, and again after the Roles tab saves, because that moves who the
  // roles let in.
  useEffect(() => {
    if (!activated) return undefined;

    void load();
    return () => controller.current?.abort();
  }, [activated, load, rolesSaves]);

  // A staged change keeps the person as they were when it was staged, and that
  // is what "can they open PressedMail now" is worked out from. After a save
  // that landed in part (Roles saved, this tab refused) the list is read again
  // and their access has moved, so the snapshot follows each list that lands.
  useEffect(() => {
    if (!people) return;

    setPending((current) => {
      let moved = false;
      const next = { ...current };
      for (const user of people.users) {
        const change = next[user.id];
        if (change && change.user !== user) {
          next[user.id] = { ...change, user };
          moved = true;
        }
      }
      return moved ? next : current;
    });
  }, [people]);

  const pendingList = useMemo(() => Object.values(pending), [pending]);
  const pendingCount = pendingList.length;
  const denyCount = pendingList.filter((c) => c.override === "deny").length;
  const allowCount = pendingList.filter((c) => c.override === "allow").length;
  const inheritCount = pendingCount - denyCount - allowCount;

  const setChoice = useCallback(
    (user: AccessUser, choice: AccessOverrideChoice) => {
      const next = choice === "inherit" ? null : choice;
      const order = stagedCount.current++;

      setPending((current) => {
        if (next === user.override) {
          const { [user.id]: _dropped, ...rest } = current;
          return rest;
        }
        return {
          ...current,
          [user.id]: {
            user,
            override: next,
            order: current[user.id]?.order ?? order,
          },
        };
      });
      // Only this person's own error goes. The summary of who else did not
      // save follows from the errors that are left.
      setRowErrors(({ [user.id]: _dropped, ...rest }) => rest);
      setSaveError("");
      setDropped([]);
    },
    [],
  );

  const save = useCallback(async (): Promise<boolean> => {
    const changes = Object.values(pending);
    if (changes.length === 0) return true;

    setSaving(true);
    setSaveError("");
    setDropped([]);
    setRowErrors({});

    const settled = new Map<number, AccessUser>();
    const gone = new Map<number, AccessUser>();
    const failed: Record<number, string> = {};
    let requestError = "";
    const asked = new Map(
      changes.map((change) => [change.user.id, change.user]),
    );

    try {
      for (let start = 0; start < changes.length; start += MAX_CHANGES) {
        const chunk = changes.slice(start, start + MAX_CHANGES);
        const response = await apiFetch(
          `${routeApiPrefix}/plugin/settings/access-users`,
          {
            method: "POST",
            credentials: "include",
            headers: jsonHeaders(),
            body: JSON.stringify({
              changes: chunk.map((change) => ({
                id: change.user.id,
                override: change.override,
              })),
            }),
          },
        );

        if (!response.ok) {
          throw new RequestFailed(
            await errorMessage(
              response,
              __("The changes could not be saved", "pressedmail"),
              true,
            ),
          );
        }

        const data = await response.json();
        for (const row of Array.isArray(data?.results) ? data.results : []) {
          const askedUser = asked.get(Number(row.id));

          if (row.saved === true && row.user) {
            settled.set(Number(row.id), row.user as AccessUser);
          } else if (row.code === "not_found" && askedUser) {
            // They are not on this site any more, so no retry can save it.
            gone.set(Number(row.id), askedUser);
          } else {
            failed[Number(row.id)] =
              typeof row.message === "string" && row.message
                ? row.message
                : __("This change could not be saved.", "pressedmail");
          }
        }
      }
    } catch (caught) {
      requestError =
        caught instanceof RequestFailed
          ? caught.message
          : unreachable(__("The changes could not be saved", "pressedmail"));
    }

    // Whatever was saved is saved, even when a later request failed. A change
    // for someone who is gone is dropped: it would fail on every Save and keep
    // the count above zero, and the alert says so.
    setPending((current) => {
      const next = { ...current };
      settled.forEach((_user, id) => delete next[id]);
      gone.forEach((_user, id) => delete next[id]);
      return next;
    });
    setPeople((current) =>
      current
        ? {
            ...current,
            users: current.users.map((user) => settled.get(user.id) ?? user),
          }
        : current,
    );
    setSaving(false);

    if (requestError || Object.keys(failed).length > 0 || gone.size > 0) {
      setRowErrors(failed);
      setSaveError(requestError);
      setDropped(Array.from(gone.values()));
      needsAttention.current = true;
      notifyAutosaveError(
        __("Could not save who can open PressedMail", "pressedmail"),
      );
      return false;
    }

    // The page says "saved" once, when every part of it has been, so a save
    // this tab refused never comes with a success toast from another.
    // Filters and totals may have moved under the saved rows.
    void load();
    return true;
  }, [load, pending]);

  const cancel = useCallback(() => {
    setPending({});
    setRowErrors({});
    setSaveError("");
    setDropped([]);
  }, []);

  // A change that failed may be on another page, or hidden by a filter, so the
  // alert names who and offers to bring the first one into view. It is worked
  // out from the errors that remain, so fixing one person leaves the map to the
  // others in place, and it goes when the last one is fixed.
  const failed = Object.keys(rowErrors)
    .map((id) => pending[Number(id)])
    .filter((change): change is PendingChange => Boolean(change))
    .sort((a, b) => a.order - b.order)
    .map((change) => change.user);
  const failedSummary = [
    saveError ||
      (failed.length > 0
        ? _n(
            "One change could not be saved. It stays in your draft.",
            "Some changes could not be saved. They stay in your draft.",
            failed.length,
            "pressedmail",
          )
        : ""),
    dropped.length > 0
      ? sprintf(
          /* translators: %s: the people who are not on this site any more, such as "Ada Lovelace, Alan Turing and 2 more". */
          _n(
            "%s is no longer on this site, so that change was dropped.",
            "%s are no longer on this site, so those changes were dropped.",
            dropped.length,
            "pressedmail",
          ),
          nameList(dropped),
        )
      : "",
  ]
    .filter(Boolean)
    .join(" ");
  const refused = failedSummary !== "";

  // Only a Deny on someone who can open PressedMail today, and still would once
  // everything else waiting for Save is applied, takes anything away. The other
  // two stop nothing, so they get no warning about lost work:
  //
  // - Someone who is kept out anyway, because the Roles tab is turning their
  //   role off or because their role never let them in. Their Deny is saved and
  //   it wins if a role lets them in later.
  // - Someone who cannot open it today but would, because the Roles tab is
  //   turning their role on. Nothing is taken from them, and nothing they use
  //   stops: their Deny is what keeps them out of the role that is being opened.
  const { losing, standing, kept } = useMemo(() => {
    const denies = pendingList
      .filter((change) => change.override === "deny")
      .sort((a, b) => a.order - b.order);
    const canOpenNow = (change: PendingChange) => change.user.effective;
    const wouldOpen = (change: PendingChange) =>
      projectAccess(change.user, undefined, stagedRoles).effective;

    return {
      losing: denies
        .filter((change) => canOpenNow(change) && wouldOpen(change))
        .map((change) => change.user),
      standing: denies
        .filter((change) => !wouldOpen(change))
        .map((change) => change.user),
      kept: denies
        .filter((change) => !canOpenNow(change) && wouldOpen(change))
        .map((change) => change.user),
    };
  }, [pendingList, stagedRoles]);

  // Asked before anything on the page is saved, so a "keep editing" leaves the
  // page exactly as it was.
  const beforeSave = useCallback(async (): Promise<boolean> => {
    if (losing.length === 0) return true;

    return confirm({
      title: sprintf(
        _n(
          "Remove access for %d person?",
          "Remove access for %d people?",
          losing.length,
          "pressedmail",
        ),
        losing.length,
      ),
      lead: sprintf(
        /* translators: %s: the people who lose access, such as "Ada Lovelace, Alan Turing and 2 more". */
        _n(
          "%s won't be able to open PressedMail.",
          "%s won't be able to open PressedMail.",
          losing.length,
          "pressedmail",
        ),
        nameList(losing),
      ),
      note:
        [
          standing.length > 0
            ? sprintf(
                /* translators: %s: the people who can't open PressedMail after the save anyway, such as "Ada Lovelace, Alan Turing and 2 more". */
                _n(
                  "%s can't open PressedMail either way, so nothing changes for them now. Their Deny is saved, and it wins if a role lets them in later.",
                  "%s can't open PressedMail either way, so nothing changes for them now. Their Deny is saved, and it wins if a role lets them in later.",
                  standing.length,
                  "pressedmail",
                ),
                nameList(standing),
              )
            : "",
          kept.length > 0
            ? sprintf(
                /* translators: %s: the people a role that is being turned on would let in, but who are denied by name, such as "Ada Lovelace, Alan Turing and 2 more". */
                _n(
                  "%s can't open PressedMail today. A role you're turning on would let them in, but their Deny keeps them out.",
                  "%s can't open PressedMail today. A role you're turning on would let them in, but their Deny keeps them out.",
                  kept.length,
                  "pressedmail",
                ),
                nameList(kept),
              )
            : "",
        ]
          .filter(Boolean)
          .join(" ") || undefined,
    });
  }, [confirm, kept, losing, standing]);

  const draft = useMemo(
    () => ({
      dirty: pendingCount > 0,
      saving,
      count: pendingCount,
      failed: refused,
      beforeSave,
      save,
      cancel,
    }),
    [beforeSave, cancel, pendingCount, refused, save, saving],
  );

  useEffect(() => {
    registerDraft?.("access-users", draft);
    return () => registerDraft?.("access-users", null);
  }, [draft, registerDraft]);

  // A refused save is put in front of the admin. They may have saved from
  // another tab, which the page answers by bringing them here, so this waits
  // until this tab is showing.
  useEffect(() => {
    if (!needsAttention.current || !active || !refused) return;

    needsAttention.current = false;
    alertRef.current?.focus();
    alertRef.current?.scrollIntoView?.({ block: "nearest" });
  }, [active, refused]);

  // Once the list that "Show" asked for is in, the cursor goes to that person.
  useEffect(() => {
    const id = focusAfterLoad.current;
    if (id === null || loading || !people) return;

    focusAfterLoad.current = null;
    focusRow(id);
  }, [loading, people]);

  const filtered =
    search !== "" || role !== "" || overrideFilter !== "" || access !== "";

  // Whatever removes the control that has the cursor hands it on, so a
  // keyboard user is never dropped at the top of the page.
  const commitSearch = (value: string) => {
    setSearch(value.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput("");
    commitSearch("");
    searchRef.current?.focus();
  };

  const clearFilters = () => {
    setSearchInput("");
    setSearch("");
    setRole("");
    setStaleRole("");
    setScanDropped(false);
    setOverrideFilter("");
    setAccess("");
    setPage(1);
    searchRef.current?.focus();
  };

  const sortBy = (next: SortKey) => {
    setSort(next);
    setScanDropped(false);
    setPage(1);
  };

  // A page picked from the footer used to leave the admin where they pressed
  // it, at the bottom of the new page, looking at its last rows. So when the top
  // of the list is out of view it comes back, gently unless they asked for less
  // motion. The cursor stays on the pager button that was pressed.
  const goToPage = (next: number) => {
    setPage(next);

    const top = listRef.current;
    if (!top || top.getBoundingClientRect().top >= 0) return;

    top.scrollIntoView?.({
      block: "start",
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches
        ? "auto"
        : "smooth",
    });
  };

  // Administrators are never ticked: there is nothing to set for them.
  const selectable = useMemo(
    () => (people?.users ?? []).filter((user) => !user.locked),
    [people],
  );
  const tickedHere = selectable.filter((user) => selected.has(user.id)).length;

  const tick = (user: AccessUser, on: boolean) => {
    setBulkNote("");
    setSelected((current) => {
      const next = new Map(current);
      if (on) next.set(user.id, user);
      else next.delete(user.id);
      return next;
    });
  };

  const tickAll = (on: boolean) => {
    setBulkNote("");
    setSelected(
      on ? new Map(selectable.map((user) => [user.id, user])) : new Map(),
    );
  };

  // One setting for everyone ticked. It stages the same changes the rows would,
  // so Save, Cancel, the preview in each row and the warning before a Deny all
  // behave as they do for one person at a time. Nothing is saved here.
  const applyBulk = (choice: AccessOverrideChoice) => {
    const live = new Map((people?.users ?? []).map((user) => [user.id, user]));
    let applied = 0;
    let skipped = 0;

    selected.forEach((ticked) => {
      const user = live.get(ticked.id) ?? ticked;

      // Allow means nothing for someone who cannot read: every route refuses them.
      if (choice === "allow" && !user.can_read) {
        skipped += 1;
        return;
      }
      setChoice(user, choice);
      applied += 1;
    });

    const label =
      choice === "allow"
        ? __("Allow", "pressedmail")
        : choice === "deny"
          ? __("Deny", "pressedmail")
          : __("Inherit", "pressedmail");

    setBulkNote(
      [
        applied > 0
          ? sprintf(
              /* translators: 1: how many people, 2: the setting, Inherit, Allow or Deny. */
              _n(
                "Set %1$d person to %2$s. Save to apply.",
                "Set %1$d people to %2$s. Save to apply.",
                applied,
                "pressedmail",
              ),
              applied,
              label,
            )
          : "",
        skipped > 0
          ? sprintf(
              _n(
                "%d person skipped: Allow needs a role with read access.",
                "%d people skipped: Allow needs a role with read access.",
                skipped,
                "pressedmail",
              ),
              skipped,
            )
          : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
    setSelected(new Map());
    // The button that was pressed goes away with the ticks.
    selectAllRef.current?.focus();
  };

  const showFailed = () => {
    const first = failed[0];
    if (!first) return;

    // Already on screen: go straight to them.
    if (people?.users.some((user) => user.id === first.id)) {
      focusRow(first.id);
      return;
    }

    focusAfterLoad.current = first.id;
    setRole("");
    setStaleRole("");
    setOverrideFilter("");
    setAccess("");
    setSearchInput(first.email);
    commitSearch(first.email);
  };

  const counts = people?.counts ?? null;
  // Offered until the server says it will not, which it does for a site too big
  // to work out person by person.
  const scanAvailable = people?.canScan !== false;
  // The chips: everyone, then the exceptions an admin made, then the rest.
  const settingViews: Array<{
    value: OverrideFilter;
    label: string;
    count: number | null;
  }> = [
    {
      value: "",
      label: __("Everyone", "pressedmail"),
      count: counts ? counts.members : null,
    },
    {
      value: "allow",
      label: __("Allowed by name", "pressedmail"),
      count: counts ? counts.allow : null,
    },
    {
      value: "deny",
      label: __("Denied by name", "pressedmail"),
      count: counts ? counts.deny : null,
    },
    {
      value: "inherit",
      label: __("Follow their role", "pressedmail"),
      count: counts
        ? Math.max(0, counts.members - counts.allow - counts.deny)
        : null,
    },
  ];

  // What the toolbar says, in order of what matters: what was just done, what is
  // ticked, how many match, how many there are.
  const toolbarText = bulkNote
    ? bulkNote
    : selected.size > 0
      ? sprintf(
          _n(
            "%d person selected",
            "%d people selected",
            selected.size,
            "pressedmail",
          ),
          selected.size,
        )
      : people && filtered && counts
        ? sprintf(
            _n(
              "%1$d of %2$d person",
              "%1$d of %2$d people",
              counts.members,
              "pressedmail",
            ),
            people.total,
            counts.members,
          )
        : people
          ? sprintf(
              _n("%d person", "%d people", people.total, "pressedmail"),
              people.total,
            )
          : "";

  return (
    <SettingsSectionCard
      // A heading of its own, so heading navigation finds the people list. The
      // card puts its title in a plain element.
      title={
        <span role="heading" aria-level={2}>
          {__("Who can open PressedMail", "pressedmail")}
        </span>
      }
      description={
        <span
          id={helpId}
          data-test="access-users-legend"
          data-testid="access-users-legend">
          {__(
            "Allow or Deny beats a person's role, and Inherit follows it. Administrators always have access.",
            "pressedmail",
          )}
        </span>
      }
      dataTest="access-users"
      ariaBusy={loading}
      // Not clipped, so the table's header can stay in view while it scrolls;
      // capped, so a wide screen does not put a name and its setting a screen
      // apart; and clear of the bottom-right corner, where the shell's floating
      // navigation button covers the last page button at the end of a list.
      className="max-w-6xl overflow-visible md:mb-14"
      // A gap, not space-y. space-y is a margin on each child, and the chip row
      // below has a margin of its own that replaced it, which left the chips
      // flush on the search field with 0px between. A gap belongs to the parent,
      // so no child's margin can undo it.
      contentClassName="@container/people flex flex-col gap-4">
      {/* Who has a setting of their own, and how many of them: the exceptions an
          admin made are what this page is for, and they are one press away. One
          row that scrolls on a phone, where four chips would take three lines of
          finger-sized pills before the first person; the 4px of padding and the
          matching negative margin leave room for the focus outline, which a
          scrolling box would otherwise clip. The margin cancels the padding, so
          the row's box is the chips' own and the 16px gap below is measured from
          the chips, not from the outline room. */}
      <div
        ref={chips.ref}
        role="group"
        aria-label={__("Filter by setting", "pressedmail")}
        onScroll={chips.onScroll}
        data-fade-start={chips.edges.start ? "true" : undefined}
        data-fade-end={chips.edges.end ? "true" : undefined}
        style={
          {
            "--fade-start": chips.edges.start ? SCROLL_FADE : "0px",
            "--fade-end": chips.edges.end ? SCROLL_FADE : "0px",
          } as CSSProperties
        }
        className={cn(
          "-m-1 flex gap-2 overflow-x-auto p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden @2xl/people:flex-wrap @2xl/people:overflow-visible",
          // The ends that have more fade out, so the row says it scrolls. Where
          // the chips wrap there is nothing to say.
          (chips.edges.start || chips.edges.end) &&
            "[mask-image:linear-gradient(to_right,transparent,#000_var(--fade-start),#000_calc(100%_-_var(--fade-end)),transparent)] rtl:[mask-image:linear-gradient(to_left,transparent,#000_var(--fade-start),#000_calc(100%_-_var(--fade-end)),transparent)] @2xl/people:[mask-image:none]",
        )}
        data-test="access-users-override"
        data-testid="access-users-override">
        {settingViews.map((option) => (
          <FilterChip
            key={option.value || "everyone"}
            selected={overrideFilter === option.value}
            count={option.count}
            onClick={(event) => {
              setOverrideFilter(option.value);
              setPage(1);
              // A chip at the clipped edge of the row slides fully into view.
              event.currentTarget.scrollIntoView?.({
                block: "nearest",
                inline: "nearest",
              });
            }}
            data-test={`access-users-view-${option.value || "everyone"}`}
            data-testid={`access-users-view-${option.value || "everyone"}`}>
            {option.label}
          </FilterChip>
        ))}
      </div>

      {/* Three selects beside the search leave it 136px at 42rem, too little for
          its own placeholder, so they sit under it until 48rem, in a row of three
          from 36rem, and beside it only once it keeps 280px. */}
      <div className="flex flex-col gap-2 @3xl/people:flex-row @3xl/people:items-center">
        <div className="relative min-w-0 flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute start-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
          />
          {/* The padding is inline because the field's own horizontal padding
              is a shorthand that out-ranked a logical padding class, which put
              the first letter under the icon. An inline style beats every
              stylesheet, whatever order they load in. */}
          <Input
            ref={searchRef}
            type="text"
            inputMode="search"
            enterKeyHint="search"
            autoComplete="off"
            maxLength={MAX_SEARCH_LENGTH}
            value={searchInput}
            onChange={(event) => setSearchInput(event.target.value)}
            onKeyDown={(event) => {
              // Enter confirms and Escape cancels a candidate for someone typing
              // through an input method, so neither is a request to search or clear.
              if (event.nativeEvent.isComposing) return;

              if (event.key === "Enter") {
                // Do not wait out the pause when the admin says they are done.
                event.preventDefault();
                commitSearch(searchInput);
              } else if (event.key === "Escape" && searchInput !== "") {
                event.preventDefault();
                event.stopPropagation();
                clearSearch();
              }
            }}
            placeholder={__("Search name or email", "pressedmail")}
            // The same words as the placeholder, so what a person reads is what
            // a voice command or a screen reader calls the field (WCAG 2.5.3).
            aria-label={__("Search name or email", "pressedmail")}
            style={{
              paddingInlineStart: SEARCH_PADDING_START,
              paddingInlineEnd: searchInput ? SEARCH_PADDING_END : undefined,
            }}
            data-test="access-users-search"
          />
          {searchInput ? (
            <button
              type="button"
              onClick={clearSearch}
              aria-label={__("Clear search", "pressedmail")}
              className="absolute end-0 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-md text-muted-foreground outline-none hover:text-foreground @2xl/people:size-control">
              <X aria-hidden="true" className="size-4" />
            </button>
          ) : null}
        </div>
        {/* Fixed widths on a wide panel: the selects used to size themselves to
            their options, which are few while the list loads and many after, so
            the search field beside them grew and shrank under the admin. */}
        <div className="grid grid-cols-2 gap-2 @xl/people:grid-cols-3 @3xl/people:flex @3xl/people:shrink-0">
          <NativeSelect
            value={role}
            onChange={(event) => {
              setRole(event.target.value);
              setStaleRole("");
              setPage(1);
            }}
            aria-label={__("Filter by role", "pressedmail")}
            className={cn(
              "w-full @3xl/people:w-40",
              role !== "" && ACTIVE_FILTER,
            )}
            data-active={role !== "" ? "true" : undefined}
            data-test="access-users-role">
            <NativeSelectOption value="">
              {__("All roles", "pressedmail")}
            </NativeSelectOption>
            {(people?.roles ?? []).map((option) => (
              <NativeSelectOption key={option.slug} value={option.slug}>
                {option.name}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          {/* What the list is for: who can open PressedMail. The chips above
              filter by what was set on a person, and this by the result. */}
          {scanAvailable ? (
            <NativeSelect
              value={access}
              onChange={(event) => {
                setAccess(event.target.value as AccessFilter);
                setScanDropped(false);
                setPage(1);
              }}
              aria-label={__("Filter by access", "pressedmail")}
              className={cn(
                "w-full @3xl/people:w-36",
                access !== "" && ACTIVE_FILTER,
              )}
              data-active={access !== "" ? "true" : undefined}
              data-test="access-users-access">
              <NativeSelectOption value="">
                {__("Any access", "pressedmail")}
              </NativeSelectOption>
              <NativeSelectOption value="open">
                {__("Can open", "pressedmail")}
              </NativeSelectOption>
              <NativeSelectOption value="blocked">
                {__("No access", "pressedmail")}
              </NativeSelectOption>
            </NativeSelect>
          ) : null}
          <NativeSelect
            value={sort}
            onChange={(event) => {
              setSort(event.target.value as SortKey);
              setScanDropped(false);
              setPage(1);
            }}
            aria-label={__("Sort people", "pressedmail")}
            className={cn(
              "w-full @3xl/people:w-40",
              // Three controls in two columns: the last takes the second row. In
              // a row of three it is one of them.
              scanAvailable && "col-span-2 @xl/people:col-span-1",
              sort !== "name_asc" && ACTIVE_FILTER,
            )}
            data-active={sort !== "name_asc" ? "true" : undefined}
            data-test="access-users-sort">
            <NativeSelectOption value="name_asc">
              {__("Name A to Z", "pressedmail")}
            </NativeSelectOption>
            <NativeSelectOption value="name_desc">
              {__("Name Z to A", "pressedmail")}
            </NativeSelectOption>
            {scanAvailable ? (
              <>
                <NativeSelectOption value="role_asc">
                  {__("Role A to Z", "pressedmail")}
                </NativeSelectOption>
                <NativeSelectOption value="role_desc">
                  {__("Role Z to A", "pressedmail")}
                </NativeSelectOption>
                <NativeSelectOption value="access_asc">
                  {__("No access first", "pressedmail")}
                </NativeSelectOption>
                <NativeSelectOption value="access_desc">
                  {__("Can open first", "pressedmail")}
                </NativeSelectOption>
              </>
            ) : null}
          </NativeSelect>
        </div>
      </div>

      {staleRole ? (
        <p
          role="status"
          className="text-xs text-muted-foreground"
          data-test="access-users-stale-role"
          data-testid="access-users-stale-role">
          {sprintf(
            /* translators: %s: the name of a role that no longer exists. */
            __(
              "The role %s no longer exists, so everyone is listed.",
              "pressedmail",
            ),
            staleRole,
          )}
        </p>
      ) : null}

      {scanDropped ? (
        <p
          role="status"
          className="text-xs text-muted-foreground"
          data-test="access-users-scan-dropped"
          data-testid="access-users-scan-dropped">
          {__(
            "This site has too many people to filter or sort by access, so everyone is listed by name.",
            "pressedmail",
          )}
        </p>
      ) : null}

      {/* Spoken, not drawn. A banner here pushed every row down the moment a
          choice was made, out from under the pointer that had just made it. The
          rows show what is waiting, the Save bar counts it, and what a Deny takes
          away is said once, when Save is pressed. */}
      <AccessStagedNotice
        show={pendingCount > 0}
        silent
        dataTest="access-users-pending">
        {sprintf(
          /* translators: 1: number of staged changes, 2: what they are, such as "1 to Deny, 2 to Allow". */
          __("%1$s: %2$s. Save to apply.", "pressedmail"),
          sprintf(
            _n(
              "%d unsaved change",
              "%d unsaved changes",
              pendingCount,
              "pressedmail",
            ),
            pendingCount,
          ),
          [
            denyCount > 0
              ? sprintf(__("%d to Deny", "pressedmail"), denyCount)
              : "",
            allowCount > 0
              ? sprintf(__("%d to Allow", "pressedmail"), allowCount)
              : "",
            inheritCount > 0
              ? sprintf(__("%d to Inherit", "pressedmail"), inheritCount)
              : "",
          ]
            .filter(Boolean)
            .join(", "),
        )}
      </AccessStagedNotice>

      {failedSummary ? (
        <AccessProblem
          contentClassName="flex flex-wrap items-center gap-x-3 gap-y-2"
          data-test="access-users-save-error"
          data-testid="access-users-save-error">
          <span ref={alertRef} tabIndex={-1} className="outline-none">
            {failedSummary}
            {failed.length > 0
              ? ` ${sprintf(
                  /* translators: %s: the people whose change was not saved, such as "Ada Lovelace, Alan Turing and 2 more". */
                  __("Not saved: %s.", "pressedmail"),
                  nameList(failed),
                )}`
              : ""}
          </span>
          {failed.length > 0 ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={showFailed}
              data-test="access-users-show-failed">
              {sprintf(
                /* translators: %s: a person's name. */
                __("Show %s", "pressedmail"),
                failed[0]?.name ?? "",
              )}
            </Button>
          ) : null}
        </AccessProblem>
      ) : null}

      {loadError && !people ? (
        <AccessProblem
          role="alert"
          title={__("People could not be loaded", "pressedmail")}
          contentClassName="space-y-3"
          data-test="access-users-load-error"
          data-testid="access-users-load-error">
          <p>
            {withStop(loadError)}{" "}
            {__("Nothing has been changed.", "pressedmail")}
          </p>
          <RetryButton
            loading={loading}
            onRetry={() => results.retry(() => void load())}
            dataTest="access-users-retry"
          />
        </AccessProblem>
      ) : !people ? (
        <PeopleSkeleton />
      ) : (
        <>
          {loadError ? (
            <AccessProblem
              role="alert"
              contentClassName="flex flex-wrap items-center gap-3"
              data-test="access-users-refresh-error"
              data-testid="access-users-refresh-error">
              <span>
                {__("The list could not be refreshed.", "pressedmail")}{" "}
                {withStop(loadError)}{" "}
                {__("Showing the last list.", "pressedmail")}
              </span>
              <RetryButton
                loading={loading}
                onRetry={() => results.retry(() => void load())}
                dataTest="access-users-refresh-retry"
              />
            </AccessProblem>
          ) : null}

          <div ref={listRef} className="scroll-mt-4 space-y-2">
            {/* One row, always there, so nothing moves when it has something to
                say: who is listed, or who is ticked and what to set them to. */}
            <div
              className="flex min-h-control flex-wrap items-center justify-between gap-x-4 gap-y-2"
              data-test="access-users-toolbar"
              data-testid="access-users-toolbar">
              <div className="flex min-w-0 items-center gap-2.5">
                {/* A target of 24px, or 44px for a finger. The kit's box is 16px
                    and brings its own larger hit area, which this keeps clear of
                    the row's own. */}
                <span className="flex size-6 shrink-0 items-center justify-center pointer-coarse:size-11">
                  <Checkbox
                    ref={selectAllRef}
                    checked={
                      selectable.length > 0 && tickedHere === selectable.length
                    }
                    indeterminate={
                      tickedHere > 0 && tickedHere < selectable.length
                    }
                    disabled={selectable.length === 0 || saving}
                    onCheckedChange={(checked) => tickAll(checked === true)}
                    aria-label={__("Select everyone on this page", "pressedmail")}
                    data-test="access-users-select-all"
                  />
                </span>
                <p
                  aria-live="polite"
                  className="min-w-0 text-xs text-muted-foreground"
                  data-test="access-users-count"
                  data-testid="access-users-count">
                  {toolbarText}
                </p>
              </div>
              {selected.size > 0 ? (
                <div
                  role="group"
                  aria-label={__("Set the selected people to", "pressedmail")}
                  className="flex flex-wrap items-center gap-2"
                  data-test="access-users-bulk"
                  data-testid="access-users-bulk">
                  <span className="text-xs text-muted-foreground" aria-hidden="true">
                    {__("Set to", "pressedmail")}
                  </span>
                  {(["inherit", "allow", "deny"] as const).map((choice) => (
                    <Button
                      key={choice}
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={saving}
                      onClick={() => applyBulk(choice)}
                      className="pointer-coarse:min-h-11"
                      data-test={`access-users-bulk-${choice}`}>
                      {choice === "allow"
                        ? __("Allow", "pressedmail")
                        : choice === "deny"
                          ? __("Deny", "pressedmail")
                          : __("Inherit", "pressedmail")}
                    </Button>
                  ))}
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      tickAll(false);
                      selectAllRef.current?.focus();
                    }}
                    className="pointer-coarse:min-h-11"
                    data-test="access-users-bulk-clear">
                    {__("Clear selection", "pressedmail")}
                  </Button>
                </div>
              ) : filtered ? (
                // Always there while the list is narrowed, empty or not, so it is
                // never swapped for another button while a page is on its way:
                // the empty state offers the same, beside its words.
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={clearFilters}
                  className={LINK_BUTTON}
                  data-test="access-users-clear-filters-inline">
                  {__("Clear filters", "pressedmail")}
                </Button>
              ) : null}
            </div>

            {people.users.length === 0 ? (
              <div ref={results.target} tabIndex={-1} className="outline-none">
                <EmptyPeople
                  search={search}
                  role={role}
                  access={access}
                  overrideFilter={overrideFilter}
                  filtered={filtered}
                  onClear={clearFilters}
                />
              </div>
            ) : (
              <div
                ref={results.target}
                tabIndex={-1}
                role="table"
                aria-label={__("People and their access", "pressedmail")}
                aria-describedby={helpId}
                aria-busy={loading}
                // Clipped, not hidden, so the rounded corners hold and the header
                // can still stick to the top of the page's scroll area.
                className={cn(
                  "overflow-clip rounded-lg border outline-none transition-opacity duration-150",
                  loading && "opacity-60",
                )}
                data-test="access-users-table"
                data-testid="access-users-table">
                {/* The sticky element is this group, not the row in it: a sticky
                    box stays inside its parent, and the row's parent is only as
                    tall as the row. The group's parent is the whole table. */}
                <div
                  role="rowgroup"
                  className="sticky top-0 z-10 hidden @4xl/people:block">
                  <div
                    role="row"
                    className={cn(
                      "grid gap-x-4 border-b bg-muted px-3 py-2 text-xs font-medium text-muted-foreground",
                      WIDE_COLUMNS,
                      FLOATING_BUTTON_GUTTER,
                    )}>
                    <SortHeader
                      label={__("Person", "pressedmail")}
                      sort={sort}
                      asc="name_asc"
                      desc="name_desc"
                      className={CELL.person}
                      testId="access-users-sort-name"
                      onSort={sortBy}
                    />
                    <SortHeader
                      label={__("Roles", "pressedmail")}
                      sort={sort}
                      asc="role_asc"
                      desc="role_desc"
                      className={CELL.roles}
                      testId="access-users-sort-role"
                      sortable={scanAvailable}
                      onSort={sortBy}
                    />
                    <div role="columnheader" className={CELL.setting}>
                      {__("Setting", "pressedmail")}
                    </div>
                    <SortHeader
                      label={__("Access", "pressedmail")}
                      sort={sort}
                      asc="access_asc"
                      desc="access_desc"
                      className={CELL.access}
                      testId="access-users-sort-access"
                      sortable={scanAvailable}
                      onSort={sortBy}
                    />
                  </div>
                </div>
                <div role="rowgroup" className="divide-y">
                  {people.users.map((user) => (
                    <PersonRow
                      key={user.id}
                      user={user}
                      change={pending[user.id]}
                      staged={stagedRoles}
                      error={rowErrors[user.id]}
                      disabled={saving}
                      idPrefix={helpId}
                      term={search}
                      ticked={selected.has(user.id)}
                      onTick={(on) => tick(user, on)}
                      onChoose={(choice) => setChoice(user, choice)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          <PeopleFooter
            page={page}
            perPage={perPage}
            shownPage={people.page}
            shownPerPage={people.perPage}
            count={people.users.length}
            total={people.total}
            totalPages={people.totalPages}
            loading={loading}
            onPage={goToPage}
            onPerPage={(size) => {
              setPerPage(size);
              setPage(1);
            }}
          />
        </>
      )}
      {lossDialog}
    </SettingsSectionCard>
  );
}

/**
 * A column heading that sorts by its column: the first press sorts one way, the
 * next the other, and the arrow and aria-sort say which. A column that cannot
 * be sorted (on a site too big to work it out) is a plain heading.
 */
function SortHeader({
  label,
  sort,
  asc,
  desc,
  className,
  testId,
  sortable = true,
  onSort,
}: {
  label: string;
  sort: SortKey;
  asc: SortKey;
  desc: SortKey;
  className: string;
  testId: string;
  sortable?: boolean;
  onSort: (sort: SortKey) => void;
}) {
  if (!sortable) {
    return (
      <div role="columnheader" className={className}>
        {label}
      </div>
    );
  }

  return (
    <div
      role="columnheader"
      className={className}
      aria-sort={
        sort === asc ? "ascending" : sort === desc ? "descending" : "none"
      }>
      <button
        type="button"
        onClick={() => onSort(sort === asc ? desc : asc)}
        className="-mx-1 inline-flex items-center gap-1 rounded-sm px-1 outline-none hover:text-foreground"
        data-test={testId}
        data-testid={testId}>
        {label}
        {sort === asc ? (
          <ArrowUp aria-hidden="true" className="size-3.5" />
        ) : sort === desc ? (
          <ArrowDown aria-hidden="true" className="size-3.5" />
        ) : (
          <ChevronsUpDown aria-hidden="true" className="size-3.5 opacity-60" />
        )}
      </button>
    </div>
  );
}

/**
 * Retry for an alert that stays up while it retries. It is marked aria-disabled
 * then, not disabled, so the button that has the cursor keeps it.
 */
function RetryButton({
  loading,
  onRetry,
  dataTest,
}: {
  loading: boolean;
  onRetry: () => void;
  dataTest: string;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-disabled={loading || undefined}
      onClick={() => {
        if (!loading) onRetry();
      }}
      className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
      data-test={dataTest}>
      {loading ? __("Retrying...", "pressedmail") : __("Retry", "pressedmail")}
    </Button>
  );
}

function PersonRow({
  user,
  change,
  staged,
  error,
  disabled,
  idPrefix,
  term,
  ticked,
  onTick,
  onChoose,
}: {
  user: AccessUser;
  change: PendingChange | undefined;
  staged: StagedRoleGrants;
  error: string | undefined;
  disabled: boolean;
  /** Makes the ids that tie a row's reason and note to its control unique on the page. */
  idPrefix: string;
  /** The search that produced this list, so the part of the name or email it matched can be marked. */
  term: string;
  /** Whether this person is ticked for a bulk change. */
  ticked: boolean;
  onTick: (on: boolean) => void;
  onChoose: (choice: AccessOverrideChoice) => void;
}) {
  const { effective, reason } = projectAccess(user, change, staged);
  // Waiting for Save on this tab, or on the Roles tab: the badge is a preview either way.
  const previewed =
    Boolean(change) || effective !== user.effective || reason !== user.reason;
  const isYou = window.pressedmailPlugin?.userInfo?.userId === user.id;
  const hiddenRoles = Math.max(0, user.roles.length - VISIBLE_ROLE_CHIPS);
  const staleDeny = user.locked && user.override === "deny";
  // Nobody who cannot read gets in, so Allow is offered only where it can work.
  const cannotRead = !user.locked && !user.can_read;
  const reasonId = `${idPrefix}-reason-${user.id}`;
  const noteId = `${idPrefix}-note-${user.id}`;
  const unsavedId = `${idPrefix}-unsaved-${user.id}`;
  const reasonLabel = reasonText(user, reason, staged);
  const tone = pillTone(effective, reason);
  const describedBy = [
    reasonId,
    previewed ? unsavedId : null,
    cannotRead ? noteId : null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div
      role="row"
      data-test="access-users-row"
      data-testid="access-users-row"
      data-user-id={user.id}
      data-pending={change ? "true" : undefined}
      data-selected={ticked ? "true" : undefined}
      className={cn(
        ROW_GRID,
        "px-3 py-3 transition-colors duration-150",
        FLOATING_BUTTON_GUTTER,
        previewed
          ? "bg-warning/5"
          : ticked
            ? "bg-muted/50"
            : "hover:bg-muted/30",
      )}>
      <div
        role="cell"
        className={cn("flex min-w-0 items-center gap-3", CELL.person)}>
        {/* Nothing to tick on an administrator: there is nothing to set for them.
            Their cell keeps the space, so every avatar lines up. */}
        <span className="flex size-6 shrink-0 items-center justify-center pointer-coarse:size-11">
          {user.locked ? null : (
            <Checkbox
              checked={ticked}
              disabled={disabled}
              onCheckedChange={(checked) => onTick(checked === true)}
              aria-label={sprintf(
                /* translators: %s: a person's name. */
                __("Select %s", "pressedmail"),
                user.name,
              )}
              data-test="access-users-select"
            />
          )}
        </span>
        <Avatar className="size-9 shrink-0">
          {user.avatar_url ? (
            <AvatarImage src={user.avatar_url} alt="" />
          ) : null}
          <AvatarFallback className="bg-muted text-xs font-medium text-muted-foreground">
            {initials(user.name)}
          </AvatarFallback>
        </Avatar>
        {/* Nothing here is cut with an ellipsis: a name and an address that do
            not fit their column wrap onto another line. A title is out of reach
            of a keyboard and a finger, and the address is the one field that
            tells two similar names apart. */}
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-1.5 text-sm font-medium">
            <span className="min-w-0 [overflow-wrap:anywhere]">
              <Highlight text={user.name} term={term} />
            </span>
            {isYou ? (
              <Badge
                variant="secondary"
                className="shrink-0 rounded-full px-2 text-xs">
                {__("You", "pressedmail")}
              </Badge>
            ) : null}
          </p>
          <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            <Highlight text={user.email} term={term} breakable />
          </p>
        </div>
      </div>

      <div
        role="cell"
        className={cn(
          "flex min-w-0 flex-wrap items-center gap-1",
          CELL.roles,
        )}>
        <span className="sr-only @4xl/people:hidden">
          {__("Roles:", "pressedmail")}
        </span>
        {user.roles.length === 0 ? (
          <span className="text-xs text-muted-foreground">
            {__("No role", "pressedmail")}
          </span>
        ) : (
          user.roles.slice(0, VISIBLE_ROLE_CHIPS).map((role) => (
            <Badge
              key={role.slug}
              variant="outline"
              className={cn(
                // Soft and round like the status pill beside it, and with no
                // dark edge: a role is a label, not a control.
                "max-w-full truncate rounded-full border-transparent bg-muted px-2 font-normal text-foreground",
                !roleGrants(role, staged) && "text-muted-foreground",
              )}>
              {role.name}
            </Badge>
          ))
        )}
        {hiddenRoles > 0 ? (
          <span
            className="text-xs text-muted-foreground"
            title={user.roles
              .slice(VISIBLE_ROLE_CHIPS)
              .map((role) => role.name)
              .join(", ")}>
            <span aria-hidden="true">
              {sprintf(
                /* translators: %d: how many more roles this person has. */
                __("+%d", "pressedmail"),
                hiddenRoles,
              )}
            </span>
            {/* A title is out of reach of a keyboard and a screen reader. */}
            <span className="sr-only">
              {sprintf(
                /* translators: %s: the names of the roles that are not shown. */
                __("and %s", "pressedmail"),
                user.roles
                  .slice(VISIBLE_ROLE_CHIPS)
                  .map((role) => role.name)
                  .join(", "),
              )}
            </span>
          </span>
        ) : null}
      </div>

      <div role="cell" className={cn("min-w-0 space-y-1", CELL.setting)}>
        {user.locked ? (
          <>
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <Lock aria-hidden="true" className="size-3.5 shrink-0" />
              {__("Can't be changed", "pressedmail")}
            </p>
            <p className="text-xs text-muted-foreground">
              {__("Administrators always have access.", "pressedmail")}
            </p>
            {staleDeny ? (
              // One button in one place, so the cursor stays on it when it swaps
              // between clearing the Deny and taking that back.
              <p className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                {change ? __("Old Deny will be cleared.", "pressedmail") : null}
                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  disabled={disabled}
                  onClick={() => onChoose(change ? "deny" : "inherit")}
                  className={LINK_BUTTON}
                  data-test={
                    change
                      ? "access-users-keep-block"
                      : "access-users-clear-block"
                  }>
                  {change
                    ? __("Undo", "pressedmail")
                    : __("Clear the old Deny", "pressedmail")}
                </Button>
              </p>
            ) : null}
          </>
        ) : (
          <>
            <AccessOverrideControl
              name={user.name}
              value={choiceFor(user, change)}
              onChange={onChoose}
              disabled={disabled}
              unavailable={cannotRead ? ["allow"] : undefined}
              describedBy={describedBy}
            />
            {cannotRead ? (
              <p id={noteId} className="text-xs text-muted-foreground">
                {__("Allow needs a role with read access.", "pressedmail")}
              </p>
            ) : null}
          </>
        )}
        {error ? (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        ) : null}
      </div>

      <div
        role="cell"
        className={cn(
          // A line on a two-column row, where the result sits under the setting,
          // and the reason drops to a line of its own when the pill and the
          // Unsaved cue leave it too little room; two lines in a column of its
          // own on the widest. Wrapping, not clipped, whichever it is.
          "flex min-w-0 flex-col gap-1 @2xl/people:flex-row @2xl/people:flex-wrap @2xl/people:items-center @2xl/people:gap-x-2 @2xl/people:gap-y-1 @4xl/people:flex-col @4xl/people:flex-nowrap @4xl/people:items-stretch",
          CELL.access,
        )}>
        <span className="sr-only @4xl/people:hidden">
          {__("Access:", "pressedmail")}
        </span>
        <div className="flex min-w-0 shrink-0 items-center gap-2">
          <StatusPill
            tone={tone}
            label={
              effective
                ? __("Can open", "pressedmail")
                : __("No access", "pressedmail")
            }
            className={cn(
              "rounded-full",
              tone === "pass" && PASS_TEXT,
              tone === "fail" && FAIL_TEXT,
            )}
            data-test="access-users-effective"
          />
          {/* Beside the pill, outside the reason below, which wraps: a long
              role list must never push this out of view. */}
          {previewed ? (
            <span
              id={unsavedId}
              className={cn("shrink-0 text-xs font-medium", WARN_TEXT)}>
              {__("Unsaved", "pressedmail")}
            </span>
          ) : null}
        </div>
        {/* The reason is the explanation, so it is never cut: where it does not
            fit beside the pill it drops under it, and where it is still too long
            it wraps. */}
        <p
          id={reasonId}
          className="min-w-0 text-xs text-muted-foreground [overflow-wrap:anywhere]">
          {reasonLabel}
        </p>
      </div>
    </div>
  );
}

function EmptyPeople({
  search,
  role,
  access,
  overrideFilter,
  filtered,
  onClear,
}: {
  search: string;
  role: string;
  access: AccessFilter;
  overrideFilter: OverrideFilter;
  filtered: boolean;
  onClear: () => void;
}) {
  let title = __("No one is here yet", "pressedmail");
  let description = __(
    "People on this site appear here once they have a role.",
    "pressedmail",
  );

  if (filtered) {
    title = __("No one matches", "pressedmail");
    description = __(
      "Try a different search, or clear the filters.",
      "pressedmail",
    );

    // What the empty list says is about what was asked for, so it is only as
    // specific as that: "No one is denied" under a chip that counts six people
    // denied by name is false when the role filter beside it is what emptied it.
    const settingOnly = search === "" && role === "" && access === "";

    if (settingOnly && overrideFilter === "deny") {
      title = __("No one is denied", "pressedmail");
      description = __(
        "Everyone follows their role. Pick Deny on a person to stop them opening PressedMail.",
        "pressedmail",
      );
    } else if (settingOnly && overrideFilter === "allow") {
      title = __("No one is allowed by name", "pressedmail");
      description = __(
        "Pick Allow on a person to let them in even when their role can't open PressedMail.",
        "pressedmail",
      );
    } else if (search === "" && access === "" && overrideFilter === "deny") {
      title = __("No one with this role is denied", "pressedmail");
      description = __(
        "Try another role, or clear the filters.",
        "pressedmail",
      );
    } else if (search === "" && access === "" && overrideFilter === "allow") {
      title = __("No one with this role is allowed by name", "pressedmail");
      description = __(
        "Try another role, or clear the filters.",
        "pressedmail",
      );
    } else if (
      search === "" &&
      role === "" &&
      overrideFilter === "" &&
      access === "blocked"
    ) {
      title = __("Everyone can open PressedMail", "pressedmail");
      description = __(
        "No one is kept out by their role or by a Deny.",
        "pressedmail",
      );
    } else if (
      search === "" &&
      overrideFilter === "" &&
      access === "" &&
      role !== ""
    ) {
      title = __("No one has this role", "pressedmail");
      description = __(
        "People appear here once they hold it. Try another role, or clear the filters.",
        "pressedmail",
      );
    }
  }

  return (
    <SettingsEmptyState
      title={title}
      description={description}
      actions={
        filtered ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onClear}
            data-test="access-users-clear-filters">
            {__("Clear filters", "pressedmail")}
          </Button>
        ) : undefined
      }
    />
  );
}

function PeopleSkeleton() {
  return (
    <div className="space-y-2">
      {/* The toolbar's own height, so the table does not drop by a line when the
          list lands and the toolbar takes its place. */}
      <div
        aria-hidden="true"
        className="flex min-h-control items-center gap-2.5 animate-pulse motion-reduce:animate-none">
        <span className="flex size-6 shrink-0 items-center justify-center pointer-coarse:size-11">
          <span className="size-4 rounded-[4px] bg-muted" />
        </span>
        <span className="h-3 w-20 rounded bg-muted" />
      </div>
      <div
        role="status"
        aria-label={__("Loading people", "pressedmail")}
        aria-busy="true"
        className="overflow-clip rounded-lg border"
        data-test="access-users-loading"
        data-testid="access-users-loading">
        <span className="sr-only">{__("Loading people", "pressedmail")}</span>
        <div
          aria-hidden="true"
          className="divide-y animate-pulse motion-reduce:animate-none">
          {Array.from({ length: 6 }, (_, row) => (
            <div
              key={row}
              className={cn(ROW_GRID, "px-3 py-3", FLOATING_BUTTON_GUTTER)}>
              <div className={cn("flex items-center gap-3", CELL.person)}>
                <span className="flex size-6 shrink-0 items-center justify-center pointer-coarse:size-11">
                  <span className="size-4 rounded-[4px] bg-muted" />
                </span>
                <div className="size-9 shrink-0 rounded-full bg-muted" />
                <div className="space-y-2">
                  <div className="h-3 w-32 rounded bg-muted" />
                  <div className="h-2.5 w-44 max-w-full rounded bg-muted/60" />
                </div>
              </div>
              <div
                className={cn("h-5 w-20 rounded-full bg-muted", CELL.roles)}
              />
              <div
                className={cn(
                  "h-13 rounded-md bg-muted @2xl/people:h-control @2xl/people:pointer-coarse:h-13",
                  CELL.setting,
                )}
              />
              <div className={cn("space-y-2", CELL.access)}>
                <div className="h-5 w-16 rounded-full bg-muted" />
                <div className="h-2.5 w-24 rounded bg-muted/60" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/**
 * One of the four page buttons. It is marked aria-disabled, not disabled, at
 * the ends and while a page loads, so a button that has the cursor keeps it
 * through every press, including the one that reaches the last page.
 */
function PagerButton({
  label,
  icon: Icon,
  blocked,
  onClick,
}: {
  label: string;
  icon: LucideIcon;
  blocked: boolean;
  onClick: () => void;
}) {
  return (
    <Button
      type="button"
      variant="outline"
      size="icon"
      className={cn(
        PAGER_BUTTON,
        "aria-disabled:pointer-events-none aria-disabled:opacity-50",
      )}
      aria-disabled={blocked || undefined}
      onClick={() => {
        if (!blocked) onClick();
      }}
      aria-label={label}>
      <Icon aria-hidden="true" className="size-4" />
    </Button>
  );
}

function PeopleFooter({
  page,
  perPage,
  shownPage,
  shownPerPage,
  count,
  total,
  totalPages,
  loading,
  onPage,
  onPerPage,
}: {
  page: number;
  perPage: number;
  /** The page and page size of the rows on screen. While the next page loads these still describe the old one. */
  shownPage: number;
  shownPerPage: number;
  count: number;
  total: number;
  totalPages: number;
  loading: boolean;
  onPage: (page: number) => void;
  onPerPage: (size: number) => void;
}) {
  const [pageDraft, setPageDraft] = useState(String(page));

  useEffect(() => setPageDraft(String(page)), [page]);

  if (total === 0) return null;

  const first = (shownPage - 1) * shownPerPage + 1;
  const commit = () => {
    const wanted = Math.round(Number(pageDraft));
    if (Number.isFinite(wanted) && wanted >= 1) {
      const target = Math.min(wanted, totalPages);
      // Said back even when it is the page already showing: a 99 that was
      // clamped to the last page would otherwise stay in the box beside "of 16".
      setPageDraft(String(target));
      onPage(target);
    } else {
      setPageDraft(String(page));
    }
  };

  return (
    <div
      className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2"
      data-test="access-users-footer"
      data-testid="access-users-footer">
      <p
        aria-live="polite"
        className="text-xs text-muted-foreground"
        data-test="access-users-range"
        data-testid="access-users-range">
        {totalPages === 1
          ? sprintf(_n("%d person", "%d people", total, "pressedmail"), total)
          : sprintf(
              /* translators: 1: first row number, 2: last row number, 3: total people. */
              __("Showing %1$d to %2$d of %3$d people", "pressedmail"),
              first,
              first + count - 1,
              total,
            )}
      </p>
      <div className="flex flex-wrap items-center gap-2">
        <NativeSelect
          value={String(perPage)}
          onChange={(event) => onPerPage(Number(event.target.value))}
          aria-label={__("People per page", "pressedmail")}
          data-test="access-users-per-page">
          {PAGE_SIZES.map((size) => (
            <NativeSelectOption key={size} value={String(size)}>
              {sprintf(
                /* translators: %d: rows on a page. */
                __("%d per page", "pressedmail"),
                size,
              )}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        {totalPages > 1 ? (
          <div
            className="flex items-center gap-1"
            role="group"
            aria-label={__("Pages", "pressedmail")}>
            <PagerButton
              label={__("First page", "pressedmail")}
              icon={ChevronsLeft}
              blocked={page <= 1 || loading}
              onClick={() => onPage(1)}
            />
            <PagerButton
              label={__("Previous page", "pressedmail")}
              icon={ChevronLeft}
              blocked={page <= 1 || loading}
              onClick={() => onPage(page - 1)}
            />
            <span className="flex items-center gap-1.5 px-1 text-xs text-muted-foreground">
              {/* A number field is too small a target on a phone, so a narrow panel
                  says which page this is and leaves the jump to the four buttons. */}
              <Input
                type="number"
                inputMode="numeric"
                autoComplete="off"
                min={1}
                max={totalPages}
                value={pageDraft}
                onChange={(event) => setPageDraft(event.target.value)}
                onBlur={commit}
                onKeyDown={(event) => {
                  if (event.key === "Enter") commit();
                }}
                aria-label={__("Page number", "pressedmail")}
                className="hidden w-16 text-center @2xl/people:inline-block"
                data-test="access-users-page-input"
              />
              <span className="hidden @2xl/people:inline">
                {sprintf(
                  /* translators: %d: total number of pages. */
                  __("of %d", "pressedmail"),
                  totalPages,
                )}
              </span>
              <span className="@2xl/people:hidden">
                {sprintf(
                  /* translators: 1: current page, 2: total number of pages. */
                  __("Page %1$d of %2$d", "pressedmail"),
                  page,
                  totalPages,
                )}
              </span>
            </span>
            <PagerButton
              label={__("Next page", "pressedmail")}
              icon={ChevronRight}
              blocked={page >= totalPages || loading}
              onClick={() => onPage(page + 1)}
            />
            <PagerButton
              label={__("Last page", "pressedmail")}
              icon={ChevronsRight}
              blocked={page >= totalPages || loading}
              onClick={() => onPage(totalPages)}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
