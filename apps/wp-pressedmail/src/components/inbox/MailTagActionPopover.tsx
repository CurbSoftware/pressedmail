"use client";

import * as React from "react";
import { __, sprintf, _n } from "@wordpress/i18n";
import { CircleAlert, Loader2, Plus, Search, Trash2 } from "lucide-react";

import {
  Button,
  Checkbox,
  Input,
  Popover,
  PopoverTrigger,
  toast,
} from "@kit/ui/plugin";

import { MailTagAutoTagItem } from "@/components/inbox/MailTagAutoTagItem";
import { MobileSheet } from "@/components/mobile-shell/MobileSheet";
import { TagEditDialog } from "@/components/tags/TagEditDialog";
import {
  PressedOverlayError,
  PressedPopoverContent,
} from "@/components/ui/pressed-overlay";
import { PressedTooltip } from "@/components/ui/pressed-tooltip";
import { useTags } from "@/context/tags";
import { cn } from "@/lib/utils";
import type { CreateTagData, Tag } from "@/types/tags";

import { MAIL_ACTION_ICON_CLASS } from "./reading-pane-action-icons";

/** The tags to add to and remove from every target email. */
export interface MailTagChange {
  add: number[];
  remove: number[];
}

type TagState = "on" | "off" | "mixed";

/** Past this many tags the list gets a filter field. */
const TAG_FILTER_THRESHOLD = 8;

/** Coarse pointers get 44px rows and buttons. */
const TOUCH_TARGET = "pointer-coarse:min-h-11";

/**
 * The rows in the action group. `text-sm!` because wp-admin's unlayered
 * button font rule otherwise shrinks them a size below the tag names above.
 */
export const MAIL_TAG_ACTION_ROW = cn(
  "w-full justify-start px-1.5 text-sm!",
  TOUCH_TARGET,
);

/** The group of rows that act straight away: Create tag, Auto-tag, Remove. */
const ACTION_GROUP = "mt-1 flex flex-col border-t border-border px-1.5 py-1";

/**
 * Asks the open panel before its popover or sheet closes. Returns true when
 * the panel handled the request itself and the container should stay open:
 * a save is in flight (closing would lose its outcome), or the Remove all
 * question is open (Escape or a tap outside backs out of that question).
 */
export type MailTagCloseGuard = () => boolean;

export interface MailTagActionPanelProps {
  availableTags: Tag[];
  /** Tags every target email carries. */
  selectedTagIds: number[];
  /** Tags only some target emails carry. Shown as mixed; bulk only. */
  partialTagIds?: number[];
  /** How many target emails carry each tag. Labels the mixed rows. */
  tagCounts?: Record<number, number>;
  /** How many emails the actions touch. 1 labels the actions for one email. */
  targetCount?: number;
  /**
   * Writes the change. Throw (or reject) when it fails: the panel stays open,
   * keeps the ticks and shows the error's message above Apply.
   */
  onApplyTags: (change: MailTagChange) => void | Promise<void>;
  /** An extension's own row, drawn with the panel's other actions. */
  extraAction?: MailTagExtraAction;
  /** The work is done; the popover or sheet should close. */
  onDone: () => void;
  disabled?: boolean;
  /** The current tags are still loading; nothing can be written yet. */
  isLoading?: boolean;
  /**
   * Why nothing can be written right now (say, a select-all that reaches
   * emails the list has not loaded). Shown above the buttons, which stay
   * disabled, so nobody learns it from a failed Apply.
   */
  blockedReason?: string;
  isApplying?: boolean;
  /** The panel fills this in; the popover or sheet calls it before closing. */
  closeGuardRef?: React.MutableRefObject<MailTagCloseGuard | null>;
}

/** An extension's action row in the tag panel. */
export interface MailTagExtraAction {
  run: () => void | Promise<void>;
  /** The action is working now. */
  running: boolean;
  disabled: boolean;
}

export interface MailTagActionPopoverProps extends Omit<
  MailTagActionPanelProps,
  "onDone" | "closeGuardRef"
> {
  trigger: React.ReactElement<{
    onClick?: (event: React.MouseEvent<HTMLElement>) => void;
    disabled?: boolean;
  }>;
  onOpenChange?: (open: boolean) => void | Promise<void>;
  align?: "start" | "center" | "end";
  /** Tooltip for the trigger. Hidden while the popover is open. */
  tooltip?: string;
  /** Open a bottom sheet instead of a popover (phone layouts). */
  sheet?: boolean;
}

