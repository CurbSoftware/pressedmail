"use client";

const SHARED_PANEL_COOKIE_KEY = "react-resizable-panels:layout";
const MIN_PANEL_SIZE = 5;
const MAX_PANEL_SIZE = 95;

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function readCookieValue(key: string): string | null {
  if (typeof document === "undefined") return null;
  const pattern = new RegExp(`(?:^|;\\s*)${escapeRegExp(key)}=([^;]+)`);
  const match = document.cookie.match(pattern);
  return match?.[1] ?? null;
}

function sanitizePanelSizes(
  values: unknown,
  expectedLength?: number,
): number[] | null {
  if (!Array.isArray(values) || values.length === 0) return null;
  if (expectedLength !== undefined && values.length !== expectedLength) {
    return null;
  }
  if (
    !values.every(
      (value) => typeof value === "number" && Number.isFinite(value),
    )
  ) {
    return null;
  }

  const clamped = values.map((value) =>
    Math.min(MAX_PANEL_SIZE, Math.max(MIN_PANEL_SIZE, value)),
  );
  const total = clamped.reduce((sum, value) => sum + value, 0);
  if (!Number.isFinite(total) || total <= 0) return null;

  return clamped.map((value) => (value / total) * 100);
}

export function getPanelLayoutCookieKey(layoutId: string) {
  return `${SHARED_PANEL_COOKIE_KEY}:${layoutId}`;
}

export function readPanelLayoutFromCookie(
  layoutId: string,
  options: { expectedLength?: number; fallbackToShared?: boolean } = {},
): number[] | null {
  const key = getPanelLayoutCookieKey(layoutId);
  const candidates = [
    readCookieValue(key),
    options.fallbackToShared ? readCookieValue(SHARED_PANEL_COOKIE_KEY) : null,
  ].filter((value): value is string => Boolean(value));

  for (const rawValue of candidates) {
    try {
      const decoded = decodeURIComponent(rawValue);
      const parsed = JSON.parse(decoded);
      const sanitized = sanitizePanelSizes(parsed, options.expectedLength);
      if (sanitized) {
        return sanitized;
      }
    } catch {
      continue;
    }
  }

  return null;
}

export function writePanelLayoutCookie(
  layoutId: string,
  sizes: number[],
  options: { cleanupShared?: boolean } = {},
) {
  if (typeof document === "undefined") return;
  const sanitized = sanitizePanelSizes(sizes);
  if (!sanitized) return;
  const key = getPanelLayoutCookieKey(layoutId);
  document.cookie = `${key}=${encodeURIComponent(JSON.stringify(sanitized))}`;

  if (options.cleanupShared && readCookieValue(SHARED_PANEL_COOKIE_KEY)) {
    const expires = "Max-Age=0";
    document.cookie = `${SHARED_PANEL_COOKIE_KEY}=; ${expires}; path=/`;
    document.cookie = `${SHARED_PANEL_COOKIE_KEY}=; ${expires}`;
    if (typeof location !== "undefined") {
      const basePath = location.pathname.replace(/\/[^/]*$/, "/");
      if (basePath && basePath !== "/") {
        document.cookie = `${SHARED_PANEL_COOKIE_KEY}=; ${expires}; path=${basePath}`;
      }
    }
  }
}
