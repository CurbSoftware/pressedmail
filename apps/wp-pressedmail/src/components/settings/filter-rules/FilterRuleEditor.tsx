"use client";

/**
 * Filter Rule Editor
 *
 * The rule form: when it runs, what it matches, what it does. The fields,
 * operators, actions and triggers on offer come from the server's rule schema
 * (GET /filter-rules), so a site only ever offers what it can run: Free sees
 * the core engine, and the Pro build adds its own while those features are
 * available (their copy lives in pro-rule-options).
 *
 * FilterRuleEditor is the form (body and footer); FilterRuleEditorDialog puts
 * it in the standard dialog, the same shell as the Create tag dialog.
 */

import * as React from "react";
import {
  AlertCircle,
  FlaskConical,
  ListFilter,
  Loader2,
  Plus,
  Trash2,
} from "lucide-react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  Button,
  Checkbox,
  Dialog,
  Input,
  Label,
  NativeSelect,
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  cn,
} from "@kit/ui/plugin";
import type {
  FilterRule,
  FilterCondition,
  FilterAction,
  FilterConditionField,
  FilterOperator,
  FilterActionType,
  ConditionLogic,
  FilterRuleRunTrigger,
  FilterRuleScheduleInterval,
  FilterRuleSchema,
  FilterRuleTestResult,
  CreateFilterRuleData,
  UpdateFilterRuleData,
} from "@/types/filter-rules";
import {
  ACTION_TYPE_LABELS,
  CONDITION_FIELD_LABELS,
  DEFAULT_FILTER_RULE_TRIGGERS,
  FILTER_RULE_SCHEDULE_INTERVALS,
  FLAG_CONDITION_FIELDS,
  actionRequiresValue,
  actionTypeLabel,
  conditionFieldLabel,
  getOperatorsForField,
  isUnimplementedAction,
  operatorLabel,
  runTriggerLabel,
} from "@/types/filter-rules";
import { DateTimeSelector } from "@/components/ui/date-time-selector";
import { useUnsavedChangesGuard } from "@/components/settings-ui";
import {
  PressedDialogContent,
  PressedDialogHeader,
  PressedOverlayBody,
  PressedOverlayError,
  PressedOverlayFooter,
  revealInBody,
} from "@/components/ui/pressed-overlay";
import type { ImapFolder } from "@/services/interfaces";
import { isResolvedFilterRuleFolderTarget } from "@/services/filter-rule-folder-targets";
import { testFilterRule } from "@/services/filter-rules.service";
import { useTagsOptional } from "@/context/tags/TagsContext";
import {
  proActionHint,
  proActionLabel,
  proActionPicker,
  proActionGroups,
  proRuleConditionError,
  proRuleTimingNote,
  proConditionFieldLabel,
  proConditionMax,
  proConditionPlaceholder,
  proConditionValueLabel,
  proFieldGroups,
  proTriggerLabel,
} from "@/components/settings/filter-rules/pro-rule-options.active";
import { RuleFolderPicker } from "./RuleFolderPicker";

interface FilterRuleEditorProps {
  rule?: FilterRule;
  onSave: (data: CreateFilterRuleData | UpdateFilterRuleData) => Promise<void>;
  onCancel: () => void;
  accountId: number | null;
  accountOptions?: AccountOption[];
  saving?: boolean;
  folderTree?: ImapFolder[];
  /** What this site can build rules from. Without it the core schema applies. */
  schema?: FilterRuleSchema | null;
  /** A viewer of a shared inbox sees the rule but cannot change it. */
  readOnly?: boolean;
  /** Rules of a shared inbox are always scoped to that inbox. */
  lockedAccountId?: number | null;
  /**
   * Set to the form's guarded close, so a dialog's Escape or overlay click
   * asks about unsaved changes the same way Cancel does.
   */
  requestCloseRef?: React.MutableRefObject<(() => void) | null>;
  /** Why the last save failed, shown inside the form so it is not hidden behind the dialog. */
  saveError?: string | null;
  /** The server's code for that failure, so it can point at the part it is about. */
  saveErrorCode?: string | null;
  /** Why a rule opens read-only, shown above the form. */
  readOnlyNote?: string;
}

/** One field surface for inputs and selects side by side (selects are white, inputs were grey). */
export const RULE_FIELD_SURFACE = "bg-card dark:bg-input/30";

/** Menus with many options: open where there is room, never taller than about eight rows. */
const LONG_MENU =
  "max-h-[min(var(--radix-select-content-available-height),18rem)]";

