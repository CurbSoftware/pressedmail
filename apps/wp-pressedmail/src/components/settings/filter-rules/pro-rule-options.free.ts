/**
 * Free build stand-in for pro-rule-options.ts. Free registers no Pro rule
 * conditions, actions or triggers, so there is nothing to label or pick.
 */
import type { ReactElement } from "react";

export const proConditionFieldLabel = (_field: string): string => "";
export const proActionLabel = (_type: string): string => "";
export const proTriggerLabel = (_trigger: string): string => "";
export const proActionHint = (_type: string): string => "";
export const proConditionPlaceholder = (_field: string): string => "";
export const proConditionValueLabel = (_field: string, value: string): string =>
  value;
export const proFieldGroups = (): Array<{
  id: string;
  label: string;
  fields: string[];
}> => [];
export const proActionGroups = (): Array<{
  id: string;
  label: string;
  actions: string[];
}> => [];
export const proConditionMax = (_field: string): number | undefined =>
  undefined;
export const proActionPicker = (
  _type: string,
): {
  choices: Array<{ value: string; label: string }>;
  placeholder: string;
} | null => null;
export const useProSweepTasks = (): Array<
  | "run_security_check"
  | "run_spam_check"
  | "run_phishing_check"
  | "run_auto_tagger"
> => [];
export const proSweepMatchAllLabel = (): string => "";
export const proSweepImpact = (_task: string, _count: number): string | null =>
  null;
export const sweepScoreRangeError = (
  _min: string,
  _max: string,
): string | null => null;

export function SweepScoreRange(_props: {
  min: string;
  max: string;
  onMinChange: (value: string) => void;
  onMaxChange: (value: string) => void;
  field?: "phishing" | "spam";
  band?: string;
  onBandChange?: (value: string) => void;
}): ReactElement | null {
  return null;
}

export interface SharedRuleAccount {
  id: number;
  email: string;
  role: "viewer" | "responder" | "manager";
  ownerName: string;
}

export function SharedInboxRules(_props: {
  accountOptions: SharedRuleAccount[];
}): ReactElement | null {
  return null;
}

export const sharedMailboxesLabel = (): string => "";

export const useProRulesListNotes = (): Array<{
  key: string;
  text: string;
  linkText: string;
  href: string;
}> => [];

export const proRuleConditionError = (
  _fields: string[],
  _logic: string,
): string => "";
export const proRuleTimingNote = (
  _fields: string[],
  _triggers: string[],
): string => "";
