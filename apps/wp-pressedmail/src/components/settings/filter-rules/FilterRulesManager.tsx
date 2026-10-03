"use client";

/**
 * Filter Rules Manager Component
 *
 * Main component for managing email filter rules.
 * Displays list of rules with options to add, edit, delete, and reorder.
 */

import * as React from "react";
import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  type DragEndEvent,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Plus,
  Pencil,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  ListFilter,
  Eye,
  Clock,
} from "lucide-react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  Switch,
  Skeleton,
} from "@kit/ui/plugin";
import {
  PressedAlertDialogContent,
  PressedAlertDialogHeader,
  PressedOverlayFooter,
} from "@/components/ui/pressed-overlay";
import { cn } from "@/lib/utils";
import type {
  FilterRule,
  CreateFilterRuleData,
  UpdateFilterRuleData,
} from "@/types/filter-rules";
import {
  actionTypeLabel,
  conditionFieldLabel,
  isUnimplementedAction,
  operatorLabel,
  runTriggerLabel,
} from "@/types/filter-rules";
import { useFilterRules } from "@/hooks/useFilterRules";
import { useTagsOptional } from "@/context/tags/TagsContext";
import { useSettingsHeaderAction } from "@/components/settings-ui";
import {
  proActionLabel,
  proConditionFieldLabel,
  proTriggerLabel,
  useProRulesListNotes,
  proRuleTimingNote,
} from "@/components/settings/filter-rules/pro-rule-options.active";
import { FilterRuleEditorDialog, type AccountOption } from "./FilterRuleEditor";

const fieldText = (field: string) =>
  conditionFieldLabel(field) || proConditionFieldLabel(field) || field;
const actionText = (type: string) =>
  actionTypeLabel(type) || proActionLabel(type) || type;
const triggerText = (trigger: string) =>
  runTriggerLabel(trigger) || proTriggerLabel(trigger) || trigger;
import { loadRuleFolderTrees } from "@/services/filter-rule-folder-targets";

interface FilterRulesManagerProps {
  accountId: number | null;
  accountOptions?: AccountOption[];
  sourceFilter?: "manual" | "sweep";
  allowCreate?: boolean;
  className?: string;
  /** Reports how many rules are visible, so a caller can reflect it. */
  onRuleCountChange?: (count: number) => void;
  /** Show the owner's rules of a mailbox shared with this user. */
  sharedAccountId?: number | null;
  /** A viewer sees shared rules but cannot change them. */
  readOnly?: boolean;
  /**
   * Keep Create rule out of the settings header while another tab owns it.
   * The Email Rules tab keeps this list mounted on every tab so the header,
   * and so the page, keeps one shape as the user switches tabs.
   */
  headerActionHidden?: boolean;
}

export function getNextRuleOrder(
  ruleIds: string[],
  activeId: string,
  overId: string,
): string[] {
  const oldIndex = ruleIds.indexOf(activeId);
  const newIndex = ruleIds.indexOf(overId);

  if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) {
    return ruleIds;
  }

  return arrayMove(ruleIds, oldIndex, newIndex);
}

/**
 * Fold a reorder made inside one filtered tab back into the full rule order.
 *
 * The server assigns priorities straight from the submitted list and appends
 * anything missing below it, so posting only the visible tab's ids would push
 * every rule from the other tab underneath. The visible rules keep their slots
 * in the full list; only their order inside those slots changes.
 */
export function mergeFilteredReorder(
  allRuleIds: string[],
  visibleRuleIds: string[],
  nextVisibleRuleIds: string[],
): string[] {
  const visible = new Set(visibleRuleIds);
  let cursor = 0;

  return allRuleIds.map((id) =>
    visible.has(id) ? (nextVisibleRuleIds[cursor++] ?? id) : id,
  );
}

