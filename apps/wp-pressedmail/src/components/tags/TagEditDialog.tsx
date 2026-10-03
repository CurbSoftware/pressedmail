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
import { __, sprintf } from "@wordpress/i18n";
import { Tag as TagIcon, Trash2 } from "lucide-react";
import {
  Dialog,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  Button,
  Input,
  Label,
  Switch,
  Textarea,
} from "@kit/ui/plugin";
import {
  tagConfidenceHelp,
  useAutoTaggerToolAvailable,
} from "@/context/auto-tagger/AutoTaggerContext";
import { SwatchColorPicker } from "../ui/color-picker/SwatchColorPicker";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
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
/** Minimum AI confidence, in percent, before a tag applies automatically. */
const DEFAULT_AI_CONFIDENCE = 70;

// Auto-tagging is Pro: the Free build compiles none of a tag's AI fields.
const confidenceText = (tag: Tag | null) =>
  __ENABLE_AUTO_TAGGER__
    ? String(tag?.ai_confidence ?? DEFAULT_AI_CONFIDENCE)
    : String(DEFAULT_AI_CONFIDENCE);

const legacyPrompt = (tag: Tag | null) =>
  __ENABLE_AUTO_TAGGER__ ? tag?.ai_prompt : undefined;

const autoTagEnabled = (tag: Tag | null) =>
  __ENABLE_AUTO_TAGGER__ ? Boolean(tag?.ai_auto_tag_enabled) : false;

const validConfidence = (value: string) =>
  /^\d{1,2}$/.test(value) && Number(value) >= 1 && Number(value) <= 99;

/**
 * Tag Edit Dialog Component
 */
export interface TagEditDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tag: Tag | null;
  onSave: (data: CreateTagData | UpdateTagData) => Promise<void>;
  error?: string | null;
  /** Where focus goes on close. Needed when the dialog has no trigger. */
  onCloseAutoFocus?: (event: Event) => void;
  /** Name to start a new tag with, such as the text typed in a filter. */
  initialName?: string;
}

