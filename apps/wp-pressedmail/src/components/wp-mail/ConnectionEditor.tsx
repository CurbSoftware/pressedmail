import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Loader2, Trash2 } from "lucide-react";

import { Button } from "@kit/ui/plugin";

import { ConfirmationPanel } from "@/components/shared/ConfirmationPanel";
import type {
  RegisterSettingsDraft,
  SettingsDraftHandle,
} from "@/components/settings-ui";
import {
  createWpMailConnection,
  deleteWpMailConnection,
  testWpMailConnection,
  updateWpMailConnection,
  type WpMailConnectionInput,
  type WpMailConnectionView,
  type WpMailState,
} from "@/lib/wp-mail-api";

import { SmtpConnectionForm } from "./SmtpConnectionForm";
import { SmtpTestSendPanel } from "./SmtpTestSendPanel";
import { buildWpMailTestStatus } from "./test-status";
import {
  SINGLE_CONNECTION_CAPABILITIES,
  type SmtpConnectionCapabilities,
  type SmtpConnectionFormErrors,
  type SmtpConnectionValue,
  type SmtpStatusMessage,
  type SmtpTestPanelErrors,
} from "./types";

export interface ConnectionEditorProps {
  /** Null while creating the first connection. */
  connection: WpMailConnectionView | null;
  /** Whether the site-wide runtime switch is on, for the test result copy. */
  runtimeEnabled: boolean;
  capabilities?: SmtpConnectionCapabilities;
  onStateChange: (state: WpMailState) => void;
  canDelete?: boolean;
  idPrefix?: string;
  /**
   * Lets the surrounding tab see unsaved edits, so leaving the page warns
   * instead of dropping a half-typed connection.
   */
  registerDraft?: RegisterSettingsDraft;
  draftKey?: string;
  /** Another whole-option mutation is already running in the settings tab. */
  disabled?: boolean;
}

const EMPTY_CONNECTION: SmtpConnectionValue = {
  enabled: true,
  host: "",
  port: 587,
  security: "tls",
  auth: true,
  username: "",
  password: "",
  fromEmail: "",
  fromName: "",
  label: "",
  forceFrom: false,
  fromAddresses: [],
};

function toValue(connection: WpMailConnectionView | null): SmtpConnectionValue {
  if (!connection) {
    return { ...EMPTY_CONNECTION };
  }

  return {
    enabled: connection.enabled,
    host: connection.host,
    port: connection.port,
    security: connection.security,
    auth: connection.auth,
    username: connection.username,
    // Never seeded from the server: the stored password is not sent to the
    // client, and an empty value means "keep it".
    password: "",
    fromEmail: connection.fromEmail,
    fromName: connection.fromName,
    label: connection.label,
    forceFrom: connection.forceFrom,
    fromAddresses: [...connection.fromAddresses],
  };
}

function toInput(value: SmtpConnectionValue): WpMailConnectionInput {
  return {
    label: value.label ?? "",
    enabled: value.enabled,
    host: value.host,
    port: value.port,
    security: value.security,
    auth: value.auth,
    password: value.password,
    username: value.username,
    fromEmail: value.fromEmail,
    fromName: value.fromName,
    forceFrom: value.forceFrom ?? false,
    fromAddresses: value.fromAddresses ?? [],
  };
}

/**
 * Edit, test, save, and delete one SMTP connection.
 *
 * Shared by both edition panels so the Free single-connection form and one row
 * of the Pro list cannot drift apart. Everything edition-specific arrives
 * through `capabilities`, which the server supplies.
 */
