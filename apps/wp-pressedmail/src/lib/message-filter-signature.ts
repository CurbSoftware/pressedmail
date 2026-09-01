import type { MessageFilters } from "@/services/interfaces";

function normalizeFilterValue(value: unknown): unknown {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? "" : value.toISOString();
  }

  if (Array.isArray(value)) {
    return value.map(normalizeFilterValue);
  }

  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entryValue]) => entryValue !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entryValue]) => [key, normalizeFilterValue(entryValue)]),
    );
  }

  return value;
}

export function getMessageFilterSignature(
  filters?: MessageFilters | null,
): string {
  return JSON.stringify(normalizeFilterValue(filters ?? {}));
}
