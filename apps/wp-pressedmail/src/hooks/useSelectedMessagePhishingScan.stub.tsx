"use client";

import type { PhishingUiStatus } from "@/components/phishing/phishing-display";
import type { EmailMessage } from "@/types";
import type { PhishingAnalysisResult } from "@/types/phishing";

interface SelectedMessagePhishingScanResult {
  phishingEnabled: boolean;
  isScanning: boolean;
  phishingStatus: PhishingUiStatus;
  analysisResult: PhishingAnalysisResult | null;
  runScan: () => Promise<void>;
}

const disabledScanResult: SelectedMessagePhishingScanResult = {
  phishingEnabled: false,
  isScanning: false,
  phishingStatus: "unavailable",
  analysisResult: null,
  runScan: async () => {},
};

export function useSelectedMessagePhishingScan(
  _message: EmailMessage | null,
): SelectedMessagePhishingScanResult {
  return disabledScanResult;
}

export default useSelectedMessagePhishingScan;
