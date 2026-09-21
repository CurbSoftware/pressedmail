"use client";

/**
 * Tag Filter Section
 *
 * Reusable sidebar/drawer section that lists the user's active tags as toggle
 * buttons wired to the inbox tag filter (applyFilters({tags}) / clearFilters),
 * and hosts inline tag management (add / edit / delete) reusing the shared tag
 * dialog. Shared across layout variants (default, pressedg, pressedout) and
 * mobile so tag filtering + management is reachable everywhere.
 *
 * The list condenses to the first 5 tags behind a Show more toggle. Tags always
 * render below all folders in every layout.
 */

import * as React from "react";
import { __, sprintf } from "@wordpress/i18n";
import { Plus, Pencil, Trash2 } from "lucide-react";

import { useTags, useCanCreateTag } from "@/context/tags";
import { useFilterOperations } from "@/context/InboxContext";
import { cn } from "@/lib/utils";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { TagEditDialog, DeleteConfirmDialog } from "./TagEditDialog";
import { toggleTagFilterId } from "./tag-filter-utils";
import {
  EmailTagVisualIcon,
  emailTagSoftBadgeClassName,
  getEmailTagBadgeStyle,
  resolveEmailTagColor,
} from "./tag-visuals";
import type { Tag, CreateTagData, UpdateTagData } from "@/types/tags";

/** Number of tags shown before the Show more toggle. */
const VISIBLE_LIMIT = 5;

interface TagFilterSectionProps {
  className?: string;
  /** Icon-only rail mode (default layout collapsed): no header/management. */
  isCollapsed?: boolean;
  /** Show an icon-only create button in collapsed rails that support tag creation. */
  showCollapsedCreate?: boolean;
  /** Optional callback fired after a tag is toggled (e.g. close a drawer). */
  onAfterToggle?: () => void;
}

