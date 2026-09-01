/**
 * Signature Editor Component
 *
 * Rich text editor for creating and editing email signatures.
 *
 * @since 1.1.0
 */

import React, { useState, useCallback, useMemo, useRef } from "react";
import { Loader2, Save, X, AlertCircle } from "lucide-react";
import type {
  Signature,
  CreateSignatureData,
  UpdateSignatureData,
} from "../../types/signatures";
import type { EmailEditorRef } from "@/components/composer";
import { ComposerAuthoringEditor } from "@/components/inbox/compose/ComposerAuthoringEditor";
import { normalizeRichEditorHtml } from "@/components/inbox/compose/compose-utils";
import { useUnsavedChangesGuard } from "@/components/settings-ui";

interface SignatureEditorProps {
  /** Signature to edit (null for new signature) */
  signature?: Signature | null;
  /** Callback when signature is saved */
  onSave: (
    data: CreateSignatureData | UpdateSignatureData,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Callback when editor is cancelled */
  onCancel: () => void;
  /** Whether save is in progress */
  saving?: boolean;
  /** Account ID to associate with signature */
  accountId?: number | null;
}

export const SignatureEditor: React.FC<SignatureEditorProps> = ({
  signature,
  onSave,
  onCancel,
  saving = false,
  accountId,
}) => {
  const [name, setName] = useState(signature?.name || "");
  const [content, setContent] = useState(
    normalizeRichEditorHtml(signature?.content || ""),
  );
  const [includeForNew, setIncludeForNew] = useState(
    signature?.include_for_new ?? true,
  );
  const [includeForReply, setIncludeForReply] = useState(
    signature?.include_for_reply ?? true,
  );
  const [includeForForward, setIncludeForForward] = useState(
    signature?.include_for_forward ?? true,
  );
  // Auto-attach is an explicit opt-in: a signature is only added to emails
  // automatically when it is the default. New signatures start off NOT default.
  const [isDefault, setIsDefault] = useState(signature?.is_default ?? false);
  const [error, setError] = useState<string | null>(null);
  const editorRef = useRef<EmailEditorRef>(null);

  const isEditing = !!signature;
  const initialSnapshot = useMemo(
    () =>
      JSON.stringify({
        name: signature?.name || "",
        content: normalizeRichEditorHtml(signature?.content || ""),
        includeForNew: signature?.include_for_new ?? true,
        includeForReply: signature?.include_for_reply ?? true,
        includeForForward: signature?.include_for_forward ?? true,
        isDefault: signature?.is_default ?? false,
      }),
    [signature],
  );
  const currentSnapshot = JSON.stringify({
    name,
    content,
    includeForNew,
    includeForReply,
    includeForForward,
    isDefault,
  });
  const { guardedAction, guardDialog } = useUnsavedChangesGuard({
    dirty: currentSnapshot !== initialSnapshot,
  });

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);

      if (!name.trim()) {
        setError("Please enter a name for this signature.");
        return;
      }

      const editorContent = editorRef.current?.getHTML() || content;

      if (!editorContent.trim()) {
        setError("Please enter content for this signature.");
        return;
      }

      const data: CreateSignatureData | UpdateSignatureData = {
        name: name.trim(),
        content: editorContent.trim(),
        content_type: "html",
        is_default: isDefault,
        include_for_new: includeForNew,
        include_for_reply: includeForReply,
        include_for_forward: includeForForward,
      };

      if (!isEditing && accountId) {
        (data as CreateSignatureData).account_id = accountId;
      }

      const result = await onSave(data);

