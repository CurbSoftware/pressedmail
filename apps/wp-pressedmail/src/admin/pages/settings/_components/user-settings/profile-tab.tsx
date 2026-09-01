import { SignatureManager } from "@/components/signatures/SignatureManager";

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
    </div>
  );
}
