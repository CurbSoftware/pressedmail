import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { __, _n, sprintf } from "@wordpress/i18n";
import { useSearchParams } from "react-router-dom";

import {
  UnderlineTabs,
  UnderlineTabsContent,
  UnderlineTabsList,
  UnderlineTabsTrigger,
} from "../underline-tabs";
import {
  AccessRolesCard,
  type AccessControlDraftHandle,
  type RegisterAccessControlDraft,
  type StagedRoleGrants,
} from "./access-tab";
import { AccessUsersPanel, defaultPerPage } from "./access-users-panel";
import {
  ACCESS_TAB_PARAM,
  ACCESS_VIEW_PARAMS,
  readUsersView,
  withoutUsersView,
  writeUsersView,
  type UsersView,
} from "./access-view";

/**
 * The address parameters that only choose a view: the active tab, and the
 * Users tab's search, filters, order and page. The page keeps every tab's draft
 * mounted, so none of them loses anything and the unsaved-changes guard is told
 * not to stop it.
 */
export { ACCESS_VIEW_PARAMS };

/**
 * What a save that changed only roles and people says it did, such as "Access
 * updated for 2 people and 1 role", or nothing when it had no such changes. The
 * parts are counted separately so each reads in its own plural.
 */
export function accessSavedMessage({
  people,
  roles,
}: {
  people: number;
  roles: number;
}): string | undefined {
  const parts = [
    people > 0
      ? sprintf(_n("%d person", "%d people", people, "pressedmail"), people)
      : "",
    roles > 0
      ? sprintf(_n("%d role", "%d roles", roles, "pressedmail"), roles)
      : "",
  ].filter(Boolean);

  if (parts.length === 0) return undefined;

  return parts.length === 1
    ? sprintf(
        /* translators: %s: what was updated, such as "2 people" or "1 role". */
        __("Access updated for %s", "pressedmail"),
        parts[0],
      )
    : sprintf(
        /* translators: 1: the people updated, such as "2 people", 2: the roles updated, such as "1 role". */
        __("Access updated for %1$s and %2$s", "pressedmail"),
        parts[0],
        parts[1],
      );
}

const SUBTABS = ["general", "roles", "users"] as const;
type AccessSubtab = (typeof SUBTABS)[number];

function isSubtab(value: string | null): value is AccessSubtab {
  return SUBTABS.some((subtab) => subtab === value);
}

interface AccessControlTabsProps {
  /** The General tab: site-wide attachment and email display settings. */
  general: ReactNode;
  drafts: Record<string, AccessControlDraftHandle>;
  registerDraft: RegisterAccessControlDraft;
  /**
   * The page's own settings (the General tab) were refused on the last save.
   * That stops the page before the other tabs are tried, so it is the one
   * refusal they cannot show, and General is where it is written.
   */
  coreFailed?: boolean;
}

/**
 * The Access Control page for administrators: General, Roles and Users.
 *
 * The active tab lives in `?subtab=`, and a value nobody recognises falls back
 * to General. Roles and Users hold drafts that the page's one Save applies, so
 * they stay mounted while hidden: switching tabs never drops a staged change.
 * That is also why the switch is not stopped by the unsaved-changes guard,
 * which the parent tells that `subtab` only chooses a view here: nothing is
 * lost by it, so nothing needs confirming. Leaving the page still is guarded
 * by the parent. Each of
 * the two reads its data on its first visit, not on the page's, so a visit to
 * General costs neither.
 *
 * A save that one of them refuses may be started from another tab, where its
 * errors cannot be seen, so the page takes the admin to the tab that holds them.
 *
 * The Users tab's search, filters, order and page live in the address too, so a
 * filtered list can be shared and survives a reload. The tab and the address
 * agree on one view: the tab writes what it shows while it is the one showing,
 * and follows the address when a link it did not write arrives under it (one
 * pasted into the same tab). The address carries them for no other tab.
 */