export interface AccountOption {
  id: number;
  email: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** A stored UTC "Y-m-d H:i:s" (or ISO) time as a local date, or "" when it is not one. */
function shortDate(value: string): string {
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  const date = new Date(iso);
  return value && !Number.isNaN(date.getTime())
    ? date.toLocaleDateString()
    : "";
}

function isAbsoluteDateOperator(operator: string): boolean {
  return operator === "before" || operator === "after" || operator === "on";
}

/**
 * The schema this build offers when the server did not send one: every core
 * field and action, and the triggers this edition can run.
 */
export function coreRuleSchema(): FilterRuleSchema {
  const fields: FilterRuleSchema["fields"] = {};
  for (const field of Object.keys(
    CONDITION_FIELD_LABELS,
  ) as FilterConditionField[]) {
    fields[field] = {
      operators: getOperatorsForField(field),
      value: FLAG_CONDITION_FIELDS.includes(field)
        ? "none"
        : field === "size"
          ? "number"
          : field === "tag" || field === "account"
            ? "id"
            : field === "date"
              ? "date"
              : "text",
    };
  }
  const actions: FilterRuleSchema["actions"] = {};
  for (const type of Object.keys(ACTION_TYPE_LABELS) as FilterActionType[]) {
    if (isUnimplementedAction(type)) continue;
    actions[type] = {
      terminal: [
        "move_to_folder",
        "move_to_trash",
        "archive",
        "delete",
        "never_spam",
        "always_spam",
      ].includes(type),
    };
  }
  return {
    fields,
    actions,
    triggers: __IS_PRO__
      ? ["manual", "on_receive", "scheduled"]
      : ["manual", "on_receive"],
  };
}

function fieldLabel(field: string): string {
  return conditionFieldLabel(field) || proConditionFieldLabel(field) || field;
}

function actionLabel(type: string): string {
  return actionTypeLabel(type) || proActionLabel(type) || type;
}

function triggerLabel(trigger: string): string {
  // Timed rules are Pro; Free compiles the label out with the trigger.
  if (!__IS_FREE__ && trigger === "scheduled") {
    return __("On a schedule", "pressedmail");
  }
  return runTriggerLabel(trigger) || proTriggerLabel(trigger) || trigger;
}

/** Fields in reading order: who and what, status, where, then everything else. */
const FIELD_ORDER = [
  "from",
  "to",
  "cc",
  "bcc",
  "reply_to",
  "subject",
  "body",
  "list_id",
  "has_attachment",
  "size",
  "date",
  "tag",
  "is_read",
  "is_starred",
  "is_important",
  "folder",
  "account",
];

/** The field menu, grouped so seventeen fields do not read as one flat list. */
const FIELD_GROUPS: Array<{
  id: string;
  label: () => string;
  fields: string[];
}> = [
  {
    id: "people",
    label: () => __("People", "pressedmail"),
    fields: ["from", "to", "cc", "bcc", "reply_to"],
  },
  {
    id: "content",
    label: () => __("Content", "pressedmail"),
    fields: ["subject", "body", "list_id", "has_attachment", "size", "date"],
  },
  {
    id: "status",
    label: () => __("Status", "pressedmail"),
    fields: ["tag", "is_read", "is_starred", "is_important"],
  },
  {
    id: "where",
    label: () => __("Where", "pressedmail"),
    fields: ["folder", "account"],
  },
];

/** The action menu, grouped the same way, so seventeen actions do not read as one flat list. */
const ACTION_GROUPS: Array<{
  id: string;
  label: () => string;
  actions: string[];
}> = [
  {
    id: "move",
    label: () => __("Move", "pressedmail"),
    actions: ["move_to_folder", "archive", "move_to_trash", "delete"],
  },
  {
    id: "spam",
    label: () => __("Junk", "pressedmail"),
    actions: ["always_spam", "never_spam"],
  },
  {
    id: "mark",
    label: () => __("Mark", "pressedmail"),
    actions: [
      "mark_as_read",
      "mark_as_unread",
      "mark_as_starred",
      "mark_as_important",
    ],
  },
  {
    id: "tags",
    label: () => __("Tags", "pressedmail"),
    actions: ["add_tag", "remove_tag"],
  },
];

/**
 * Radix Select inside a form reports "" through onValueChange when its
 * options change under a value it has not registered yet (its hidden native
 * select loses the value). That wiped a condition's operator every time the
 * field changed, so a real choice is never "".
 */
export function onPicked(
  handler: (value: string) => void,
): (value: string) => void {
  return (value) => {
    if (value !== "") handler(value);
  };
}

/** A tag's colour, as the inbox chips show it. */
function TagDot({ color }: { color?: string }) {
  return (
    <span
      aria-hidden="true"
      className="mr-2 inline-block h-2.5 w-2.5 shrink-0 rounded-full border border-border align-middle"
      style={{ backgroundColor: color || "transparent" }}
    />
  );
}

function orderedKeys(keys: string[], order: string[]): string[] {
  return [...keys].sort((left, right) => {
    const a = order.indexOf(left);
    const b = order.indexOf(right);
    return (a < 0 ? order.length : a) - (b < 0 ? order.length : b);
  });
}

/** Folder paths of one account (or every account for 0), for the folder condition. */
/**
 * Folder paths a condition can name, with the name people see in the sidebar.
 * The value stays the server path, which is what the condition compares.
 */
function folderPaths(
  folders: ImapFolder[],
  accountId: number,
): Map<string, string> {
  const labels = new Map<string, string>();
  const visit = (nodes: ImapFolder[], parents: string[]) => {
    for (const folder of nodes) {
      const path = String(
        folder.imapPath ?? folder.imap_path ?? folder.path ?? "",
      );
      const name =
        path.toUpperCase() === "INBOX"
          ? __("Inbox", "pressedmail")
          : String(folder.name || path);
      const crumbs = [...parents, name];
      // A parent the server cannot hold mail in (Gmail's [Gmail]) is no choice.
      if (
        path &&
        folder.selectable !== false &&
        (accountId === 0 || folder.accountId === accountId) &&
        !labels.has(path)
      ) {
        labels.set(path, crumbs.join(" / "));
      }
      visit(folder.children ?? [], crumbs);
    }
  };
  visit(folders, []);
  return new Map([...labels].sort((a, b) => a[1].localeCompare(b[1])));
}

export function FilterRuleEditor({
  rule,
  onSave,
  onCancel,
  accountId,
  accountOptions = [],
  saving = false,
  folderTree = [],
  schema,
  readOnly = false,
  requestCloseRef,
  saveError = null,
  saveErrorCode = null,
  readOnlyNote,
  ...sharedInboxProps
}: FilterRuleEditorProps) {
  // Shared-inbox rules are Ultimate-only: the Free build never locks a rule.
  const lockedAccountId: number | null = __IS_FREE__
    ? null
    : (sharedInboxProps.lockedAccountId ?? null);
  const isEditing = !!rule;
  const offered = React.useMemo(() => schema ?? coreRuleSchema(), [schema]);
  const tags = useTagsOptional()?.tags ?? [];

  // Form state
  const [name, setName] = React.useState(rule?.name || "");
  const [description, setDescription] = React.useState(rule?.description || "");
  const [enabled, setEnabled] = React.useState(rule?.enabled ?? true);
  const [ruleAccountId, setRuleAccountId] = React.useState(
    lockedAccountId ?? rule?.accountId ?? accountId ?? 0,
  );
  const [conditions, setConditions] = React.useState<FilterCondition[]>(
    rule?.conditions || [],
  );
  const [conditionLogic, setConditionLogic] = React.useState<ConditionLogic>(
    rule?.conditionLogic || "and",
  );
  const [actions, setActions] = React.useState<FilterAction[]>(
    rule?.actions || [],
  );
  const [stopProcessing, setStopProcessing] = React.useState(
    rule?.stopProcessing ?? false,
  );
  // A trigger this site does not offer (a Pro trigger on Free, say) would be
  // an automatic run the user cannot see or untick. The server drops it on
  // save anyway.
  const storedRunTriggers = (
    rule?.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS
  ).filter((trigger) => offered.triggers.includes(trigger));
  const [runTriggers, setRunTriggers] =
    React.useState<FilterRuleRunTrigger[]>(storedRunTriggers);
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] =
    React.useState<FilterRuleScheduleInterval | null>(
      __IS_FREE__ ? null : (rule?.scheduleIntervalMinutes ?? null),
    );
  const [testResult, setTestResult] =
    React.useState<FilterRuleTestResult | null>(null);
  const [testError, setTestError] = React.useState<string | null>(null);
  const [testing, setTesting] = React.useState(false);
  // Value boxes the user has left, so a blank one is marked where it is.
  const [touchedValues, setTouchedValues] = React.useState<Set<string>>(
    () => new Set(),
  );
  // Set by the footer's "Show me": every blank field turns red at once and the
  // first one is scrolled to and focused.
  const [revealInvalid, setRevealInvalid] = React.useState(false);
  const formRef = React.useRef<HTMLFormElement>(null);
  const touchValue = (id: string) =>
    setTouchedValues((current) =>
      current.has(id) ? current : new Set(current).add(id),
    );
  const blankConditionValue = (condition: FilterCondition): boolean =>
    offered.fields[condition.field]?.value !== "none" &&
    !FLAG_CONDITION_FIELDS.includes(condition.field) &&
    String(condition.value ?? "").trim() === "";
  const showsBlank = (condition: FilterCondition): boolean =>
    (revealInvalid || touchedValues.has(condition.id)) &&
    blankConditionValue(condition);
  const conditionErrorId = (condition: FilterCondition) =>
    `filter-rule-condition-error-${condition.id}`;
  const actionNeedsChoice = (action: FilterAction): boolean =>
    action.type === "move_to_folder"
      ? !(ruleAccountId > 0 && isResolvedFilterRuleFolderTarget(action.value))
      : (actionRequiresValue(action.type) ||
          proActionPicker(action.type) !== null) &&
        !(typeof action.value === "string" && action.value !== "");

  const initialSnapshot = React.useMemo(
    () =>
      JSON.stringify({
        name: rule?.name || "",
        description: rule?.description || "",
        enabled: rule?.enabled ?? true,
        ruleAccountId: lockedAccountId ?? rule?.accountId ?? accountId ?? 0,
        conditions: rule?.conditions || [],
        conditionLogic: rule?.conditionLogic || "and",
        actions: rule?.actions || [],
        stopProcessing: rule?.stopProcessing ?? false,
        runTriggers: storedRunTriggers,
        // Timed rules are Pro; Free has no interval to track.
        ...(__IS_FREE__
          ? null
          : { scheduleIntervalMinutes: rule?.scheduleIntervalMinutes ?? null }),
      }),
    [accountId, rule, lockedAccountId],
  );
  const currentSnapshot = JSON.stringify({
    name,
    description,
    enabled,
    ruleAccountId,
    conditions,
    conditionLogic,
    actions,
    stopProcessing,
    runTriggers,
    ...(__IS_FREE__ ? null : { scheduleIntervalMinutes }),
  });
  const { guardedAction, guardDialog } = useUnsavedChangesGuard({
    dirty: !readOnly && currentSnapshot !== initialSnapshot,
  });
  React.useEffect(() => {
    if (!requestCloseRef) return;
    requestCloseRef.current = () => guardedAction(onCancel);
    return () => {
      requestCloseRef.current = null;
    };
  }, [requestCloseRef, guardedAction, onCancel]);

