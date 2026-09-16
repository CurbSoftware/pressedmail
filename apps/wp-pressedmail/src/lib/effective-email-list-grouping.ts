import { isFreeBuild } from "./build-variant";
import type { EmailListGroupingMode } from "./message-grouping";

/**
 * The grouping the inbox should actually render.
 *
 * Threaded view belongs to the paid edition. The Free build ships no control
 * for it, so a profile that still stores `threads` from an older release, or
 * that arrives from a Pro install, must not start grouping conversations. Both
 * branches resolve at build time, so the Pro bundle drops the Free check.
 */
export function getEffectiveEmailListGrouping(
  preference: EmailListGroupingMode | null | undefined,
): EmailListGroupingMode {
  if (isFreeBuild()) {
    return "list";
  }

  return preference === "threads" ? "threads" : "list";
}