export function AccessControlTabs({
  general,
  drafts,
  registerDraft,
  coreFailed = false,
}: AccessControlTabsProps) {
  const [searchParams, setSearchParams] = useSearchParams();
  const [rolesSaves, setRolesSaves] = useState(0);
  const [stagedRoles, setStagedRoles] = useState<StagedRoleGrants>({});
  const requested = searchParams.get(ACCESS_TAB_PARAM);
  const active: AccessSubtab = isSubtab(requested) ? requested : "general";
  const onRolesSaved = useCallback(
    () => setRolesSaves((count) => count + 1),
    [],
  );
  // The Users tab's part of the address, as it is now. The tab opens with it and
  // follows it when it changes under the tab, and writes its own changes back.
  const usersView = useMemo(() => readUsersView(searchParams), [searchParams]);
  // The latest of these, so the callback below can stay the same function. If
  // it changed whenever the address did, the tab would write the address, which
  // would change the callback, which would make the tab write it again.
  const address = useRef({ searchParams, setSearchParams });
  address.current = { searchParams, setSearchParams };
  const onUsersViewChange = useCallback((view: UsersView) => {
    const { searchParams: current, setSearchParams: set } = address.current;
    const next = writeUsersView(current, view, defaultPerPage());

    if (next.toString() !== current.toString()) set(next, { replace: true });
  }, []);

  // A value nobody recognises shows General, and leaves the address too, so a
  // reload or a shared link does not carry the mistake along.
  useEffect(() => {
    if (requested === null || isSubtab(requested)) return;

    const next = new URLSearchParams(searchParams);
    next.delete(ACCESS_TAB_PARAM);
    setSearchParams(next, { replace: true });
  }, [requested, searchParams, setSearchParams]);

  const selectSubtab = useCallback(
    (value: string, byPerson = false) => {
      if (!isSubtab(value) || value === active) return;

      // The Users tab's view belongs to that tab: the address carries it only
      // while the tab is showing, and the tab puts it back when it returns.
      const next = withoutUsersView(searchParams);
      if (value === "general") {
        next.delete(ACCESS_TAB_PARAM);
      } else {
        next.set(ACCESS_TAB_PARAM, value);
      }
      // Replaced, not pushed: a tab is a view of one page, and Back should leave
      // the page rather than walk through every tab that was opened.
      //
      // A tab a person picks is committed before the next key is read. The
      // router otherwise renders a navigation as a transition, which can land
      // after a second arrow key, Home or End has already been pressed (a held
      // key repeats faster than a frame). The tab strip then still believes the
      // old tab is selected, ignores the key that would put it back, and focus
      // and selection part ways until the next press. Not done for the page's
      // own calls: they run in an effect, where React does not allow it.
      setSearchParams(next, { replace: true, flushSync: byPerson });
    },
    [active, searchParams, setSearchParams],
  );

  const showUsers = useCallback(
    () => selectSubtab("users", true),
    [selectSubtab],
  );

  // Once per refused save, bring the admin to the tab whose errors explain it.
  const refused: AccessSubtab | null = coreFailed
    ? "general"
    : drafts["access-users"]?.failed
      ? "users"
      : drafts["access-roles"]?.failed
        ? "roles"
        : null;
  const shown = useRef<AccessSubtab | null>(null);

  useEffect(() => {
    if (refused === null) {
      shown.current = null;
      return;
    }
    if (shown.current === refused) return;

    shown.current = refused;
    selectSubtab(refused);
  }, [refused, selectSubtab]);

  return (
    // Capped like the Users card, so the rule under the tabs ends where the
    // content does on a wide screen, and the same on every tab.
    <UnderlineTabs
      value={active}
      onValueChange={(value) => selectSubtab(value, true)}
      className="max-w-6xl">
      {/* A rule with the chosen tab underlined, as AI Tools draws its two: these
          choose what is on the page, so they look the same on every page. */}
      <UnderlineTabsList
        variant="line"
        aria-label={__("Access Control sections", "pressedmail")}>
        <UnderlineTabsTrigger
          value="general"
          data-test="access-subtab-general"
          data-testid="access-subtab-general">
          {__("General", "pressedmail")}
        </UnderlineTabsTrigger>
        <UnderlineTabsTrigger
          value="roles"
          data-test="access-subtab-roles"
          data-testid="access-subtab-roles">
          {__("Roles", "pressedmail")}
          <StagedMark draft={drafts["access-roles"]} />
        </UnderlineTabsTrigger>
        <UnderlineTabsTrigger
          value="users"
          data-test="access-subtab-users"
          data-testid="access-subtab-users">
          {__("Users", "pressedmail")}
          <StagedMark draft={drafts["access-users"]} />
        </UnderlineTabsTrigger>
      </UnderlineTabsList>

      <UnderlineTabsContent value="general">{general}</UnderlineTabsContent>
      <UnderlineTabsContent
        value="roles"
        forceMount
        hidden={active !== "roles"}>
        <AccessRolesCard
          registerDraft={registerDraft}
          active={active === "roles"}
          onSaved={onRolesSaved}
          onStagedChange={setStagedRoles}
          onShowUsers={showUsers}
        />
      </UnderlineTabsContent>
      <UnderlineTabsContent
        value="users"
        forceMount
        hidden={active !== "users"}>
        <AccessUsersPanel
          registerDraft={registerDraft}
          active={active === "users"}
          rolesSaves={rolesSaves}
          stagedRoles={stagedRoles}
          view={usersView}
          onViewChange={onUsersViewChange}
        />
      </UnderlineTabsContent>
    </UnderlineTabs>
  );
}

/**
 * How many changes a hidden tab is holding, so they are never out of sight and
 * out of mind, and in the error colour, with words for a screen reader, when its
 * last save was refused.
 */
function StagedMark({
  draft,
}: {
  draft: AccessControlDraftHandle | undefined;
}) {
  if (!draft?.dirty) return null;

  const count = Math.max(1, draft.count ?? 1);
  const failed = Boolean(draft.failed);

  return (
    <>
      <span
        aria-hidden="true"
        data-failed={failed ? "true" : undefined}
        className={
          failed
            ? "min-w-5 rounded-full bg-destructive/15 px-1.5 text-center text-xs font-medium text-destructive tabular-nums"
            : "min-w-5 rounded-full bg-warning/15 px-1.5 text-center text-xs font-medium text-warning tabular-nums"
        }>
        {count}
      </span>
      <span className="sr-only">
        {failed
          ? sprintf(
              _n(
                "%d change could not be saved",
                "%d changes could not be saved",
                count,
                "pressedmail",
              ),
              count,
            )
          : sprintf(
              _n(
                "%d unsaved change",
                "%d unsaved changes",
                count,
                "pressedmail",
              ),
              count,
            )}
      </span>
    </>
  );
}
