/**
 * Free-build stub for PhishingIndicator. Phishing detection is a Pro feature
 * (gated by __ENABLE_PHISHING_DETECTION__); the real component already renders
 * null when disabled, so the free build aliases this path to an inert stub and
 * does not bundle the phishing implementation.
 */
export function PhishingIndicator(_props: Record<string, unknown>): null {
  return null;
}

export default PhishingIndicator;
