/**
 * useFilterRules Hook
 *
 * React hook for managing filter rules state and operations.
 */

import { useState, useCallback } from "react";
import type {
  FilterRule,
  CreateFilterRuleData,
  UpdateFilterRuleData,
} from "@/types/filter-rules";
import {
  fetchFilterRules,
  createFilterRule,
  updateFilterRule,
  deleteFilterRule,
  toggleFilterRule,
  reorderFilterRules,
} from "@/services/filter-rules.service";

export interface UseFilterRulesOptions {
  accountId: number | null;
  autoLoad?: boolean;
}

export interface UseFilterRulesReturn {
  rules: FilterRule[];
  loading: boolean;
  error: string | null;
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

  const [rules, setRules] = useState<FilterRule[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRules = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const fetchedRules = await fetchFilterRules(accountId);
      setRules(fetchedRules);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to load filter rules",
      );
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  const addRule = useCallback(
    async (data: CreateFilterRuleData): Promise<FilterRule | null> => {
      setError(null);

      const result = await createFilterRule({
        ...data,
        accountId:
          typeof data.accountId === "number"
            ? data.accountId
            : (accountId ?? 0),
      });
      if (result.success && result.rule) {
        setRules((prev) => [...prev, result.rule!]);
        return result.rule;
      }

      setError(result.error || "Failed to create filter rule");
      return null;
    },
    [accountId],
  );

  const editRule = useCallback(
    async (
      ruleId: string,
      data: UpdateFilterRuleData,
    ): Promise<FilterRule | null> => {
      setError(null);

      const result = await updateFilterRule(ruleId, data);
      if (result.success && result.rule) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? result.rule! : r)),
        );
        return result.rule;
      }

      setError(result.error || "Failed to update filter rule");
      return null;
    },
    [],
  );

  const removeRule = useCallback(async (ruleId: string): Promise<boolean> => {
    setError(null);

    const result = await deleteFilterRule(ruleId);
    if (result.success) {
      setRules((prev) => prev.filter((r) => r.id !== ruleId));
      return true;
    }

    setError(result.error || "Failed to delete filter rule");
    return false;
  }, []);

  const toggleRuleEnabled = useCallback(
    async (ruleId: string, enabled: boolean): Promise<boolean> => {
      setError(null);

      const result = await toggleFilterRule(ruleId, enabled);
      if (result.success && result.rule) {
        setRules((prev) =>
          prev.map((r) => (r.id === ruleId ? result.rule! : r)),
        );
        return true;
      }

      setError(result.error || "Failed to toggle filter rule");
      return false;
    },
    [],
  );

  const reorderRulesHandler = useCallback(
    async (ruleIds: string[]): Promise<boolean> => {
      setError(null);

      const result = await reorderFilterRules(accountId ?? 0, ruleIds);
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
    [accountId, rules],
  );

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    rules,
    loading,
    error,
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
