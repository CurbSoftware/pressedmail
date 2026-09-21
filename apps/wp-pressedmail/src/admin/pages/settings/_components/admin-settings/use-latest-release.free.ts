"use client";

import { __ } from "@wordpress/i18n";

/**
 * The "latest release version" diagnostics row for the Free edition.
 *
 * WordPress.org owns Free updates, so there is nothing to check and no route
 * to call. Reporting the channel without a request is the whole behaviour; the
 * Pro lookup, its endpoint and its copy live in `use-latest-release.ts`, which
 * the Free build never compiles.
 */
export interface LatestRelease {
  label: string;
  value: string;
}

export function useLatestRelease(_currentVersion: string): LatestRelease {
  return {
    label: __("Latest release version (Free)", "pressedmail"),
    value: __("Managed by WordPress.org", "pressedmail"),
  };
}