export function FilterRulesManager(props: FilterRulesManagerProps) {
  const {
    accountId,
    accountOptions = [],
    sourceFilter,
    allowCreate = true,
    className,
    onRuleCountChange,
    readOnly = false,
    headerActionHidden = false,
  } = props;
  // Shared-inbox rules are Pro. Free reads and writes only its own rules.
  const sharedAccountId = __IS_FREE__ ? null : (props.sharedAccountId ?? null);
  const [folders, setFolders] = React.useState<
    import("@/services/interfaces").ImapFolder[]
  >([]);
  const {
    rules,
    schema,
    loading,
    error,
    errorCode,
    loadRules,
    addRule,
    editRule,
    removeRule,
    toggleRule,
    reorderRules,
  } = useFilterRules({ accountId, sharedAccountId });
  const tags = useTagsOptional()?.tags;
  // Read-only lines for what runs with these rules but is set elsewhere.
  const listNotes = useProRulesListNotes();
  const tagNames = React.useMemo(
    () => new Map((tags ?? []).map((tag) => [String(tag.id), tag.name])),
    [tags],
  );

  // Modal state
  const [showEditor, setShowEditor] = React.useState(false);
  const [editingRule, setEditingRule] = React.useState<FilterRule | null>(null);
  const [deleteConfirmRule, setDeleteConfirmRule] =
    React.useState<FilterRule | null>(null);
  const [saving, setSaving] = React.useState(false);

  // Expanded rules for viewing details
  const [expandedRules, setExpandedRules] = React.useState<Set<string>>(
    new Set(),
  );
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  );
  const visibleRules = React.useMemo(
    () =>
      rules.filter((rule) => {
        if (sourceFilter === "sweep") {
          return rule.source === "sweep";
        }

        if (sourceFilter === "manual") {
          return rule.source !== "sweep";
        }

        return true;
      }),
    [rules, sourceFilter],
  );
  // Email Rules are unlimited on every build; the only gate on creating one is
  // whether the current surface allows creation at all.
  const canCreateRule = allowCreate && !readOnly;

  // Load rules on mount
  React.useEffect(() => {
    loadRules();
  }, [loadRules]);

  React.useEffect(() => {
    onRuleCountChange?.(visibleRules.length);
  }, [onRuleCountChange, visibleRules.length]);

  React.useEffect(() => {
    if (!showEditor || accountOptions.length === 0) return;
    let cancelled = false;
    void loadRuleFolderTrees(accountOptions.map((account) => account.id)).then(
      (next) => {
        if (!cancelled) setFolders(next);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [accountOptions, showEditor]);

  React.useEffect(() => {
    if (typeof window === "undefined") return;

    const handleRulesChanged = () => {
      void loadRules();
    };

    window.addEventListener("pm-filter-rules-changed", handleRulesChanged);
    return () => {
      window.removeEventListener("pm-filter-rules-changed", handleRulesChanged);
    };
  }, [loadRules]);

  // Toggle rule expansion
  const toggleExpanded = (ruleId: string) => {
    setExpandedRules((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) {
        next.delete(ruleId);
      } else {
        next.add(ruleId);
      }
      return next;
    });
  };

  // Handle creating a new rule
  const handleCreate = React.useCallback(() => {
    if (!canCreateRule) return;

    setEditingRule(null);
    setShowEditor(true);
  }, [canCreateRule]);

  // Handle editing a rule
  const handleEdit = (rule: FilterRule) => {
    setEditingRule(rule);
    setShowEditor(true);
  };

  // Handle saving a rule
  const handleSave = async (
    data: CreateFilterRuleData | UpdateFilterRuleData,
  ) => {
    setSaving(true);
    try {
      // A failed save returns null and leaves the error on the hook. Closing the
      // editor here threw away everything the user had typed, with no way to
      // correct and resubmit it.
      const saved = editingRule
        ? await editRule(editingRule.id, data as UpdateFilterRuleData)
        : await addRule({
            ...(data as CreateFilterRuleData),
            source: sourceFilter === "sweep" ? "sweep" : "manual",
          });
      if (!saved) return;

      setShowEditor(false);
      setEditingRule(null);
      // Notify the open inbox so it re-applies the updated rule set to the
      // already-loaded messages (new mail is handled by enforcement on load).
      if (typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent("pm-filter-rules-changed"));
      }
    } finally {
      setSaving(false);
    }
  };

  // Cancel the inline editor (create or edit).
  const handleCancelEditor = () => {
    setShowEditor(false);
    setEditingRule(null);
  };

  // Handle deleting a rule
  const handleDelete = async () => {
    if (!deleteConfirmRule) return;

    await removeRule(deleteConfirmRule.id);
    setDeleteConfirmRule(null);
  };

  // Handle toggling rule enabled state
  const handleToggle = async (rule: FilterRule) => {
    await toggleRule(rule.id, !rule.enabled);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const ruleIds = visibleRules.map((rule) => rule.id);
    const nextRuleIds = getNextRuleOrder(
      ruleIds,
      String(active.id),
      String(over.id),
    );
    if (nextRuleIds === ruleIds) return;

    const changed = await reorderRules(
      mergeFilteredReorder(
        rules.map((rule) => rule.id),
        ruleIds,
        nextRuleIds,
      ),
    );
    if (changed && typeof window !== "undefined") {
      window.dispatchEvent(new CustomEvent("pm-filter-rules-changed"));
    }
  };

  // Get summary of rule conditions
  const getConditionsSummary = (rule: FilterRule): string => {
    if (rule.conditions.length === 0) {
      return __("No conditions", "pressedmail");
    }
    const firstCondition = rule.conditions[0];
    if (rule.conditions.length === 1 && firstCondition) {
      return sprintf(
        /* translators: 1: field name. 2: operator. 3: value to match. */
        __('%1$s %2$s "%3$s"', "pressedmail"),
        fieldText(firstCondition.field),
        operatorLabel(
          firstCondition.field,
          firstCondition.operator,
          schema?.fields[firstCondition.field]?.value === "number",
        ).toLowerCase(),
        String(firstCondition.value),
      );
    }
    return sprintf(
      rule.conditionLogic === "or"
        ? /* translators: %d: number of conditions. */
          _n(
            "Any of %d condition",
            "Any of %d conditions",
            rule.conditions.length,
            "pressedmail",
          )
        : /* translators: %d: number of conditions. */
          _n(
            "All of %d condition",
            "All of %d conditions",
            rule.conditions.length,
            "pressedmail",
          ),
      rule.conditions.length,
    );
  };

  const createRuleHeaderAction = React.useMemo(
    () =>
      allowCreate ? (
        <Button
          onClick={handleCreate}
          disabled={!canCreateRule}
          className="max-sm:min-h-11"
          data-test="filter-rules-create"
          data-testid="filter-rules-create">
          <Plus className="h-4 w-4 mr-2" />
          {__("Create rule", "pressedmail")}
        </Button>
      ) : null,
    [allowCreate, canCreateRule, handleCreate],
  );
  const usingSharedHeaderActions = useSettingsHeaderAction(
    !__IS_FREE__ && sharedAccountId
      ? "email-rules:create-shared"
      : "email-rules:create",
    headerActionHidden ? null : createRuleHeaderAction,
    20,
  );

  // Get summary of rule actions
  const getActionsSummary = (rule: FilterRule): string => {
    if (rule.actions.length === 0) return __("No actions", "pressedmail");
    return rule.actions.map((a) => actionText(a.type)).join(", ");
  };

  // The server flips a move_to_folder action to repair_required and disables the
  // rule when its destination folder disappears. Without this the list showed a
  // bare "Disabled" badge and the reason only surfaced inside the editor.
  const needsFolderRepair = (rule: FilterRule): boolean =>
    rule.actions.some(
      (action) =>
        action.type === "move_to_folder" &&
        typeof action.value === "object" &&
        action.value?.status === "repair_required",
    );

  const getRunTriggersSummary = (rule: FilterRule): string =>
    (rule.runTriggers ?? ["manual"]).map(triggerText).join(", ");

  const getAccountScopeBadge = (
    scopeAccountId: number,
  ): { label: string; title?: string; ariaLabel?: string } => {
    if (scopeAccountId === 0) {
      return { label: __("All accounts", "pressedmail") };
    }

    const account = accountOptions.find(
      (option) => option.id === scopeAccountId,
    );
    if (account) {
      return { label: account.email };
    }

    const title = sprintf(
      /* translators: %d: internal account id. */
      __("Account ID %d", "pressedmail"),
      scopeAccountId,
    );
    return {
      label: __("Unknown account", "pressedmail"),
      title,
      ariaLabel: sprintf(
        /* translators: %s: "Account ID 12". */
        __("Unknown account (%s)", "pressedmail"),
        title,
      ),
    };
  };

  const editorDialogProps = {
    onOpenChange: (open: boolean) => {
      if (!open) handleCancelEditor();
    },
    accountId,
    accountOptions,
    onSave: handleSave,
    onCancel: handleCancelEditor,
    saving,
    folderTree: folders,
    schema,
    readOnly,
    // Sharing is Ultimate-only: Free never locks a rule to a shared mailbox.
    ...(__IS_FREE__ ? {} : { lockedAccountId: sharedAccountId }),
    saveError: error,
    saveErrorCode: errorCode,
  };

  if (loading && visibleRules.length === 0) {
    return (
      <div className={cn("space-y-3", className)}>
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-9 w-28" />
        </div>
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
    );
  }

  return (
    <div className={cn("space-y-3", className)}>
      {/* Header */}
      {allowCreate && !usingSharedHeaderActions ? (
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold">
              {__("Auto Organize", "pressedmail")}
            </h2>
            <p className="text-sm text-muted-foreground">
              {__(
                "Rules that automatically classify incoming mail into folders. They run on new mail and when you save a rule.",
                "pressedmail",
              )}
            </p>
          </div>
          <Button
            onClick={handleCreate}
            disabled={!canCreateRule}
            data-test="filter-rules-create"
            data-testid="filter-rules-create">
            <Plus className="h-4 w-4 mr-2" />
            {__("Create rule", "pressedmail")}
          </Button>
        </div>
      ) : null}

      {/* Error message. A failed save shows inside the open dialog instead. */}
      {error && !showEditor && (
        <Card className="border-destructive bg-destructive/10">
          <CardContent className="p-3 text-destructive text-sm">
            {error}
          </CardContent>
        </Card>
      )}

      {/* Empty state (hidden while the inline create editor is open) */}
      {visibleRules.length === 0 && !loading && !showEditor && (
        <Card>
          <CardContent className="p-6 text-center">
            <ListFilter className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
            <h3 className="text-base font-medium mb-1.5">
              {sourceFilter === "sweep"
                ? __("No generated rules yet", "pressedmail")
                : __("No rules yet", "pressedmail")}
            </h3>
            <p className="text-sm text-muted-foreground mb-3">
              {sourceFilter === "sweep"
                ? __(
                    "Rules created by bulk sweep actions will appear here.",
                    "pressedmail",
                  )
                : __(
                    "Rules sort new mail into folders for you.",
                    "pressedmail",
                  )}
            </p>
            {canCreateRule ? (
              <Button
                onClick={handleCreate}
                data-test="filter-rules-create-empty"
                data-testid="filter-rules-create-empty">
                <Plus className="h-4 w-4 mr-2" />
                {__("Create your first rule", "pressedmail")}
              </Button>
            ) : null}
          </CardContent>
        </Card>
      )}

      {/* Create and edit open the rule form in the standard dialog. The test
          ids keep their old "inline-editor" names: Playwright and the QA
          inventory hold them. */}
      {editingRule ? (
        <FilterRuleEditorDialog
          key={editingRule.id}
          {...editorDialogProps}
          readOnly={
            readOnly || (!__IS_FREE__ && Boolean(editingRule.sharedLocked))
          }
          readOnlyNote={
            !__IS_FREE__ && !readOnly && editingRule.sharedLocked
              ? __(
                  "This rule has a step only the mailbox owner can change. You can turn it off or delete it.",
                  "pressedmail",
                )
              : undefined
          }
          open={showEditor}
          testId={`filter-rule-inline-editor-${editingRule.id}`}
          rule={editingRule}
        />
      ) : (
        <FilterRuleEditorDialog
          key="new"
          {...editorDialogProps}
          open={showEditor && canCreateRule}
          testId="filter-rule-inline-editor"
        />
      )}

      {sourceFilter !== "sweep" && listNotes.length > 0 ? (
        <ul className="space-y-1.5" data-test="filter-rules-list-notes">
          {listNotes.map((note) => (
            <li
              key={note.key}
              data-test={`filter-rules-note-${note.key}`}
              className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
              <span>{note.text}</span>
              <a
                href={note.href}
                className="font-medium text-primary hover:underline">
                {note.linkText}
              </a>
            </li>
          ))}
        </ul>
      ) : null}

      {/* Rules list */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={(event) => {
          void handleDragEnd(event);
        }}>
        <SortableContext
          items={visibleRules.map((rule) => rule.id)}
          strategy={verticalListSortingStrategy}>
          <div className="space-y-1.5">
            {visibleRules.map((rule) => {
              const isExpanded = expandedRules.has(rule.id);
              return (
                <SortableRuleContainer
                  key={rule.id}
                  ruleId={rule.id}
                  disabled={readOnly || showEditor || Boolean(editingRule)}>
                  {({
                    attributes,
                    listeners,
                    setActivatorNodeRef,
                    isDragging,
                  }) => {
                    const accountScope = getAccountScopeBadge(rule.accountId);

                    return (
                      <Card
                        data-test={`filter-rule-row-${rule.id}`}
                        data-testid={`filter-rule-row-${rule.id}`}
                        data-state={rule.enabled ? "on" : "off"}
                        className={cn(
                          // A dense row, not the Card's default roomy padding.
                          "gap-0 py-0 transition-colors",
                          // An off rule recedes: a muted, dashed card, not
                          // opacity (that took the name under 4.5:1).
                          !rule.enabled &&
                            "border-dashed bg-muted/50 shadow-none",
                          isDragging && "opacity-70 shadow-md",
                        )}>
                        <CardHeader className="p-3 pb-1.5">
                          <div className="flex flex-wrap items-start gap-2">
                            {readOnly ? null : (
                              <button
                                ref={setActivatorNodeRef}
                                type="button"
                                className="mt-0.5 flex h-6 w-6 flex-shrink-0 cursor-grab items-center justify-center rounded text-muted-foreground hover:bg-accent hover:text-accent-foreground active:cursor-grabbing max-sm:mt-0 max-sm:h-11"
                                data-test={`filter-rule-drag-handle-${rule.id}`}
                                data-testid={`filter-rule-drag-handle-${rule.id}`}
                                aria-label={sprintf(
                                  /* translators: %s: the rule's name. */
                                  __("Reorder rule %s", "pressedmail"),
                                  rule.name,
                                )}
                                {...attributes}
                                {...listeners}>
                                <GripVertical className="h-4 w-4" />
                              </button>
                            )}

                            {/* On a phone the name gets the whole row and the
                                controls wrap below it: next to four controls
                                it was cut to about fourteen characters. */}
                            <div className="min-w-0 flex-1 basis-0 max-sm:basis-[calc(100%-3.5rem)] max-sm:self-center">
                              <CardTitle
                                className={cn(
                                  "truncate text-sm",
                                  !rule.enabled &&
                                    "font-normal text-muted-foreground",
                                )}>
                                {rule.name}
                              </CardTitle>
                              {rule.description && (
                                <CardDescription className="text-xs mt-0.5 truncate">
                                  {rule.description}
                                </CardDescription>
                              )}
                              {/* One wrapping line of status chips, never one per line. */}
                              <div className="mt-1 flex flex-wrap items-center gap-1">
                                {!rule.enabled && (
                                  <Badge
                                    variant="outline"
                                    className="border-border text-xs text-muted-foreground">
                                    {__("Off", "pressedmail")}
                                  </Badge>
                                )}
                                {proRuleTimingNote(
                                  rule.conditions.map(
                                    (condition) => condition.field,
                                  ),
                                  rule.runTriggers ?? ["manual"],
                                ) ? (
                                  <Badge
                                    variant="outline"
                                    title={proRuleTimingNote(
                                      rule.conditions.map(
                                        (condition) => condition.field,
                                      ),
                                      rule.runTriggers ?? ["manual"],
                                    )}>
                                    <Clock
                                      className="mr-1 h-3 w-3"
                                      aria-hidden="true"
                                    />
                                    {proTriggerLabel("on_phishing_scanned")}
                                  </Badge>
                                ) : null}
                                {rule.inactiveReason ? (
                                  <span
                                    role="status"
                                    className="text-xs text-destructive">
                                    {rule.inactiveReason}
                                  </span>
                                ) : null}
                                {needsFolderRepair(rule) && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                    title={__(
                                      "The folder this rule files mail into is gone. Edit the rule and pick another one.",
                                      "pressedmail",
                                    )}
                                    data-test={`filter-rule-folder-missing-${rule.id}`}
                                    data-testid={`filter-rule-folder-missing-${rule.id}`}>
                                    {__("Folder missing", "pressedmail")}
                                  </Badge>
                                )}
                                {rule.actions.some((action) =>
                                  isUnimplementedAction(action.type),
                                ) && (
                                  <Badge
                                    variant="destructive"
                                    className="text-xs"
                                    title={__(
                                      "Won't run until you remove the action that no longer runs.",
                                      "pressedmail",
                                    )}
                                    data-test={`filter-rule-needs-attention-${rule.id}`}
                                    data-testid={`filter-rule-needs-attention-${rule.id}`}>
                                    {__("Needs attention", "pressedmail")}
                                  </Badge>
                                )}
                                {!readOnly &&
                                (__IS_FREE__ || !rule.sharedLocked) &&
                                (needsFolderRepair(rule) ||
                                  rule.actions.some((action) =>
                                    isUnimplementedAction(action.type),
                                  )) ? (
                                  <button
                                    type="button"
                                    onClick={() => handleEdit(rule)}
                                    className="rounded-sm px-1 text-xs font-medium text-foreground underline underline-offset-2 hover:no-underline max-sm:min-h-11"
                                    data-test={`filter-rule-fix-${rule.id}`}
                                    data-testid={`filter-rule-fix-${rule.id}`}>
                                    {needsFolderRepair(rule)
                                      ? __("Pick a folder", "pressedmail")
                                      : __("Fix it", "pressedmail")}
                                  </button>
                                ) : null}
                                <Badge
                                  variant="outline"
                                  // A block child truncates with an ellipsis; the
                                  // chip's own inline-flex box only clipped.
                                  className="min-w-0 max-w-full border-border text-xs text-muted-foreground"
                                  title={
                                    accountScope.title ?? accountScope.label
                                  }
                                  aria-label={accountScope.ariaLabel}
                                  data-test={`filter-rule-account-scope-${rule.id}`}
                                  data-testid={`filter-rule-account-scope-${rule.id}`}>
                                  <span className="block min-w-0 truncate">
                                    {accountScope.label}
                                  </span>
                                </Badge>
                              </div>
                            </div>

                            <div className="ml-auto flex flex-shrink-0 items-center gap-1 max-sm:w-full max-sm:justify-end max-sm:gap-0">
                              {readOnly ? null : (
                                <Switch
                                  checked={rule.enabled}
                                  onCheckedChange={() => handleToggle(rule)}
                                  // A manager may turn an owner-only rule off, never on.
                                  disabled={
                                    !__IS_FREE__ &&
                                    Boolean(rule.sharedLocked) &&
                                    !rule.enabled
                                  }
                                  className="mr-1 max-sm:mr-auto"
                                  data-test={`filter-rule-toggle-${rule.id}`}
                                  data-testid={`filter-rule-toggle-${rule.id}`}
                                  aria-label={sprintf(
                                    /* translators: %s: the rule's name. */
                                    rule.enabled
                                      ? __("Turn off rule %s", "pressedmail")
                                      : __("Turn on rule %s", "pressedmail"),
                                    rule.name,
                                  )}
                                />
                              )}
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpanded(rule.id)}
                                aria-expanded={isExpanded}
                                aria-label={sprintf(
                                  /* translators: %s: the rule's name. */
                                  isExpanded
                                    ? __("Hide details for %s", "pressedmail")
                                    : __("Show details for %s", "pressedmail"),
                                  rule.name,
                                )}
                                className="h-7 w-7 p-0 max-sm:size-11">
                                {isExpanded ? (
                                  <ChevronUp className="h-4 w-4" />
                                ) : (
                                  <ChevronDown className="h-4 w-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(rule)}
                                aria-label={sprintf(
                                  /* translators: %s: the rule's name. */
                                  readOnly ||
                                    (!__IS_FREE__ && rule.sharedLocked)
                                    ? __("View rule %s", "pressedmail")
                                    : __("Edit rule %s", "pressedmail"),
                                  rule.name,
                                )}
                                data-test={`filter-rule-edit-${rule.id}`}
                                data-testid={`filter-rule-edit-${rule.id}`}
                                className="h-7 w-7 p-0 max-sm:size-11">
                                {readOnly ||
                                (!__IS_FREE__ && rule.sharedLocked) ? (
                                  <Eye className="h-4 w-4" />
                                ) : (
                                  <Pencil className="h-4 w-4" />
                                )}
                              </Button>
                              {readOnly ? null : (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setDeleteConfirmRule(rule)}
                                  aria-label={sprintf(
                                    /* translators: %s: the rule's name. */
                                    __("Delete rule %s", "pressedmail"),
                                    rule.name,
                                  )}
                                  data-test={`filter-rule-delete-${rule.id}`}
                                  data-testid={`filter-rule-delete-${rule.id}`}
                                  className="h-7 w-7 p-0 text-muted-foreground hover:text-destructive focus-visible:text-destructive max-sm:size-11">
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </div>
                        </CardHeader>

                        <CardContent className="p-3 pt-0">
                          <div
                            className={cn(
                              "text-xs text-muted-foreground",
                              !readOnly && "ml-8",
                            )}>
                            <span>{getConditionsSummary(rule)}</span>
                            <span className="mx-1.5" aria-hidden="true">
                              →
                            </span>
                            <span className="sr-only">, </span>
                            <span>{getActionsSummary(rule)}</span>
                          </div>
                          <div
                            className={cn(
                              "mt-0.5 text-xs text-muted-foreground",
                              !readOnly && "ml-8",
                            )}
                            data-test={`filter-rule-run-triggers-${rule.id}`}
                            data-testid={`filter-rule-run-triggers-${rule.id}`}>
                            {getRunTriggersSummary(rule)}
                            {/* Timed rules are Pro. */}
                            {!__IS_FREE__ &&
                            rule.runTriggers?.includes("scheduled") &&
                            rule.scheduleIntervalMinutes
                              ? ` ${sprintf(
                                  /* translators: %d: number of minutes between runs. */
                                  _n(
                                    "(every %d minute)",
                                    "(every %d minutes)",
                                    rule.scheduleIntervalMinutes,
                                    "pressedmail",
                                  ),
                                  rule.scheduleIntervalMinutes,
                                )}`
                              : ""}
                          </div>

                          {isExpanded && (
                            <div className="ml-8 mt-3 pt-3 border-t space-y-3">
                              <div>
                                <h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                                  {rule.conditionLogic === "or"
                                    ? __(
                                        "If any condition matches",
                                        "pressedmail",
                                      )
                                    : __(
                                        "If every condition matches",
                                        "pressedmail",
                                      )}
                                </h4>
                                <div className="space-y-1">
                                  {rule.conditions.map((c, i) => (
                                    <div
                                      key={c.id}
                                      className="text-xs flex items-center gap-2">
                                      <Badge
                                        variant="outline"
                                        className="text-xs">
                                        {fieldText(c.field)}
                                      </Badge>
                                      <span className="text-xs text-muted-foreground">
                                        {operatorLabel(
                                          c.field,
                                          c.operator,
                                          schema?.fields[c.field]?.value ===
                                            "number",
                                        )}
                                      </span>
                                      {c.value !== "" ? (
                                        <span className="text-xs font-medium">
                                          "{String(c.value)}"
                                        </span>
                                      ) : null}
                                      {i < rule.conditions.length - 1 && (
                                        <span className="text-xs text-muted-foreground">
                                          {rule.conditionLogic === "or"
                                            ? __("or", "pressedmail")
                                            : __("and", "pressedmail")}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div>
                                <h4 className="text-xs font-medium uppercase text-muted-foreground mb-2">
                                  {__("Actions", "pressedmail")}
                                </h4>
                                <div className="space-y-1">
                                  {rule.actions.map((a) => (
                                    <div
                                      key={a.id}
                                      className="text-xs flex items-center gap-2">
                                      <Badge
                                        variant="secondary"
                                        className="text-xs">
                                        {actionText(a.type)}
                                      </Badge>
                                      {a.value && (
                                        <span className="font-medium">
                                          {typeof a.value !== "string"
                                            ? a.value.lastKnownPath
                                            : a.type === "add_tag" ||
                                                a.type === "remove_tag"
                                              ? (tagNames.get(a.value) ??
                                                a.value)
                                              : a.value}
                                        </span>
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>

                              <div className="text-xs text-muted-foreground">
                                {__("Created:", "pressedmail")}{" "}
                                {new Date(rule.createdAt).toLocaleDateString()}
                                {rule.stopProcessing && (
                                  <span className="ml-4">
                                    {__(
                                      "Stops further processing",
                                      "pressedmail",
                                    )}
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  }}
                </SortableRuleContainer>
              );
            })}
          </div>
        </SortableContext>
      </DndContext>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteConfirmRule}
        onOpenChange={() => setDeleteConfirmRule(null)}>
        <PressedAlertDialogContent size="confirmation">
          <PressedAlertDialogHeader
            title={__("Delete rule", "pressedmail")}
            icon={Trash2}
            tone="destructive"
            description={__(
              "Are you sure you want to delete this rule? This action cannot be undone.",
              "pressedmail",
            )}
          />
          <PressedOverlayFooter>
            <AlertDialogCancel>{__("Cancel", "pressedmail")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              data-test="filter-rule-delete-confirm"
              data-testid="filter-rule-delete-confirm"
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {__("Delete", "pressedmail")}
            </AlertDialogAction>
          </PressedOverlayFooter>
        </PressedAlertDialogContent>
      </AlertDialog>
    </div>
  );
}

type SortableRuleContainerRenderProps = Pick<
  ReturnType<typeof useSortable>,
  "attributes" | "listeners" | "setActivatorNodeRef" | "isDragging"
>;

function SortableRuleContainer({
  ruleId,
  disabled,
  children,
}: {
  ruleId: string;
  disabled?: boolean;
  children: (props: SortableRuleContainerRenderProps) => React.ReactNode;
}) {
  const {
    attributes,
    listeners,
    setActivatorNodeRef,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: ruleId, disabled });
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      {children({ attributes, listeners, setActivatorNodeRef, isDragging })}
    </div>
  );
}

export default FilterRulesManager;
