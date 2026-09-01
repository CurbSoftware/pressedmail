import { __, _n, sprintf } from "@wordpress/i18n";
import { useCallback, useEffect, useMemo, useState } from "react";
import { UserCheck } from "lucide-react";

import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Label,
} from "@kit/ui/plugin";
import { SettingsSaveState } from "@/components/settings-ui";
import { routeApiPrefix } from "@/context/Strings";
import {
  notifyAutosaveError,
  notifyAutosaveSuccess,
  type AutosaveStatus,
} from "@/hooks/useAutosaveSetting";
import { apiFetch } from "@/lib/api-client";

interface AccessRole {
  slug: string;
  name: string;
  allowed: boolean;
  locked: boolean;
}

export interface AccessControlDraftHandle {
  dirty: boolean;
  saving: boolean;
  save: () => Promise<boolean>;
  cancel: () => void;
}

export type RegisterAccessControlDraft = (
  key: string,
  draft: AccessControlDraftHandle | null,
) => void;

interface AccessControlDraftCardProps {
  registerDraft?: RegisterAccessControlDraft;
}

const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

/**
 * WordPress role access is the sole remaining concern on the Access Control
 * surface. Managed domains now live in the dedicated paid Allowed Domains tab.
 */
export function AccessRolesCard({
  registerDraft,
}: AccessControlDraftCardProps = {}) {
  const [roles, setRoles] = useState<AccessRole[]>([]);
  const [savedRoles, setSavedRoles] = useState<AccessRole[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState<AutosaveStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const fetchRoles = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await apiFetch(
        `${routeApiPrefix}/plugin/settings/access-roles`,
        {
          credentials: "include",
          headers: getApiHeaders(),
        },
      );

      if (!response.ok) {
        throw new Error(`Failed to load roles: ${response.status}`);
      }

      const data = await response.json();
      const nextRoles = Array.isArray(data.roles) ? data.roles : [];
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : __("Failed to load access roles", "pressedmail"),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchRoles();
  }, [fetchRoles]);

  const selectedSlugs = useMemo(
    () => roles.filter((role) => role.allowed).map((role) => role.slug),
    [roles],
  );
  const savedSelectedSlugs = useMemo(
    () => savedRoles.filter((role) => role.allowed).map((role) => role.slug),
    [savedRoles],
  );
  const dirty = useMemo(
    () =>
      JSON.stringify([...selectedSlugs].sort()) !==
      JSON.stringify([...savedSelectedSlugs].sort()),
    [savedSelectedSlugs, selectedSlugs],
  );

  const toggleRole = (slug: string, allowed: boolean) => {
    setRoles((current) =>
      current.map((role) =>
        role.slug === slug && !role.locked ? { ...role, allowed } : role,
      ),
    );
    setSaveStatus("dirty");
  };

  const saveRoles = useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;

    const nextSelectedSlugs = roles
      .filter((role) => role.allowed)
      .map((role) => role.slug);
    setSaving(true);
    setSaveStatus("saving");
    setError(null);

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
        throw new Error(`Failed to save roles: ${response.status}`);
      }

      const data = await response.json();
      const nextRoles = Array.isArray(data.roles) ? data.roles : roles;
      setRoles(nextRoles);
      setSavedRoles(nextRoles);
      setSaveStatus("saved");
      notifyAutosaveSuccess("admin-settings");
      return true;
    } catch (caught) {
      setSaveStatus("error");
      setError(
        caught instanceof Error
          ? caught.message
          : __("Failed to save access roles", "pressedmail"),
      );
      notifyAutosaveError(
        __("Could not save role access settings", "pressedmail"),
      );
      return false;
    } finally {
      setSaving(false);
    }
  }, [dirty, roles]);

  const cancelRoles = useCallback(() => {
    setRoles(savedRoles);
    setError(null);
    setSaveStatus("idle");
  }, [savedRoles]);

  const draftHandle = useMemo<AccessControlDraftHandle>(
    () => ({
      dirty,
      saving,
      save: saveRoles,
      cancel: cancelRoles,
    }),
    [cancelRoles, dirty, saveRoles, saving],
  );

  useEffect(() => {
    registerDraft?.("access-roles", draftHandle);
    return () => registerDraft?.("access-roles", null);
  }, [draftHandle, registerDraft]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          {__("PressedMail App Access", "pressedmail")}
          <SettingsSaveState status={saveStatus} />
        </CardTitle>
        <CardDescription>
          {__(
            "Choose which WordPress roles can open PressedMail. Administrators always have access.",
            "pressedmail",
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error ? (
          <div className="rounded-md border border-destructive/20 bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="flex items-center justify-center py-4 text-sm text-muted-foreground">
            {__("Loading roles...", "pressedmail")}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {roles.map((role) => (
              <div
                key={role.slug}
                className="flex items-center gap-3 rounded-lg border p-3">
                <Checkbox
                  id={`access-role-${role.slug}`}
                  checked={role.allowed}
                  disabled={role.locked || saving}
                  onCheckedChange={(checked) =>
                    toggleRole(role.slug, checked === true)
                  }
                />
                <Label
                  htmlFor={`access-role-${role.slug}`}
                  className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  <span className="truncate">{role.name}</span>
                  {role.locked ? (
                    <Badge variant="secondary" className="text-xs">
                      {__("Required", "pressedmail")}
                    </Badge>
                  ) : null}
                </Label>
              </div>
            ))}
          </div>
        )}

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
        </div>
      </CardContent>
    </Card>
  );
}
