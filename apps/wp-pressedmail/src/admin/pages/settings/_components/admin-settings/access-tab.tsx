import { __, _n, sprintf } from "@wordpress/i18n";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Badge, Button, Checkbox, Label } from "@kit/ui/plugin";
import {
  SettingsSaveState,
  SettingsSkeleton,
  SettingsSectionCard,
} from "@/components/settings-ui";
import { routeApiPrefix } from "@/context/Strings";
import {
  notifyAutosaveError,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import { apiFetch } from "@/lib/api-client";

import { nameList, useAccessLossConfirm } from "./access-loss-confirm";
import { AccessProblem } from "./access-problem";
import { AccessStagedNotice } from "./access-staged-notice";
import { useRetryFocus } from "./use-retry-focus";

interface AccessRole {
  slug: string;
  name: string;
  allowed: boolean;
  locked: boolean;
  /**
   * Whether the role lets its people read the site. Every route asks for that
   * first, so a role without it lets no one in, whatever else it holds.
   */
  can_read?: boolean;
  /** How many people on this site hold the role. */
  users?: number;
}

export interface AccessControlDraftHandle {
  dirty: boolean;
  saving: boolean;
  /** How many changes are staged, for the Save bar and the tab that holds them. */
  count?: number;
  /**
   * Whether the last save of this draft was refused, so the tab that holds it
   * can say so when it is out of sight and the page can take the admin to it.
   */
  failed?: boolean;
  /**
   * Asked before the page saves anything, so a draft can have the admin
   * confirm what its change will do. Resolves false to stop the whole save,
   * with nothing on the page written.
   */
  beforeSave?: () => Promise<boolean>;
  save: () => Promise<boolean>;
  cancel: () => void;
}

export type RegisterAccessControlDraft = (
  key: string,
  draft: AccessControlDraftHandle | null,
) => void;

/** Whether each role whose setting is not saved yet will grant access once it is, by role slug. */
export type StagedRoleGrants = Record<string, boolean>;

interface AccessControlDraftCardProps {
  registerDraft?: RegisterAccessControlDraft;
  /**
   * Whether this tab is showing. Nothing is fetched until it first is, because
   * the people counts read every user on the site and most visits never open
   * the Roles tab. Defaults to showing, for a card that stands alone.
   */
  active?: boolean;
  /** Told after a save lands, so a list built on what the roles allow can read it again. */
  onSaved?: () => void;
  /** Told what the roles will grant once saved, wherever that differs from now. */
  onStagedChange?: (grants: StagedRoleGrants) => void;
  /** Takes the admin to the Users tab, where one person is set. Without it the hint is plain text. */
  onShowUsers?: () => void;
}

const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/** How long the roles sit still before the server is asked what turning one off costs. */
const IMPACT_DEBOUNCE_MS = 250;

/**
 * What saving the roles as they are now would cost, as the server works it out
 * person by person: it leaves out people who are already denied, people with an
 * Allow of their own, and people who have another role that stays on.
 */
interface RoleImpact {
  /** The roles that would be allowed, which this answer is for. */
  key: string;
  /** False when the site is too big to work it out, and the head count is all there is. */
  exact: boolean;
  losing: number;
  /** The first two people who would lose access. */
  names: string[];
}

/**
 * Which WordPress roles can open PressedMail. The Roles tab of Access Control;
 * the Users tab sets a single person, which beats their role. Managed domains
 * live in the dedicated paid Allowed Domains tab.
 */
export function AccessRolesCard({
  registerDraft,
  active = true,
  onSaved,
  onStagedChange,
  onShowUsers,
}: AccessControlDraftCardProps = {}) {
  const [activated, setActivated] = useState(active);
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [savedRoles, setSavedRoles] = useState<AccessRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [loadFailed, setLoadFailed] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const saveAlertRef = useRef<HTMLParagraphElement>(null);
  const needsAttention = useRef(false);
  const [impact, setImpact] = useState<RoleImpact | null>(null);
  // The same answer, readable by a pause that is already waiting, so the one a
  // Save asked for in the meantime is not asked for twice.
  const impactRef = useRef<RoleImpact | null>(null);
  const list = useRetryFocus<HTMLDivElement>(loading, loadFailed);
  const { confirm, dialog: lossDialog } = useAccessLossConfirm();

  const fetchRoles = useCallback(async () => {
    setLoading(true);

    try {
      const response = await apiFetch(
        `${routeApiPrefix}/plugin/settings/access-roles`,
        {
          credentials: "include",
          headers: getApiHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const nextRoles = Array.isArray(data.roles) ? data.roles : [];
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      // Cleared only now, so the alert holding a pressed Retry stays up while it retries.
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  useEffect(() => {
    if (activated) void fetchRoles();
  }, [activated, fetchRoles]);

  const selectedSlugs = useMemo(
    () => roles.filter((role) => role.allowed).map((role) => role.slug),
    [roles],
  );
  const savedSelectedSlugs = useMemo(
    () => savedRoles.filter((role) => role.allowed).map((role) => role.slug),
    [savedRoles],
  );
  const changedRoles = useMemo(
    () =>
      selectedSlugs.filter((slug) => !savedSelectedSlugs.includes(slug))
        .length +
      savedSelectedSlugs.filter((slug) => !selectedSlugs.includes(slug)).length,
    [savedSelectedSlugs, selectedSlugs],
  );
  const dirty = changedRoles > 0;
  const stagedGrants = useMemo<StagedRoleGrants>(() => {
    const saved = new Set(savedSelectedSlugs);
    const grants: StagedRoleGrants = {};

    for (const role of roles) {
      if (role.allowed !== saved.has(role.slug))
        grants[role.slug] = role.allowed;
    }

    return grants;
  }, [roles, savedSelectedSlugs]);
  // What turning a role off costs: the people who hold it. Someone can hold
  // two of these roles, and some have another way in, so this is the most who
  // can lose access, never a head count, and the warning says "up to". A role
  // that cannot read lets no one in to begin with, so turning it off costs none.
  const removed = useMemo(
    () =>
      roles.filter(
        (role) => stagedGrants[role.slug] === false && role.can_read !== false,
      ),
    [roles, stagedGrants],
  );
  const peopleAtRisk = removed.reduce(
    (sum, role) => sum + (role.users ?? 0),
    0,
  );
  // The roles the save would leave allowed: what the server needs to say who
  // would really be turned away. Locked roles are let in whatever this says.
  const allowedAfter = useMemo(
    () =>
      roles
        .filter((role) => role.allowed && !role.locked)
        .map((role) => role.slug)
        .sort()
        .join(","),
    [roles],
  );
  // Nothing to ask while no one holds the roles being turned off.
  const impactKey = peopleAtRisk > 0 ? allowedAfter : null;

  const fetchImpact = useCallback(
    async (key: string): Promise<RoleImpact | null> => {
      try {
        const response = await apiFetch(
          `${routeApiPrefix}/plugin/settings/access-roles-impact?roles=${encodeURIComponent(key)}`,
          {
            credentials: "include",
            headers: getApiHeaders(),
          },
        );

        if (!response.ok) return null;

        const data = await response.json();
        const found: RoleImpact =
          data?.exact === true
            ? {
                key,
                exact: true,
                losing: Math.max(0, Number(data.losing) || 0),
                names: Array.isArray(data.names)
                  ? data.names.filter(
                      (name: unknown) => typeof name === "string",
                    )
                  : [],
              }
            : { key, exact: false, losing: 0, names: [] };

        // An answer for roles the admin has since changed is never shown: it is
        // only used when its key is the one asked about.
        impactRef.current = found;
        setImpact(found);

        return found;
      } catch {
        // The head count below is still true, as a ceiling.
        return null;
      }
    },
    [],
  );

  // Once the roles have sat still for a moment, ask who would really lose
  // access, so the warning names people and not a ceiling.
  useEffect(() => {
    if (impactKey === null) return undefined;

    const timer = window.setTimeout(() => {
      if (impactRef.current?.key !== impactKey) void fetchImpact(impactKey);
    }, IMPACT_DEBOUNCE_MS);

    return () => window.clearTimeout(timer);
  }, [fetchImpact, impactKey]);

  // The answer for the roles as they are now, if it has come in.
  const exactImpact =
    impactKey !== null && impact?.key === impactKey && impact.exact
      ? impact
      : null;

  useEffect(() => {
    onStagedChange?.(stagedGrants);
  }, [onStagedChange, stagedGrants]);

  const toggleRole = (slug: string, allowed: boolean) => {
    setRoles((current) =>
      current.map((role) =>
        role.slug === slug && !role.locked ? { ...role, allowed } : role,
      ),
    );
    setSaveFailed(false);
    setSaveStatus("dirty");
  };

  const saveRoles = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;

    // A locked role is let in whatever this list says, because it holds
    // manage_options, so it is not a choice the admin made. Stored as one, it
    // would outlive the role losing manage_options as a grant nobody picked.
    // Administrator is always kept by the server.
    const nextSelectedSlugs = roles
      .filter((role) => role.allowed && !role.locked)
      .map((role) => role.slug);
    setSaving(true);
    setSaveStatus("saving");
    setSaveFailed(false);

    try {
      const response = await apiFetch(
        `${routeApiPrefix}/plugin/settings/access-roles`,
        {
          method: "POST",
          credentials: "include",
          headers: getApiHeaders(),
          body: JSON.stringify({ roles: nextSelectedSlugs }),
        },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      const nextRoles = Array.isArray(data.roles) ? data.roles : roles;
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setSaveStatus("saved");
      // The page says "saved" once, when every part of it has been.
      onSaved?.();
      return true;
    } catch {
      setSaveStatus("error");
      setSaveFailed(true);
      needsAttention.current = true;
      notifyAutosaveError(
        __("Could not save role access settings", "pressedmail"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirty, onSaved, roles]);

  const cancelRoles = useCallback(() => {
    setRoles(savedRoles);
    setSaveFailed(false);
    setSaveStatus("idle");
  }, [savedRoles]);

  // Asked before anything on the page is saved. With the server's answer it names
  // who would really lose access, and asks nothing when no one would. Without it
  // (a site too big to work out, or a request that failed) it says at most how
  // many could, because someone can hold two of these roles or have another way in.
  const beforeSave = useCallback(async (): Promise<boolean> => {
    if (impactKey === null) return true;

    const found =
      impactRef.current?.key === impactKey
        ? impactRef.current
        : await fetchImpact(impactKey);

    if (found?.exact) {
      if (found.losing === 0) return true;

      return confirm({
        title: sprintf(
          _n(
            "Remove access for %d person?",
            "Remove access for %d people?",
            found.losing,
            "pressedmail",
          ),
          found.losing,
        ),
        lead: sprintf(
          /* translators: %s: the people who lose access, such as "Ada Lovelace, Alan Turing and 2 more". */
          _n(
            "%s won't be able to open PressedMail.",
            "%s won't be able to open PressedMail.",
            found.losing,
            "pressedmail",
          ),
          nameList(found.names, found.losing),
        ),
        note: sprintf(
          /* translators: %s: the roles that are being turned off, such as "Editor, Author". */
          _n(
            "They get in only through %s, which is being turned off.",
            "They get in only through %s, which are being turned off.",
            removed.length,
            "pressedmail",
          ),
          removed.map((role) => role.name).join(", "),
        ),
      });
    }

    if (peopleAtRisk === 0) return true;

    return confirm({
      title: sprintf(
        _n(
          "Remove access for up to %d person?",
          "Remove access for up to %d people?",
          peopleAtRisk,
          "pressedmail",
        ),
        peopleAtRisk,
      ),
      lead: sprintf(
        /* translators: %s: the roles that are being turned off, such as "Editor, Author". */
        __(
          "That counts everyone in %s. Anyone with another way in, such as another role or Allow, keeps access.",
          "pressedmail",
        ),
        removed.map((role) => role.name).join(", "),
      ),
    });
  }, [confirm, fetchImpact, impactKey, peopleAtRisk, removed]);

  const draftHandle = useMemo<AccessControlDraftHandle>(
    () => ({
      dirty,
      saving,
      count: changedRoles,
      failed: saveFailed,
      beforeSave,
      save: saveRoles,
      cancel: cancelRoles,
    }),
    [beforeSave, cancelRoles, changedRoles, dirty, saveFailed, saveRoles, saving],
  );

  useEffect(() => {
    registerDraft?.("access-roles", draftHandle);
    return () => registerDraft?.("access-roles", null);
  }, [draftHandle, registerDraft]);

  // A refused save is put in front of the admin once this tab is showing. The
  // page takes them here from another tab, so this waits for that.
  useEffect(() => {
    if (!saveFailed || !active || !needsAttention.current) return;

    needsAttention.current = false;
    saveAlertRef.current?.focus();
  }, [active, saveFailed]);

  return (
    <SettingsSectionCard
      // A heading of its own, so heading navigation finds it. The card puts its
      // title in a plain element.
      title={
        <span role="heading" aria-level={2}>
          {__("PressedMail App Access", "pressedmail")}
        </span>
      }
      description={
        <>
          {__(
            "Choose which WordPress roles can open PressedMail. Administrators always have access.",
            "pressedmail",
          )}{" "}
          {onShowUsers ? (
            // The whole sentence is the link, so a translation never has to split
            // a sentence around a link.
            <button
              type="button"
              onClick={onShowUsers}
              className="inline cursor-pointer rounded-sm p-0 text-start underline underline-offset-2 hover:text-foreground"
              data-test="access-roles-show-users"
              data-testid="access-roles-show-users">
              {__("To allow or deny one person, use the Users tab.", "pressedmail")}
            </button>
          ) : (
            __("To allow or deny one person, use the Users tab.", "pressedmail")
          )}
        </>
      }
      contentClassName="space-y-4">
      {saveFailed ? (
        <AccessProblem
          role="alert"
          data-test="access-roles-save-error"
          data-testid="access-roles-save-error">
          <p ref={saveAlertRef} tabIndex={-1} className="outline-none">
            {__(
              "Roles could not be saved. Your changes are still here.",
              "pressedmail",
            )}
          </p>
        </AccessProblem>
      ) : null}

      {loading && !loadFailed ? (
        <SettingsSkeleton
          label={__("Loading roles...", "pressedmail")}
          className="border-0 bg-transparent p-0 shadow-none"
          dataTest="access-roles-loading"
          rows={2}
        />
      ) : loadFailed ? (
        <AccessProblem
          role="alert"
          title={__("Roles could not be loaded", "pressedmail")}
          contentClassName="space-y-3"
          data-test="access-roles-load-error"
          data-testid="access-roles-load-error">
          <p>{__("Nothing has been changed.", "pressedmail")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-disabled={loading || undefined}
            onClick={() => {
              if (!loading) list.retry(() => void fetchRoles());
            }}
            className="aria-disabled:pointer-events-none aria-disabled:opacity-50"
            data-test="access-roles-retry">
            {loading
              ? __("Retrying...", "pressedmail")
              : __("Retry", "pressedmail")}
          </Button>
        </AccessProblem>
      ) : (
        <div
          ref={list.target}
          tabIndex={-1}
          role="group"
          aria-label={__("Roles", "pressedmail")}
          // One track that may shrink, not the auto-sized one a bare grid gets: a
          // role name of fifty characters otherwise widened every card past the
          // phone and pushed every count off the screen.
          className="grid grid-cols-1 gap-3 outline-none sm:grid-cols-2">
          {roles.map((role) => {
            const noRead = role.allowed && role.can_read === false;
            const peopleId = `access-role-${role.slug}-people`;
            const noteId = `access-role-${role.slug}-note`;

            return (
              <div
                key={role.slug}
                className="flex items-center gap-3 rounded-lg border p-3"
                data-test="access-role"
                data-role={role.slug}>
                {/* The checkbox puts its id on a hidden input, so the visible box
                    is named by pointing at the label directly. */}
                <Checkbox
                  id={`access-role-${role.slug}`}
                  checked={role.allowed}
                  disabled={role.locked || saving}
                  aria-labelledby={`access-role-${role.slug}-label`}
                  aria-describedby={noRead ? `${peopleId} ${noteId}` : peopleId}
                  onCheckedChange={(checked) =>
                    toggleRole(role.slug, checked === true)
                  }
                />
                <div className="min-w-0 flex-1">
                  <Label
                    id={`access-role-${role.slug}-label`}
                    htmlFor={`access-role-${role.slug}`}
                    className="flex min-w-0 items-center gap-2 text-sm">
                    {/* Wraps, so a long name is read whole on a phone; the title is for a pointer. */}
                    <span
                      className="min-w-0 [overflow-wrap:anywhere]"
                      title={role.name}>
                      {role.name}
                    </span>
                    {role.locked ? (
                      <Badge variant="secondary" className="text-xs">
                        {__("Required", "pressedmail")}
                      </Badge>
                    ) : null}
                  </Label>
                  {noRead ? (
                    <p
                      id={noteId}
                      className="text-xs text-muted-foreground"
                      data-test="access-role-no-read"
                      data-testid="access-role-no-read">
                      {__(
                        "Its people can't read this site, so it lets no one in.",
                        "pressedmail",
                      )}
                    </p>
                  ) : null}
                </div>
                <span
                  id={peopleId}
                  className="shrink-0 text-xs text-muted-foreground tabular-nums"
                  data-test="access-role-people">
                  {sprintf(
                    _n(
                      "%d person",
                      "%d people",
                      role.users ?? 0,
                      "pressedmail",
                    ),
                    role.users ?? 0,
                  )}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* One element whichever answer it has, so the live region is never torn
          down and made again while it is changing what it says. With the
          server's answer there is nobody to warn about when everyone in the
          roles has another way in, so nothing is said. */}
      <AccessStagedNotice
        show={
          exactImpact
            ? exactImpact.losing > 0
            : removed.length > 0 && peopleAtRisk > 0
        }
        dataTest="access-roles-pending">
        {exactImpact ? (
          <>
            <p className="font-semibold text-foreground">
              {sprintf(
                _n(
                  "%d person will lose access",
                  "%d people will lose access",
                  exactImpact.losing,
                  "pressedmail",
                ),
                exactImpact.losing,
              )}
            </p>
            <p className="text-muted-foreground">
              {sprintf(
                /* translators: %s: the people who lose access, such as "Ada Lovelace, Alan Turing and 2 more". */
                _n(
                  "%s gets in only through the roles you turned off. You'll see what stops before anything is saved.",
                  "%s get in only through the roles you turned off. You'll see what stops before anything is saved.",
                  exactImpact.losing,
                  "pressedmail",
                ),
                nameList(exactImpact.names, exactImpact.losing),
              )}
            </p>
          </>
        ) : (
          <>
            <p className="font-semibold text-foreground">
              {sprintf(
                _n(
                  "Up to %d person could lose access",
                  "Up to %d people could lose access",
                  peopleAtRisk,
                  "pressedmail",
                ),
                peopleAtRisk,
              )}
            </p>
            <p className="text-muted-foreground">
              {__(
                "That counts everyone in the roles you turned off. Anyone with another way in, such as another role or Allow, keeps access. You'll see what stops before anything is saved.",
                "pressedmail",
              )}
            </p>
          </>
        )}
      </AccessStagedNotice>

      {loading || loadFailed ? null : (
        // The save state is here and not in the card's header: a header's
        // second column is as wide as its content, and this one reserves 5rem
        // for "Saved" even while it is empty, which took a third of the phone's
        // width from the description above.
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">
            {sprintf(
              _n(
                "%d role allowed.",
                "%d roles allowed.",
                selectedSlugs.length,
                "pressedmail",
              ),
              selectedSlugs.length,
            )}
          </p>
          <SettingsSaveState status={saveStatus} />
        </div>
      )}
      {lossDialog}
    </SettingsSectionCard>
  );
}
