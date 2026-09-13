"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import { CheckCircle2, MailCheck, Plus } from "lucide-react";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { appMessage } from "@/context/toast";
import { buildMailtoHandlerUrl } from "@/lib/mailto";

import { useInstallPrompt } from "./useInstallPrompt";

function InstructionCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section
      aria-label={__("Installation instructions", "pressedmail")}
      className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

function installPlatform(): "apple" | "android" | "other" {
  const ua = navigator.userAgent;
  if (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
    return "apple";
  return /Android/.test(ua) ? "android" : "other";
}

export function MobileInstallScreen() {
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const [mailtoStatus, setMailtoStatus] = React.useState<
    "idle" | "registered" | "unsupported"
  >("idle");
  const platform = React.useMemo(installPlatform, []);

  const registerMailto = React.useCallback(() => {
    const registerProtocolHandler =
      navigator.registerProtocolHandler?.bind(navigator);
    if (!registerProtocolHandler || typeof window === "undefined") {
      setMailtoStatus("unsupported");
      return;
    }

    try {
      registerProtocolHandler(
        "mailto",
        buildMailtoHandlerUrl(window.location.href),
      );
      setMailtoStatus("registered");
      appMessage(
        __(
          "Your browser may ask you to confirm PressedMail for mailto links.",
          "pressedmail",
        ),
      );
    } catch {
      setMailtoStatus("unsupported");
    }
  }, []);

  const appleCard = (
    <InstructionCard
      key="apple"
      title={__("iPhone / Safari", "pressedmail")}
      steps={[
        __("Open PressedMail in Safari.", "pressedmail"),
        __("Tap Share in the browser toolbar.", "pressedmail"),
        __("Choose Add to Home Screen, then tap Add.", "pressedmail"),
      ]}
    />
  );
  const androidCard = (
    <InstructionCard
      key="android"
      title={__("Android / Chrome", "pressedmail")}
      steps={[
        __("Open PressedMail in Chrome.", "pressedmail"),
        __("Tap the browser menu.", "pressedmail"),
        __("Choose Install app or Add to Home screen.", "pressedmail"),
      ]}
    />
  );

  return (
    <MobileScreen
      header={
        <MobileScreenHeader title={__("Install PressedMail", "pressedmail")} />
      }>
      <div className="flex flex-col gap-4 px-3 py-4">
        {isInstalled ? (
          <p role="status" className="text-sm text-foreground">
            {__(
              "PressedMail is installed. Open it from your home screen.",
              "pressedmail",
            )}
          </p>
        ) : (
          <>
            <p className="text-sm text-muted-foreground">
              {__(
                "Add PressedMail to your home screen to open it without the browser toolbar.",
                "pressedmail",
              )}
            </p>
            {canPrompt ? (
              <button
                type="button"
                onClick={() => void promptInstall()}
                data-test="install-prompt-button"
                data-testid="install-prompt-button"
                className="pm-touch-target pm-no-tap-highlight inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground active:bg-primary/90">
                <Plus className="h-4 w-4" aria-hidden="true" />
                {__("Install app", "pressedmail")}
              </button>
            ) : platform === "apple" ? (
              appleCard
            ) : platform === "android" ? (
              androidCard
            ) : (
              <InstructionCard
                title={__("Your browser", "pressedmail")}
                steps={[
                  __("Open your browser's menu.", "pressedmail"),
                  __(
                    "If available, choose Install app or Add to Home screen.",
                    "pressedmail",
                  ),
                  __(
                    "If neither option appears, bookmark this page for quick access.",
                    "pressedmail",
                  ),
                ]}
              />
            )}
          </>
        )}

        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <MailCheck
              className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-foreground">
                {__("Default email app support is limited", "pressedmail")}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {__(
                  "A web app cannot become your phone's default mail app. Some browsers will let PressedMail open mailto links instead.",
                  "pressedmail",
                )}
              </p>
              <button
                type="button"
                onClick={registerMailto}
                className="pm-touch-target pm-no-tap-highlight mt-3 inline-flex items-center gap-2 rounded-full bg-muted px-4 text-sm font-semibold text-foreground active:bg-muted/80">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                {mailtoStatus === "registered"
                  ? __("Mailto requested", "pressedmail")
                  : mailtoStatus === "unsupported"
                    ? __("Mailto unsupported", "pressedmail")
                    : __("Use for mailto links", "pressedmail")}
              </button>
            </div>
          </div>
        </section>
      </div>
    </MobileScreen>
  );
}

export default MobileInstallScreen;
