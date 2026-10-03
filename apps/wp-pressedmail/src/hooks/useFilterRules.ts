/**
 * useFilterRules Hook
 *
 * React hook for managing filter rules state and operations.
 */

import { useState, useCallback } from "react";
import type {
  FilterRule,
  FilterRuleSchema,
  CreateFilterRuleData,
  UpdateFilterRuleData,
} from "@/types/filter-rules";
import {
  fetchFilterRuleList,
  createFilterRule,
  updateFilterRule,
  deleteFilterRule,
  toggleFilterRule,
  reorderFilterRules,
} from "@/services/filter-rules.service";

export interface UseFilterRulesOptions {
  accountId: number | null;
  autoLoad?: boolean;
  /** Read and write the owner's rules of a mailbox shared with this user. */
  sharedAccountId?: number | null;
}

export interface UseFilterRulesReturn {
  rules: FilterRule[];
  /** What this site can build rules from; null until the first load. */
  schema: FilterRuleSchema | null;
  loading: boolean;
  error: string | null;
  /** The server's code for the last failed save, when it sent one. */
  errorCode: string | null;
  loadRules: () => Promise<void>;
  addRule: (data: CreateFilterRuleData) => Promise<FilterRule | null>;
  editRule: (
    ruleId: string,
    data: UpdateFilterRuleData,
  ) => Promise<FilterRule | null>;
  removeRule: (ruleId: string) => Promise<boolean>;
  toggleRule: (ruleId: string, enabled: boolean) => Promise<boolean>;
  reorderRules: (ruleIds: string[]) => Promise<boolean>;
  clearError: () => void;
}

export function useFilterRules(
  options: UseFilterRulesOptions,
): UseFilterRulesReturn {
  const { accountId } = options;
  // Shared-inbox rules are Pro. Free reads and writes only its own rules.
  const sharedAccountId = __IS_FREE__ ? null : (options.sharedAccountId ?? null);

  const [rules, setRules] = useState<FilterRule[]>([]);
  const [schema, setSchema] = useState<FilterRuleSchema | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetched = await fetchFilterRuleList(accountId, sharedAccountId);
      setRules(fetched.rules);
      setSchema(fetched.schema);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load filter rules",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId, sharedAccountId]);

  const addRule = useCallback(
    async (data: CreateFilterRuleData): Promise<FilterRule | null> => {
      setError(null);

      const result = await createFilterRule(
        {
          ...data,
          accountId:
            typeof data.accountId === "number"
              ? data.accountId
              : (accountId ?? 0),
        },
        sharedAccountId,
      );
      if (result.success && result.rule) {
        setRules((prev) => [...prev, result.rule!]);
        return result.rule;
      }

      setError(result.error || "Failed to create filter rule");
      setErrorCode(result.errorCode ?? null);
      return null;
    },
    [accountId, sharedAccountId],
  );

  const editRule = useCallback(
    async (
      ruleId: string,
      data: UpdateFilterRuleData,
    ): Promise<FilterRule | null> => {
      setError(null);

      const result = await updateFilterRule(ruleId, data, sharedAccountId);
      if (result.success && result.rule) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? result.rule! : r)),
        );
        return result.rule;
      }

      setError(result.error || "Failed to update filter rule");
      setErrorCode(result.errorCode ?? null);
      return null;
    },
    [sharedAccountId],
  );

  const removeRule = useCallback(async (ruleId: string): Promise<boolean> => {
    setError(null);

    const result = await deleteFilterRule(ruleId, sharedAccountId);
    if (result.success) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      return true;
    }

    setError(result.error || "Failed to delete filter rule");
    return false;
  }, [sharedAccountId]);

  const toggleRuleEnabled = useCallback(
    async (ruleId: string, enabled: boolean): Promise<boolean> => {
      setError(null);

      const result = await toggleFilterRule(ruleId, enabled, sharedAccountId);
      if (result.success && result.rule) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? result.rule! : r)),
        );
        return true;
      }

      setError(result.error || "Failed to toggle filter rule");
      return false;
    },
    [sharedAccountId],
  );

  const reorderRulesHandler = useCallback(
    async (ruleIds: string[]): Promise<boolean> => {
      setError(null);

      const result = await reorderFilterRules(ruleIds, sharedAccountId);
      if (result.success) {
        // Reorder locally
        const orderedRules = ruleIds
          .map((id) => rules.find((r) => r.id === id))
          .filter((r): r is FilterRule => r !== undefined);
        setRules(orderedRules);
        return true;
      }

      setError(result.error || "Failed to reorder filter rules");
      return false;
    },
    [rules, sharedAccountId],
  );

  const clearError = useCallback(() => {
    setError(null);
    setErrorCode(null);
  }, []);

  return {
    rules,
    schema,
    loading,
    error,
    errorCode,
    loadRules,
    addRule,
    editRule,
    removeRule,
    toggleRule: toggleRuleEnabled,
    reorderRules: reorderRulesHandler,
    clearError,
  };
}

export default useFilterRules;