export function TagFilterSection({
  className,
  isCollapsed = false,
  showCollapsedCreate = false,
  onAfterToggle,
}: TagFilterSectionProps) {
  const { tags, capabilities, createTag, updateTag, deleteTag } = useTags();
  const canCreate = useCanCreateTag();
  const { activeFilters, applyFilters } = useFilterOperations();

  const [showAll, setShowAll] = React.useState(false);
  const [editing, setEditing] = React.useState<Tag | null>(null);
  const [isCreating, setIsCreating] = React.useState(false);
  const [deleteTarget, setDeleteTarget] = React.useState<Tag | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [isSectionOpen, setIsSectionOpen] = React.useState(true);

  const activeTags = tags.filter((tag) => tag.is_active !== false);
  if (activeTags.length === 0 && !canCreate) {
    return null;
  }

  const canEdit = Boolean(capabilities?.edit);
  const canDelete = Boolean(capabilities?.delete);
  // Row actions float over the pill's trailing end, so the pill reserves
  // matching padding, one control or two, never the full strip for one.
  const rowActionCount = (canEdit ? 1 : 0) + (canDelete ? 1 : 0);
  const hasRowActions = rowActionCount > 0;
  const current = activeFilters.tags ?? [];
  const visible =
    isCollapsed || showAll ? activeTags : activeTags.slice(0, VISIBLE_LIMIT);

  const toggle = (tag: Tag) => {
    // Additive AND: the inbox tag filter keys on tag id (drives the server-side
    // tags=<ids> query). Clicking toggles the id in/out of the active set so
    // multiple tags narrow to mail carrying them all; other filters are kept.
    const next = toggleTagFilterId(current, String(tag.id));
    applyFilters({ ...activeFilters, tags: next });
    onAfterToggle?.();
  };

  const clearTagFilter = () => {
    applyFilters({ ...activeFilters, tags: [] });
  };

  const handleSave = async (data: CreateTagData | UpdateTagData) => {
    try {
      setError(null);
      if (editing) {
        await updateTag(editing.id, data as UpdateTagData);
      } else {
        await createTag(data as CreateTagData);
      }
      setEditing(null);
      setIsCreating(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : __("Could not save the tag.", "pressedmail"));
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteTag(deleteTarget.id);
      setDeleteTarget(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : __("Could not delete the tag.", "pressedmail"));
    }
  };

  return (
    <div data-test="tags-section" className={cn("space-y-0.5", className)}>
      {!isCollapsed && (
        <div className="flex items-center justify-between px-2 py-1">
          <button
            type="button"
            aria-expanded={isSectionOpen}
            data-test="tags-section-toggle"
            onClick={() => setIsSectionOpen((value) => !value)}
            className="-my-1 inline-flex min-h-6 items-center text-2xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
            {__("Tags", "pressedmail")}
          </button>
          <div className="flex items-center gap-0.5">
            {current.length > 0 && (
              <button
                type="button"
                data-test="tag-filter-clear"
                data-testid="tag-filter-clear"
                aria-label={__("Clear tag filter", "pressedmail")}
                onClick={clearTagFilter}
                className="px-1 text-2xs font-medium uppercase tracking-wider text-muted-foreground hover:text-foreground">
                {__("Clear", "pressedmail")}
              </button>
            )}
            {canCreate && (
              <PressedTooltip
                content={__("Add tag", "pressedmail")}
                side="right">
                <button
                  type="button"
                  data-test="tag-add"
                  aria-label={__("Add tag", "pressedmail")}
                  onClick={() => {
                    setEditing(null);
                    setIsCreating(true);
                    setError(null);
                  }}
                  className="-m-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-foreground">
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </PressedTooltip>
            )}
          </div>
        </div>
      )}

      {isCollapsed && showCollapsedCreate && canCreate && (
        <PressedTooltip content={__("Add tag", "pressedmail")} side="right">
          <button
            type="button"
            data-test="tag-add"
            aria-label={__("Add tag", "pressedmail")}
            onClick={() => {
              setEditing(null);
              setIsCreating(true);
              setError(null);
            }}
            className="mx-auto flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground">
            <Plus className="h-4 w-4" />
          </button>
        </PressedTooltip>
      )}

      {isCollapsed &&
        visible.map((tag) => {
          const isActive = current.includes(String(tag.id));
          const tagStyle = getEmailTagBadgeStyle(tag);
          const tagColor = resolveEmailTagColor(tag);

          return (
            <PressedTooltip key={tag.id} content={tag.name} side="right">
              <button
                type="button"
                aria-label={tag.name}
                aria-pressed={isActive}
                data-test="pressedmail-tag-item"
                data-active={isActive ? "true" : undefined}
                onClick={() => toggle(tag)}
                className={cn(
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-md border transition-colors hover:opacity-85",
                  isActive
                    ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
                    : "",
                )}
                style={tagStyle}
                data-tag-color={tagColor}>
                <EmailTagVisualIcon className="h-3.5 w-3.5 shrink-0" />
              </button>
            </PressedTooltip>
          );
        })}

      {!isCollapsed && isSectionOpen && visible.length > 0 && (
        <div data-test="tags-list" className="space-y-1 px-2">
          {visible.map((tag) => {
            const isActive = current.includes(String(tag.id));
            const tagStyle = getEmailTagBadgeStyle(tag);
            const tagColor = resolveEmailTagColor(tag);

            return (
              <div
                key={tag.id}
                data-test="pressedmail-tag-row"
                className="group relative flex items-center gap-1">
                {/*
                  The pill spans the row. The edit/delete controls float over
                  its trailing end on hover rather than sitting in the flow,
                  in the flow they reserved their width permanently, so a tag
                  never reached the pane edge even though they were invisible.
                  `hasRowActions` reserves matching padding inside the pill so
                  a long name truncates before it runs underneath them.
                */}
                <button
                  type="button"
                  aria-label={tag.name}
                  aria-pressed={isActive}
                  data-test="pressedmail-tag-item"
                  data-active={isActive ? "true" : undefined}
                  onClick={() => toggle(tag)}
                  className={cn(
                    emailTagSoftBadgeClassName,
                    "w-full min-w-0 max-w-full justify-start text-left transition-colors hover:opacity-85",
                    rowActionCount === 2 && "pr-12",
                    rowActionCount === 1 && "pr-7",
                    isActive
                      ? "ring-2 ring-primary/50 ring-offset-1 ring-offset-background"
                      : "",
                  )}
                  style={tagStyle}
                  data-tag-color={tagColor}>
                  <EmailTagVisualIcon />
                  <span className="truncate">{tag.name}</span>
                </button>
                {hasRowActions && (
                  <span
                    data-test="tag-row-actions"
                    className="absolute right-1 top-1/2 flex -translate-y-1/2 items-center gap-0.5">
                    {canEdit && (
                      <button
                        type="button"
                        data-test={`tag-edit-${tag.id}`}
                        aria-label={sprintf(
                          __("Edit %s", "pressedmail"),
                          tag.name,
                        )}
                        onClick={() => {
                          setEditing(tag);
                          setIsCreating(false);
                          setError(null);
                        }}
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-accent hover:text-foreground focus:opacity-100 group-hover:opacity-100">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                    )}
                    {canDelete && (
                      <button
                        type="button"
                        data-test={`tag-delete-${tag.id}`}
                        aria-label={sprintf(
                          __("Delete %s", "pressedmail"),
                          tag.name,
                        )}
                        onClick={() => setDeleteTarget(tag)}
                        className="shrink-0 rounded-md p-1 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive focus:opacity-100 group-hover:opacity-100">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </span>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!isCollapsed && isSectionOpen && activeTags.length > VISIBLE_LIMIT && (
        <button
          type="button"
          data-test="tag-show-more"
          onClick={() => setShowAll((value) => !value)}
          className="flex h-7 w-full items-center px-2 text-xs font-medium text-muted-foreground hover:text-foreground">
          {showAll
            ? __("Show less", "pressedmail")
            : sprintf(
                __("Show %d more", "pressedmail"),
                activeTags.length - VISIBLE_LIMIT,
              )}
        </button>
      )}

      {(!isCollapsed || showCollapsedCreate) && (
        <>
          <TagEditDialog
            open={isCreating || editing !== null}
            onOpenChange={(open) => {
              if (!open) {
                setIsCreating(false);
                setEditing(null);
                setError(null);
              }
            }}
            tag={editing}
            onSave={handleSave}
            error={error}
          />
          <DeleteConfirmDialog
            open={deleteTarget !== null}
            onOpenChange={(open) => !open && setDeleteTarget(null)}
            tag={deleteTarget}
            onConfirm={handleDelete}
          />
        </>
      )}
    </div>
  );
}

export default TagFilterSection;
