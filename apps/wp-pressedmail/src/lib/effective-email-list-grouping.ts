import type { EmailListGroupingMode } from "./message-grouping";

/**
 * The grouping the inbox should actually render.
 *
 * Every edition honours the stored preference. Threaded view is not a paid
 * feature: the threading service, the threaded snapshot and the threaded
 * branch of the messages controller all ship in the Free package, and both
 * editions carry a control for it. This function exists to normalize a missing
 * or unknown stored value, nothing more.
 */
export function getEffectiveEmailListGrouping(
  preference: EmailListGroupingMode | null | undefined,
): EmailListGroupingMode {
  return preference === "threads" ? "threads" : "list";
}