/** "Tag this email" or "Tag 3 emails". Shared with the mobile tag sheet. */
export function mailTagTitle(targetCount: number): string {
  return targetCount === 1
    ? __("Tag this email", "pressedmail")
    : sprintf(
        /* translators: %d: number of selected emails. */
        _n("Tag %d email", "Tag %d emails", targetCount, "pressedmail"),
        targetCount,
      );
}

/** A bulk tag save stopped partway because the selection or folder moved. */
export function tagApplyStoppedMessage(): string {
  return __(
    "Tag changes stopped because the selection changed. Some emails may already be updated.",
    "pressedmail",
  );
}

/**
 * Tag checklist plus its actions. The popover wraps it on desktop and the
 * mobile tag sheets render it directly, so every surface writes tags the
 * same way.
 *
 * Ticking is a draft and Apply writes it: ticked means the emails keep or
 * get the tag, unticked means they lose it. Rows that will change say so. A
 * tag some of the selected emails carry starts mixed and cycles mixed, on,
 * off, like Gmail's label menu, so a bulk apply leaves it alone unless
 * someone chose otherwise.
 *
 * The draft controls (Untick, Apply) sit together in the footer. The actions
 * that write straight away (Create tag, Auto-tag, Remove all tags) sit in
 * their own group above it, and Remove all tags asks first. While it asks,
 * that question is the only thing on the panel that acts.
 */