  const fieldKeys = orderedKeys(Object.keys(offered.fields), FIELD_ORDER);
  const fieldGroups = (() => {
    const groups = [
      ...FIELD_GROUPS.map((group) => ({ ...group, label: group.label() })),
      ...proFieldGroups(),
    ];
    const grouped = groups.map((group) => ({
      id: group.id,
      label: group.label,
      fields: fieldKeys.filter((field) => group.fields.includes(field)),
    }));
    // A field a newer extension adds joins the last group rather than vanishing.
    const known = new Set(groups.flatMap((group) => group.fields));
    const other = fieldKeys.filter((field) => !known.has(field));
    if (other.length > 0) {
      grouped.push({
        id: "more",
        label: __("More", "pressedmail"),
        fields: other,
      });
    }
    return grouped.filter((group) => group.fields.length > 0);
  })();
  const actionKeys = Object.keys(offered.actions);
  const actionGroupsFor = (current: string) => {
    const keys =
      current === "" || actionKeys.includes(current)
        ? actionKeys
        : [...actionKeys, current];
    const groups = [
      ...ACTION_GROUPS.map((group) => ({ ...group, label: group.label() })),
      ...proActionGroups(),
    ];
    const grouped = groups.map((group) => ({
      id: group.id,
      label: group.label,
      actions: group.actions.filter((type) => keys.includes(type)),
    }));
    // An action a newer extension adds, or a legacy one an older rule holds.
    const known = new Set(groups.flatMap((group) => group.actions));
    const other = keys.filter((type) => !known.has(type));
    if (other.length > 0) {
      grouped.push({
        id: "more",
        label: __("More", "pressedmail"),
        actions: other,
      });
    }
    return grouped.filter((group) => group.actions.length > 0);
  };
  const offeredFolderPaths = React.useMemo(
    () => folderPaths(folderTree, ruleAccountId),
    [folderTree, ruleAccountId],
  );
  const accountLabels = React.useMemo(
    () => new Map(accountOptions.map((account) => [account.id, account.email])),
    [accountOptions],
  );

  const operatorsFor = (field: string): string[] =>
    offered.fields[field]?.operators ??
    getOperatorsForField(field as FilterConditionField);

