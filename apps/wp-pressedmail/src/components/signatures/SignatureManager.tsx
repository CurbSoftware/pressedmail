/**
 * Signature Manager Component
 *
 * Settings page component for managing email signatures.
 *
 * @since 1.1.0
 */

import React, { useState, useCallback, useMemo } from "react";
import {
  AlertDialog,
  AlertDialogAction,
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
import { SignaturePreview } from "./SignatureSelector";
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
} from "@/components/settings-ui";

interface SignatureManagerProps {
  /** Optional account ID filter */
  accountId?: number | null;
  /** Hide the page-level header when an outer shell already renders it */
  hideHeader?: boolean;
  /** Additional class names */
  className?: string;
}

export const SignatureManager: React.FC<SignatureManagerProps> = ({
  accountId,
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
  const [saving, setSaving] = useState(false);

  // Filter signatures by account if specified
  const filteredSignatures = accountId
    ? signatures.filter(
        (sig) => sig.account_id === accountId || sig.account_id === null,
      )
    : signatures;
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
          const createData = data as CreateSignatureData;
          if (accountId) {
            createData.account_id = accountId;
          }
          const result = await createSignature(createData);
          if (result.success) {
            setIsCreating(false);
          }
          return result;
        }
      } finally {
        setSaving(false);
      }
    },
    [editingSignature, accountId, createSignature, updateSignature],
  );

  const handleCancel = useCallback(() => {
    setEditingSignature(null);
    setIsCreating(false);
  }, []);

  const handleDelete = useCallback(async () => {
    if (!deleteConfirm) return;

    setSaving(true);
    try {
      await deleteSignature(deleteConfirm.id);
      setDeleteConfirm(null);
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
        label={__SINGLE_SIGNATURE__ ? "Signature" : "New Signature"}
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
          accountId={accountId}
        />
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Card */}
      <div className="rounded-lg border bg-card border-border">
        {/* Header */}
        {!usingSharedHeaderActions &&
        (!hideHeader || showHeaderCreateAction) ? (
          <div className="p-4 border-b border-border sm:p-5">
            <div className="flex items-center justify-between">
              {!hideHeader ? (
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                    <PenTool className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="flex items-center gap-1.5 text-lg font-semibold">
                      <span>Email Signatures</span>
                      <SettingsInfoTooltip
                        tooltip={settingsInfoTooltips.emailSignatures}
                        docHref={settingsInfoDocHrefs.emailSignatures}
                      />
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Create and manage your email signatures
                    </p>
                  </div>
                </div>
              ) : (
                <h3 className="text-lg font-semibold">Signatures</h3>
              )}
              {showHeaderCreateAction && !signatureSlotFilled ? (
                <Button
                  type="button"
                  onClick={handleCreate}
                  disabled={!canCreate || loading}
                  data-test="signature-new"
                  data-testid="signature-new">
                  <PlusCircle className="mr-2 h-4 w-4" />
                  {__SINGLE_SIGNATURE__ ? "Signature" : "New Signature"}
                </Button>
              ) : null}
            </div>
          </div>
        ) : null}

        {/* Content */}
        <div className="p-4 sm:p-5">
          {/* Error State */}
          {error && (
            <div className="mb-4 flex items-center gap-2 rounded-md border border-destructive/20 bg-destructive/10 p-3 text-destructive">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{error.message}</span>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          )}

          {/* Empty State */}
          {!loading && filteredSignatures.length === 0 && (
            <SettingsEmptyState
              icon={<PenTool className="h-6 w-6" />}
              title="No signatures yet"
              description="Create a signature that can be added automatically when composing email."
              actions={
                canCreate && !usingSharedHeaderActions ? (
                  <Button
                    type="button"
                    onClick={handleCreate}
                    data-test="signature-new-empty"
                    data-testid="signature-new-empty">
                    <PlusCircle className="mr-2 h-4 w-4" />
                    Create Signature
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
        onOpenChange={(open) => !open && setDeleteConfirm(null)}>
        <AlertDialogContent
          className="sm:max-w-sm"
          data-test="signature-delete-dialog"
          data-testid="signature-delete-dialog">
          <AlertDialogHeader>
            <AlertDialogTitle>
              <AlertDialogTitleRow variant="destructive">
                <Trash2 />
                <span>Delete Signature</span>
              </AlertDialogTitleRow>
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{deleteConfirm?.name}"? This
              action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={saving}
              data-test="signature-delete-cancel"
              data-testid="signature-delete-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
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
              Delete
            </AlertDialogAction>
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
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
}

const SignatureStatusIndicator: React.FC<SignatureStatusIndicatorProps> = ({
  signatureId,
  kind,
  label,
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
    <Icon className="h-3 w-3 shrink-0" />
    <span className="truncate">{label}</span>
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
      {/* Rendered preview */}
      <div
        data-test={`signature-card-preview-${signature.id}`}
        data-testid={`signature-card-preview-${signature.id}`}
        className="aspect-video w-full overflow-hidden rounded-md border border-border bg-muted/30 px-3 py-2 text-sm">
        {hasContent ? (
          <SignaturePreview signature={signature} />
        ) : (
          <span className="text-muted-foreground italic">No content</span>
        )}
      </div>

      {/* Identity */}
      <h4 className="truncate text-sm font-medium" title={signature.name}>
        {signature.name}
      </h4>

      <div className="grid grid-cols-3 gap-2">
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="new"
          label="New"
          active={signature.include_for_new}
          icon={Mail}
        />
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="reply"
          label="Reply"
          active={signature.include_for_reply}
          icon={EmailReplyIcon}
        />
        <SignatureStatusIndicator
          signatureId={signature.id}
          kind="forward"
          label="Forward"
          active={signature.include_for_forward}
          icon={EmailForwardIcon}
        />
      </div>

      {/* Actions */}
      <div className="absolute right-2 top-2 flex items-center gap-1 rounded-md border border-border bg-card/95 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
        <button
          type="button"
          onClick={onEdit}
          title="Edit"
          data-test={`signature-card-edit-${signature.id}`}
          data-testid={`signature-card-edit-${signature.id}`}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "text-muted-foreground hover:text-foreground hover:bg-accent",
          )}>
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          type="button"
          onClick={onDelete}
          title="Delete"
          data-test={`signature-card-delete-${signature.id}`}
          data-testid={`signature-card-delete-${signature.id}`}
          className={cn(
            "p-1.5 rounded-md transition-colors",
            "text-muted-foreground hover:text-destructive hover:bg-destructive/10",
          )}>
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
};

export default SignatureManager;
