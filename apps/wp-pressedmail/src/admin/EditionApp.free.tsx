import { StrictMode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { RouterProvider } from "react-router-dom";

import { AdminSettingsProvider } from "@/context/admin-settings";
import { LayoutProvider } from "@/components/layouts";
import { ThemeProvider as UIThemeProvider } from "@/components/themes/ThemeProvider";
import { ThemeProvider } from "@/components/theme-provider";
import { ImpersonationGate } from "@/components/security/ImpersonationGate";
import { LockGate } from "@/components/security/LockGate";
import { LocaleProvider } from "@/context/i18n/LocaleProvider";
import { MediaLibraryPickerProvider } from "@/components/inbox/compose/media-library/MediaLibraryPickerProvider";
import { PressedMailToaster } from "@/components/ui/pressedmail-toaster";
import { queryClient } from "@/lib/query-client";

import { FreeProviders } from "./components/FreeProviders";
import { router } from "./routes.free";

export function EditionApp() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider defaultTheme="system" storageKey="vite-ui-theme">
        <AdminSettingsProvider>
          <UIThemeProvider initialTheme="pressedm" isPro={false}>
            <LayoutProvider>
              <StrictMode>
                <ImpersonationGate>
                  <LockGate>
                    <FreeProviders>
                      <LocaleProvider>
                        <MediaLibraryPickerProvider>
                          <RouterProvider
                            router={router}
                            future={{ v7_startTransition: true }}
                          />
                        </MediaLibraryPickerProvider>
                      </LocaleProvider>
                      <PressedMailToaster />
                    </FreeProviders>
                  </LockGate>
                </ImpersonationGate>
              </StrictMode>
            </LayoutProvider>
          </UIThemeProvider>
        </AdminSettingsProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default EditionApp;
