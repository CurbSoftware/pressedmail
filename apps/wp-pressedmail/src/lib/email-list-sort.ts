import { parseEmailDate } from "@/lib/email-date";
import type { EmailMessage } from "@/types";

export type EmailListSortColumn = "from" | "subject" | "date";
export type EmailListSortOrder = "asc" | "desc";

export interface EmailListSortState {
  column: EmailListSortColumn;
  order: EmailListSortOrder;
}

export const DEFAULT_EMAIL_LIST_SORT: EmailListSortState = {
  column: "date",
  order: "desc",
};

export function getNextEmailListSortState(
  current: EmailListSortState,
  column: EmailListSortColumn,
): EmailListSortState {
  if (current.column === column) {
    return {
      column,
      order: current.order === "asc" ? "desc" : "asc",
    };
  }

  return {
    column,
    order: "desc",
  };
}

export function sortEmailMessages(
  messages: EmailMessage[],
  sort: EmailListSortState,
): EmailMessage[] {
  return [...messages].sort((a, b) => {
    const comparison = (() => {
      switch (sort.column) {
        case "from":
          return (a.from ?? "").localeCompare(b.from ?? "");
        case "subject":
          return (a.subject ?? "").localeCompare(b.subject ?? "");
        case "date":
        default:
          return (
            (parseEmailDate(a.receivedDate ?? a.date)?.getTime() ?? 0) -
            (parseEmailDate(b.receivedDate ?? b.date)?.getTime() ?? 0)
          );
      }
    })();

    return sort.order === "asc" ? comparison : -comparison;
  });
}
