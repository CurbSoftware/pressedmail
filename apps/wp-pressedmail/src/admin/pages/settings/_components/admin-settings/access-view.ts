/**
 * What the Access Control page is showing, as address parameters, so a
 * filtered list can be shared and comes back after a reload.
 *
 * The page holds several of its own drafts and keeps them mounted, so none of
 * these is a reason to ask "leave without saving?": they choose a view and
 * nothing else. The unsaved-changes guard is told to ignore every one.
 */

export type OverrideFilter = "" | "allow" | "deny" | "inherit";
/** What a person can do as things stand: the people who can open PressedMail, or the people who cannot. */
export type AccessFilter = "" | "open" | "blocked";
export type SortKey =
  | "name_asc"
  | "name_desc"
  | "role_asc"
  | "role_desc"
  | "access_asc"
  | "access_desc";

export const SORTS: Record<SortKey, { orderby: string; order: "asc" | "desc" }> =
  {
    name_asc: { orderby: "name", order: "asc" },
    name_desc: { orderby: "name", order: "desc" },
    role_asc: { orderby: "role", order: "asc" },
    role_desc: { orderby: "role", order: "desc" },
    // Ascending puts the people who are turned away first.
    access_asc: { orderby: "access", order: "asc" },
    access_desc: { orderby: "access", order: "desc" },
  };

/**
 * Whether the server has to read the whole site to answer. A role or an access
 * order, and the access filter, depend on what each person can do, which only
 * the server can work out person by person, so they exist only while the site
 * is small enough for that.
 */
export function isScanSort(sort: SortKey): boolean {
  return SORTS[sort].orderby !== "name";
}

export const PAGE_SIZES = [10, 25, 50, 100] as const;

/** The longest search the server takes. */
export const MAX_SEARCH_LENGTH = 100;

/** The furthest page the server will serve. */
const MAX_PAGE = 100000;

/** The parameter that holds the active tab. */
export const ACCESS_TAB_PARAM = "subtab";

/** The parameters that hold the Users tab's search, filters, order and page. */
export const ACCESS_USERS_PARAMS = [
  "q",
  "role",
  "setting",
  "access",
  "sort",
  "page",
  "per_page",
] as const;

/** Every address parameter that only chooses a view of this page. */
export const ACCESS_VIEW_PARAMS = [
  ACCESS_TAB_PARAM,
  ...ACCESS_USERS_PARAMS,
] as const;

export interface UsersView {
  /** The search, as sent. */
  q: string;
  role: string;
  setting: OverrideFilter;
  access: AccessFilter;
  sort: SortKey;
  page: number;
  perPage: number;
}

export function isSortKey(value: unknown): value is SortKey {
  return typeof value === "string" && Object.keys(SORTS).includes(value);
}

function isAccessFilter(value: unknown): value is Exclude<AccessFilter, ""> {
  return value === "open" || value === "blocked";
}

function isOverrideFilter(value: unknown): value is Exclude<OverrideFilter, ""> {
  return value === "allow" || value === "deny" || value === "inherit";
}

/** What the address asks for. A value nobody recognises is left out, so it falls back to the default. */
export function readUsersView(params: URLSearchParams): Partial<UsersView> {
  const view: Partial<UsersView> = {};
  const q = params.get("q")?.trim().slice(0, MAX_SEARCH_LENGTH);
  const role = params.get("role");
  const setting = params.get("setting");
  const access = params.get("access");
  const sort = params.get("sort");
  const page = Number(params.get("page"));
  const perPage = Number(params.get("per_page"));

  if (q) view.q = q;
  if (role) view.role = role;
  if (isOverrideFilter(setting)) view.setting = setting;
  if (isAccessFilter(access)) view.access = access;
  if (isSortKey(sort)) view.sort = sort;
  if (Number.isInteger(page) && page > 1) view.page = Math.min(page, MAX_PAGE);
  if ((PAGE_SIZES as readonly number[]).includes(perPage)) {
    view.perPage = perPage;
  }

  return view;
}

/**
 * The address for a view. A value that is the default is left out, so the
 * plain page keeps its plain address. `defaultPerPage` is the page size this
 * device starts with, which differs between a phone and a desktop.
 */
export function writeUsersView(
  params: URLSearchParams,
  view: UsersView,
  defaultPerPage: number,
): URLSearchParams {
  const next = new URLSearchParams(params);

  ACCESS_USERS_PARAMS.forEach((name) => next.delete(name));

  if (view.q) next.set("q", view.q);
  if (view.role) next.set("role", view.role);
  if (view.setting) next.set("setting", view.setting);
  if (view.access) next.set("access", view.access);
  if (view.sort !== "name_asc") next.set("sort", view.sort);
  if (view.page > 1) next.set("page", String(view.page));
  if (view.perPage !== defaultPerPage) {
    next.set("per_page", String(view.perPage));
  }

  return next;
}

/** The address without any of the Users tab's parameters. */
export function withoutUsersView(params: URLSearchParams): URLSearchParams {
  const next = new URLSearchParams(params);

  ACCESS_USERS_PARAMS.forEach((name) => next.delete(name));

  return next;
}

/**
 * One string for a view, the same whichever way it was spelled: a missing part
 * and a part that is its default come out alike. The tab uses it to tell a view
 * it wrote itself (which it already shows) from one that arrived in the address
 * (a link pasted into the same tab), which it has to follow.
 */
export function usersViewKey(
  view: Partial<UsersView>,
  defaultPerPage: number,
): string {
  return writeUsersView(
    new URLSearchParams(),
    {
      q: view.q ?? "",
      role: view.role ?? "",
      setting: view.setting ?? "",
      access: view.access ?? "",
      sort: view.sort ?? "name_asc",
      page: view.page ?? 1,
      perPage: view.perPage ?? defaultPerPage,
    },
    defaultPerPage,
  ).toString();
}
