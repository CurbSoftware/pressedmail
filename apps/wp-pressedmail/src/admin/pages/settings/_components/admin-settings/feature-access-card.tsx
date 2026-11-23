import { __, _n, sprintf } from "@wordpress/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button, Checkbox, Input, Label } from "@kit/ui/plugin";
import {
  SettingsSaveState,
  SettingsSectionCard,
  SettingsSkeleton,
} from "@/components/settings-ui";
import { routeApiPrefix } from "@/context/Strings";
import {
  notifyAutosaveError,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import { apiFetch } from "@/lib/api-client";
import type { GatedFeature } from "@/lib/feature-access";

import type {
  AccessControlDraftHandle,
  RegisterAccessControlDraft,
} from "./access-tab";
import { AccessProblem } from "./access-problem";

/** One feature's grant. Null is everyone who can open PressedMail (templates and forms only). */
export type FeatureRule = { roles: string[]; users: number[] } | null;
export type FeatureAccessRules = Record<GatedFeature, FeatureRule>;

interface Role {
  slug: string;
  name: string;
  locked: boolean;
}

interface Person {
  id: number;
  name: string;
  email: string;
}

const FEATURES: GatedFeature[] = ["campaigns", "templates", "forms"];
const ENDPOINT = `${routeApiPrefix}/plugin/settings/feature-access`;
const HEADERS: HeadersInit = { "Content-Type": "application/json" };

const title = (feature: GatedFeature): string =>
  feature === "campaigns"
    ? __("Campaigns", "pressedmail")
    : feature === "templates"
      ? __("Templates", "pressedmail")
      : __("Forms", "pressedmail");

const note = (feature: GatedFeature): string =>
  feature === "campaigns"
    ? __(
        "Campaigns also need the Ultimate or Lifetime plan. Writing a campaign's emails needs Templates too.",
        "pressedmail",
      )
    : feature === "templates"
      ? __(
          "Anyone can still use a template in an email. This decides who can make, change, delete and import them.",
          "pressedmail",
        )
      : __("This decides who can make and change signup forms.", "pressedmail");

/** A rule in one order, so a draft that went back to what was saved is not dirty. */
const ruleKey = (rule: FeatureRule): string =>
  rule === null
    ? "everyone"
    : JSON.stringify([
        [...rule.roles].sort(),
        [...rule.users].sort((a, b) => a - b),
      ]);

function readRules(body: unknown): FeatureAccessRules | null {
  const access = (body as { access?: Record<string, unknown> })?.access;
  if (!access || typeof access !== "object") return null;
  const rules = {} as FeatureAccessRules;
  for (const feature of FEATURES) {
    const value = access[feature] as FeatureRule | undefined;
    rules[feature] =
      value === null && feature !== "campaigns"
        ? null
        : {
            roles: Array.isArray(value?.roles) ? value.roles : [],
            users: Array.isArray(value?.users) ? value.users : [],
          };
  }
  return rules;
}

/**
 * Who may use Campaigns, Templates and Forms (Services/FeatureAccess.php).
 * Administrators always may. Out of the box Campaigns are administrators only,
 * and Templates and Forms are everyone who can open PressedMail. A grant lets a
 * person work on their own items only. Saved with the rest of the page.
 */
export function FeatureAccessCard({
  registerDraft,
  active = true,
}: {
  registerDraft?: RegisterAccessControlDraft;
  active?: boolean;
}) {
  const [activated, setActivated] = useState(active);
  const [saved, setSaved] = useState<FeatureAccessRules | null>(null);
  const [rules, setRules] = useState<FeatureAccessRules | null>(null);
  const [roles, setRoles] = useState<Role[]>([]);
  const [people, setPeople] = useState<Record<number, Person>>({});
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [status, setStatus] = useState<AutosaveStatus>("idle");

  const apply = useCallback((body: unknown) => {
    const next = readRules(body);
    if (!next) throw new Error("Missing feature access");
    const answer = body as { roles?: Role[]; people?: Person[] };
    setSaved(next);
    setRules(next);
    setRoles(Array.isArray(answer.roles) ? answer.roles : []);
    setPeople((current) => {
      const known = { ...current };
      for (const person of answer.people ?? []) known[person.id] = person;
      return known;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiFetch(ENDPOINT, {
        credentials: "include",
        headers: HEADERS,
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      apply(await response.json());
      setLoadFailed(false);
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, [apply]);

  useEffect(() => {
    if (active) setActivated(true);
  }, [active]);

  useEffect(() => {
    if (activated) void load();
  }, [activated, load]);

  // How many features differ from what is saved: the Save bar and the Roles tab count them.
  const changed = useMemo(
    () =>
      saved && rules
        ? FEATURES.filter(
            (feature) => ruleKey(saved[feature]) !== ruleKey(rules[feature]),
          ).length
        : 0,
    [rules, saved],
  );
  const dirty = changed > 0;

  const change = (feature: GatedFeature, next: FeatureRule) => {
    setRules((current) =>
      current ? { ...current, [feature]: next } : current,
    );
    setSaveError(null);
    setStatus("dirty");
  };

  const save = useCallback(async (): Promise<boolean> => {
    if (!dirty || !rules) return true;
    setSaving(true);
    setStatus("saving");
    setSaveError(null);
    // Someone removed from the site since is not sent back: the server refuses a person it cannot find.
    const access = Object.fromEntries(
      FEATURES.map((feature) => {
        const rule = rules[feature];
        return [
          feature,
          rule === null
            ? null
            : {
                roles: rule.roles,
                users: rule.users.filter((id) => id in people),
              },
        ];
      }),
    );
    try {
      const response = await apiFetch(ENDPOINT, {
        method: "POST",
        credentials: "include",
        headers: HEADERS,
        body: JSON.stringify({ access }),
      });
      const body = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          typeof body?.message === "string" && body.message !== ""
            ? body.message
            : __(
                "Feature access could not be saved. Try again.",
                "pressedmail",
              ),
        );
      }
      apply(body);
      setStatus("saved");
      return true;
    } catch (error) {
      setStatus("error");
      setSaveError(
        error instanceof Error && error.message !== ""
          ? error.message
          : __("Feature access could not be saved. Try again.", "pressedmail"),
      );
      notifyAutosaveError(__("Could not save feature access", "pressedmail"));
      return false;
    } finally {
      setSaving(false);
    }
  }, [apply, dirty, people, rules]);

  const cancel = useCallback(() => {
    setRules(saved);
    setSaveError(null);
    setStatus("idle");
  }, [saved]);

  const handle = useMemo<AccessControlDraftHandle>(
    () => ({
      dirty,
      saving,
      count: changed,
      failed: saveError !== null,
      save,
      cancel,
    }),
    [cancel, changed, dirty, save, saveError, saving],
  );

  useEffect(() => {
    registerDraft?.("feature-access", handle);
    return () => registerDraft?.("feature-access", null);
  }, [handle, registerDraft]);

  return (
    <SettingsSectionCard
      title={
        <span role="heading" aria-level={2}>
          {__("Who can use Campaigns, Templates and Forms", "pressedmail")}
        </span>
      }
      description={__(
        "Administrators always have access. Everyone else needs a role or a name here. A person sees and changes only their own items.",
        "pressedmail",
      )}
      contentClassName="space-y-4"
      dataTest="feature-access-card">
      {saveError ? (
        <AccessProblem
          role="alert"
          data-test="feature-access-save-error"
          data-testid="feature-access-save-error">
          <p>{saveError}</p>
        </AccessProblem>
      ) : null}

      {loading && !loadFailed ? (
        <SettingsSkeleton
          label={__("Loading feature access...", "pressedmail")}
          className="border-0 bg-transparent p-0 shadow-none"
          dataTest="feature-access-loading"
          rows={3}
        />
      ) : loadFailed || !rules ? (
        <AccessProblem
          role="alert"
          title={__("Feature access could not be loaded", "pressedmail")}
          contentClassName="space-y-3"
          data-test="feature-access-load-error"
          data-testid="feature-access-load-error">
          <p>{__("Nothing has been changed.", "pressedmail")}</p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void load()}
            data-test="feature-access-retry"
            data-testid="feature-access-retry">
            {__("Retry", "pressedmail")}
          </Button>
        </AccessProblem>
      ) : (
        <>
          {FEATURES.map((feature) => (
            <FeatureRow
              key={feature}
              feature={feature}
              rule={rules[feature]}
              roles={roles}
              people={people}
              disabled={saving}
              onChange={(next) => change(feature, next)}
              onFound={(found) =>
                setPeople((current) => ({ ...current, [found.id]: found }))
              }
            />
          ))}
          <div className="flex justify-end">
            <SettingsSaveState status={status} />
          </div>
        </>
      )}
    </SettingsSectionCard>
  );
}

function FeatureRow({
  feature,
  rule,
  roles,
  people,
  disabled,
  onChange,
  onFound,
}: {
  feature: GatedFeature;
  rule: FeatureRule;
  roles: Role[];
  people: Record<number, Person>;
  disabled: boolean;
  onChange: (next: FeatureRule) => void;
  onFound: (person: Person) => void;
}) {
  const everyone = rule === null;
  const chosen = rule ?? { roles: [], users: [] };
  const id = `feature-access-${feature}`;

  return (
    <fieldset
      className="space-y-3 rounded-lg border p-3"
      data-test={id}
      data-testid={id}>
      <legend className="px-1 text-sm font-semibold">{title(feature)}</legend>
      <p className="text-xs text-muted-foreground">{note(feature)}</p>
      {feature === "campaigns" ? (
        <p className="text-xs text-muted-foreground">
          {__(
            "Anyone with Campaigns can send from every enabled site email connection, using its From address.",
            "pressedmail",
          )}
        </p>
      ) : null}

      {feature === "campaigns" ? null : (
        <div className="flex items-center gap-2">
          <Checkbox
            id={`${id}-everyone`}
            checked={everyone}
            disabled={disabled}
            aria-labelledby={`${id}-everyone-label`}
            onCheckedChange={(checked) =>
              onChange(checked === true ? null : { roles: [], users: [] })
            }
            data-test={`${id}-everyone`}
            data-testid={`${id}-everyone`}
          />
          <Label
            id={`${id}-everyone-label`}
            htmlFor={`${id}-everyone`}
            className="text-sm">
            {__("Everyone who can open PressedMail", "pressedmail")}
          </Label>
        </div>
      )}

      {everyone ? null : (
        <>
          <div
            role="group"
            aria-label={sprintf(
              /* translators: %s: a feature, such as Campaigns. */
              __("Roles that can use %s", "pressedmail"),
              title(feature),
            )}
            className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {roles
              .filter((role) => !role.locked)
              .map((role) => {
                const boxId = `${id}-role-${role.slug}`;
                return (
                  <div key={role.slug} className="flex items-center gap-2">
                    <Checkbox
                      id={boxId}
                      checked={chosen.roles.includes(role.slug)}
                      disabled={disabled}
                      aria-labelledby={`${boxId}-label`}
                      onCheckedChange={(checked) =>
                        onChange({
                          ...chosen,
                          roles:
                            checked === true
                              ? [...chosen.roles, role.slug]
                              : chosen.roles.filter(
                                  (slug) => slug !== role.slug,
                                ),
                        })
                      }
                      data-test="feature-access-role"
                      data-testid={boxId}
                    />
                    <Label
                      id={`${boxId}-label`}
                      htmlFor={boxId}
                      className="min-w-0 text-sm [overflow-wrap:anywhere]">
                      {role.name}
                    </Label>
                  </div>
                );
              })}
          </div>

          <ul
            className="flex flex-wrap gap-2"
            aria-label={__("People", "pressedmail")}>
            {chosen.users.map((user) => {
              const person = people[user];
              const name =
                person?.name ??
                __("Someone no longer on this site", "pressedmail");
              return (
                <li
                  key={user}
                  className="flex items-center gap-1 rounded-full border px-2 py-0.5 text-sm"
                  data-test="feature-access-person"
                  data-testid={`${id}-person-${user}`}>
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {name}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-1 pointer-coarse:min-h-11"
                    disabled={disabled}
                    aria-label={sprintf(
                      /* translators: %s: a person's name. */
                      __("Remove %s", "pressedmail"),
                      name,
                    )}
                    onClick={() =>
                      onChange({
                        ...chosen,
                        users: chosen.users.filter((other) => other !== user),
                      })
                    }
                    data-testid={`${id}-person-${user}-remove`}>
                    {__("Remove", "pressedmail")}
                  </Button>
                </li>
              );
            })}
          </ul>

          <PersonSearch
            id={id}
            feature={feature}
            disabled={disabled}
            exclude={chosen.users}
            onPick={(person) => {
              onFound(person);
              onChange({ ...chosen, users: [...chosen.users, person.id] });
            }}
          />
        </>
      )}
    </fieldset>
  );
}

/** Finds people by name or email through the Users tab's own list. */
function PersonSearch({
  id,
  feature,
  disabled,
  exclude,
  onPick,
}: {
  id: string;
  feature: GatedFeature;
  disabled: boolean;
  exclude: number[];
  onPick: (person: Person) => void;
}) {
  const [term, setTerm] = useState("");
  const [found, setFound] = useState<Person[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [searching, setSearching] = useState(false);

  const search = async () => {
    const query = term.trim();
    if (query === "" || searching) return;
    setSearching(true);
    setFailed(false);
    try {
      const params = new URLSearchParams({ search: query, per_page: "10" });
      const response = await apiFetch(
        `${routeApiPrefix}/plugin/settings/access-users?${params.toString()}`,
        { credentials: "include", headers: HEADERS },
      );
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const body = (await response.json()) as { users?: Person[] };
      setFound(
        (Array.isArray(body.users) ? body.users : []).map(
          ({ id: user, name, email }) => ({
            id: user,
            name,
            email,
          }),
        ),
      );
    } catch {
      setFound(null);
      setFailed(true);
    } finally {
      setSearching(false);
    }
  };

  const shown = (found ?? []).filter((person) => !exclude.includes(person.id));

  return (
    <div className="space-y-2">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          void search();
        }}>
        <Label htmlFor={`${id}-search`} className="sr-only">
          {sprintf(
            /* translators: %s: a feature, such as Campaigns. */
            __("Add a person to %s", "pressedmail"),
            title(feature),
          )}
        </Label>
        <Input
          id={`${id}-search`}
          value={term}
          disabled={disabled}
          autoComplete="off"
          placeholder={__("Name or email", "pressedmail")}
          onChange={(event) => setTerm(event.target.value)}
          className="w-full max-w-xs"
          data-testid={`${id}-search`}
        />
        <Button
          type="submit"
          variant="outline"
          size="sm"
          disabled={disabled || searching || term.trim() === ""}
          className="pointer-coarse:min-h-11"
          data-testid={`${id}-find`}>
          {__("Find", "pressedmail")}
        </Button>
      </form>
      {failed ? (
        <p
          role="alert"
          className="text-sm text-destructive"
          data-testid={`${id}-search-error`}>
          {__("People could not be searched. Try again.", "pressedmail")}
        </p>
      ) : null}
      {found !== null && shown.length === 0 ? (
        <p
          className="text-sm text-muted-foreground"
          data-testid={`${id}-search-none`}>
          {__("No one else matches.", "pressedmail")}
        </p>
      ) : null}
      {shown.length > 0 ? (
        <ul
          className="flex flex-wrap gap-2"
          aria-label={__("Matches", "pressedmail")}>
          {shown.map((person) => (
            <li key={person.id}>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled}
                className="pointer-coarse:min-h-11"
                onClick={() => onPick(person)}
                aria-label={sprintf(
                  /* translators: 1: a person's name, 2: their email address. */
                  __("Add %1$s (%2$s)", "pressedmail"),
                  person.name,
                  person.email,
                )}
                data-testid={`${id}-add-${person.id}`}>
                {sprintf(
                  /* translators: %s: a person's name. */
                  __("Add %s", "pressedmail"),
                  person.name,
                )}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      <span className="sr-only" aria-live="polite">
        {found === null
          ? ""
          : sprintf(
              _n("%d match", "%d matches", shown.length, "pressedmail"),
              shown.length,
            )}
      </span>
    </div>
  );
}
