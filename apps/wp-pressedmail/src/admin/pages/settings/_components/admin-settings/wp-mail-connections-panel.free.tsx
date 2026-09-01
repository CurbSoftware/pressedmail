import { useCallback, useMemo, useRef, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Loader2, Pencil, PlusCircle, Server, Trash2 } from "lucide-react";

import { Button, Checkbox, Label, toast } from "@kit/ui/plugin";

import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import {
  SettingsEmptyState,
  SettingsHeaderActionButton,
  SettingsSectionCard,
  useSettingsGuardedAction,
  useSettingsHeaderAction,
  type RegisterSettingsDraft,
} from "@/components/settings-ui";
import { ConnectionEditor } from "@/components/wp-mail/ConnectionEditor";
import {
  deleteWpMailConnection,
  updateWpMailConnection,
  type WpMailConnectionView,
  type WpMailState,
} from "@/lib/wp-mail-api";

export interface WpMailConnectionsPanelProps {
  state: WpMailState;
  onStateChange: (state: WpMailState) => void;
  registerDraft?: RegisterSettingsDraft;
  disabled?: boolean;
}

/** Complete one-server flow for the Free edition. */
export function WpMailConnectionsPanel({
  state,
  onStateChange,
  registerDraft,
  disabled = false,
}: WpMailConnectionsPanelProps) {
  const connection = state.connections[0] ?? null;
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const mutationInFlight = useRef(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const guardedAction = useSettingsGuardedAction();

  const openCreate = useCallback(() => {
    if (!busy && !disabled) {
      setAdding(true);
    }
  }, [busy, disabled]);
  const addAction = useMemo(() => {
    if (connection || adding || editing) {
      return null;
    }

    return (
      <SettingsHeaderActionButton
        icon={PlusCircle}
        label={__("Add mail server", "pressedmail")}
        onClick={openCreate}
        disabled={busy || disabled}
        dataTest="wp-mail-add-connection"
      />
    );
  }, [adding, busy, connection, disabled, editing, openCreate]);
  const usingSharedHeaderAction = useSettingsHeaderAction(
    "wp-mail:add-server",
    addAction,
    10,
  );

  const finishEditor = (next: WpMailState) => {
    setAdding(false);
    setEditing(false);
    onStateChange(next);
  };

  const updateEnabled = async (enabled: boolean) => {
    if (!connection || disabled || mutationInFlight.current) {
      return;
    }

    mutationInFlight.current = true;
    setBusy(true);
    try {
      const result = await updateWpMailConnection(connection.id, {
        enabled,
        ...(enabled ? {} : { disableRuntime: true }),
      });
      if (result.ok && result.state) {
        onStateChange(result.state);
      } else {
        toast.error(
          result.message ??
            __("Could not update this mail server.", "pressedmail"),
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : __("Could not update this mail server.", "pressedmail"),
      );
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!connection || disabled || mutationInFlight.current) {
      return;
    }

    mutationInFlight.current = true;
    setBusy(true);
    try {
      const result = await deleteWpMailConnection(connection.id, {
        disableRuntime: true,
      });
      if (result.ok && result.state) {
        setConfirmDelete(false);
        onStateChange(result.state);
      } else {
        toast.error(
          result.message ??
            __("Could not remove this mail server.", "pressedmail"),
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : __("Could not remove this mail server.", "pressedmail"),
      );
    } finally {
      mutationInFlight.current = false;
      setBusy(false);
    }
  };

  if (adding || (editing && connection)) {
    return (
      <SettingsSectionCard
        title={
          adding
            ? __("New mail server", "pressedmail")
            : sprintf(
                /* translators: %s: mail server label. */
                __("Edit %s", "pressedmail"),
                connection?.label ?? "",
              )
        }
        description={__(
          "Save the SMTP settings, then send a test email before relying on this server.",
          "pressedmail",
        )}
        actions={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() =>
              guardedAction(() => {
                setAdding(false);
                setEditing(false);
              })
            }>
            {__("Cancel", "pressedmail")}
          </Button>
        }>
        <ConnectionEditor
          connection={adding ? null : connection}
          runtimeEnabled={state.settings.enabled}
          capabilities={state.capabilities}
          onStateChange={finishEditor}
          registerDraft={registerDraft}
          disabled={disabled}
          idPrefix="wp-mail-connection"
        />
      </SettingsSectionCard>
    );
  }

  return (
    <SettingsSectionCard
      title={__("Outgoing mail server", "pressedmail")}
      description={__(
        "The SMTP server WordPress uses for password resets, store mail, forms, and plugin notifications.",
        "pressedmail",
      )}
      actions={
        !connection && !usingSharedHeaderAction ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            data-test="wp-mail-add-connection"
            disabled={busy || disabled}
            onClick={openCreate}>
            <PlusCircle className="mr-2 h-4 w-4" />
            {__("Add mail server", "pressedmail")}
          </Button>
        ) : null
      }>
      {!connection ? (
        <SettingsEmptyState
          icon={<Server className="h-6 w-6" />}
          title={__("No mail server yet", "pressedmail")}
          description={__(
            "Add one SMTP server to start sending WordPress email reliably.",
            "pressedmail",
          )}
        />
      ) : (
        <div
          className="max-w-md rounded-lg border border-border bg-card p-4"
          data-test={`wp-mail-server-card-${connection.id}`}
          data-testid={`wp-mail-server-card-${connection.id}`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <h4 className="text-sm font-semibold">{connection.label}</h4>
              <p className="mt-1 text-xs text-muted-foreground">
                {connection.host}:{connection.port}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                {connection.fromEmail || connection.username}
              </p>
            </div>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : null}
          </div>

          <Label
            htmlFor={`wp-mail-use-${connection.id}`}
            className="mt-4 flex min-h-11 cursor-pointer items-center gap-2 text-xs font-medium">
            <Checkbox
              id={`wp-mail-use-${connection.id}`}
              data-test={`wp-mail-use-${connection.id}`}
              checked={connection.enabled}
              disabled={busy || disabled}
              onCheckedChange={(checked) =>
                void updateEnabled(checked === true)
              }
            />
            <span>{__("Use for WordPress email", "pressedmail")}</span>
          </Label>

          <div className="mt-3 flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              data-test={`wp-mail-edit-${connection.id}`}
              disabled={busy || disabled}
              onClick={() => setEditing(true)}>
              <Pencil className="mr-2 h-4 w-4" />
              {__("Edit", "pressedmail")}
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              data-test={`wp-mail-delete-${connection.id}`}
              disabled={busy || disabled}
              onClick={() => setConfirmDelete(true)}>
              <Trash2 className="mr-2 h-4 w-4" />
              {__("Remove", "pressedmail")}
            </Button>
          </div>
        </div>
      )}

      <ConfirmationPanel
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="destructive"
        loading={busy}
        title={__("Remove this mail server?", "pressedmail")}
        description={__(
          "This removes the saved server settings and password, and turns WordPress SMTP off.",
          "pressedmail",
        )}
        confirmText={__("Remove", "pressedmail")}
        cancelText={__("Keep it", "pressedmail")}
        onConfirm={remove}
      />
    </SettingsSectionCard>
  );
}

export default WpMailConnectionsPanel;
