"use client";

/**
 * Inert auto-scan hook for builds without phishing detection.
 *
 * The reading pane renders its scan gate behind `__ENABLE_PHISHING_DETECTION__`,
 * so the real hook is dead code in a Free build. It was still the module the
 * specifier resolved to, which kept the phishing analysis client, its context
 * and its API client in the published Free source tree. Aliasing to this stub
 * cuts that edge at the specifier instead of relying on dead-code elimination.
 */

import type { EmailMessage } from "@/types";

interface UseMessagePhishingAutoScanOptions {
  message: EmailMessage | null;
  accountId: number | null;
  enabled?: boolean;
}

export function useMessagePhishingAutoScan(
  _options: UseMessagePhishingAutoScanOptions,
): void {}

export default useMessagePhishingAutoScan;
