import { useEffect, useRef } from "react";
import { useSearchParams } from "react-router-dom";

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseEntityPrefix(paramKey: string): string | null {
  const match = paramKey.match(/^open(.+)Id$/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function parseOpenEntityId(raw: string, paramKey: string): number | null {
  const value = raw.trim();
  if (/^\d+$/.test(value)) {
    return Number.parseInt(value, 10);
  }

  const prefix = parseEntityPrefix(paramKey);
  if (!prefix) {
    return null;
  }

  const prefixedMatch = value.match(
    new RegExp(`^${escapeRegExp(prefix)}[_-](\\d+)$`, "i"),
  );
  if (!prefixedMatch?.[1]) {
    return null;
  }

  return Number.parseInt(prefixedMatch[1], 10);
}

/**
 * Reads a one-shot id from the URL search params and hands it to a callback.
 *
 * The header search drops things like `?openContactId=42` onto the URL when a
 * user picks a typeahead result; pages consume the param to focus the right
 * entity. After the callback fires the param is removed so refreshes do not
 * re-trigger it.
 */
export function useOpenFromSearchParam(
  paramKey: string,
  onOpen: (id: number) => void | boolean,
  relatedParamKeys: readonly string[] = [],
): void {
  const [searchParams, setSearchParams] = useSearchParams();
  const seenRef = useRef<string | null>(null);
  const relatedParamKey = relatedParamKeys.join("|");

  useEffect(() => {
    const raw = searchParams.get(paramKey);
    if (!raw) {
      seenRef.current = null;
      return;
    }
    if (raw === seenRef.current) return;
    const parsed = parseOpenEntityId(raw, paramKey);
    if (parsed === null || !Number.isSafeInteger(parsed)) return;
    const opened = onOpen(parsed);
    if (opened === false) return;
    seenRef.current = raw;
    const next = new URLSearchParams(searchParams);
    next.delete(paramKey);
    for (const key of relatedParamKey.split("|").filter(Boolean)) {
      next.delete(key);
    }
    setSearchParams(next, { replace: true });
  }, [paramKey, relatedParamKey, searchParams, setSearchParams, onOpen]);
}
