"use client";

/**
 * Filter Rule Editor Component
 *
 * Form for creating and editing email filter rules.
 * Supports adding conditions, selecting actions, and testing rules.
 */

import * as React from "react";
import { Plus, Trash2 } from "lucide-react";
import { __, _n, sprintf } from "@wordpress/i18n";
import {
  Button,
  Checkbox,
  Input,
  Label,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Separator,
} from "@kit/ui/plugin";
import { cn } from "@/lib/utils";
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
  CreateFilterRuleData,
  UpdateFilterRuleData,
} from "@/types/filter-rules";
import {
  CONDITION_FIELD_LABELS,
  STRING_OPERATOR_LABELS,
  BOOLEAN_OPERATOR_LABELS,
  NUMERIC_OPERATOR_LABELS,
  DATE_OPERATOR_LABELS,
  ACTION_TYPE_LABELS,
  getOperatorsForField,
  actionRequiresValue,
  DEFAULT_FILTER_RULE_TRIGGERS,
  FILTER_RULE_SCHEDULE_INTERVALS,
  isUnimplementedAction,
} from "@/types/filter-rules";
import { DateTimeSelector } from "@/components/ui/date-time-selector";
import { useUnsavedChangesGuard } from "@/components/settings-ui";
import type { ImapFolder } from "@/services/interfaces";
import { isResolvedFilterRuleFolderTarget } from "@/services/filter-rule-folder-targets";
import { RuleFolderPicker } from "./RuleFolderPicker";

interface FilterRuleEditorProps {
  rule?: FilterRule;
  onSave: (data: CreateFilterRuleData | UpdateFilterRuleData) => Promise<void>;
  onCancel: () => void;
  accountId: number | null;
  accountOptions?: AccountOption[];
  saving?: boolean;
  folderTree?: ImapFolder[];
}

