import { lazy, Suspense } from "react";
import { __ } from "@wordpress/i18n";
import { SettingsSkeleton } from "@/components/settings-ui";
import { SignatureManager } from "@/components/signatures/SignatureManager";

const SignatureRulesManager = __IS_PRO__
  ? lazy(() =>
      import("@/components/signatures/SignatureRulesManager.pro").then(
        (module) => ({ default: module.SignatureRulesManager }),
      ),
    )
  : null;

/**
 * Signatures Section - Email signature management
 */
function SignaturesSection() {
  return <SignatureManager hideHeader />;
}

export function SignaturesTab() {
  return (
    <div className="space-y-6">
      <SignaturesSection />
      {SignatureRulesManager ? (
        <Suspense
          fallback={
            <SettingsSkeleton
              label={__("Loading signature rules", "pressedmail")}
              rows={2}
            />
          }>
          <SignatureRulesManager />
        </Suspense>
      ) : null}
    </div>
  );
}
