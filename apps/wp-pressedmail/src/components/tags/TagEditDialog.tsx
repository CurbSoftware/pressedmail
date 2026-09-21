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

import React, { useId, useState } from "react";
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
import { useAutoTaggerToolAvailable } from "@/context/auto-tagger/AutoTaggerContext";
import { cn } from "@/lib/utils";
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
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Names for TAG_COLORS, in the same order. Built at render time for i18n. */
function tagColorNames(): string[] {
  return [
    __("Red", "pressedmail"),
    __("Orange", "pressedmail"),
    __("Amber", "pressedmail"),
    __("Yellow", "pressedmail"),
    __("Lime", "pressedmail"),
    __("Green", "pressedmail"),
    __("Emerald", "pressedmail"),
    __("Teal", "pressedmail"),
    __("Cyan", "pressedmail"),
    __("Sky", "pressedmail"),
    __("Blue", "pressedmail"),
    __("Indigo", "pressedmail"),
    __("Violet", "pressedmail"),
    __("Purple", "pressedmail"),
    __("Fuchsia", "pressedmail"),
    __("Pink", "pressedmail"),
    __("Rose", "pressedmail"),
    __("Slate", "pressedmail"),
  ];
}

/**
 * Tag colour choice: the curated tag swatches as a radio group, plus one
 * custom hex field. Tag text renders in the theme foreground over a light tint
 * of the colour, so every choice stays readable. Nothing here touches the
 * composer's palette history or custom colours.
 */
function TagColorPicker({
  value,
  onChange,
}: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const labelId = useId();
  const customId = useId();
  const customErrorId = useId();
  const names = tagColorNames();
  const selectedIndex = TAG_COLORS.findIndex(
    (hex) => hex.toLowerCase() === value.toLowerCase(),
  );
  const [custom, setCustom] = useState(selectedIndex === -1 ? value : "");
  const customInvalid = custom !== "" && !HEX_COLOR.test(custom);

  const select = (index: number, group: HTMLElement | null) => {
    const hex = TAG_COLORS[index];
    if (!hex) return;
    onChange(hex);
    setCustom("");
    const radios = group?.querySelectorAll<HTMLButtonElement>('[role="radio"]');
    radios?.[index]?.focus();
  };

  return (
    <div className="space-y-2">
      <span id={labelId} className="text-sm font-medium leading-none">
        {__("Color", "pressedmail")}
      </span>
      <div
        role="radiogroup"
        aria-labelledby={labelId}
        data-test="tag-color-swatches"
        className="flex flex-wrap gap-1.5"
        onKeyDown={(event) => {
          const step =
            event.key === "ArrowRight" || event.key === "ArrowDown"
              ? 1
              : event.key === "ArrowLeft" || event.key === "ArrowUp"
                ? -1
                : 0;
          if (!step) return;
          event.preventDefault();
          const from = selectedIndex === -1 ? 0 : selectedIndex;
          select(
            (from + step + TAG_COLORS.length) % TAG_COLORS.length,
            event.currentTarget,
          );
        }}>
        {TAG_COLORS.map((hex, index) => {
          const checked = index === selectedIndex;
          return (
            <button
              key={hex}
              type="button"
              role="radio"
              aria-checked={checked}
              aria-label={names[index]}
              tabIndex={checked || (selectedIndex === -1 && index === 0) ? 0 : -1}
              onClick={(event) =>
                select(index, event.currentTarget.parentElement)
              }
              className={cn(
                "size-7 rounded-full border border-black/10 transition-shadow",
                checked &&
                  "ring-2 ring-foreground ring-offset-2 ring-offset-background",
              )}
              style={{ backgroundColor: hex }}
            />
          );
        })}
      </div>
      <div className="flex items-center gap-2">
        <Label htmlFor={customId} className="text-sm font-normal">
          {__("Custom", "pressedmail")}
        </Label>
        <Input
          id={customId}
          autoComplete="off"
          spellCheck={false}
          value={custom}
          maxLength={7}
          placeholder="#3b82f6"
          data-test="tag-color-custom"
          aria-invalid={customInvalid || undefined}
          aria-describedby={customInvalid ? customErrorId : undefined}
          onChange={(event) => {
            const next = event.target.value.trim();
            setCustom(next);
            if (HEX_COLOR.test(next)) onChange(next);
          }}
          className="h-8 w-28 font-mono text-sm"
        />
      </div>
      {customInvalid ? (
        <p id={customErrorId} className="text-xs text-destructive">
          {__("Use a hex color such as #3b82f6.", "pressedmail")}
        </p>
      ) : null}
    </div>
  );
}

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
          title={
            tag ? __("Edit tag", "pressedmail") : __("Create tag", "pressedmail")
          }
          icon={TagIcon}
          description={
            tag
              ? __("Change this tag's name, color or description.", "pressedmail")
              : __("Create a tag to label your email.", "pressedmail")
          }
          descriptionMode="sr-only"
        />

        <form onSubmit={handleSubmit}>
          <PressedOverlayBody className="space-y-4">
            {/* Name Input */}
            <div className="space-y-2">
              <Label htmlFor="tag-name">{__("Name", "pressedmail")}</Label>
              <Input autoComplete="off"
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
              <Textarea autoComplete="off"
                id="tag-description"
                data-test="tag-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={
                  aiAvailable
                    ? __(
                        "Describe this tag. With AI auto-tagging on, this is the instruction the AI follows.",
                        "pressedmail",
                      )
                    : __("What is this tag for?", "pressedmail")
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
              </div>
            ) : null}

            {/* Color Picker */}
            <TagColorPicker
              key={tag?.id ?? "new"}
              value={color}
              onChange={setColor}
            />

            {/* Preview */}
            <div className="space-y-2">
              <span className="text-sm font-medium leading-none">
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
              {__("Cancel", "pressedmail")}
            </Button>
            <Button
              type="submit"
              data-test="tag-save"
              disabled={!name.trim() || saving}>
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
            {deleting ? __("Deleting…", "pressedmail") : __("Delete", "pressedmail")}
          </AlertDialogAction>
        </PressedOverlayFooter>
      </PressedAlertDialogContent>
    </AlertDialog>
  );
};
