/**
 * Search Operators Service
 *
 * Parses and handles advanced search operators like Gmail-style syntax:
 * - from:sender@email.com
 * - to:recipient@email.com
 * - subject:keyword
 * - has:attachment
 * - is:unread / is:starred / is:read
 * - before:2024-01-01 / after:2024-01-01
 * - in:folder
 * - label:tag
 */

import type { AdvancedSearchFilters } from "@/types/search";

export interface SearchOperator {
  name: string;
  description: string;
  examples: string[];
  valueType: "text" | "boolean" | "date" | "list";
  aliases?: string[];
}

/**
 * Available search operators
 */
export const SEARCH_OPERATORS: SearchOperator[] = [
  {
    name: "from",
    description: "Messages from a specific sender",
    examples: ["from:john@example.com", "from:John"],
    valueType: "text",
  },
  {
    name: "to",
    description: "Messages to a specific recipient",
    examples: ["to:jane@example.com", "to:marketing"],
    valueType: "text",
  },
  {
    name: "subject",
    description: "Messages with specific words in subject",
    examples: ["subject:meeting", "subject:invoice"],
    valueType: "text",
  },
  {
    name: "has",
    description: "Messages with specific attributes",
    examples: ["has:attachment", "has:link"],
    valueType: "list",
  },
  {
    name: "is",
    description: "Messages with specific status",
    examples: ["is:unread", "is:starred", "is:read"],
    valueType: "list",
  },
  {
    name: "before",
    description: "Messages sent before a date",
    examples: ["before:2024-01-01", "before:yesterday"],
    valueType: "date",
  },
  {
    name: "after",
    description: "Messages sent after a date",
    examples: ["after:2024-01-01", "after:lastweek"],
    valueType: "date",
  },
  {
    name: "in",
    description: "Messages in a specific folder",
    examples: ["in:inbox", "in:sent", "in:archive"],
    valueType: "text",
    aliases: ["folder"],
  },
  {
    name: "label",
    description: "Messages with a specific label/tag",
    examples: ["label:work", "label:important"],
    valueType: "text",
    aliases: ["tag"],
  },
  {
    name: "older_than",
    description: "Messages older than a time period",
    examples: ["older_than:7d", "older_than:1m", "older_than:1y"],
    valueType: "text",
  },
  {
    name: "newer_than",
    description: "Messages newer than a time period",
    examples: ["newer_than:7d", "newer_than:1m"],
    valueType: "text",
  },
];

/**
 * Pattern for matching search operators
 * Matches: operator:value or operator:"quoted value"
 */
const OPERATOR_PATTERN = /(\w+):(?:"([^"]+)"|(\S+))/g;

/**
 * Parse a search query into operators and remaining text
 */
export interface ParsedSearchQuery {
  /** Plain text search (non-operator portion) */
  text: string;
  /** Parsed operators */
  operators: { operator: string; value: string }[];
  /** Converted filters */
  filters: AdvancedSearchFilters;
}

/**
 * Parse relative date strings
 */
function parseRelativeDate(value: string): Date | undefined {
  const now = new Date();
  const lowered = value.toLowerCase();

  // Handle relative keywords
  if (lowered === "today") {
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }
  if (lowered === "yesterday") {
    const d = new Date(now);
    d.setDate(d.getDate() - 1);
    return d;
  }
  if (lowered === "lastweek") {
    const d = new Date(now);
    d.setDate(d.getDate() - 7);
    return d;
  }
  if (lowered === "lastmonth") {
    const d = new Date(now);
    d.setMonth(d.getMonth() - 1);
    return d;
  }

  // Handle period format: 7d, 1m, 1y
  const periodMatch = value.match(/^(\d+)([dDwWmMyY])$/);
  if (periodMatch && periodMatch[1] && periodMatch[2]) {
    const amount = parseInt(periodMatch[1], 10);
    const unit = periodMatch[2].toLowerCase();
    const d = new Date(now);

    switch (unit) {
      case "d":
        d.setDate(d.getDate() - amount);
        break;
      case "w":
        d.setDate(d.getDate() - amount * 7);
        break;
      case "m":
        d.setMonth(d.getMonth() - amount);
        break;
      case "y":
        d.setFullYear(d.getFullYear() - amount);
        break;
    }
    return d;
  }

  // Try parsing as ISO date
  const parsed = new Date(value);
  if (!isNaN(parsed.getTime())) {
    return parsed;
  }

  return undefined;
}

/**
 * Parse a search query string into structured data
 */
