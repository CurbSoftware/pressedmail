import { __ } from "@wordpress/i18n";

import type {
  PhishingAnalysisResult,
  PhishingSuspectLevel,
  PhishingVerdict,
} from "@/types/phishing";

export type PhishingUiStatus =
  | "unavailable"
  | "unchecked"
  | "checking"
  | "safe"
  | "caution"
  | "danger"
  | "error";

export function getPhishingVerdict(
  result: PhishingAnalysisResult | null | undefined,
): PhishingVerdict | null {
  if (!result) return null;
  if (result.verdict) return result.verdict;

  const level = result.suspect_level as PhishingSuspectLevel | undefined;
  if (level === "high") return "danger";
  if (level === "medium") return "caution";
  if (level === "low") return "safe";

  if (result.risk_score >= 61) return "danger";
  if (result.risk_score >= 31) return "caution";
  return result.is_suspicious ? "caution" : "safe";
}

export function getPhishingSafetyRating(
  result: PhishingAnalysisResult,
): number {
  return result.safety_rating ?? Math.max(0, 100 - result.risk_score);
}

export function getPhishingStatus({
  enabled,
  isScanning,
  result,
  hasError,
}: {
  enabled: boolean;
  isScanning: boolean;
  result: PhishingAnalysisResult | null;
  hasError: boolean;
}): PhishingUiStatus {
  if (!enabled) return "unavailable";
  if (isScanning) return "checking";
  const verdict = getPhishingVerdict(result);
  if (verdict) return verdict;
  if (hasError) return "error";
  return "unchecked";
}

export function getPhishingButtonCopy(status: PhishingUiStatus): {
  ariaLabel: string;
  visibleLabel: string;
  tooltip: string;
  iconClassName: string;
  buttonClassName: string;
} {
  switch (status) {
    case "checking":
      return {
        ariaLabel: __("Checking message for phishing", "pressedmail"),
        visibleLabel: __("Checking", "pressedmail"),
        tooltip: __("Checking message for phishing", "pressedmail"),
        iconClassName: "text-primary",
        buttonClassName: "text-primary",
      };
    case "safe":
      return {
        ariaLabel: __("No phishing indicators found", "pressedmail"),
        visibleLabel: __("Safe", "pressedmail"),
        tooltip: __("No phishing indicators found", "pressedmail"),
        iconClassName: "text-success",
        buttonClassName: "text-success hover:bg-success/10 hover:text-success",
      };
    case "caution":
      return {
        ariaLabel: __("Potential phishing indicators found", "pressedmail"),
        visibleLabel: __("Review", "pressedmail"),
        tooltip: __("Potential phishing indicators found", "pressedmail"),
        iconClassName: "text-warning",
        buttonClassName: "text-warning hover:bg-warning/10 hover:text-warning",
      };
    case "danger":
      return {
        ariaLabel: __("High-risk phishing warning", "pressedmail"),
        visibleLabel: __("High risk", "pressedmail"),
        tooltip: __("High-risk phishing warning", "pressedmail"),
        iconClassName: "text-destructive",
        buttonClassName:
          "text-destructive hover:bg-destructive/10 hover:text-destructive",
      };
    case "error":
      return {
        ariaLabel: __("Could not check message", "pressedmail"),
        visibleLabel: __("Error", "pressedmail"),
        tooltip: __("Could not check message", "pressedmail"),
        iconClassName: "text-muted-foreground",
        buttonClassName: "text-muted-foreground",
      };
    case "unavailable":
      return {
        ariaLabel: __("Phishing detection unavailable", "pressedmail"),
        visibleLabel: __("Unavailable", "pressedmail"),
        tooltip: __("Phishing detection unavailable", "pressedmail"),
        iconClassName: "text-muted-foreground",
        buttonClassName: "text-muted-foreground",
      };
    case "unchecked":
    default:
      return {
        ariaLabel: __("Run phishing detection", "pressedmail"),
        visibleLabel: __("Safety", "pressedmail"),
        tooltip: __("Run phishing detection", "pressedmail"),
        iconClassName: "text-primary",
        buttonClassName: "text-primary hover:bg-primary/10",
      };
  }
}

/**
 * Short risk-tier label for the report header badge.
 * Mirrors the spec's Safe / Suspicious / Likely phishing tiers.
 */
export function getPhishingRiskLabel(verdict: PhishingVerdict): string {
  if (verdict === "danger") {
    return __("Likely phishing", "pressedmail");
  }

  if (verdict === "caution") {
    return __("Suspicious", "pressedmail");
  }

  return __("Safe", "pressedmail");
}

export function getPhishingBannerTitle(verdict: PhishingVerdict): string {
  if (verdict === "danger") {
    return __("High-risk phishing warning", "pressedmail");
  }

  if (verdict === "caution") {
    return __("Potential phishing indicators found", "pressedmail");
  }

  return __("No phishing indicators found", "pressedmail");
}