  const addCondition = () => {
    setConditions((prev) => [
      ...prev,
      { id: generateId(), field: "from", operator: "contains", value: "" },
    ]);
    setTestResult(null);
    setTestError(null);
  };

  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions((prev) =>
      prev.map((condition) => {
        if (condition.id !== id) return condition;
        const updated = { ...condition, ...updates };
        // A new field starts from its first comparison and an empty value,
        // so switching Folder to Subject never keeps "Is" as "Equals exactly".
        if (updates.field && updates.field !== condition.field) {
          updated.operator = (operatorsFor(updates.field)[0] ??
            "contains") as FilterOperator;
          updated.value = "";
        }
        return updated;
      }),
    );
    setTestResult(null);
    setTestError(null);
  };

  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
    setTestResult(null);
    setTestError(null);
  };

  // A new action starts empty: defaulting to Archive armed a mutating step
  // the user never picked.
  const addAction = () => {
    setActions((prev) => [
      ...prev,
      { id: generateId(), type: "" as FilterActionType },
    ]);
  };

  const updateAction = (id: string, updates: Partial<FilterAction>) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };

  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (readOnly || !isValid) return;
    const normalizedTriggers =
      runTriggers.length > 0 ? runTriggers : DEFAULT_FILTER_RULE_TRIGGERS;

    const data: CreateFilterRuleData | UpdateFilterRuleData = {
      name,
      description: description || undefined,
      enabled,
      // Ids ride along so a save that changes nothing stores the same rule,
      // and runs already queued against it keep going.
      conditions,
      conditionLogic,
      actions,
      stopProcessing,
      accountId: ruleAccountId,
      runTriggers: normalizedTriggers,
      ...(__IS_FREE__
        ? null
        : {
            scheduleIntervalMinutes: normalizedTriggers.includes("scheduled")
              ? (scheduleIntervalMinutes ?? 60)
              : null,
          }),
    };

    await onSave(data);
  };

  // What Try it sends. The fields stay editable while it runs, so an answer
  // for a draft that has since changed is dropped, not shown as current.
  const testDraft = JSON.stringify([
    conditions.map(({ id: _, ...rest }) => rest),
    conditionLogic,
    ruleAccountId,
  ]);
  const testDraftRef = React.useRef(testDraft);
  testDraftRef.current = testDraft;

  const runTest = async () => {
    const draft = testDraft;
    setTesting(true);
    setTestError(null);
    try {
      const result = await testFilterRule(
        {
          conditions: conditions.map(({ id: _, ...rest }) => rest),
          conditionLogic,
          accountId: ruleAccountId,
        },
        lockedAccountId,
      );
      if (testDraftRef.current === draft) setTestResult(result);
    } catch (err) {
      if (testDraftRef.current !== draft) return;
      setTestResult(null);
      setTestError(
        err instanceof Error
          ? err.message
          : __(
              "Couldn't try this rule just now. Press Try it again in a moment.",
              "pressedmail",
            ),
      );
    } finally {
      setTesting(false);
    }
  };

  const hasValidMoveTargets = actions.every(
    (action) =>
      action.type !== "move_to_folder" ||
      (ruleAccountId > 0 && isResolvedFilterRuleFolderTarget(action.value)),
  );
  const hasActionValues = actions.every(
    (action) =>
      action.type === "move_to_folder" ||
      (!actionRequiresValue(action.type) &&
        proActionPicker(action.type) === null) ||
      (typeof action.value === "string" && action.value !== ""),
  );
  const hasActionTypes = actions.every(
    (action) => (action.type as string) !== "",
  );
  const hasOperators = conditions.every((condition) =>
    operatorsFor(condition.field).includes(condition.operator),
  );
  const hasConditionValues = conditions.every(
    (condition) =>
      offered.fields[condition.field]?.value === "none" ||
      FLAG_CONDITION_FIELDS.includes(condition.field) ||
      String(condition.value ?? "").trim() !== "",
  );
  const hasAutomaticTrigger = runTriggers.some(
    (trigger) => trigger !== "manual",
  );
  const hasLegacyAction = actions.some((action) =>
    isUnimplementedAction(action.type),
  );
  const automaticRuleUnavailable = hasAutomaticTrigger && hasLegacyAction;
  const securityRuleError = proRuleConditionError(
    conditions.map((condition) => condition.field),
    conditionLogic,
  );
  const timingNote = proRuleTimingNote(
    conditions.map((condition) => condition.field),
    runTriggers,
  );
  const isValid =
    name.trim() &&
    conditions.length > 0 &&
    hasOperators &&
    actions.length > 0 &&
    hasActionTypes &&
    hasValidMoveTargets &&
    hasActionValues &&
    hasConditionValues &&
    !automaticRuleUnavailable &&
    !securityRuleError;

  // Why Save is off, in the order the form asks for things.
  const missing: string[] = isValid
    ? []
    : [
        securityRuleError || null,
        !name.trim() ? __("add a name", "pressedmail") : null,
        conditions.length === 0 ? __("add a condition", "pressedmail") : null,
        !hasOperators
          ? __("pick a comparison for every condition", "pressedmail")
          : null,
        !hasConditionValues
          ? __("fill in every condition", "pressedmail")
          : null,
        actions.length === 0 ? __("add an action", "pressedmail") : null,
        !hasActionTypes
          ? __("pick what every action does", "pressedmail")
          : null,
        !hasValidMoveTargets
          ? __("pick a folder to move mail to", "pressedmail")
          : null,
        !hasActionValues ? __("finish every action", "pressedmail") : null,
        automaticRuleUnavailable
          ? __("remove the action that no longer runs", "pressedmail")
          : null,
      ].filter((item): item is string => item !== null);

  const toggleRunTrigger = (
    trigger: FilterRuleRunTrigger,
    checked: boolean,
  ) => {
    setRunTriggers((current) => {
      const next = checked
        ? Array.from(new Set([...current, trigger]))
        : current.filter((value) => value !== trigger);
      if (
        !__IS_FREE__ &&
        trigger === "scheduled" &&
        checked &&
        scheduleIntervalMinutes === null
      ) {
        setScheduleIntervalMinutes(60);
      }
      if (!__IS_FREE__ && trigger === "scheduled" && !checked) {
        setScheduleIntervalMinutes(null);
      }
      return next;
    });
  };

  const renderConditionValue = (condition: FilterCondition, index: number) => {
    const kind = offered.fields[condition.field]?.value;
    const label = sprintf(
      /* translators: %d: condition number. */
      __("Condition %d value", "pressedmail"),
      index + 1,
    );
    const testId = `filter-rule-condition-value-${condition.id}`;
    if (kind === "none" || FLAG_CONDITION_FIELDS.includes(condition.field)) {
      return null;
    }
    if (kind === "enum") {
      return (
        <NativeSelect
          className="w-full"
          aria-label={label}
          data-testid={testId}
          disabled={readOnly}
          value={String(condition.value ?? "")}
          onChange={(event) =>
            updateCondition(condition.id, { value: event.target.value })
          }
          onBlur={() => touchValue(condition.id)}>
          <option value="">
            {__("Pick a value from the list.", "pressedmail")}
          </option>
          {(offered.fields[condition.field]?.options ?? []).map((option) => (
            <option key={option} value={option}>
              {proConditionValueLabel(condition.field, option)}
            </option>
          ))}
        </NativeSelect>
      );
    }
    if ((condition.field === "tag" || condition.field === "ai_tag")) {
      return (
        <Select
          value={String(condition.value || "")}
          disabled={readOnly}
          onValueChange={onPicked((value) =>
            updateCondition(condition.id, { value }),
          )}
          onOpenChange={(open) => {
            if (!open) touchValue(condition.id);
          }}>
          <SelectTrigger
            aria-label={label}
            aria-invalid={showsBlank(condition) || undefined}
            aria-describedby={
              showsBlank(condition) ? conditionErrorId(condition) : undefined
            }
            data-test={testId}
            data-testid={testId}
            className={RULE_FIELD_SURFACE}>
            <SelectValue
              placeholder={
                tags.length > 0
                  ? __("Choose a tag", "pressedmail")
                  : __("No tags yet", "pressedmail")
              }
            />
          </SelectTrigger>
          <SelectContent>
            {tags.map((tag) => (
              <SelectItem key={tag.id} value={String(tag.id)}>
                <TagDot color={tag.color} />
                {tag.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (condition.field === "account") {
      return (
        <Select
          value={String(condition.value || "")}
          disabled={readOnly}
          onValueChange={onPicked((value) =>
            updateCondition(condition.id, { value }),
          )}
          onOpenChange={(open) => {
            if (!open) touchValue(condition.id);
          }}>
          <SelectTrigger
            aria-label={label}
            aria-invalid={showsBlank(condition) || undefined}
            aria-describedby={
              showsBlank(condition) ? conditionErrorId(condition) : undefined
            }
            data-test={testId}
            data-testid={testId}
            className={RULE_FIELD_SURFACE}>
            <SelectValue placeholder={__("Choose an account", "pressedmail")} />
          </SelectTrigger>
          <SelectContent>
            {accountOptions.map((account) => (
              <SelectItem key={account.id} value={String(account.id)}>
                {account.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    if (
      condition.field === "date" &&
      isAbsoluteDateOperator(condition.operator)
    ) {
      return (
        <DateTimeSelector
          id={`filter-rule-date-condition-${condition.id}`}
          mode="date"
          value={String(condition.value || "")}
          onChange={(value) => updateCondition(condition.id, { value })}
          data-test={`filter-rule-date-condition-${condition.id}`}
          data-testid={`filter-rule-date-condition-${condition.id}`}
        />
      );
    }
    if (
      condition.field === "folder" &&
      (condition.operator === "equals" ||
        condition.operator === "not_equals") &&
      offeredFolderPaths.size > 0
    ) {
      const current = String(condition.value || "");
      const paths =
        current && !offeredFolderPaths.has(current)
          ? [current, ...offeredFolderPaths.keys()]
          : [...offeredFolderPaths.keys()];
      return (
        <Select
          value={current}
          disabled={readOnly}
          onValueChange={onPicked((value) =>
            updateCondition(condition.id, { value }),
          )}
          onOpenChange={(open) => {
            if (!open) touchValue(condition.id);
          }}>
          <SelectTrigger
            aria-label={label}
            aria-invalid={showsBlank(condition) || undefined}
            aria-describedby={
              showsBlank(condition) ? conditionErrorId(condition) : undefined
            }
            data-test={testId}
            data-testid={testId}
            className={RULE_FIELD_SURFACE}>
            <SelectValue placeholder={__("Choose a folder", "pressedmail")} />
          </SelectTrigger>
          <SelectContent>
            {paths.map((path) => (
              <SelectItem key={path} value={path}>
                {offeredFolderPaths.get(path) ?? path}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }
    const numeric =
      kind === "number" ||
      (condition.field === "date" &&
        !isAbsoluteDateOperator(condition.operator));
    const listId =
      condition.field === "folder"
        ? `filter-rule-folders-${condition.id}`
        : undefined;
    return (
      <>
        <Input
          autoComplete="off"
          type={numeric ? "number" : "text"}
          inputMode={numeric ? "numeric" : undefined}
          min={numeric ? 0 : undefined}
          max={proConditionMax(condition.field)}
          aria-label={label}
          list={listId}
          readOnly={readOnly}
          value={String(condition.value)}
          onChange={(e) =>
            updateCondition(condition.id, { value: e.target.value })
          }
          onBlur={() => touchValue(condition.id)}
          aria-invalid={showsBlank(condition) || undefined}
          aria-describedby={
            showsBlank(condition) ? conditionErrorId(condition) : undefined
          }
          placeholder={
            condition.field === "size"
              ? __("Size in bytes", "pressedmail")
              : condition.field === "date"
                ? __("Days", "pressedmail")
                : condition.field === "folder"
                  ? __("Folder path, such as INBOX/Receipts", "pressedmail")
                  : proConditionPlaceholder(condition.field) ||
                    __("Value to match", "pressedmail")
          }
          data-test={testId}
          data-testid={testId}
          className={RULE_FIELD_SURFACE}
        />
        {listId ? (
          <datalist id={listId}>
            {[...offeredFolderPaths].map(([path, name]) => (
              <option key={path} value={path} label={name} />
            ))}
          </datalist>
        ) : null}
      </>
    );
  };

  const renderActionValue = (action: FilterAction, index: number) => {
    const label = sprintf(
      /* translators: %d: action number. */
      __("Action %d value", "pressedmail"),
      index + 1,
    );
    const testId = `filter-rule-action-value-${action.id}`;
    if (action.type === "move_to_folder") {
      return (
        <RuleFolderPicker
          folders={folderTree}
          accountId={ruleAccountId}
          accountLabels={accountLabels}
          value={action.value}
          onChange={(value) => updateAction(action.id, { value })}
          data-test={`filter-rule-action-folder-${action.id}`}
          data-testid={`filter-rule-action-folder-${action.id}`}
        />
      );
    }
    const usesTag = action.type === "add_tag" || action.type === "remove_tag";
    const proPicker = usesTag
      ? null
      : proActionPicker(action.type);
    const choices: Array<{
      value: string;
      label: string;
      color?: string;
    }> | null = usesTag
      ? tags.map((tag) => ({
          value: String(tag.id),
          label: tag.name,
          color: tag.color,
        }))
      : (proPicker?.choices ?? null);
    if (choices === null) return null;
    return (
      <Select
        value={typeof action.value === "string" ? action.value : ""}
        disabled={readOnly}
        onValueChange={onPicked((value) => updateAction(action.id, { value }))}>
        <SelectTrigger
          aria-label={label}
          aria-invalid={
            (revealInvalid && actionNeedsChoice(action)) || undefined
          }
          data-test={testId}
          data-testid={testId}
          className={RULE_FIELD_SURFACE}>
          <SelectValue
            placeholder={
              proPicker?.placeholder ?? __("Choose a tag", "pressedmail")
            }
          />
        </SelectTrigger>
        <SelectContent>
          {choices.map((choice) => (
            <SelectItem key={choice.value} value={choice.value}>
              {"color" in choice ? <TagDot color={choice.color} /> : null}
              {choice.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  };

  const sectionTitle = "text-sm font-semibold text-foreground";

  // Save is off and the reason may be off screen: mark every blank field and
  // take the user to the first thing in the way.
  const showFirstBlocker = () => {
    setRevealInvalid(true);
    window.requestAnimationFrame(() => {
      const target = formRef.current?.querySelector<HTMLElement>(
        '[aria-invalid="true"], [data-rule-blocker="true"]',
      );
      if (!target) return;
      revealInBody(target);
      const focusable = target.matches("input, button, textarea")
        ? target
        : target.querySelector<HTMLElement>("button, input, textarea");
      focusable?.focus({ preventScroll: true });
    });
  };

  // A refused save points at the part it is about, not only the footer.
  const errorSection: "account" | "when" | "if" | "then" | null = !saveError
    ? null
    : saveErrorCode === "invalid_account" ||
        saveErrorCode === "account_access_denied"
      ? "account"
      : saveErrorCode === "automatic_rule_not_supported"
        ? "when"
        : saveErrorCode === "invalid_conditions" ||
            saveErrorCode === "invalid_rule_criteria"
          ? "if"
          : saveErrorCode === "invalid_actions"
            ? "then"
            : null;
  React.useEffect(() => {
    if (!errorSection) return;
    const section = formRef.current?.querySelector<HTMLElement>(
      `[data-rule-section="${errorSection}"]`,
    );
    if (!section) return;
    revealInBody(section);
    section
      .querySelector<HTMLElement>(
        "button:not(:disabled), input:not(:disabled), textarea:not(:disabled)",
      )
      ?.focus({ preventScroll: true });
  }, [errorSection, saveError]);
  const sectionError = (section: typeof errorSection) =>
    errorSection === section ? (
      <PressedOverlayError
        className="flex items-start gap-1.5 text-xs"
        data-test="filter-rule-section-error"
        data-testid="filter-rule-section-error">
        <AlertCircle
          className="mt-px h-3.5 w-3.5 shrink-0"
          aria-hidden="true"
        />
        <span>{saveError}</span>
      </PressedOverlayError>
    ) : null;

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="flex min-h-0 flex-1 flex-col">
      {guardDialog}
      <PressedOverlayBody className="min-h-0 flex-1 space-y-5 overflow-y-auto">
        {readOnlyNote ? (
          <p
            className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm text-muted-foreground"
            data-test="filter-rule-read-only-note"
            data-testid="filter-rule-read-only-note">
            {readOnlyNote}
          </p>
        ) : null}
        <fieldset disabled={readOnly} className="min-w-0 space-y-5">
          <div className="space-y-3">
            <div
              className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] md:items-start"
              data-test="filter-rule-basic-row"
              data-testid="filter-rule-basic-row">
              <div className="space-y-1.5">
                <Label htmlFor="rule-name">{__("Name", "pressedmail")}</Label>
                <Input
                  autoComplete="off"
                  id="rule-name"
                  data-test="filter-rule-name"
                  data-testid="filter-rule-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={__(
                    "For example: Receipts to one folder",
                    "pressedmail",
                  )}
                  aria-invalid={(revealInvalid && !name.trim()) || undefined}
                  className={RULE_FIELD_SURFACE}
                  required
                />
              </div>

              <div className="space-y-1.5" data-rule-section="account">
                <Label htmlFor="filter-rule-account-scope">
                  {__("Applies to", "pressedmail")}
                </Label>
                <Select
                  value={String(ruleAccountId)}
                  disabled={readOnly || lockedAccountId !== null}
                  onValueChange={(value) => {
                    setRuleAccountId(Number(value));
                    setActions((current) =>
                      current.map((action) =>
                        action.type === "move_to_folder"
                          ? { ...action, value: undefined }
                          : action,
                      ),
                    );
                    setTestResult(null);
                    setTestError(null);
                  }}>
                  <SelectTrigger
                    id="filter-rule-account-scope"
                    aria-describedby={
                      !__IS_FREE__ && lockedAccountId !== null
                        ? "filter-rule-account-locked"
                        : undefined
                    }
                    data-test="filter-rule-account-scope"
                    data-testid="filter-rule-account-scope"
                    className={RULE_FIELD_SURFACE}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="0"
                      disabled={actions.some(
                        (action) => action.type === "move_to_folder",
                      )}>
                      {__("All accounts", "pressedmail")}
                    </SelectItem>
                    {accountOptions.map((account) => (
                      <SelectItem key={account.id} value={String(account.id)}>
                        {account.email}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {!__IS_FREE__ && lockedAccountId !== null ? (
                  <p
                    id="filter-rule-account-locked"
                    className="text-xs text-muted-foreground">
                    {__(
                      "A shared mailbox's rules only cover that mailbox.",
                      "pressedmail",
                    )}
                  </p>
                ) : null}
                {sectionError("account")}
              </div>

              {/* Level with the fields, below their labels. */}
              <div className="flex items-center gap-2 md:mt-5 md:h-[var(--control-height)]">
                <Switch
                  id="rule-enabled"
                  checked={enabled}
                  onCheckedChange={setEnabled}
                />
                <Label htmlFor="rule-enabled" className="whitespace-nowrap">
                  {__("Rule is on", "pressedmail")}
                </Label>
              </div>
            </div>

            <div
              className="space-y-1.5"
              data-test="filter-rule-description-row"
              data-testid="filter-rule-description-row">
              <Label htmlFor="rule-description">
                {__("Description (optional)", "pressedmail")}
              </Label>
              <Textarea
                autoComplete="off"
                id="rule-description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder={__("A note for future you", "pressedmail")}
                rows={1}
                // Two lines: it is optional. The portal sets textarea min-height
                // unlayered and important, which only an important utility beats.
                className={cn("min-h-14!", RULE_FIELD_SURFACE)}
              />
            </div>
          </div>

          <section
            className="space-y-2"
            aria-labelledby="filter-rule-when"
            data-rule-section="when"
            data-test="filter-rule-run-triggers"
            data-testid="filter-rule-run-triggers">
            <h3 id="filter-rule-when" className={sectionTitle}>
              {__("Runs", "pressedmail")}
            </h3>
            {/* Three across on a wide dialog, so five triggers sit 3 + 2 with no stretched orphan. */}
            <div className="grid gap-2 text-sm sm:grid-cols-2 lg:grid-cols-3">
              {offered.triggers.map((trigger) => {
                const typed = trigger as FilterRuleRunTrigger;
                return (
                  <label
                    key={trigger}
                    className={cn(
                      "flex min-h-[var(--control-height,28px)] items-center gap-2 rounded-md border border-border px-2 py-1.5 has-[:focus-visible]:border-[var(--pm-focus-ring)] has-[:focus-visible]:bg-muted/40 max-sm:min-h-11",
                      // Same chosen look as the sweep's cards.
                      runTriggers.includes(typed) &&
                        "border-primary bg-primary/5",
                    )}>
                    <Checkbox
                      data-test={`filter-rule-run-${trigger.replace(/_/g, "-")}`}
                      data-testid={`filter-rule-run-${trigger.replace(/_/g, "-")}`}
                      checked={runTriggers.includes(typed)}
                      onCheckedChange={(checked) =>
                        toggleRunTrigger(typed, checked === true)
                      }
                    />
                    <span>{triggerLabel(trigger)}</span>
                  </label>
                );
              })}
            </div>
            {runTriggers.includes("on_receive") ? (
              <p className="text-xs text-muted-foreground">
                {__(
                  "Runs on new Inbox mail. For another folder, add a Folder condition and match all conditions.",
                  "pressedmail",
                )}
              </p>
            ) : null}

            {timingNote ? (
              <p className="text-xs text-muted-foreground">{timingNote}</p>
            ) : null}
            {rule?.inactiveReason ? (
              <p role="status" className="text-xs text-destructive">
                {rule.inactiveReason}
              </p>
            ) : null}
            {sectionError("when")}

            {/* Timed rules are Pro: Free compiles this picker out entirely. */}
            {__IS_PRO__ &&
              runTriggers.includes("scheduled") &&
              offered.triggers.includes("scheduled") && (
                <div className="max-w-xs space-y-1.5">
                  <Label htmlFor="filter-rule-schedule-interval">
                    {__("Schedule interval", "pressedmail")}
                  </Label>
                  <Select
                    value={String(scheduleIntervalMinutes ?? 60)}
                    onValueChange={(value) =>
                      setScheduleIntervalMinutes(
                        Number(value) as FilterRuleScheduleInterval,
                      )
                    }>
                    <SelectTrigger
                      id="filter-rule-schedule-interval"
                      data-test="filter-rule-schedule-interval"
                      data-testid="filter-rule-schedule-interval">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FILTER_RULE_SCHEDULE_INTERVALS.map((minutes) => (
                        <SelectItem
                          key={minutes}
                          value={String(minutes)}
                          data-test={`filter-rule-schedule-interval-option-${minutes}`}
                          data-testid={`filter-rule-schedule-interval-option-${minutes}`}>
                          {minutes === 1440
                            ? __("Every day", "pressedmail")
                            : minutes >= 60
                              ? sprintf(
                                  /* translators: %d: number of hours between runs. */
                                  _n(
                                    "Every %d hour",
                                    "Every %d hours",
                                    minutes / 60,
                                    "pressedmail",
                                  ),
                                  minutes / 60,
                                )
                              : sprintf(
                                  /* translators: %d: number of minutes between runs. */
                                  _n(
                                    "Every %d minute",
                                    "Every %d minutes",
                                    minutes,
                                    "pressedmail",
                                  ),
                                  minutes,
                                )}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
          </section>

          <section
            className="space-y-2"
            aria-labelledby="filter-rule-if"
            data-rule-section="if">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 id="filter-rule-if" className={sectionTitle}>
                {__("If", "pressedmail")}
              </h3>
              <Select
                value={conditionLogic}
                onValueChange={(v) => {
                  setConditionLogic(v as ConditionLogic);
                  setTestResult(null);
                  setTestError(null);
                }}>
                <SelectTrigger
                  className={cn("w-44", RULE_FIELD_SURFACE)}
                  aria-label={__("How conditions combine", "pressedmail")}
                  data-test="filter-rule-condition-logic"
                  data-testid="filter-rule-condition-logic">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem
                    value="and"
                    data-test="filter-rule-condition-logic-and"
                    data-testid="filter-rule-condition-logic-and">
                    {__("All conditions match", "pressedmail")}
                  </SelectItem>
                  <SelectItem
                    value="or"
                    data-test="filter-rule-condition-logic-or"
                    data-testid="filter-rule-condition-logic-or">
                    {__("Any condition matches", "pressedmail")}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {sectionError("if")}

            {/* One bordered group with row dividers, not a box per row. */}
            <ol
              className="divide-y divide-border rounded-md border border-border empty:hidden"
              style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {conditions.map((condition, index) => (
                <li key={condition.id}>
                  <div
                    className="p-2"
                    data-test={`filter-rule-condition-row-${condition.id}`}
                    data-testid={`filter-rule-condition-row-${condition.id}`}>
                    {/* The connector sits in a gutter beside the fields: on a
                      line of its own it added a row to every condition. */}
                    <div className="flex items-start gap-2">
                      <span
                        aria-hidden="true"
                        className="flex h-[var(--control-height,32px)] w-7 shrink-0 items-center text-xs font-medium text-muted-foreground max-sm:h-11">
                        {index === 0
                          ? __("If", "pressedmail")
                          : conditionLogic === "and"
                            ? __("and", "pressedmail")
                            : __("or", "pressedmail")}
                      </span>
                      <div className="grid min-w-0 flex-1 gap-2 md:grid-cols-3">
                        <Select
                          value={condition.field}
                          onValueChange={onPicked((v) =>
                            updateCondition(condition.id, {
                              field: v as FilterConditionField,
                            }),
                          )}>
                          <SelectTrigger
                            aria-label={sprintf(
                              /* translators: %d: condition number. */
                              __("Condition %d field", "pressedmail"),
                              index + 1,
                            )}
                            data-test={`filter-rule-condition-field-${condition.id}`}
                            data-testid={`filter-rule-condition-field-${condition.id}`}
                            className={RULE_FIELD_SURFACE}>
                            <SelectValue>
                              {fieldLabel(condition.field)}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent className={LONG_MENU}>
                            {fieldGroups.map((group) => (
                              <SelectGroup key={group.id}>
                                <SelectLabel className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                                  {group.label}
                                </SelectLabel>
                                {group.fields.map((field) => (
                                  <SelectItem
                                    key={field}
                                    value={field}
                                    data-test={`filter-rule-condition-field-option-${field}`}
                                    data-testid={`filter-rule-condition-field-option-${field}`}>
                                    {fieldLabel(field)}
                                  </SelectItem>
                                ))}
                              </SelectGroup>
                            ))}
                          </SelectContent>
                        </Select>

                        <Select
                          // Remount per field: the new field's options and its
                          // first operator arrive together.
                          key={`${condition.id}-${condition.field}`}
                          value={condition.operator}
                          onValueChange={onPicked((v) =>
                            updateCondition(condition.id, {
                              operator: v as FilterOperator,
                            }),
                          )}>
                          <SelectTrigger
                            aria-label={sprintf(
                              /* translators: %d: condition number. */
                              __("Condition %d operator", "pressedmail"),
                              index + 1,
                            )}
                            data-test={`filter-rule-condition-operator-${condition.id}`}
                            data-testid={`filter-rule-condition-operator-${condition.id}`}
                            className={RULE_FIELD_SURFACE}>
                            <SelectValue>
                              {operatorLabel(
                                condition.field,
                                condition.operator,
                                offered.fields[condition.field]?.value ===
                                  "number",
                              )}
                            </SelectValue>
                          </SelectTrigger>
                          <SelectContent>
                            {operatorsFor(condition.field).map((op) => (
                              <SelectItem
                                key={op}
                                value={op}
                                data-test={`filter-rule-condition-operator-option-${op}`}
                                data-testid={`filter-rule-condition-operator-option-${op}`}>
                                {operatorLabel(
                                  condition.field,
                                  op,
                                  offered.fields[condition.field]?.value ===
                                    "number",
                                )}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>

                        {renderConditionValue(condition, index)}
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeCondition(condition.id)}
                        aria-label={sprintf(
                          /* translators: %d: condition number. */
                          __("Remove condition %d", "pressedmail"),
                          index + 1,
                        )}
                        data-test={`filter-rule-condition-remove-${condition.id}`}
                        data-testid={`filter-rule-condition-remove-${condition.id}`}
                        className="text-muted-foreground hover:text-destructive focus-visible:text-destructive max-sm:size-11">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    {showsBlank(condition) ? (
                      <p
                        id={conditionErrorId(condition)}
                        className="mt-1 ml-9 flex items-start gap-1.5 text-xs text-destructive">
                        <AlertCircle
                          className="mt-px h-3.5 w-3.5 shrink-0"
                          aria-hidden="true"
                        />
                        <span>
                          {__("This condition needs a value.", "pressedmail")}
                        </span>
                      </p>
                    ) : null}
                    {["body", "size"].includes(condition.field) ? (
                      <p className="mt-1 ml-9 text-xs text-muted-foreground">
                        {__(
                          "Reads the saved copy of the message. Mail PressedMail has not downloaded yet never matches.",
                          "pressedmail",
                        )}
                      </p>
                    ) : null}
                    {["list_id", "reply_to"].includes(condition.field) ? (
                      <p className="mt-1 ml-9 text-xs text-muted-foreground">
                        {__(
                          "Only seen as mail arrives, so older mail never matches it.",
                          "pressedmail",
                        )}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="ghost"
              onClick={addCondition}
              data-test="filter-rule-add-condition"
              data-testid="filter-rule-add-condition"
              className="self-start max-sm:min-h-11">
              <Plus className="mr-2 h-4 w-4" />
              {__("Add condition", "pressedmail")}
            </Button>
          </section>

          <section
            className="space-y-2"
            aria-labelledby="filter-rule-then"
            data-rule-section="then">
            <h3 id="filter-rule-then" className={sectionTitle}>
              {__("Then", "pressedmail")}
            </h3>
            {sectionError("then")}

            <ol
              className="divide-y divide-border rounded-md border border-border empty:hidden"
              style={{ listStyle: "none", margin: 0, padding: 0 }}>
              {actions.map((action, actionIndex) => (
                <li
                  key={action.id}
                  className={
                    isUnimplementedAction(action.type)
                      ? "bg-destructive/5 p-2 shadow-[inset_3px_0_0_var(--destructive)]"
                      : "p-2"
                  }
                  data-rule-blocker={
                    (isUnimplementedAction(action.type) &&
                      automaticRuleUnavailable) ||
                    (revealInvalid && actionNeedsChoice(action))
                      ? "true"
                      : undefined
                  }
                  data-test={`filter-rule-action-row-${action.id}`}
                  data-testid={`filter-rule-action-row-${action.id}`}>
                  <div className="flex items-start gap-2">
                    <div className="grid flex-1 gap-2 md:grid-cols-2">
                      <Select
                        value={action.type}
                        onValueChange={onPicked((v) =>
                          updateAction(action.id, {
                            type: v as FilterActionType,
                            value: undefined,
                          }),
                        )}>
                        <SelectTrigger
                          aria-label={sprintf(
                            /* translators: %d: action number. */
                            __("Action %d type", "pressedmail"),
                            actionIndex + 1,
                          )}
                          data-test={`filter-rule-action-type-${action.id}`}
                          data-testid={`filter-rule-action-type-${action.id}`}
                          aria-invalid={
                            (revealInvalid && (action.type as string) === "") ||
                            undefined
                          }
                          className={RULE_FIELD_SURFACE}>
                          <SelectValue
                            placeholder={__(
                              "Choose what to do",
                              "pressedmail",
                            )}>
                            {action.type ? actionLabel(action.type) : undefined}
                          </SelectValue>
                        </SelectTrigger>
                        <SelectContent className={LONG_MENU}>
                          {actionGroupsFor(action.type).map((group) => (
                            <SelectGroup key={group.id}>
                              <SelectLabel className="px-2 pt-2 pb-1 text-xs font-medium text-muted-foreground">
                                {group.label}
                              </SelectLabel>
                              {group.actions.map((value) => (
                                <SelectItem
                                  key={value}
                                  value={value}
                                  data-test={`filter-rule-action-type-option-${value}`}
                                  data-testid={`filter-rule-action-type-option-${value}`}>
                                  {actionLabel(value)}
                                </SelectItem>
                              ))}
                            </SelectGroup>
                          ))}
                          {!__IS_FREE__ && lockedAccountId !== null ? (
                            // Say why tag and owner-only steps are missing
                            // instead of dropping them silently.
                            <SelectGroup>
                              <SelectLabel className="px-2 pt-2 pb-1 text-xs font-normal text-muted-foreground">
                                {__(
                                  "Some steps are for the mailbox owner only.",
                                  "pressedmail",
                                )}
                              </SelectLabel>
                            </SelectGroup>
                          ) : null}
                        </SelectContent>
                      </Select>

                      {renderActionValue(action, actionIndex)}
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeAction(action.id)}
                      aria-label={sprintf(
                        /* translators: %d: action number. */
                        __("Remove action %d", "pressedmail"),
                        actionIndex + 1,
                      )}
                      data-test={`filter-rule-action-remove-${action.id}`}
                      data-testid={`filter-rule-action-remove-${action.id}`}
                      className="text-muted-foreground hover:text-destructive focus-visible:text-destructive max-sm:size-11">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {/* On the row itself, so the warning sits next to what it is about. */}
                  {isUnimplementedAction(action.type) &&
                  automaticRuleUnavailable ? (
                    <p
                      className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive"
                      role="status"
                      data-test="filter-rule-automatic-unavailable"
                      data-testid="filter-rule-automatic-unavailable">
                      <AlertCircle
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {__(
                          "This action no longer runs. Remove it before this rule can run on its own.",
                          "pressedmail",
                        )}{" "}
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="font-medium underline underline-offset-2 hover:no-underline"
                          data-test={`filter-rule-action-legacy-remove-${action.id}`}
                          data-testid={`filter-rule-action-legacy-remove-${action.id}`}>
                          {__("Remove it", "pressedmail")}
                        </button>
                      </span>
                    </p>
                  ) : isUnimplementedAction(action.type) ? (
                    <p className="mt-1.5 flex items-start gap-1.5 text-xs text-destructive">
                      <AlertCircle
                        className="h-3.5 w-3.5 shrink-0"
                        aria-hidden="true"
                      />
                      <span>
                        {__(
                          "This action no longer runs. Remove it or pick another one.",
                          "pressedmail",
                        )}{" "}
                        <button
                          type="button"
                          onClick={() => removeAction(action.id)}
                          className="font-medium underline underline-offset-2 hover:no-underline">
                          {__("Remove it", "pressedmail")}
                        </button>
                      </span>
                    </p>
                  ) : null}
                  {proActionHint(action.type) ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {proActionHint(action.type)}
                    </p>
                  ) : null}
                  {action.type === "never_spam" ? (
                    <p className="mt-1.5 text-xs text-muted-foreground">
                      {__(
                        "Moves matching mail the server puts in Junk back out. Mail you report as spam stays put. Overrides Send to Junk.",
                        "pressedmail",
                      )}
                    </p>
                  ) : null}
                </li>
              ))}
            </ol>

            <Button
              type="button"
              variant="ghost"
              onClick={addAction}
              data-test="filter-rule-add-action"
              data-testid="filter-rule-add-action"
              className="self-start max-sm:min-h-11">
              <Plus className="mr-2 h-4 w-4" />
              {__("Add action", "pressedmail")}
            </Button>
          </section>

          {/* After If and Then, so the form reads top to bottom; it tries
              the conditions only, and changes nothing. */}
          <div
            className="rounded-md border border-border p-3 text-sm"
            data-test="filter-rule-test"
            data-testid="filter-rule-test">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-muted-foreground">
                {conditions.length === 0 || !hasOperators || !hasConditionValues
                  ? __(
                      "Fill in a condition to see what it matches.",
                      "pressedmail",
                    )
                  : __(
                      "See what the conditions match in your recent mail.",
                      "pressedmail",
                    )}
              </span>
              <Button
                type="button"
                variant="outline"
                disabled={
                  conditions.length === 0 ||
                  !hasOperators ||
                  !hasConditionValues ||
                  testing
                }
                onClick={() => void runTest()}
                data-test="filter-rule-test-run"
                data-testid="filter-rule-test-run">
                {testing ? (
                  <Loader2
                    className="mr-2 h-4 w-4 animate-spin"
                    aria-hidden="true"
                  />
                ) : (
                  <FlaskConical className="mr-2 h-4 w-4" aria-hidden="true" />
                )}
                {testing
                  ? __("Checking...", "pressedmail")
                  : __("Try it", "pressedmail")}
              </Button>
            </div>
            <div aria-live="polite">
              {testError ? (
                <PressedOverlayError className="mt-2 flex items-start gap-1.5">
                  <AlertCircle
                    className="mt-0.5 h-4 w-4 shrink-0"
                    aria-hidden="true"
                  />
                  <span>{testError}</span>
                </PressedOverlayError>
              ) : null}
              {testResult ? (
                <div
                  className="mt-2 space-y-1"
                  data-test="filter-rule-test-result"
                  data-testid="filter-rule-test-result">
                  <p className="font-medium text-foreground">
                    {sprintf(
                      /* translators: 1: messages that match, 2: messages checked, 3: folder name. */
                      _n(
                        "%1$d of the %2$d newest message in %3$s matches.",
                        "%1$d of the %2$d newest messages in %3$s match.",
                        testResult.checked,
                        "pressedmail",
                      ),
                      testResult.matched,
                      testResult.checked,
                      testResult.folder.toUpperCase() === "INBOX"
                        ? __("the Inbox", "pressedmail")
                        : (offeredFolderPaths.get(testResult.folder) ??
                            testResult.folder),
                    )}
                  </p>
                  {testResult.unknown > 0 ? (
                    <p
                      className="text-muted-foreground"
                      data-test="filter-rule-test-unknown"
                      data-testid="filter-rule-test-unknown">
                      {sprintf(
                        /* translators: %d: messages the test could not judge. */
                        _n(
                          "%d more couldn't be checked: its body or headers aren't saved.",
                          "%d more couldn't be checked: their body or headers aren't saved.",
                          testResult.unknown,
                          "pressedmail",
                        ),
                        testResult.unknown,
                      )}
                    </p>
                  ) : null}
                  {testResult.samples.length > 0 ? (
                    <ul className="divide-y divide-border rounded-md border border-border">
                      {testResult.samples.map((sample, index) => (
                        <li
                          key={index}
                          className="flex min-w-0 items-baseline gap-2 px-2 py-1.5">
                          <span className="min-w-0 flex-1 truncate text-foreground">
                            {sample.subject ||
                              __("(no subject)", "pressedmail")}
                          </span>
                          <span className="max-w-[40%] shrink-0 truncate text-xs text-muted-foreground">
                            {sample.from}
                          </span>
                          {shortDate(sample.receivedAt) ? (
                            <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                              {shortDate(sample.receivedAt)}
                            </span>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="stop-processing"
              checked={stopProcessing}
              onCheckedChange={setStopProcessing}
              data-test="filter-rule-stop-processing"
              data-testid="filter-rule-stop-processing"
            />
            <Label htmlFor="stop-processing" className="text-sm">
              {__("Stop other rules after this one matches", "pressedmail")}
            </Label>
          </div>
        </fieldset>
      </PressedOverlayBody>

      {/* Pinned, so Save is always on screen however long the rule gets. The
          line beside it says why Save is off, or why the last save failed. */}
      <PressedOverlayFooter className="flex-row flex-wrap items-center bg-popover">
        <Button
          type="button"
          variant="outline"
          onClick={() => guardedAction(onCancel)}
          className="flex-1 sm:h-9 sm:flex-none max-sm:min-h-11"
          data-test="filter-rule-cancel"
          data-testid="filter-rule-cancel">
          {readOnly ? __("Close", "pressedmail") : __("Cancel", "pressedmail")}
        </Button>
        {readOnly ? null : (
          <Button
            type="submit"
            disabled={!isValid || saving}
            className="flex-1 sm:h-9 sm:flex-none max-sm:min-h-11"
            data-test="filter-rule-save"
            data-testid="filter-rule-save">
            {saving
              ? __("Saving...", "pressedmail")
              : isEditing
                ? __("Save rule", "pressedmail")
                : __("Create rule", "pressedmail")}
          </Button>
        )}
        {saveError ? (
          <PressedOverlayError
            className="flex items-start gap-1.5 order-first basis-full sm:basis-auto sm:mr-auto"
            data-test="filter-rule-save-error"
            data-testid="filter-rule-save-error">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              aria-hidden="true"
            />
            <span>{saveError}</span>
          </PressedOverlayError>
        ) : !readOnly && missing.length > 0 ? (
          <p
            role="status"
            className="text-sm text-muted-foreground order-first basis-full sm:basis-auto sm:mr-auto"
            data-test="filter-rule-requirements"
            data-testid="filter-rule-requirements">
            {sprintf(
              /* translators: %s: comma-separated list of what to do before the rule can be saved. */
              __("To save: %s.", "pressedmail"),
              missing.join(__(", ", "pressedmail")),
            )}{" "}
            <button
              type="button"
              className="font-medium text-foreground underline underline-offset-2 hover:no-underline"
              onClick={showFirstBlocker}>
              {__("Show me", "pressedmail")}
            </button>
          </p>
        ) : null}
      </PressedOverlayFooter>
    </form>
  );
}

/**
 * The rule form in the standard dialog. Closing it (Escape, the overlay, the
 * close button) goes through the form's own Cancel, so unsaved changes still
 * ask first.
 */
export function FilterRuleEditorDialog({
  open,
  onOpenChange,
  testId,
  ...props
}: FilterRuleEditorProps & {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  testId?: string;
}) {
  const requestCloseRef = React.useRef<(() => void) | null>(null);
  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (next) onOpenChange(true);
        else if (requestCloseRef.current) requestCloseRef.current();
        else onOpenChange(false);
      }}>
      <PressedDialogContent
        size="form"
        data-test={testId}
        data-testid={testId}
        // Header and footer stay put; only the form body scrolls, the same as
        // the sweep dialog, so the title and close button are always there.
        className="flex max-h-[90vh] flex-col overflow-hidden"
        onOpenAutoFocus={(event) => {
          // Radix focuses the first field with its text selected, so one
          // stray key wiped an existing rule's name. Put the caret at the end.
          const name = (
            event.currentTarget as HTMLElement | null
          )?.querySelector<HTMLInputElement>("#rule-name:not(:disabled)");
          if (!name) return;
          event.preventDefault();
          name.focus();
          const end = name.value.length;
          name.setSelectionRange(end, end);
        }}>
        <PressedDialogHeader
          title={
            props.readOnly
              ? __("Rule", "pressedmail")
              : props.rule
                ? __("Edit rule", "pressedmail")
                : __("New rule", "pressedmail")
          }
          icon={ListFilter}
          description={__(
            "Choose when the rule runs, what it matches and what it does.",
            "pressedmail",
          )}
          descriptionMode="sr-only"
        />
        <FilterRuleEditor {...props} requestCloseRef={requestCloseRef} />
      </PressedDialogContent>
    </Dialog>
  );
}

export default FilterRuleEditor;
