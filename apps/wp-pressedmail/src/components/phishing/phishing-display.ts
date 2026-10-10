import { __, sprintf } from "@wordpress/i18n";

import type { PhishingIconMark } from "@/components/icons/PhishingIcons";
import { SECURITY_BANDS } from "@/lib/security-bands";
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
  // The server's own band beats re-deriving one from the score here.
  if (result.band === "safe" || result.band === "caution" || result.band === "danger") {
    return result.band;
  }

  const level = result.suspect_level as PhishingSuspectLevel | undefined;
  if (level === "high") return "danger";
  if (level === "medium") return "caution";
  if (level === "low") return "safe";

  if (result.risk_score >= SECURITY_BANDS.phishing.danger[0]) return "danger";
  if (result.risk_score >= SECURITY_BANDS.phishing.caution[0]) return "caution";
  return result.is_suspicious ? "caution" : "safe";
}

/** The words for a result: its band's name. */
export function getPhishingResultLabel(
  result: PhishingAnalysisResult | null | undefined,
): string {
  return getPhishingRiskLabel(getPhishingVerdict(result) ?? "safe");
}

/**
 * How confident the check is that this message is phishing, from 0 (certainly not) to 100 (certainly), or null
 * when the result carries none. An unknown confidence is never shown as 0: that would read as "certainly safe".
 * A server before this release stored a check that could not judge as safe at 0, so a 0 on an abstained result is
 * "no number", never "certainly not phishing".
 */
export function phishingConfidenceOf(
  result: Partial<Pick<PhishingAnalysisResult, "risk_score" | "abstained">> | null | undefined,
): number | null {
  const score = result?.risk_score;
  if (typeof score !== "number" || !Number.isFinite(score)) return null;
  const confidence = Math.max(0, Math.min(100, Math.round(score)));
  return result?.abstained && confidence === 0 ? null : confidence;
}

/** "Phishing confidence 88%", or "" when the result carries no number. */
export function phishingConfidenceText(
  result: Partial<Pick<PhishingAnalysisResult, "risk_score" | "abstained">> | null | undefined,
): string {
  const confidence = phishingConfidenceOf(result);
  return confidence === null
    ? ""
    : sprintf(
        /* translators: %d: how confident the check is that a message is phishing, from 0 to 100. */
        __("Phishing confidence %d%%", "pressedmail"),
        confidence,
      );
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
        visibleLabel: __("Looks safe", "pressedmail"),
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
        ariaLabel: __("Likely phishing", "pressedmail"),
        visibleLabel: __("Likely phishing", "pressedmail"),
        tooltip: __("Likely phishing", "pressedmail"),
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
 * The mark the fish wears for a verdict, so colour is never the only signal:
 * a check, a warning triangle and a cross, as on the spam bag beside it. Any
 * other state draws the plain fish.
 */
export function getPhishingMark(status: PhishingUiStatus): PhishingIconMark {
  if (status === "safe") return "check";
  if (status === "caution") return "warn";
  if (status === "danger") return "cross";
  return "none";
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

  return __("Looks safe", "pressedmail");
}

export function getPhishingBannerTitle(verdict: PhishingVerdict): string {
  if (verdict === "danger") {
    return __("Likely phishing", "pressedmail");
  }

  if (verdict === "caution") {
    return __("Potential phishing indicators found", "pressedmail");
  }

  return __("No phishing indicators found", "pressedmail");
}

/** The band and the confidence on one line, for a toast or a handling line: "Suspicious, phishing confidence 62%". */
export function describePhishingBrief(
  result: PhishingAnalysisResult | null | undefined,
): string {
  const label = getPhishingResultLabel(result);
  const confidence = phishingConfidenceOf(result);
  return confidence === null
    ? label
    : sprintf(
        /* translators: 1: the phishing result, such as "Suspicious". 2: how confident the check is that it is phishing, a number from 0 to 100. */
        __("%1$s, phishing confidence %2$d%%", "pressedmail"),
        label,
        confidence,
      );
}
