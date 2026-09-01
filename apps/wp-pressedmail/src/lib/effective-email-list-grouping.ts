import type { EmailListGroupingMode } from "./message-grouping";

export function getEffectiveEmailListGrouping(
  preference: EmailListGroupingMode | null | undefined,
): EmailListGroupingMode {
  return preference === "threads" ? "threads" : "list";
}
