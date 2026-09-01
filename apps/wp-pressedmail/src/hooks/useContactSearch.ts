import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch } from "@/lib/api-client";
import { getRuntimeRestRoot } from "@/lib/runtime-config";

export interface ContactSearchResult {
  id: number;
  email: string;
  first_name: string | null;
  last_name: string | null;
}

interface UseContactSearchOptions {
  debounceMs?: number;
}

const DEFAULT_DEBOUNCE_MS = 200;

function buildSearchUrl(query: string): string {
  const root = getRuntimeRestRoot();
  const base = root.endsWith("/") ? root : `${root}/`;
  return `${base}wp/v1/pressedmail/contacts/search?q=${encodeURIComponent(query)}`;
}

export function useContactSearch({
  debounceMs = DEFAULT_DEBOUNCE_MS,
}: UseContactSearchOptions = {}) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ContactSearchResult[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return;
    }

    const timeoutId = setTimeout(async () => {
      const currentId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const res = await apiFetch(buildSearchUrl(trimmed), {
          headers: {
            Accept: "application/json",
          },
          credentials: "same-origin",
        });
        if (!res.ok) {
          if (currentId === requestIdRef.current) {
            setError(`HTTP ${res.status}`);
            setResults([]);
            setIsLoading(false);
          }
          return;
        }
        const payload = (await res.json()) as {
          contacts?: ContactSearchResult[];
          data?: ContactSearchResult[];
        };
        if (currentId !== requestIdRef.current) return;
        const list = payload.contacts ?? payload.data ?? [];
        setResults(Array.isArray(list) ? list : []);
        setIsLoading(false);
      } catch (e) {
        if (currentId !== requestIdRef.current) return;
        setError(e instanceof Error ? e.message : "unknown error");
        setResults([]);
        setIsLoading(false);
      }
    }, debounceMs);

    return () => clearTimeout(timeoutId);
  }, [query, debounceMs]);

  const updateQuery = useCallback((next: string) => setQuery(next), []);

  return {
    query,
    setQuery: updateQuery,
    results,
    isLoading,
    error,
  };
}
