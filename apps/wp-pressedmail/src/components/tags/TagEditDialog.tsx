/**
 * Tag Edit Dialog + Delete Confirm Dialog
 *
 * Shared create/edit/delete UI for tags. Extracted from TagManager so both the
 * Settings → Tags tab and the sidebar TagFilterSection reuse the exact same
 * form (name / color / description, with the AI auto-tag toggle shown only when
 * AI is configured). The `data-test` ids are part of the contract. Keep them.
 *
 * @since 1.1.0
 */

import React, { useState } from "react";
import { Tag as TagIcon, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogTitleRow,
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
  Input,
  Label,
  Switch,
  Textarea,
} from "@kit/ui/plugin";
import { useAutoTaggerToolAvailable } from "@/context/auto-tagger/AutoTaggerContext";
import { ComposerColorPalette } from "@/components/ui/color-picker/ComposerColorPalette";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayError,
  PressedOverlayFooter,
} from "../ui/pressed-overlay";
import { TagBadge } from "./TagBadge";
import { TAG_COLORS } from "../../types/tags";
import type { Tag, CreateTagData, UpdateTagData } from "../../types/tags";

const DEFAULT_TAG_COLOR = TAG_COLORS[10] ?? "#3b82f6";

/**
 * Tag Edit Dialog Component
 */
export interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onSave: (data: CreateTagData | UpdateTagData) => Promise<void>;
  error?: string | null;
}

export const TagEditDialog: React.FC<TagEditDialogProps> = ({
  open,
  onOpenChange,
  tag,
  onSave,
  error,
}) => {
  const aiAvailable = useAutoTaggerToolAvailable();
  const [name, setName] = useState(tag?.name || "");
  const [color, setColor] = useState(tag?.color || DEFAULT_TAG_COLOR);
  // A tag's single description doubles as the AI auto-tag instruction. Fall back
  // to a legacy tag's ai_prompt for tags created before the description field.
  const [description, setDescription] = useState(
    tag?.description || tag?.ai_prompt || "",
  );
  const [aiEnabled, setAiEnabled] = useState(tag?.ai_auto_tag_enabled || false);
  const [saving, setSaving] = useState(false);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(tag?.name || "");
      setColor(tag?.color || DEFAULT_TAG_COLOR);
      setDescription(tag?.description || tag?.ai_prompt || "");
      setAiEnabled(tag?.ai_auto_tag_enabled || false);
    }
  }, [open, tag]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        // AI auto-tag config is only meaningful when AI is configured.
        ...(aiAvailable ? { ai_auto_tag_enabled: aiEnabled } : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PressedDialogContent size="paletteForm">
        <PressedDialogHeader
          title={tag ? "Edit Tag" : "Create Tag"}
          icon={TagIcon}
          description={tag ? "Edit tag details" : "Create a new tag"}
          descriptionMode="sr-only"
        />

        <form onSubmit={handleSubmit}>
          <PressedOverlayBody className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">Name</Label>
              <Input autoComplete="off"
                id="tag-name"
                data-test="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Enter tag name"
                maxLength={100}
              />
            </div>

            {/* Description, doubles as the AI auto-tag instruction */}
            <div className="space-y-2">
              <Label htmlFor="tag-description">Description</Label>
              <Textarea autoComplete="off"
                id="tag-description"
                data-test="tag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  aiAvailable
                    ? "Describe this tag. When AI auto-tagging is on, this is the instruction the AI uses to apply it."
                    : "Describe what this tag is for"
                }
                rows={4}
              />
            </div>

            {/* AI auto-tagging, only shown when the AI key/settings are configured */}
            {aiAvailable ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                <div className="flex items-center justify-between gap-3">
                  <Label
                    htmlFor="tag-ai-enabled"
                    className="text-sm font-medium">
                    AI auto-tagging
                  </Label>
                  <Switch
                    id="tag-ai-enabled"
                    data-test="tag-ai-enabled"
                    checked={aiEnabled}
                    onCheckedChange={setAiEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  When on, the AI applies this tag to emails during auto-tagging
                  using the description above as its instruction.
                </p>
              </div>
            ) : null}

            {/* Color Picker */}
            <div className="space-y-2">
              <Label>Color</Label>
              <ComposerColorPalette
                mode="picker"
                level="reduced"
                onPick={setColor}
                onClear={() => setColor(DEFAULT_TAG_COLOR)}
              />
            </div>

            {/* Preview */}
            <div className="space-y-2">
              <Label>Preview</Label>
              <TagBadge
                tag={{
                  id: 0,
                  user_id: 0,
                  account_id: null,
                  name: name || "Tag name",
                  description,
                  color,
                  icon: null,
                  ai_prompt: description,
                  ai_auto_tag_enabled: aiEnabled,
                  sort_order: 0,
                  is_active: true,
                  created_at: "",
                  updated_at: "",
                }}
                size="lg"
              />
            </div>

            {/* Error */}
            {error ? <PressedOverlayError>{error}</PressedOverlayError> : null}
          </PressedOverlayBody>

          <PressedOverlayFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button
              type="submit"
              data-test="tag-save"
              disabled={!name.trim() || saving}>
              {saving ? "Saving..." : tag ? "Save Changes" : "Create Tag"}
            </Button>
          </PressedOverlayFooter>
        </form>
      </PressedDialogContent>
    </Dialog>
  );
};

/**
 * Delete Confirmation Dialog
 */
export interface DeleteConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onConfirm: () => void;
}

export const DeleteConfirmDialog: React.FC<DeleteConfirmDialogProps> = ({
  open,
  onOpenChange,
  tag,
  onConfirm,
}) => {
  const [deleting, setDeleting] = useState(false);

  const handleConfirm = async () => {
    setDeleting(true);
    try {
      onConfirm();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-sm">
        <AlertDialogHeader>
          <AlertDialogTitle>
            <DialogTitleRow>
              <Trash2 />
              <span>Delete Tag</span>
            </DialogTitleRow>
          </AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete the tag{" "}
            <strong>"{tag?.name}"</strong>? This will remove the tag from all
            messages.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting ? "Deleting..." : "Delete"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};