export const TagEditDialog: React.FC<TagEditDialogProps> = ({
  open,
  onOpenChange,
  tag,
  onSave,
  error,
  onCloseAutoFocus,
  initialName = "",
}) => {
  const autoTaggerToolAvailable = useAutoTaggerToolAvailable();
  const aiAvailable = __ENABLE_AUTO_TAGGER__ && autoTaggerToolAvailable;
  const [name, setName] = useState(tag?.name || initialName);
  const [color, setColor] = useState(tag?.color || DEFAULT_TAG_COLOR);
  // A tag's single description doubles as the AI auto-tag instruction. Fall back
  // to a legacy tag's ai_prompt for tags created before the description field.
  const [description, setDescription] = useState(
    tag?.description || legacyPrompt(tag) || "",
  );
  const [aiEnabled, setAiEnabled] = useState(autoTagEnabled(tag));
  const [confidence, setConfidence] = useState(confidenceText(tag));
  const [saving, setSaving] = useState(false);
  const nameRef = React.useRef<HTMLInputElement>(null);
  // Confidence only matters, and only shows, while auto-tagging is on.
  const confidenceInvalid =
    aiAvailable && aiEnabled && !validConfidence(confidence);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setName(tag?.name || initialName);
      setColor(tag?.color || DEFAULT_TAG_COLOR);
      setDescription(tag?.description || legacyPrompt(tag) || "");
      setAiEnabled(autoTagEnabled(tag));
      setConfidence(confidenceText(tag));
    }
  }, [open, tag, initialName]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || confidenceInvalid) return;

    setSaving(true);
    try {
      await onSave({
        name: name.trim(),
        description: description.trim(),
        color,
        // AI auto-tag config is only meaningful when AI is configured.
        ...(__ENABLE_AUTO_TAGGER__ && aiAvailable
          ? {
              ai_auto_tag_enabled: aiEnabled,
              ai_confidence: validConfidence(confidence)
                ? Number(confidence)
                : DEFAULT_AI_CONFIDENCE,
            }
          : {}),
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <PressedDialogContent
        size="paletteForm"
        onCloseAutoFocus={onCloseAutoFocus}
        // Radix selects a field it focuses on open, so the first keystroke
        // replaced a name carried over from the tag filter. Caret at the end.
        onOpenAutoFocus={(event) => {
          const field = nameRef.current;
          if (!field) return;
          event.preventDefault();
          field.focus();
          field.setSelectionRange(field.value.length, field.value.length);
        }}>
        <PressedDialogHeader
          title={
            tag
              ? __("Edit tag", "pressedmail")
              : __("Create tag", "pressedmail")
          }
          icon={TagIcon}
          description={
            tag
              ? __(
                  "Change this tag's name, color or description.",
                  "pressedmail",
                )
              : __("Create a tag to label your email.", "pressedmail")
          }
          descriptionMode="sr-only"
        />

        <form onSubmit={handleSubmit}>
          <PressedOverlayBody className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">{__("Name", "pressedmail")}</Label>
              <Input
                ref={nameRef}
                autoComplete="off"
                id="tag-name"
                data-test="tag-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={__("For example: Follow up", "pressedmail")}
                maxLength={100}
              />
            </div>

            {/* Description, doubles as the AI auto-tag instruction */}
            <div className="space-y-2">
              <Label htmlFor="tag-description">
                {__("Description", "pressedmail")}
              </Label>
              <Textarea
                autoComplete="off"
                id="tag-description"
                data-test="tag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                // The AI switch below explains the instruction role in its
                // helper text, which stays put while typing.
                placeholder={__("What is this tag for?", "pressedmail")}
                rows={4}
              />
            </div>

            {/* AI auto-tagging, only shown when the AI key/settings are configured */}
            {__ENABLE_AUTO_TAGGER__ && aiAvailable ? (
              <div className="space-y-2 rounded-md border border-border p-3">
                {/* The whole row is the label, so the small switch has a
                    44px target on a phone. */}
                <div className="flex items-center justify-between gap-3 pointer-coarse:min-h-11">
                  <Label
                    htmlFor="tag-ai-enabled"
                    className="flex-1 self-stretch text-sm font-medium pointer-coarse:flex pointer-coarse:items-center">
                    {__("AI auto-tagging", "pressedmail")}
                  </Label>
                  <Switch
                    id="tag-ai-enabled"
                    data-test="tag-ai-enabled"
                    checked={aiEnabled}
                    onCheckedChange={setAiEnabled}
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  {__(
                    "When on, the AI applies this tag during auto-tagging, using the description above as its instruction.",
                    "pressedmail",
                  )}
                </p>
                {aiEnabled ? (
                  <>
                    <div className="flex items-center justify-between gap-3 pt-1">
                      <Label
                        htmlFor="tag-ai-confidence"
                        className="text-sm font-medium">
                        {__("Confidence", "pressedmail")}
                      </Label>
                      <div className="flex items-center gap-1">
                        <Input
                          autoComplete="off"
                          id="tag-ai-confidence"
                          data-test="tag-ai-confidence"
                          // No type="number": wp-admin styles that type 40px
                          // tall, beside a 32px Name field. The check below
                          // already takes whole numbers only.
                          inputMode="numeric"
                          className="w-20"
                          value={confidence}
                          aria-invalid={confidenceInvalid}
                          aria-describedby="tag-ai-confidence-help"
                          onChange={(e) => setConfidence(e.target.value.trim())}
                        />
                        <span className="text-sm text-muted-foreground">%</span>
                      </div>
                    </div>
                    <p
                      id="tag-ai-confidence-help"
                      className={
                        confidenceInvalid
                          ? "text-xs text-destructive"
                          : "text-xs text-muted-foreground"
                      }>
                      {confidenceInvalid
                        ? __(
                            "Enter a whole number from 1 to 99.",
                            "pressedmail",
                          )
                        : tagConfidenceHelp()}
                    </p>
                  </>
                ) : null}
              </div>
            ) : null}

            {/* Color Picker */}
            <SwatchColorPicker
              key={tag?.id ?? "new"}
              colors={TAG_COLORS}
              value={color}
              onChange={setColor}
              allowCustom
            />

            {/* Preview */}
            <div className="space-y-2">
              <span className="block text-sm font-medium leading-none">
                {__("Preview", "pressedmail")}
              </span>
              <TagBadge
                tag={{
                  id: 0,
                  user_id: 0,
                  account_id: null,
                  name: name || __("Tag name", "pressedmail"),
                  description,
                  color,
                  icon: null,
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
              className="pointer-coarse:min-h-11"
              onClick={() => onOpenChange(false)}>
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="submit"
              className="pointer-coarse:min-h-11"
              data-test="tag-save"
              disabled={!name.trim() || saving || confidenceInvalid}>
              {saving
                ? __("Saving…", "pressedmail")
                : tag
                  ? __("Save changes", "pressedmail")
                  : __("Create tag", "pressedmail")}
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
      <PressedAlertDialogContent size="confirmation">
        <PressedAlertDialogHeader
          title={__("Delete tag", "pressedmail")}
          icon={Trash2}
          tone="destructive"
          description={sprintf(
            /* translators: %s: tag name. */
            __(
              "Delete the tag \u201c%s\u201d? It comes off every message that has it.",
              "pressedmail",
            ),
            tag?.name ?? "",
          )}
        />
        <PressedOverlayFooter>
          <AlertDialogCancel>{__("Cancel", "pressedmail")}</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleConfirm}
            disabled={deleting}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            {deleting
              ? __("Deleting…", "pressedmail")
              : __("Delete", "pressedmail")}
          </AlertDialogAction>
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
};