      if (!result.success && result.error) {
        setError(result.error);
      }
    },
    [
      name,
      content,
      isDefault,
      includeForNew,
      includeForReply,
      includeForForward,
      accountId,
      isEditing,
      onSave,
    ],
  );

  return (
    <div className="pm-form-card">
      {guardDialog}
      <form onSubmit={handleSubmit}>
        {/* Header */}
        <div className="px-6 py-3 border-b border-border">
          <h3 className="pm-form-title">
            {isEditing ? "Edit Signature" : "Create Signature"}
          </h3>
        </div>

        {/* Content */}
        <div className="pm-form-content">
          {error && (
            <div className="pm-alert-error">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          )}

          <div
            className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(260px,1fr)]"
            data-test="signature-content-settings-layout"
            data-testid="signature-content-settings-layout">
            {/* Content Editor */}
            <ComposerAuthoringEditor
              id="signature-content"
              testId="signature-body-editor"
              ref={editorRef}
              surface="signature"
              value={content}
              onChange={setContent}
              placeholder="Best regards, Your Name"
              disabled={saving}
              previewTitle="Signature preview"
              editorClassName="min-h-[260px]"
            />

            {/* Settings */}
            <div
              className="space-y-4 rounded-md border border-border bg-card p-4"
              data-test="signature-settings-card"
              data-testid="signature-settings-card">
              <label className="pm-label">Settings</label>

              {/* Signature Name */}
              <div className="space-y-2">
                <label htmlFor="signature-name" className="pm-label">
                  Signature Name
                </label>
                <input
                  autoComplete="off"
                  id="signature-name"
                  type="text"
                  placeholder="e.g., Work Signature, Personal"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={saving}
                  data-test="signature-name-input"
                  data-testid="signature-name-input"
                  className="pm-input"
                />
              </div>

              {/* Set as default (auto-attach opt-in) */}
              <div className="flex items-center justify-between gap-3 border-b border-border pb-4">
                <div className="space-y-0.5">
                  <label
                    htmlFor="signature-default"
                    className="pm-label cursor-pointer">
                    Set as default
                  </label>
                  <p className="text-xs text-muted-foreground">
                    Add this signature to emails automatically.
                  </p>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="signature-default"
                  aria-checked={isDefault}
                  onClick={() => setIsDefault(!isDefault)}
                  disabled={saving}
                  data-test="signature-default-toggle"
                  data-testid="signature-default-toggle"
                  className="pm-toggle">
                  <span className="pm-toggle-thumb" />
                </button>
              </div>

              {/* New Messages */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label
                    htmlFor="include-new"
                    className="pm-label cursor-pointer">
                    New Messages
                  </label>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="include-new"
                  aria-checked={includeForNew}
                  onClick={() => setIncludeForNew(!includeForNew)}
                  disabled={saving}
                  data-test="signature-include-new"
                  data-testid="signature-include-new"
                  className="pm-toggle">
                  <span className="pm-toggle-thumb" />
                </button>
              </div>

              {/* Replies */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label
                    htmlFor="include-reply"
                    className="pm-label cursor-pointer">
                    Replies
                  </label>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="include-reply"
                  aria-checked={includeForReply}
                  onClick={() => setIncludeForReply(!includeForReply)}
                  disabled={saving}
                  data-test="signature-include-reply"
                  data-testid="signature-include-reply"
                  className="pm-toggle">
                  <span className="pm-toggle-thumb" />
                </button>
              </div>

              {/* Forwards */}
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <label
                    htmlFor="include-forward"
                    className="pm-label cursor-pointer">
                    Forwards
                  </label>
                </div>
                <button
                  type="button"
                  role="switch"
                  id="include-forward"
                  aria-checked={includeForForward}
                  onClick={() => setIncludeForForward(!includeForForward)}
                  disabled={saving}
                  data-test="signature-include-forward"
                  data-testid="signature-include-forward"
                  className="pm-toggle">
                  <span className="pm-toggle-thumb" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="pm-form-footer">
          <button
            type="button"
            onClick={() => guardedAction(onCancel)}
            disabled={saving}
            data-test="signature-cancel"
            data-testid="signature-cancel"
            className="pm-btn-outline">
            <X className="h-4 w-4" />
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            data-test="signature-save"
            data-testid="signature-save"
            className="pm-btn-primary">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            {isEditing ? "Save Changes" : "Create Signature"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default SignatureEditor;