export interface AccountOption {
  id: number;
  email: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function isAbsoluteDateOperator(operator: FilterOperator): boolean {
  return operator === "before" || operator === "after" || operator === "on";
}

function getConditionInputPlaceholder(condition: FilterCondition): string {
  if (condition.field === "size") return __("Size in bytes", "pressedmail");
  if (condition.field === "date") {
    return isAbsoluteDateOperator(condition.operator)
      ? __("YYYY-MM-DD", "pressedmail")
      : __("Days", "pressedmail");
  }
  return __("Value to match", "pressedmail");
}

/**
 * Whether this condition's value is a number.
 *
 * Size is a byte count and a relative date is a number of days, but both were
 * free-text inputs, so "abc" bytes reached the server.
 */
function isNumericConditionValue(condition: FilterCondition): boolean {
  if (condition.field === "size") return true;
  return (
    condition.field === "date" && !isAbsoluteDateOperator(condition.operator)
  );
}

export function FilterRuleEditor({
  rule,
  onSave,
  onCancel,
  accountId,
  accountOptions = [],
  saving = false,
  folderTree = [],
}: FilterRuleEditorProps) {
  const isEditing = !!rule;

  // Form state
  const [name, setName] = React.useState(rule?.name || "");
  const [description, setDescription] = React.useState(rule?.description || "");
  const [enabled, setEnabled] = React.useState(rule?.enabled ?? true);
  const [ruleAccountId, setRuleAccountId] = React.useState(
    rule?.accountId ?? accountId ?? 0,
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
  const [runTriggers, setRunTriggers] = React.useState<FilterRuleRunTrigger[]>(
    rule?.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS,
  );
  const [scheduleIntervalMinutes, setScheduleIntervalMinutes] =
    React.useState<FilterRuleScheduleInterval | null>(
      rule?.scheduleIntervalMinutes ?? null,
    );
  const initialSnapshot = React.useMemo(
    () =>
      JSON.stringify({
        name: rule?.name || "",
        description: rule?.description || "",
        enabled: rule?.enabled ?? true,
        ruleAccountId: rule?.accountId ?? accountId ?? 0,
        conditions: rule?.conditions || [],
        conditionLogic: rule?.conditionLogic || "and",
        actions: rule?.actions || [],
        stopProcessing: rule?.stopProcessing ?? false,
        runTriggers: rule?.runTriggers ?? DEFAULT_FILTER_RULE_TRIGGERS,
        scheduleIntervalMinutes: rule?.scheduleIntervalMinutes ?? null,
      }),
    [accountId, rule],
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
    scheduleIntervalMinutes,
  });
  const { guardedAction, guardDialog } = useUnsavedChangesGuard({
    dirty: currentSnapshot !== initialSnapshot,
  });

  // Add a new condition
  const addCondition = () => {
    const newCondition: FilterCondition = {
      id: generateId(),
      field: "from",
      operator: "contains",
      value: "",
    };
    setConditions((prev) => [...prev, newCondition]);
  };

  // Update a condition
  const updateCondition = (id: string, updates: Partial<FilterCondition>) => {
    setConditions((prev) =>
      prev.map((c) => {
        if (c.id !== id) return c;

        const updated = { ...c, ...updates };

        // Reset operator if field type changes
        if (updates.field) {
          const operators = getOperatorsForField(updates.field);
          if (!operators.includes(c.operator as FilterOperator)) {
            updated.operator = operators[0] || "contains";
          }
        }

        return updated;
      }),
    );
  };

  // Remove a condition
  const removeCondition = (id: string) => {
    setConditions((prev) => prev.filter((c) => c.id !== id));
  };

  // Add a new action
  const addAction = () => {
    const newAction: FilterAction = {
      id: generateId(),
      type: "archive",
    };
    setActions((prev) => [...prev, newAction]);
  };

  // Update an action
  const updateAction = (id: string, updates: Partial<FilterAction>) => {
    setActions((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...updates } : a)),
    );
  };

  // Remove an action
  const removeAction = (id: string) => {
    setActions((prev) => prev.filter((a) => a.id !== id));
  };

  // Get operator label for display
  const getOperatorLabel = (
    field: FilterConditionField,
    operator: FilterOperator,
  ): string => {
    if (field === "has_attachment") {
      return (
        BOOLEAN_OPERATOR_LABELS[
          operator as keyof typeof BOOLEAN_OPERATOR_LABELS
        ] || operator
      );
    }
    if (field === "size") {
      return (
        NUMERIC_OPERATOR_LABELS[
          operator as keyof typeof NUMERIC_OPERATOR_LABELS
        ] || operator
      );
    }
    if (field === "date") {
      return (
        DATE_OPERATOR_LABELS[operator as keyof typeof DATE_OPERATOR_LABELS] ||
        operator
      );
    }
    return (
      STRING_OPERATOR_LABELS[operator as keyof typeof STRING_OPERATOR_LABELS] ||
      operator
    );
  };

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const normalizedTriggers =
      runTriggers.length > 0 ? runTriggers : DEFAULT_FILTER_RULE_TRIGGERS;

    const data: CreateFilterRuleData | UpdateFilterRuleData = {
      name,
      description: description || undefined,
      enabled,
      conditions: conditions.map(({ id: _, ...rest }) => rest),
      conditionLogic,
      actions: actions.map(({ id: _, ...rest }) => rest),
      stopProcessing,
      accountId: ruleAccountId,
      runTriggers: normalizedTriggers,
      scheduleIntervalMinutes: normalizedTriggers.includes("scheduled")
        ? (scheduleIntervalMinutes ?? 60)
        : null,
    };

    await onSave(data);
  };

  const hasValidMoveTargets = actions.every(
    (action) =>
      action.type !== "move_to_folder" ||
      (ruleAccountId > 0 && isResolvedFilterRuleFolderTarget(action.value)),
  );
  const hasAutomaticTrigger = runTriggers.some(
    (trigger) => trigger === "on_receive" || trigger === "scheduled",
  );
  const hasUnsupportedAutomaticCondition = conditions.some(
    (condition) => condition.field === "body" || condition.field === "size",
  );
  const hasUnsupportedAutomaticAction = actions.some((action) =>
    isUnimplementedAction(action.type),
  );
  const automaticRuleUnavailable =
    hasAutomaticTrigger &&
    (hasUnsupportedAutomaticCondition || hasUnsupportedAutomaticAction);
  const isValid =
    name.trim() &&
    conditions.length > 0 &&
    actions.length > 0 &&
    hasValidMoveTargets &&
    !automaticRuleUnavailable;

  const toggleRunTrigger = (
    trigger: FilterRuleRunTrigger,
    checked: boolean,
  ) => {
    setRunTriggers((current) => {
      const next = checked
        ? Array.from(new Set([...current, trigger]))
        : current.filter((value) => value !== trigger);
      if (
        trigger === "scheduled" &&
        checked &&
        scheduleIntervalMinutes === null
      ) {
        setScheduleIntervalMinutes(60);
      }
      if (trigger === "scheduled" && !checked) {
        setScheduleIntervalMinutes(null);
      }
      return next;
    });
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {guardDialog}
      {/* Basic Info */}
      <div className="space-y-3">
        <div
          className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,16rem)_auto] md:items-end"
          data-test="filter-rule-basic-row"
          data-testid="filter-rule-basic-row">
          <div className="space-y-1.5">
            <Label htmlFor="rule-name" className="text-xs">
              {__("Rule Name", "pressedmail")}
            </Label>
            <Input
              autoComplete="off"
              id="rule-name"
              data-test="filter-rule-name"
              data-testid="filter-rule-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={__(
                "e.g., Move newsletters to folder",
                "pressedmail",
              )}
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="filter-rule-account-scope" className="text-xs">
              {__("Apply rule to", "pressedmail")}
            </Label>
            <Select
              value={String(ruleAccountId)}
              onValueChange={(value) => {
                setRuleAccountId(Number(value));
                setActions((current) =>
                  current.map((action) =>
                    action.type === "move_to_folder"
                      ? { ...action, value: undefined }
                      : action,
                  ),
                );
              }}>
              <SelectTrigger
                id="filter-rule-account-scope"
                data-test="filter-rule-account-scope"
                data-testid="filter-rule-account-scope">
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
          </div>

          <div className="flex items-center gap-2 md:self-center md:pt-6">
            <Switch
              id="rule-enabled"
              checked={enabled}
              onCheckedChange={setEnabled}
            />
            <Label htmlFor="rule-enabled" className="whitespace-nowrap">
              {__("Rule Enabled", "pressedmail")}
            </Label>
          </div>
        </div>

        <div
          className="space-y-1.5"
          data-test="filter-rule-description-row"
          data-testid="filter-rule-description-row">
          <Label htmlFor="rule-description" className="text-xs">
            {__("Description (optional)", "pressedmail")}
          </Label>
          <Textarea
            autoComplete="off"
            id="rule-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder={__("Describe what this rule does...", "pressedmail")}
            rows={1}
          />
        </div>
      </div>

      <Separator />

      <div
        className="space-y-3"
        data-test="filter-rule-run-triggers"
        data-testid="filter-rule-run-triggers">
        <div>
          <h3 className="text-sm font-medium">
            {__("Run this rule", "pressedmail")}
          </h3>
        </div>

        <div className="grid gap-2 text-xs md:grid-cols-3">
          {(
            [
              ["manual", __("Manual", "pressedmail")],
              ["on_receive", __("When mail arrives", "pressedmail")],
              ["scheduled", __("On a schedule", "pressedmail")],
            ] as const
          ).map(([trigger, label]) => (
            <label
              key={trigger}
              className="flex items-center gap-2 rounded-md border border-border bg-muted/20 px-2 py-1.5">
              <Checkbox
                data-test={`filter-rule-run-${trigger.replace("_", "-")}`}
                data-testid={`filter-rule-run-${trigger.replace("_", "-")}`}
                checked={runTriggers.includes(trigger)}
                onCheckedChange={(checked) =>
                  toggleRunTrigger(trigger, checked === true)
                }
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {automaticRuleUnavailable && (
          <p
            className="text-xs text-destructive"
            role="status"
            data-test="filter-rule-automatic-unavailable"
            data-testid="filter-rule-automatic-unavailable">
            {hasUnsupportedAutomaticCondition
              ? __(
                  "Body and Size conditions can only run manually. Remove automatic triggers or choose a mailbox field.",
                  "pressedmail",
                )
              : __(
                  "One or more actions can only run manually. Remove automatic triggers or choose supported actions.",
                  "pressedmail",
                )}
          </p>
        )}

        {runTriggers.includes("scheduled") && (
          <div className="max-w-xs space-y-1.5">
            <Label htmlFor="filter-rule-schedule-interval" className="text-xs">
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

        <Separator />
      </div>

      {/* Conditions */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-medium">
              {__("Conditions", "pressedmail")}
            </h3>
          </div>
          <Select
            value={conditionLogic}
            onValueChange={(v) => setConditionLogic(v as ConditionLogic)}>
            <SelectTrigger
              className="w-32"
              data-test="filter-rule-condition-logic"
              data-testid="filter-rule-condition-logic">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem
                value="and"
                data-test="filter-rule-condition-logic-and"
                data-testid="filter-rule-condition-logic-and">
                {__("Match ALL", "pressedmail")}
              </SelectItem>
              <SelectItem
                value="or"
                data-test="filter-rule-condition-logic-or"
                data-testid="filter-rule-condition-logic-or">
                {__("Match ANY", "pressedmail")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1.5">
          {conditions.map((condition, index) => (
            <Card
              key={condition.id}
              className="bg-muted/30"
              data-test={`filter-rule-condition-row-${condition.id}`}
              data-testid={`filter-rule-condition-row-${condition.id}`}>
              <CardContent className="p-2">
                <div className="flex items-start gap-2">
                  <div className="flex-1 grid gap-2 md:grid-cols-3">
                    {/* Field selector */}
                    <Select
                      value={condition.field}
                      onValueChange={(v) =>
                        updateCondition(condition.id, {
                          field: v as FilterConditionField,
                        })
                      }>
                      <SelectTrigger
                        aria-label={sprintf(
                          /* translators: %d: condition number. */
                          __("Condition %d field", "pressedmail"),
                          index + 1,
                        )}
                        data-test={`filter-rule-condition-field-${condition.id}`}
                        data-testid={`filter-rule-condition-field-${condition.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(CONDITION_FIELD_LABELS) as [
                            FilterConditionField,
                            string,
                          ][]
                        ).map(([value, label]) => (
                          <SelectItem
                            key={value}
                            value={value}
                            data-test={`filter-rule-condition-field-option-${value}`}
                            data-testid={`filter-rule-condition-field-option-${value}`}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Operator selector */}
                    <Select
                      value={condition.operator}
                      onValueChange={(v) =>
                        updateCondition(condition.id, {
                          operator: v as FilterOperator,
                        })
                      }>
                      <SelectTrigger
                        aria-label={sprintf(
                          /* translators: %d: condition number. */
                          __("Condition %d operator", "pressedmail"),
                          index + 1,
                        )}
                        data-test={`filter-rule-condition-operator-${condition.id}`}
                        data-testid={`filter-rule-condition-operator-${condition.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {getOperatorsForField(condition.field).map((op) => (
                          <SelectItem
                            key={op}
                            value={op}
                            data-test={`filter-rule-condition-operator-option-${op}`}
                            data-testid={`filter-rule-condition-operator-option-${op}`}>
                            {getOperatorLabel(condition.field, op)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>

                    {/* Value input */}
                    {condition.field !== "has_attachment" &&
                      (condition.field === "date" &&
                      isAbsoluteDateOperator(condition.operator) ? (
                        <DateTimeSelector
                          id={`filter-rule-date-condition-${condition.id}`}
                          mode="date"
                          value={String(condition.value || "")}
                          onChange={(value) =>
                            updateCondition(condition.id, { value })
                          }
                          data-test={`filter-rule-date-condition-${condition.id}`}
                          data-testid={`filter-rule-date-condition-${condition.id}`}
                        />
                      ) : (
                        <Input
                          autoComplete="off"
                          type={
                            isNumericConditionValue(condition)
                              ? "number"
                              : "text"
                          }
                          inputMode={
                            isNumericConditionValue(condition)
                              ? "numeric"
                              : undefined
                          }
                          min={
                            isNumericConditionValue(condition) ? 0 : undefined
                          }
                          aria-label={sprintf(
                            /* translators: %d: condition number. */
                            __("Condition %d value", "pressedmail"),
                            index + 1,
                          )}
                          value={String(condition.value)}
                          onChange={(e) =>
                            updateCondition(condition.id, {
                              value: e.target.value,
                            })
                          }
                          placeholder={getConditionInputPlaceholder(condition)}
                          data-test={`filter-rule-condition-value-${condition.id}`}
                          data-testid={`filter-rule-condition-value-${condition.id}`}
                        />
                      ))}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(condition.id)}
                    aria-label={sprintf(
                      /* translators: %d: condition number. */
                      __("Remove condition %d", "pressedmail"),
                      index + 1,
                    )}
                    data-test={`filter-rule-condition-remove-${condition.id}`}
                    data-testid={`filter-rule-condition-remove-${condition.id}`}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>

                {index < conditions.length - 1 && (
                  <div className="text-center text-xs text-muted-foreground mt-2">
                    {conditionLogic === "and" ? "AND" : "OR"}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addCondition}
          data-test="filter-rule-add-condition"
          data-testid="filter-rule-add-condition"
          className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {__("Add Condition", "pressedmail")}
        </Button>
      </div>

      <Separator />

      {/* Actions */}
      <div className="space-y-3">
        <div>
          <h3 className="text-sm font-medium">
            {__("Actions", "pressedmail")}
          </h3>
        </div>

        <div className="space-y-1.5">
          {actions.map((action, actionIndex) => (
            <Card
              key={action.id}
              className="bg-muted/30"
              data-test={`filter-rule-action-row-${action.id}`}
              data-testid={`filter-rule-action-row-${action.id}`}>
              <CardContent className="p-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 grid gap-2 md:grid-cols-2">
                    {/* Action type selector */}
                    <Select
                      value={action.type}
                      onValueChange={(v) =>
                        updateAction(action.id, {
                          type: v as FilterActionType,
                          value: undefined,
                        })
                      }>
                      <SelectTrigger
                        aria-label={sprintf(
                          /* translators: %d: action number. */
                          __("Action %d type", "pressedmail"),
                          actionIndex + 1,
                        )}
                        data-test={`filter-rule-action-type-${action.id}`}
                        data-testid={`filter-rule-action-type-${action.id}`}>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {(
                          Object.entries(ACTION_TYPE_LABELS) as [
                            FilterActionType,
                            string,
                          ][]
                        )
                          .filter(
                            ([value]) =>
                              // Actions nothing executes stay out of the list,
                              // except the one this row already holds so an
                              // older rule still shows what it was set to.
                              value === action.type ||
                              !isUnimplementedAction(value),
                          )
                          .map(([value, label]) => (
                            <SelectItem
                              key={value}
                              value={value}
                              data-test={`filter-rule-action-type-option-${value}`}
                              data-testid={`filter-rule-action-type-option-${value}`}>
                              {label}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>

                    {/* Action value input */}
                    {action.type === "move_to_folder" ? (
                      <RuleFolderPicker
                        folders={folderTree}
                        accountId={ruleAccountId}
                        accountLabels={
                          new Map(
                            accountOptions.map((account) => [
                              account.id,
                              account.email,
                            ]),
                          )
                        }
                        value={action.value}
                        onChange={(value) => updateAction(action.id, { value })}
                        data-test={`filter-rule-action-folder-${action.id}`}
                        data-testid={`filter-rule-action-folder-${action.id}`}
                      />
                    ) : actionRequiresValue(action.type) ? (
                      <Input
                        autoComplete="off"
                        aria-label={sprintf(
                          /* translators: %d: action number. */
                          __("Action %d value", "pressedmail"),
                          actionIndex + 1,
                        )}
                        value={
                          typeof action.value === "string" ? action.value : ""
                        }
                        onChange={(e) =>
                          updateAction(action.id, { value: e.target.value })
                        }
                        placeholder={
                          action.type === "apply_label"
                            ? __("Label name", "pressedmail")
                            : action.type === "forward"
                              ? __("Email address", "pressedmail")
                              : __("Value", "pressedmail")
                        }
                        data-test={`filter-rule-action-value-${action.id}`}
                        data-testid={`filter-rule-action-value-${action.id}`}
                      />
                    ) : null}
                  </div>

                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => removeAction(action.id)}
                    aria-label={sprintf(
                      /* translators: %d: action number. */
                      __("Remove action %d", "pressedmail"),
                      actionIndex + 1,
                    )}
                    data-test={`filter-rule-action-remove-${action.id}`}
                    data-testid={`filter-rule-action-remove-${action.id}`}
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addAction}
          data-test="filter-rule-add-action"
          data-testid="filter-rule-add-action"
          className="w-full">
          <Plus className="h-4 w-4 mr-2" />
          {__("Add Action", "pressedmail")}
        </Button>
      </div>

      <Separator />
      <div className="space-y-3">
        <h3 className="text-sm font-medium">
          {__("Advanced Options", "pressedmail")}
        </h3>

        <div className="flex items-center gap-2">
          <Switch
            id="stop-processing"
            checked={stopProcessing}
            onCheckedChange={setStopProcessing}
            data-test="filter-rule-stop-processing"
            data-testid="filter-rule-stop-processing"
          />
          <Label htmlFor="stop-processing" className="text-sm">
            {__(
              "Stop processing other rules after this one matches",
              "pressedmail",
            )}
          </Label>
        </div>
      </div>

      <Separator />

      {/* The submit button is disabled until the rule is complete, which used
          to leave the user pressing a dead control with nothing to read. */}
      {!isValid && !automaticRuleUnavailable ? (
        <div
          role="alert"
          className="rounded-md border border-border bg-muted/30 p-3 text-xs text-muted-foreground"
          data-test="filter-rule-requirements"
          data-testid="filter-rule-requirements">
          <p className="font-medium text-foreground">
            {__("Still needed before this rule can be saved", "pressedmail")}
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4">
            {!name.trim() ? <li>{__("A rule name", "pressedmail")}</li> : null}
            {conditions.length === 0 ? (
              <li>{__("At least one condition", "pressedmail")}</li>
            ) : null}
            {actions.length === 0 ? (
              <li>{__("At least one action", "pressedmail")}</li>
            ) : null}
            {!hasValidMoveTargets ? (
              <li>
                {__("A destination folder for the move action", "pressedmail")}
              </li>
            ) : null}
          </ul>
        </div>
      ) : null}

      {/* Form actions */}
      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => guardedAction(onCancel)}
          data-test="filter-rule-cancel"
          data-testid="filter-rule-cancel">
          {__("Cancel", "pressedmail")}
        </Button>
        <Button
          type="submit"
          size="sm"
          disabled={!isValid || saving}
          data-test="filter-rule-save"
          data-testid="filter-rule-save">
          {saving
            ? __("Saving...", "pressedmail")
            : isEditing
              ? __("Update Rule", "pressedmail")
              : __("Create Rule", "pressedmail")}
        </Button>
      </div>
    </form>
  );
}

export default FilterRuleEditor;