export function MailTagActionPanel({
  availableTags,
  selectedTagIds,
  partialTagIds = [],
  tagCounts = {},
  targetCount = 1,
  onApplyTags,
  extraAction,
  onDone,
  disabled = false,
  isLoading = false,
  blockedReason,
  isApplying = false,
  closeGuardRef,
}: MailTagActionPanelProps) {
  const { createTag, capabilities } = useTags();
  const canCreate = capabilities?.create ?? false;
  const [creating, setCreating] = React.useState(false);
  const [createError, setCreateError] = React.useState<string | null>(null);
  const [applyError, setApplyError] = React.useState<string | null>(null);
  const [confirmingRemoveAll, setConfirmingRemoveAll] = React.useState(false);
  // Which of this panel's writes is in flight, so its own button shows it.
  const [pending, setPending] = React.useState<"apply" | "remove" | null>(null);
  const [query, setQuery] = React.useState("");
  // Rows kept on screen while filtering: every row that had a pending change
  // at some point during this filter. Unticking one does not make it vanish.
  const [pinnedIds, setPinnedIds] = React.useState<ReadonlySet<number>>(
    () => new Set(),
  );
  // The one checkbox in the Tab order; arrow keys move between the rest.
  const [activeId, setActiveId] = React.useState<number | null>(null);
  const [overrides, setOverrides] = React.useState<Record<number, TagState>>(
    {},
  );
  const listRef = React.useRef<HTMLUListElement>(null);
  const createButtonRef = React.useRef<HTMLButtonElement>(null);
  const removeAllRef = React.useRef<HTMLButtonElement>(null);
  const cancelRemoveRef = React.useRef<HTMLButtonElement>(null);
  const applyRef = React.useRef<HTMLButtonElement>(null);
  const createdTagId = React.useRef<number | null>(null);
  const bodyRef = React.useRef<HTMLDivElement>(null);
  const mounted = React.useRef(true);
  const idPrefix = React.useId();

  React.useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const baseOf = (id: number): TagState =>
    selectedTagIds.includes(id)
      ? "on"
      : partialTagIds.includes(id)
        ? "mixed"
        : "off";
  // The draft outlives changes to the emails' tags underneath it (a sync, a
  // step that landed before a failure): each tick is measured against the
  // current base, so one that now matches it simply stops being a change.
  // Only "mixed" needs a guard, since it means nothing once no email is mixed.
  const stateOf = (id: number): TagState => {
    const chosen = overrides[id];
    return chosen === undefined ||
      (chosen === "mixed" && baseOf(id) !== "mixed")
      ? baseOf(id)
      : chosen;
  };
  const changed = (id: number) => stateOf(id) !== baseOf(id);

  const toggle = (id: number) => {
    const current = stateOf(id);
    const next: TagState =
      current === "on"
        ? "off"
        : current === "off" && baseOf(id) === "mixed"
          ? "mixed"
          : "on";
    setOverrides((prev) => ({ ...prev, [id]: next }));
  };

  const ids = availableTags.map((tag) => tag.id);
  const add = ids.filter((id) => stateOf(id) === "on" && baseOf(id) !== "on");
  // Unticked tags that some or all of the emails carry: Apply takes them off.
  const remove = ids.filter(
    (id) => stateOf(id) === "off" && baseOf(id) !== "off",
  );
  const changeCount = add.length + remove.length;
  // Every listed tag any of the emails carries: what Remove all tags takes
  // off. The question counts them, so it never promises more than this.
  const carried = ids.filter((id) => baseOf(id) !== "off");
  const saving = isApplying || pending !== null;
  // Nothing can write: the list is loading, saving or can't be written to.
  const busy = disabled || saving || isLoading;
  const writeBlocked = busy || Boolean(blockedReason);
  // Controls that look disabled. A save only makes the panel inert, so the
  // rows and their pending labels stay readable while it runs.
  const dimmed = disabled || isLoading || Boolean(blockedReason);
  // The draft waits while Remove all asks: one decision at a time.
  const draftLocked = dimmed || confirmingRemoveAll;
  const single = targetCount === 1;
  const typed = query.trim();
  const needle = typed.toLowerCase();
  // A row with a pending change stays listed while filtering, so Apply
  // never writes something the list is hiding.
  const visibleTags = needle
    ? availableTags.filter(
        (tag) =>
          tag.name.toLowerCase().includes(needle) ||
          changed(tag.id) ||
          pinnedIds.has(tag.id),
      )
    : availableTags;
  const visibleIds = visibleTags.map((tag) => tag.id);
  const tabStopId =
    activeId !== null && visibleIds.includes(activeId)
      ? activeId
      : (visibleIds[0] ?? null);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    setPinnedIds((prev) =>
      value.trim() === ""
        ? new Set()
        : new Set([...prev, ...ids.filter((id) => changed(id))]),
    );
  };

  const errorMessage = (error: unknown) =>
    error instanceof Error && error.message
      ? error.message
      : __("Couldn't save. Your choices are kept. Try again.", "pressedmail");

  const commit = async (
    change: MailTagChange,
    kind: "apply" | "remove",
    retryFocus: () => void,
  ) => {
    setApplyError(null);
    setPending(kind);
    try {
      await onApplyTags(change);
    } catch (error) {
      setPending(null);
      // Closed by something the guard can't stop (the list went away):
      // there is no panel left to show the error, so a toast says it.
      if (!mounted.current) {
        toast.error(errorMessage(error));
        return;
      }
      setApplyError(errorMessage(error));
      // The button was disabled while saving, which drops focus. Put it
      // back so a keyboard user can retry straight away.
      window.setTimeout(retryFocus, 0);
      return;
    }
    setPending(null);
    onDone();
  };

  const cancelRemoveAll = () => {
    setConfirmingRemoveAll(false);
    window.setTimeout(() => removeAllRef.current?.focus(), 0);
  };

  // Read on every close request, so it always sees this render's state.
  if (closeGuardRef)
    closeGuardRef.current = () => {
      if (saving) return true;
      if (confirmingRemoveAll) {
        cancelRemoveAll();
        return true;
      }
      return false;
    };

  // Inert, not disabled, while saving: nothing can be clicked or focused,
  // and nothing fades. The attribute, so React 18 and 19 treat it alike.
  React.useEffect(() => {
    bodyRef.current?.toggleAttribute("inert", saving);
  }, [saving]);

  const handleCreate = async (data: CreateTagData) => {
    try {
      setCreateError(null);
      const tag = await createTag(data);
      createdTagId.current = tag.id;
      handleQueryChange("");
      setOverrides((prev) => ({ ...prev, [tag.id]: "on" }));
      setCreating(false);
    } catch (error) {
      setCreateError(
        error instanceof Error && error.message
          ? error.message
          : __("Could not save the tag.", "pressedmail"),
      );
    }
  };

  // The dialog has no trigger, so Radix has nowhere to send focus on close.
  // Land on the new tag after a create, or back on Create tag after a cancel.
  const handleCreateCloseAutoFocus = (event: Event) => {
    event.preventDefault();
    const id = createdTagId.current;
    createdTagId.current = null;
    const created =
      id === null
        ? null
        : listRef.current?.querySelector<HTMLElement>(
            `[data-tag-id="${id}"] [role="checkbox"]`,
          );
    (created ?? createButtonRef.current)?.focus();
  };

  // Cancel has focus when the question appears, so Enter never removes.
  React.useEffect(() => {
    if (confirmingRemoveAll) cancelRemoveRef.current?.focus();
  }, [confirmingRemoveAll]);

  const boxes = () =>
    Array.from(
      listRef.current?.querySelectorAll<HTMLElement>('[role="checkbox"]') ?? [],
    );

  // The list is one Tab stop; arrow keys, Home and End walk it.
  const handleListKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    const list = boxes();
    const index = list.indexOf(document.activeElement as HTMLElement);
    if (index < 0) return;
    const target =
      event.key === "ArrowDown"
        ? (index + 1) % list.length
        : event.key === "ArrowUp"
          ? (index - 1 + list.length) % list.length
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? list.length - 1
              : null;
    if (target === null) return;
    event.preventDefault();
    list[target]?.focus();
  };

  // Offer the typed name only when no tag name contains it: offering
  // "invo" beside a matching "Invoices" invites near-duplicate tags.
  const createTyped =
    typed !== "" &&
    !availableTags.some((tag) => tag.name.toLowerCase().includes(needle));
  const createButton = canCreate ? (
    <Button
      ref={createButtonRef}
      type="button"
      variant="ghost"
      className={MAIL_TAG_ACTION_ROW}
      data-test="mail-tag-create"
      // Creating a tag writes to no email, so a blocked selection allows it.
      disabled={busy || confirmingRemoveAll}
      onClick={() => setCreating(true)}>
      <Plus aria-hidden="true" className={MAIL_ACTION_ICON_CLASS} />
      <span className="min-w-0 truncate">
        {createTyped
          ? sprintf(
              /* translators: %s: tag name typed in the filter. */
              __("Create “%s”", "pressedmail"),
              typed,
            )
          : __("Create tag", "pressedmail")}
      </span>
    </Button>
  ) : null;

  const dialog = canCreate ? (
    <TagEditDialog
      open={creating}
      onOpenChange={(open) => {
        setCreating(open);
        if (!open) setCreateError(null);
      }}
      tag={null}
      onSave={(data) => handleCreate(data as CreateTagData)}
      error={createError}
      initialName={createTyped ? typed : ""}
      onCloseAutoFocus={handleCreateCloseAutoFocus}
    />
  ) : null;

  // No tags: the same panel, with one quiet line where the list goes and
  // Create tag as its only row, the way the rule menu beside it says it has
  // no rules. Auto-tag picks from existing tags, and there is nothing to
  // untick, remove or apply, so those rows go rather than sit disabled.
  // Divs, not paragraphs: wp-admin's unlayered `p` margin outranks utilities.
  if (availableTags.length === 0) {
    return (
      <div className="flex flex-col">
        <div className="flex flex-col gap-0.5 px-3 pt-1.5 pb-1">
          <div className="py-0.5 text-sm text-muted-foreground">
            {__("No tags yet", "pressedmail")}
          </div>
          <div className="text-xs text-muted-foreground">
            {__(
              "Tags label your email so you can find and sort it later.",
              "pressedmail",
            )}
          </div>
        </div>
        {createButton ? (
          <div className={ACTION_GROUP}>{createButton}</div>
        ) : null}
        {dialog}
      </div>
    );
  }

  const removeAllLabel = sprintf(
    /* translators: %d: number of tags the selected emails carry. */
    _n(
      "Remove %d tag from these emails?",
      "Remove %d tags from these emails?",
      carried.length,
      "pressedmail",
    ),
    carried.length,
  );
  const confirmId = `${idPrefix}-remove-all`;
  const confirmNoteId = `${idPrefix}-remove-all-note`;

  // One email: unticking and applying already does this. Hidden too when
  // none of the emails has a tag.
  const removeAll =
    single || carried.length === 0 ? null : confirmingRemoveAll ? (
      <div
        role="group"
        aria-labelledby={confirmId}
        aria-describedby={changeCount > 0 ? confirmNoteId : undefined}
        className="mt-1 flex flex-col gap-2 rounded-md border border-border px-1.5 py-2">
        <div className="flex flex-col gap-0.5 px-1">
          <div id={confirmId} className="text-sm font-medium text-foreground">
            {removeAllLabel}
          </div>
          {changeCount > 0 ? (
            <div id={confirmNoteId} className="text-xs text-muted-foreground">
              {__("Your unapplied ticks are dropped.", "pressedmail")}
            </div>
          ) : null}
        </div>
        <div className="flex gap-2">
          <Button
            ref={cancelRemoveRef}
            type="button"
            variant="outline"
            className={cn("flex-1", TOUCH_TARGET)}
            data-test="mail-tag-remove-cancel"
            onClick={cancelRemoveAll}>
            {__("Cancel", "pressedmail")}
          </Button>
          <Button
            type="button"
            variant="destructive"
            className={cn("flex-1", TOUCH_TARGET)}
            data-test="mail-tag-remove-confirm"
            disabled={writeBlocked}
            onClick={() =>
              void commit({ add: [], remove: carried }, "remove", () =>
                cancelRemoveRef.current?.focus(),
              )
            }>
            {pending === "remove" ? (
              <>
                <Loader2
                  aria-hidden="true"
                  className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
                />
                {__("Removing…", "pressedmail")}
              </>
            ) : (
              __("Remove all", "pressedmail")
            )}
          </Button>
        </div>
      </div>
    ) : (
      <Button
        ref={removeAllRef}
        type="button"
        variant="ghost"
        className={cn(
          MAIL_TAG_ACTION_ROW,
          "text-destructive hover:text-destructive",
        )}
        data-test="mail-tag-remove"
        disabled={writeBlocked}
        onClick={() => {
          setApplyError(null);
          setConfirmingRemoveAll(true);
        }}>
        <Trash2 aria-hidden="true" className={MAIL_ACTION_ICON_CLASS} />
        <span className="min-w-0 truncate">
          {__("Remove all tags", "pressedmail")}
        </span>
      </Button>
    );

  const filtering = needle !== "";
  // Remove all shows its own progress; Apply only shows the draft's.
  const applyBusy = pending === "apply" || (isApplying && pending !== "remove");
  const allUnticked = visibleIds.every((id) => stateOf(id) === "off");

  return (
    <div className="flex flex-col" aria-busy={saving || undefined}>
      <div ref={bodyRef} className="flex flex-col">
        <div className="px-1.5 pt-1.5">
          {availableTags.length > TAG_FILTER_THRESHOLD ? (
            <div className="px-1.5 pb-1.5">
              <div className="relative">
                <Search
                  aria-hidden="true"
                  className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
                />
                {/* No type="search": wp-admin's unlayered search-field rule
                  sets its own padding and a 40px height, which pushed the
                  text under the icon and broke the control height. */}
                <Input
                  autoComplete="off"
                  enterKeyHint="search"
                  data-pm-tag-filter=""
                  className="pl-8"
                  disabled={confirmingRemoveAll}
                  value={query}
                  onChange={(event) => handleQueryChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key !== "ArrowDown") return;
                    event.preventDefault();
                    boxes()[0]?.focus();
                  }}
                  // The count says how far the list scrolls.
                  placeholder={sprintf(
                    /* translators: %d: number of tags. */
                    _n(
                      "Filter %d tag",
                      "Filter %d tags",
                      availableTags.length,
                      "pressedmail",
                    ),
                    availableTags.length,
                  )}
                  aria-label={__("Filter tags", "pressedmail")}
                />
              </div>
            </div>
          ) : null}
          {visibleTags.length === 0 ? (
            <div className="px-1.5 py-1.5 text-sm text-muted-foreground">
              {__("No tags match.", "pressedmail")}
            </div>
          ) : null}
          <ul
            ref={listRef}
            // Phone sheets have the height to show more rows. The scroll
            // shadows say there is more above or below.
            className="pm-scroll-shadows m-0 max-h-56 list-none overflow-y-auto p-0 pointer-coarse:max-h-[45dvh]"
            aria-label={__("Tags", "pressedmail")}
            onKeyDown={handleListKeyDown}>
            {visibleTags.map((tag) => {
              const state = stateOf(tag.id);
              const count = tagCounts[tag.id];
              const noteId = `${idPrefix}-note-${tag.id}`;
              const pending = changed(tag.id);
              // A pending change says what Apply will do; otherwise a mixed
              // row says how many of the emails carry the tag.
              const note = pending
                ? state === "on"
                  ? __("Will add", "pressedmail")
                  : __("Will remove", "pressedmail")
                : baseOf(tag.id) === "mixed" && count !== undefined && !single
                  ? sprintf(
                      /* translators: 1: emails that have the tag, 2: selected emails. */
                      __("%1$d of %2$d", "pressedmail"),
                      count,
                      targetCount,
                    )
                  : null;
              return (
                <li key={tag.id} className="m-0">
                  <label
                    data-test="mail-tag-option"
                    data-tag-id={tag.id}
                    data-state={
                      state === "on"
                        ? "checked"
                        : state === "mixed"
                          ? "indeterminate"
                          : "unchecked"
                    }
                    className={cn(
                      "flex min-h-[var(--control-height)] cursor-pointer items-center gap-2.5 rounded-md px-1.5 text-sm hover:bg-muted",
                      TOUCH_TARGET,
                      draftLocked && "cursor-not-allowed opacity-60",
                    )}>
                    <Checkbox
                      checked={state === "on"}
                      indeterminate={state === "mixed"}
                      disabled={draftLocked}
                      tabIndex={tag.id === tabStopId ? 0 : -1}
                      onFocus={() => setActiveId(tag.id)}
                      // The label wraps the hidden input, not this span, so
                      // name it directly or it reads as an unnamed checkbox.
                      aria-label={tag.name}
                      aria-describedby={note ? noteId : undefined}
                      onCheckedChange={() => {
                        setApplyError(null);
                        toggle(tag.id);
                      }}
                    />
                    <span
                      aria-hidden="true"
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                    {/* Long names wrap: a cut-off name has no way to be read
                      by keyboard or touch. The note sits under the name so
                      it never squeezes it. */}
                    <span className="flex min-w-0 flex-1 flex-col py-1">
                      <span className="[overflow-wrap:anywhere]">
                        {tag.name}
                      </span>
                      {note ? (
                        <span
                          id={noteId}
                          className={cn(
                            "text-xs tabular-nums",
                            !pending && "text-muted-foreground",
                            pending &&
                              state === "on" &&
                              "font-medium text-primary",
                            pending &&
                              state !== "on" &&
                              "font-medium text-destructive",
                          )}>
                          {note}
                        </span>
                      ) : null}
                    </span>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>

        {createButton || (!__IS_FREE__ && extraAction) || removeAll ? (
          <div className={ACTION_GROUP}>
            {createButton}
            {!__IS_FREE__ && extraAction && (
              <MailTagAutoTagItem
                onDismiss={onDone}
                onAutoTag={extraAction.run}
                disabled={
                  disabled || extraAction.disabled || confirmingRemoveAll
                }
                isAutoTagging={extraAction.running}
                className={MAIL_TAG_ACTION_ROW}
              />
            )}
            {removeAll}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-2 border-t border-border px-3 py-2">
        {applyError ? (
          <PressedOverlayError className="flex items-start gap-1.5">
            <CircleAlert
              aria-hidden="true"
              className={cn(MAIL_ACTION_ICON_CLASS, "mt-0.5 shrink-0")}
            />
            <span>{applyError}</span>
          </PressedOverlayError>
        ) : blockedReason ? (
          <div className="text-sm text-muted-foreground">{blockedReason}</div>
        ) : null}
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            className={cn("flex-1", TOUCH_TARGET)}
            data-test="mail-tag-clear"
            // Only the rows on screen: a filter never unticks what it hides,
            // and the label says so.
            disabled={writeBlocked || confirmingRemoveAll || allUnticked}
            onClick={() => {
              setApplyError(null);
              setOverrides((prev) => ({
                ...prev,
                ...Object.fromEntries(visibleIds.map((id) => [id, "off"])),
              }));
            }}>
            {filtering
              ? __("Untick shown", "pressedmail")
              : __("Untick all", "pressedmail")}
          </Button>
          <Button
            ref={applyRef}
            type="button"
            className={cn("flex-1", TOUCH_TARGET)}
            data-test="mail-tag-apply"
            disabled={writeBlocked || confirmingRemoveAll || changeCount === 0}
            onClick={() =>
              void commit({ add, remove }, "apply", () =>
                applyRef.current?.focus(),
              )
            }>
            {applyBusy && (
              <Loader2
                aria-hidden="true"
                className={cn(MAIL_ACTION_ICON_CLASS, "animate-spin")}
              />
            )}
            {applyBusy
              ? __("Applying…", "pressedmail")
              : changeCount === 0
                ? __("Apply", "pressedmail")
                : applyError
                  ? __("Try again", "pressedmail")
                  : sprintf(
                      /* translators: %d: number of tag changes to save. */
                      _n(
                        "Apply %d change",
                        "Apply %d changes",
                        changeCount,
                        "pressedmail",
                      ),
                      changeCount,
                    )}
          </Button>
        </div>
      </div>

      {dialog}
    </div>
  );
}

/**
 * The tag action for the bulk bar, the reading-pane bar and the message
 * header. A popover, not a menu: menus trap Tab and only arrow between their
 * own items, which left buttons inside them unreachable from a keyboard.
 * Escape closes it and focus returns to the trigger. On a phone it opens the
 * same panel in a bottom sheet instead.
 */
export function MailTagActionPopover({
  trigger,
  onOpenChange,
  align = "start",
  tooltip,
  sheet = false,
  disabled = false,
  targetCount = 1,
  ...panelProps
}: MailTagActionPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const titleId = React.useId();
  const title = mailTagTitle(targetCount);
  const contentRef = React.useRef<HTMLDivElement>(null);
  // Opened with a pointer, focus lands on the popover itself rather than the
  // first row, so no row looks keyboard-focused. The keyboard keeps the
  // default: focus on the first control.
  const openedByPointer = React.useRef(false);

  const closeGuardRef = React.useRef<MailTagCloseGuard | null>(null);

  const handleOpenChange = (next: boolean) => {
    setOpen(next);
    void onOpenChange?.(next);
  };

  // Escape, a click outside and the trigger all close through here. A save
  // in flight keeps the panel open so its outcome has somewhere to show, and
  // Escape inside the Remove all question only backs out of the question.
  const requestOpenChange = (next: boolean) => {
    if (!next && closeGuardRef.current?.()) return;
    handleOpenChange(next);
  };

  const panel = (
    <MailTagActionPanel
      {...panelProps}
      disabled={disabled}
      targetCount={targetCount}
      closeGuardRef={closeGuardRef}
      onDone={() => handleOpenChange(false)}
    />
  );

  if (sheet) {
    return (
      <>
        {React.cloneElement(trigger, {
          "aria-haspopup": "dialog",
          "aria-expanded": open,
          disabled: disabled || trigger.props.disabled,
          onClick: (event: React.MouseEvent<HTMLElement>) => {
            trigger.props.onClick?.(event);
            handleOpenChange(true);
          },
        } as Record<string, unknown>)}
        <MobileSheet
          open={open}
          onOpenChange={requestOpenChange}
          title={title}
          flush>
          {panel}
        </MobileSheet>
      </>
    );
  }

  const triggerElement = (
    <PopoverTrigger
      asChild
      disabled={disabled}
      onPointerDown={() => {
        openedByPointer.current = true;
      }}
      onKeyDown={() => {
        openedByPointer.current = false;
      }}>
      {trigger}
    </PopoverTrigger>
  );

  return (
    <Popover open={open} onOpenChange={requestOpenChange}>
      {/* Only the trigger sits inside the tooltip: portalled popover content
          still bubbles React events, and inside the tooltip trigger every
          pointer move in the popover reopened the tooltip over it. */}
      {tooltip ? (
        <PressedTooltip content={tooltip} side="top" suppressed={open}>
          {triggerElement}
        </PressedTooltip>
      ) : (
        triggerElement
      )}
      <PressedPopoverContent
        ref={contentRef}
        size="menu"
        align={align}
        role="dialog"
        aria-labelledby={titleId}
        data-test="mail-tag-action-popover"
        onOpenAutoFocus={(event) => {
          if (!openedByPointer.current) return;
          event.preventDefault();
          contentRef.current?.focus({ preventScroll: true });
        }}
        // Portalled content still bubbles through the React tree; keep clicks
        // here from reaching the row or pane underneath.
        onClick={(event) => event.stopPropagation()}>
        <div className="border-b border-border px-3 py-2.5">
          {/* Sized like the rule menu's label beside it. */}
          <h3 id={titleId} className="text-xs font-semibold text-foreground">
            {title}
          </h3>
        </div>
        {panel}
      </PressedPopoverContent>
    </Popover>
  );
}

export default MailTagActionPopover;
