import type { ReactNode } from "react";

import { AppErrorBoundary } from "@/components/AppErrorBoundary";
import AppProvider from "@/context/AppProvider";
import { ComposerProvider } from "@/context/composer";
import { FeaturesProvider } from "@/context/features";
import { InboxProvider } from "@/context/InboxContext";
import { SignaturesProvider } from "@/context/signatures";
import { TagsProvider } from "@/context/tags";

interface FreeProvidersProps {
  children: ReactNode;
}

/** Provider graph for functionality physically included in the public build. */
export function FreeProviders({ children }: FreeProvidersProps) {
  return (
    <AppErrorBoundary>
      <AppProvider>
        <FeaturesProvider>
          <TagsProvider>
            <SignaturesProvider>
              <InboxProvider>
                <ComposerProvider>{children}</ComposerProvider>
              </InboxProvider>
            </SignaturesProvider>
          </TagsProvider>
        </FeaturesProvider>
      </AppProvider>
    </AppErrorBoundary>
  );
}

export default FreeProviders;
