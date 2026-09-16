/**
 * Signature Manager Component
 *
 * Settings page component for managing email signatures.
 *
 * @since 1.1.0
 */

import React, { useState, useCallback, useMemo } from "react";
import { __, sprintf } from "@wordpress/i18n";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTitleRow,
  Button,
} from "@kit/ui/plugin";
import {
  PlusCircle,
  PenTool,
  Edit2,
  Trash2,
  Loader2,
  AlertCircle,
  Mail,
} from "lucide-react";
import {
  EmailForwardIcon,
  EmailReplyIcon,
} from "@/components/icons/MailActionIcons";
import { useSignatures, useCanCreateSignature } from "../../context/signatures";
import { SignatureEditor } from "./SignatureEditor";
import { SignaturePreview } from "./SignaturePreview";
import type {
  Signature,
  CreateSignatureData,
  UpdateSignatureData,
} from "../../types/signatures";
import { cn } from "../../lib/utils";
import {
  SettingsInfoTooltip,
  SettingsEmptyState,
  SettingsHeaderActionButton,
  useSettingsHeaderAction,
  settingsInfoDocHrefs,
  settingsInfoTooltips,
  SettingsSkeleton,
} from "@/components/settings-ui";

interface SignatureManagerProps {
  /** Hide the page-level header when an outer shell already renders it */
  hideHeader?: boolean;
  /** Additional class names */
  className?: string;
}

/**
 * Label for the create action.
 *
 * The one-slot build used to label it with the bare noun "Signature", which
 * reads as a heading rather than something you can press.
 */
function createActionLabel(): string {
  return __SINGLE_SIGNATURE__
    ? __("Add signature", "pressedmail")
    : __("New Signature", "pressedmail");
}

