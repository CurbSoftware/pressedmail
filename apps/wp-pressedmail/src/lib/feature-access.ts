/**
 * Who may use Campaigns, Templates and Forms: the server's answer for the
 * signed-in user (Services/FeatureAccess.php, in the Pro runtime data as
 * `featureAccess`). Administrators always may. A page without the answer reads
 * as before the setting existed: campaigns for administrators only, templates
 * and forms for everyone. The
 * server decides either way; this only keeps a screen from offering what it
 * would refuse.
 */
export type GatedFeature = "campaigns" | "templates" | "forms";

export function featureAllowed(feature: GatedFeature): boolean {
  const answer = window.pressedmailPlugin?.featureAccess?.[feature];
  if (typeof answer === "boolean") return answer;
  return feature === "campaigns"
    ? Boolean(window.pressedmailPlugin?.canManageWpMail)
    : true;
}