export function ConnectionEditor({
  connection,
  runtimeEnabled,
  capabilities = SINGLE_CONNECTION_CAPABILITIES,
  onStateChange,
  canDelete = false,
  idPrefix = "wp-mail-connection",
  registerDraft,
  draftKey,
  disabled = false,
}: ConnectionEditorProps) {
  const [value, setValue] = useState<SmtpConnectionValue>(() =>
    toValue(connection),
  );
  const [fieldErrors, setFieldErrors] = useState<SmtpConnectionFormErrors>({});
  const [testErrors, setTestErrors] = useState<SmtpTestPanelErrors>({});
  const [status, setStatus] = useState<SmtpStatusMessage | null>(null);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [testRecipient, setTestRecipient] = useState("");
  const saveInFlight = useRef(false);

  const connectionId = connection?.id ?? "";

  // Re-seed when the server hands back a different record for this slot.
  useEffect(() => {
    setValue(toValue(connection));
    setFieldErrors({});
  }, [connection]);

  const applyErrors = (errors?: Record<string, string>) => {
    const next: SmtpConnectionFormErrors = {};
    if (errors) {
      if (errors.label) next.label = errors.label;
      if (errors.host) next.host = errors.host;
      if (errors.port) next.port = errors.port;
      if (errors.security) next.security = errors.security;
      if (errors.username) next.username = errors.username;
      if (errors.password) next.password = errors.password;
      if (errors.from_email) next.fromEmail = errors.from_email;
      if (errors.from_addresses) next.fromAddresses = errors.from_addresses;
    }
    setFieldErrors(next);
  };

  const handleSave = useCallback(async (): Promise<boolean> => {
    if (disabled || saveInFlight.current) {
      return false;
    }

    saveInFlight.current = true;
    setSaving(true);
    setStatus(null);
    setTestErrors({});

    try {
      const result = connectionId
        ? await updateWpMailConnection(connectionId, toInput(value))
        : await createWpMailConnection(toInput(value));

      if (!result.ok) {
        applyErrors(result.errors);
        setStatus({
          kind: "error",
          message:
            result.message ??
            __("Could not save this connection.", "pressedmail"),
        });
        return false;
      }

      applyErrors(undefined);
      if (result.state) {
        onStateChange(result.state);
      }
      // The password is never echoed back, so clear the field rather than
      // leaving the just-typed secret sitting in the DOM.
      setValue((previous) => ({ ...previous, password: "" }));
      setStatus({
        kind: "success",
        message: __("Connection saved.", "pressedmail"),
      });
      return true;
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : __("Could not save this connection.", "pressedmail"),
      });
      return false;
    } finally {
      saveInFlight.current = false;
      setSaving(false);
    }
  }, [connectionId, disabled, onStateChange, value]);

  // A connection is unsaved when it differs from the record the server handed
  // back. `toValue` always resets the password to empty, so a freshly typed
  // secret counts as a change on its own.
  const dirty = JSON.stringify(value) !== JSON.stringify(toValue(connection));

  const cancelEdits = useCallback(() => {
    setValue(toValue(connection));
    setFieldErrors({});
  }, [connection]);

  // The handle is deliberately keyed on dirty/saving only. Reading the current
  // callbacks through refs keeps its identity stable across the renders caused
  // by typing, which would otherwise re-register on every keystroke.
  const handleSaveRef = useRef(handleSave);
  handleSaveRef.current = handleSave;
  const cancelEditsRef = useRef(cancelEdits);
  cancelEditsRef.current = cancelEdits;

  const draftHandle = useMemo<SettingsDraftHandle>(
    () => ({
      dirty,
      saving,
      save: () => handleSaveRef.current(),
      cancel: () => cancelEditsRef.current(),
    }),
    [dirty, saving],
  );

  const registrationKey = draftKey ?? idPrefix;

  useEffect(() => {
    registerDraft?.(registrationKey, draftHandle);
    return () => registerDraft?.(registrationKey, null);
  }, [draftHandle, registerDraft, registrationKey]);

  const handleTest = async () => {
    if (disabled) {
      return;
    }

    const recipient = testRecipient.trim();
    if (!recipient || !recipient.includes("@")) {
      setTestErrors({
        testRecipient: __(
          "Enter an address to send the test to.",
          "pressedmail",
        ),
      });
      return;
    }

    setTestErrors({});
    setTesting(true);
    setStatus(null);

    try {
      const result = await testWpMailConnection(
        toInput(value),
        recipient,
        connectionId,
      );
      setStatus(buildWpMailTestStatus(result, runtimeEnabled && value.enabled));
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : __("Test email could not be sent.", "pressedmail"),
      });
    } finally {
      setTesting(false);
    }
  };

  const handleDelete = async () => {
    if (!connectionId || disabled) {
      return;
    }

    setDeleting(true);
    setStatus(null);

    try {
      const result = await deleteWpMailConnection(connectionId);
      if (result.ok && result.state) {
        onStateChange(result.state);
        return;
      }
      setStatus({
        kind: "error",
        message:
          result.message ??
          __("Could not delete this connection.", "pressedmail"),
      });
    } catch (error) {
      setStatus({
        kind: "error",
        message:
          error instanceof Error
            ? error.message
            : __("Could not delete this connection.", "pressedmail"),
      });
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  const connectionName = connection?.label || __("connection", "pressedmail");

  return (
    <div
      className="space-y-4"
      data-test={`${idPrefix}-editor`}
      data-testid={`${idPrefix}-editor`}>
      <SmtpConnectionForm
        value={value}
        onChange={setValue}
        errors={fieldErrors}
        hasPassword={connection?.hasPassword ?? false}
        capabilities={capabilities}
        idPrefix={idPrefix}
        disabled={disabled || saving || deleting}
      />

      <SmtpTestSendPanel
        testRecipient={testRecipient}
        onTestRecipientChange={setTestRecipient}
        onTest={handleTest}
        onSave={handleSave}
        errors={testErrors}
        status={status}
        saving={saving}
        testing={testing}
        disabled={disabled || deleting}
        idPrefix={idPrefix}
      />

      {canDelete && connectionId ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-destructive hover:text-destructive"
            data-test={`${idPrefix}-delete-button`}
            data-testid={`${idPrefix}-delete-button`}
            onClick={() => setConfirmDelete(true)}
            disabled={disabled || saving || testing || deleting}>
            {deleting ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="mr-2 h-4 w-4" />
            )}
            {sprintf(
              /* translators: %s: connection name. */
              __("Remove %s", "pressedmail"),
              connectionName,
            )}
          </Button>
        </div>
      ) : null}

      <ConfirmationPanel
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        variant="destructive"
        loading={deleting}
        title={sprintf(
          /* translators: %s: connection name. */
          __("Remove %s?", "pressedmail"),
          connectionName,
        )}
        description={__(
          "This deletes the server settings and its saved password. Any From addresses routed to it fall back to the default connection.",
          "pressedmail",
        )}
        confirmText={__("Remove", "pressedmail")}
        cancelText={__("Keep it", "pressedmail")}
        onConfirm={handleDelete}
      />
    </div>
  );
}
