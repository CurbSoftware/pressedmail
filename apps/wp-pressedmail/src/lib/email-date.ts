import { formatDistanceToNow } from "date-fns";

const EXPLICIT_TIMEZONE_PATTERN = /(?:[zZ]|[+-]\d{2}:?\d{2})$/;
const NAIVE_DATETIME_PATTERN =
  /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}(?::\d{2}(?:\.\d{1,6})?)?)$/;
const NUMERIC_TIMESTAMP_PATTERN = /^-?\d+(?:\.\d+)?$/;
const MILLISECOND_TIMESTAMP_THRESHOLD = 100_000_000_000;

function isValidDate(date: Date): boolean {
  return !Number.isNaN(date.getTime());
}

function parseNumericTimestamp(value: number): Date | null {
  const timestamp =
    Math.abs(value) < MILLISECOND_TIMESTAMP_THRESHOLD ? value * 1000 : value;
  const date = new Date(timestamp);
  return isValidDate(date) ? date : null;
}

export function parseEmailDate(value: unknown): Date | null {
  if (value instanceof Date) {
    const date = new Date(value.getTime());
    return isValidDate(date) ? date : null;
  }

  if (typeof value === "number") {
    return parseNumericTimestamp(value);
  }

  if (typeof value !== "string") {
    return null;
  }

  const raw = value.trim();
  if (!raw) {
    return null;
  }

  if (NUMERIC_TIMESTAMP_PATTERN.test(raw)) {
    return parseNumericTimestamp(Number(raw));
  }

  const naiveDateTime = raw.match(NAIVE_DATETIME_PATTERN);
  const normalizedInput =
    naiveDateTime && !EXPLICIT_TIMEZONE_PATTERN.test(raw)
      ? `${naiveDateTime[1]}T${naiveDateTime[2]}Z`
      : raw;

  const date = new Date(normalizedInput);
  return isValidDate(date) ? date : null;
}

export function normalizeEmailDate(value: unknown): string | undefined {
  return parseEmailDate(value)?.toISOString();
}

export function formatEmailRelativeTime(value: unknown): string {
  const date = parseEmailDate(value);
  return date ? formatDistanceToNow(date, { addSuffix: true }) : "";
}