export function parseSearchQuery(query: string): ParsedSearchQuery {
  const operators: { operator: string; value: string }[] = [];
  const filters: AdvancedSearchFilters = {};

  // Extract operators
  let match;
  while ((match = OPERATOR_PATTERN.exec(query)) !== null) {
    const operator = match[1]?.toLowerCase() ?? "";
    const value = match[2] || match[3] || ""; // quoted or unquoted value

    if (!operator || !value) continue;

    operators.push({ operator, value });

    // Convert to filters
    switch (operator) {
      case "from":
        filters.from = value;
        break;
      case "to":
        filters.to = value;
        break;
      case "subject":
        filters.subject = value;
        break;
      case "has":
        if (value.toLowerCase() === "attachment") {
          filters.hasAttachments = true;
        }
        break;
      case "is":
        switch (value.toLowerCase()) {
          case "unread":
            filters.readStatus = "unread";
            break;
          case "read":
            filters.readStatus = "read";
            break;
          case "starred":
            filters.starred = true;
            break;
        }
        break;
      case "before": {
        const date = parseRelativeDate(value);
        if (date) {
          filters.dateRange = { ...filters.dateRange, end: date };
        }
        break;
      }
      case "after": {
        const date = parseRelativeDate(value);
        if (date) {
          filters.dateRange = { ...filters.dateRange, start: date };
        }
        break;
      }
      case "older_than": {
        const date = parseRelativeDate(value);
        if (date) {
          filters.dateRange = { ...filters.dateRange, end: date };
        }
        break;
      }
      case "newer_than": {
        const date = parseRelativeDate(value);
        if (date) {
          filters.dateRange = { ...filters.dateRange, start: date };
        }
        break;
      }
      case "in":
      case "folder":
        filters.folder = value;
        break;
    }
  }

  // Get remaining text (non-operator portion)
  const text = query.replace(OPERATOR_PATTERN, "").trim();

  return { text, operators, filters };
}

/**
 * Build a search query string from filters
 */
export function buildSearchQuery(
  text: string,
  filters: AdvancedSearchFilters,
): string {
  const parts: string[] = [];

  if (text) {
    parts.push(text);
  }

  if (filters.from) {
    parts.push(`from:${quoteIfNeeded(filters.from)}`);
  }
  if (filters.to) {
    parts.push(`to:${quoteIfNeeded(filters.to)}`);
  }
  if (filters.subject) {
    parts.push(`subject:${quoteIfNeeded(filters.subject)}`);
  }
  if (filters.hasAttachments) {
    parts.push("has:attachment");
  }
  if (filters.readStatus === "unread") {
    parts.push("is:unread");
  }
  if (filters.readStatus === "read") {
    parts.push("is:read");
  }
  if (filters.starred) {
    parts.push("is:starred");
  }
  if (filters.folder) {
    parts.push(`in:${quoteIfNeeded(filters.folder)}`);
  }
  if (filters.dateRange?.start) {
    parts.push(`after:${formatDate(filters.dateRange.start)}`);
  }
  if (filters.dateRange?.end) {
    parts.push(`before:${formatDate(filters.dateRange.end)}`);
  }

  return parts.join(" ");
}

/**
 * Quote a value if it contains spaces
 */
function quoteIfNeeded(value: string): string {
  return value.includes(" ") ? `"${value}"` : value;
}

/**
 * Format date for query
 */
function formatDate(date: Date): string {
  return date.toISOString().split("T")[0] ?? "";
}

/**
 * Get operator suggestions based on partial input
 */
export function getOperatorSuggestions(partial: string): SearchOperator[] {
  const lowered = partial.toLowerCase();

  // Check if user is typing an operator
  const colonIndex = partial.indexOf(":");
  if (colonIndex === -1) {
    // Suggest operators that start with the partial
    return SEARCH_OPERATORS.filter(
      (op) =>
        op.name.startsWith(lowered) ||
        op.aliases?.some((a) => a.startsWith(lowered)),
    );
  }

  return [];
}

/**
 * Get value suggestions for a specific operator
 */
export function getOperatorValueSuggestions(operator: string): string[] {
  switch (operator.toLowerCase()) {
    case "is":
      return ["unread", "read", "starred"];
    case "has":
      return ["attachment", "link"];
    case "in":
    case "folder":
      return ["inbox", "sent", "drafts", "archive", "trash", "spam"];
    case "before":
    case "after":
      return ["today", "yesterday", "lastweek", "lastmonth"];
    case "older_than":
    case "newer_than":
      return ["1d", "7d", "30d", "1m", "3m", "6m", "1y"];
    default:
      return [];
  }
}
