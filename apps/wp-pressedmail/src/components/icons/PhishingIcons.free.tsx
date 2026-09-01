/**
 * Free-edition phishing icons: render nothing.
 *
 * Shared inbox chrome references these icons unconditionally and hides them at
 * runtime, which kept phishing iconography in the Free bundle. Phishing is Pro.
 */
import { forwardRef } from "react";

type PhishingIconProps = React.SVGProps<SVGSVGElement>;

export const PhishingRodIcon = forwardRef<SVGSVGElement, PhishingIconProps>(
  function PhishingRodIcon() {
    return null;
  },
);

export const PhishingFishIcon = forwardRef<SVGSVGElement, PhishingIconProps>(
  function PhishingFishIcon() {
    return null;
  },
);
