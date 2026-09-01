/**
 * Build variant helpers.
 *
 * Thin wrappers around the Vite-defined `__IS_FREE__` / `__IS_PRO__`
 * globals. Centralized so feature code can call a function and tests
 * can `vi.mock` this module instead of fighting compile-time defines.
 */

export function isFreeBuild(): boolean {
  return __IS_FREE__;
}

export function isProBuild(): boolean {
  return __IS_PRO__;
}

/**
 * Read a Vite `__ENABLE_*__` build flag value, treating an absent flag (a
 * runtime/test context that never defined it) as disabled rather than throwing.
 */
function readEnableFlag(value: boolean | undefined): boolean {
  return value === true;
}

/**
 * Email Summarize is a Pro AI feature; its `/ai/summarize/*` routes are absent
 * from the free build. Callers must gate on this before fetching so the free
 * build never triggers a 404 (e.g. the inbox status poll on list load).
 */
export function isAiSummarizeBuildEnabled(): boolean {
  if (isFreeBuild()) {
    return false;
  }

  return typeof __ENABLE_AI_SUMMARIZE__ === "boolean"
    ? __ENABLE_AI_SUMMARIZE__
    : readEnableFlag(
        (globalThis as { __ENABLE_AI_SUMMARIZE__?: boolean })
          .__ENABLE_AI_SUMMARIZE__,
      );
}

/**
 * Process / activity manager: the task queue panel (the Tasks section in the
 * activity sheet) plus the footer's active-task fragment. Intentionally ALWAYS
 * ON in BOTH free and pro builds. The `process-queue` REST routes are free-safe
 * and the queue drives ordinary sync/sweep progress, so there is no feature flag
 * and no free-build gate. Kept as a function (not a constant) so feature code
 * reads a single helper and tests can `vi.mock` this module.
 */
export function isProcessManagerBuildEnabled(): boolean {
  return true;
}