export const SignatureManager: React.FC<SignatureManagerProps> = ({
  hideHeader = false,
  className,
}) => {
  const {
    signatures,
    loading,
    error,
    createSignature,
    updateSignature,
    deleteSignature,
  } = useSignatures();
  const canCreate = useCanCreateSignature();
  // One signature, one slot. The create action is offered while the slot is
  // empty and gone once it is filled, so there is no list to add to and nothing
  // to refuse. On a multi-signature build this constant folds to false and the
  // branch leaves the bundle.
  const signatureSlotFilled = __SINGLE_SIGNATURE__ && signatures.length > 0;

  const [editingSignature, setEditingSignature] = useState<Signature | null>(
    null,
  );
  const [isCreating, setIsCreating] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<Signature | null>(null);
  const [deleteError, setDeleteError] = useState("");
  const [saving, setSaving] = useState(false);

  const filteredSignatures = signatures;
  const handleCreate = useCallback(() => {
    if (canCreate) {
      setIsCreating(true);
      setEditingSignature(null);
    }
  }, [canCreate]);

  const handleEdit = useCallback((signature: Signature) => {
    setEditingSignature(signature);
    setIsCreating(false);
  }, []);

  const handleSave = useCallback(
    async (
      data: CreateSignatureData | UpdateSignatureData,
    ): Promise<{ success: boolean; error?: string }> => {
      setSaving(true);

      try {
        if (editingSignature) {
          const result = await updateSignature(editingSignature.id, data);
          if (result.success) {
            setEditingSignature(null);
          }
          return result;
        } else {
          // Account binding is written on the Accounts settings page, not here.
          const result = await createSignature(data as CreateSignatureData);
          if (result.success) {
            setIsCreating(false);
          }
          return result;
        }
      } finally {
        setSaving(false);
      }
    },
    [editingSignature, createSignature, updateSignature],
  );

  const handleCancel = useCallback(() => {
    setEditingSignature(null);
    setIsCreating(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    setSaving(true);
    setDeleteError("");
    try {
      const result = await deleteSignature(deleteConfirm.id);
      if (result.success) {
        setDeleteConfirm(null);
      } else {
        setDeleteError(
          result.error ||
            __("The signature could not be deleted. Try again.", "pressedmail"),
        );
      }
    } finally {
      setSaving(false);
    }
  }, [deleteConfirm, deleteSignature]);

  const createSignatureHeaderAction = useMemo(() => {
    if (isCreating || editingSignature || signatureSlotFilled) {
      return null;
    }

    return (
      <SettingsHeaderActionButton
        icon={PlusCircle}
        label={createActionLabel()}
        onClick={handleCreate}
        disabled={!canCreate || loading}
        dataTest="signature-new"
      />
    );
  }, [
    canCreate,
    editingSignature,
    handleCreate,
    isCreating,
    loading,
    signatureSlotFilled,
  ]);
  const usingSharedHeaderActions = useSettingsHeaderAction(
    "signatures:create",
    createSignatureHeaderAction,
    10,
  );
  const showHeaderCreateAction =
    !usingSharedHeaderActions && filteredSignatures.length > 0;

  // Show editor if creating or editing
  if (isCreating || editingSignature) {
    return (
      <div className={className}>
        <SignatureEditor
          signature={editingSignature}
          onSave={handleSave}
          onCancel={handleCancel}
          saving={saving}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* No outer card: this already renders inside the settings shell's own
          surface, and a bordered card around bordered cards cost 24px a side
          on a phone. */}
      <div>
        {/* Header */}
        {!usingSharedHeaderActions &&
        (!hideHeader || showHeaderCreateAction) ? (
          <div className="mb-4 border-b border-border pb-4">
            <div className="flex items-center justify-between">
              {!hideHeader ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <PenTool className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-1.5 text-lg font-semibold">
                      <span>{__("Email Signatures", "pressedmail")}</span>
                      <SettingsInfoTooltip
                        tooltip={settingsInfoTooltips.emailSignatures}
                        docHref={settingsInfoDocHrefs.emailSignatures}
                      />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {__(
                        "Create and manage your email signatures",
                        "pressedmail",
                      )}
                    </p>
                  </div>
                </div>
              ) : (
                <h3 className="text-lg font-semibold">
                  {__("Signatures", "pressedmail")}
                </h3>
              )}
              {showHeaderCreateAction && !signatureSlotFilled ? (
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canCreate || loading}
                  data-test="signature-new"
                  data-testid="signature-new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {createActionLabel()}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Content */}
        <div>
          {/* Error State */}
          {error && (
            <div
              role="alert"
              className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <SettingsSkeleton
              label={__("Loading signatures", "pressedmail")}
              dataTest="signatures-loading"
              rows={2}
            />
          )}

          {/* Empty State */}
          {!loading && filteredSignatures.length === 0 && (
            <SettingsEmptyState
              icon={<PenTool className="h-6 w-6" />}
              title={__("No signatures yet", "pressedmail")}
              description={__(
                "Create a signature that can be added automatically when composing email.",
                "pressedmail",
              )}
              actions={
                canCreate && !usingSharedHeaderActions ? (
                  <Button
                    type="button"
                    onClick={handleCreate}
                    data-test="signature-new-empty"
                    data-testid="signature-new-empty">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    {__("Create Signature", "pressedmail")}
                  </Button>
                ) : null
              }
            />
          )}

          {/* Signatures List */}
          {!loading && filteredSignatures.length > 0 && (
            <div
              data-test="signature-card-grid"
              data-testid="signature-card-grid"
              className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredSignatures.map((signature) => (
                <SignatureCard
                  key={signature.id}
                  signature={signature}
                  onEdit={() => handleEdit(signature)}
                  onDelete={() => setDeleteConfirm(signature)}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirm}
        onOpenChange={(open) => {
          if (!open && !saving) {
            setDeleteConfirm(null);
            setDeleteError("");
          }
        }}>
        <AlertDialogContent
          className="sm:max-w-sm"
          data-test="signature-delete-dialog"
          data-testid="signature-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow variant="destructive">
                <Trash2 />
                <span>{__("Delete Signature", "pressedmail")}</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm
                ? sprintf(
                    /* translators: %s: the signature's name. */
                    __(
                      'Are you sure you want to delete "%s"? This action cannot be undone.',
                      "pressedmail",
                    ),
                    deleteConfirm.name,
                  )
                : null}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {deleteError ? (
            <p role="alert" className="text-sm text-destructive">
              {deleteError}
            </p>
          ) : null}
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              data-test="signature-delete-cancel"
              data-testid="signature-delete-cancel">
              {__("Cancel", "pressedmail")}
            </AlertDialogCancel>
            <Button
              type="button"
              onClick={handleDelete}
              disabled={saving}
              data-test="signature-delete-confirm"
              data-testid="signature-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {saving ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Trash2 className="mr-2 h-4 w-4" />
              )}
              {__("Delete", "pressedmail")}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

/**
 * Individual signature card component.
 */
interface SignatureCardProps {
  signature: Signature;
  onEdit: () => void;
  onDelete: () => void;
}

interface SignatureStatusIndicatorProps {
  signatureId: number;
  kind: "new" | "reply" | "forward";
  label: string;
  stateLabel: string;
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

/**
 * Whether this signature is used for one kind of message.
 *
 * These are not controls, and they used to say so with border colour alone:
 * WCAG 1.4.1 does not accept colour as the only carrier of meaning, and a
 * screen reader was told nothing at all. The state is spelled out in text.
 */
const SignatureStatusIndicator: React.FC<SignatureStatusIndicatorProps> = ({
  signatureId,
  kind,
  label,
  stateLabel,
  active,
  icon: Icon,
}) => (
  <span
    data-test={`signature-card-${signatureId}-indicator-${kind}`}
    data-testid={`signature-card-${signatureId}-indicator-${kind}`}
    className={cn(
      "inline-flex min-w-0 items-center justify-center gap-1 rounded-full border px-2 py-1",
      "text-xs font-medium transition-colors",
      active
        ? "border-primary bg-primary/5 text-foreground"
        : "border-border bg-muted/30 text-muted-foreground",
    )}>
    <Icon className="h-3 w-3 shrink-0" aria-hidden="true" />
    <span className="truncate">{label}</span>
    <span className="sr-only">{stateLabel}</span>
  </span>
);

const SignatureCard: React.FC<SignatureCardProps> = ({
  signature,
  onEdit,
  onDelete,
}) => {
  const hasContent = signature.content.trim().length > 0;

  return (
    <div
      data-test={`signature-card-${signature.id}`}
      data-testid={`signature-card-${signature.id}`}
      className={cn(
        "group relative flex h-full flex-col gap-3 rounded-lg border p-3",
        "bg-card",
        "border-border",
        "hover:border-primary/20",
        "transition-colors",
      )}>
      {/* Identity first: the name is what the card is, so it reads before the
          sample rather than under it. */}
      <div className="flex items-start justify-between gap-2">
        <h4
          className="min-w-0 truncate text-sm font-medium"
          title={signature.name}>
          {signature.name}
        </h4>

        {/* Actions stay visible. They used to be opacity-0 until :hover, and
            the compiled CSS wraps group-hover in @media (hover:hover), so on a
            phone they could not be reached at all. */}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            title={__("Edit", "pressedmail")}
            aria-label={sprintf(
              /* translators: %s: the signature's name. */
              __("Edit signature %s", "pressedmail"),
              signature.name,
            )}
            data-test={`signature-card-edit-${signature.id}`}
            data-testid={`signature-card-edit-${signature.id}`}
            className={cn(
              "pm-touch-target inline-flex items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-accent hover:text-foreground",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}>
            <Edit2 className="h-4 w-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            title={__("Delete", "pressedmail")}
            aria-label={sprintf(
              /* translators: %s: the signature's name. */
              __("Delete signature %s", "pressedmail"),
              signature.name,
            )}
            data-test={`signature-card-delete-${signature.id}`}
            data-testid={`signature-card-delete-${signature.id}`}
            className={cn(
              "pm-touch-target inline-flex items-center justify-center rounded-md transition-colors",
              "text-muted-foreground hover:bg-destructive/10 hover:text-destructive",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}>
            <Trash2 className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Rendered preview. Sized to its content: a fixed 16:9 box left a
          three-line signature sitting in 170px of empty space. */}
      <div
        data-test={`signature-card-preview-${signature.id}`}
        data-testid={`signature-card-preview-${signature.id}`}
        className="max-h-40 w-full overflow-y-auto rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        {hasContent ? (
          <SignaturePreview signature={signature} />
        ) : (
          <span className="italic text-muted-foreground">
            {__("No content", "pressedmail")}
          </span>
        )}
      </div>

      <div className="mt-auto grid grid-cols-3 gap-2">
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="new"
          label={__("New", "pressedmail")}
          stateLabel={
            signature.include_for_new
              ? __("Used for new messages", "pressedmail")
              : __("Not used for new messages", "pressedmail")
          }
          active={signature.include_for_new}
          icon={Mail}
        />
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="reply"
          label={__("Reply", "pressedmail")}
          stateLabel={
            signature.include_for_reply
              ? __("Used for replies", "pressedmail")
              : __("Not used for replies", "pressedmail")
          }
          active={signature.include_for_reply}
          icon={EmailReplyIcon}
        />
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="forward"
          label={__("Forward", "pressedmail")}
          stateLabel={
            signature.include_for_forward
              ? __("Used for forwards", "pressedmail")
              : __("Not used for forwards", "pressedmail")
          }
          active={signature.include_for_forward}
          icon={EmailForwardIcon}
        />
      </div>
    </div>
  );
};

export default SignatureManager;
