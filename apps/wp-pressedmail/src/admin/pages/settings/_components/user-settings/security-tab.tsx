import { SecuritySettingsCard } from "../../security-settings-card";

/**
 * SecurityTab: user-facing security preferences.
 *
 * Credential / storage / remote-content controls. Phishing detection is now
 * admin-controlled only (admin policy: Off / Enforce / Optional under
 * AI Tools → Phishing), so there is no per-user phishing sub-tab here.
 */
export function SecurityTab() {
  return (
    <div className="space-y-4" data-test="user-security-page">
      <SecuritySettingsCard />
    </div>
  );
}
