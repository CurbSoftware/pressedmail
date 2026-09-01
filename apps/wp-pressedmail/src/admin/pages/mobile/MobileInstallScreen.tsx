"use client";

import * as React from "react";
import { __ } from "@wordpress/i18n";
import {
  CheckCircle2,
  ExternalLink,
  LayoutGrid,
  MailCheck,
} from "lucide-react";

import { MobileScreen, MobileScreenHeader } from "@/components/mobile-shell";
import { appMessage } from "@/context/toast";
import { cn } from "@/lib/utils";

import { useInstallPrompt } from "./useInstallPrompt";

function InstructionCard({ title, steps }: { title: string; steps: string[] }) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold text-foreground">{title}</h2>
      <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
        {steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

export function MobileInstallScreen() {
  const { canPrompt, isInstalled, promptInstall } = useInstallPrompt();
  const [mailtoStatus, setMailtoStatus] = React.useState<
    "idle" | "registered" | "unsupported"
  >("idle");

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
        `${window.location.origin}${window.location.pathname}?pm_mailto=%s#/compose`,
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

  return (
    <MobileScreen
      header={
        <MobileScreenHeader title={__("Install PressedMail", "pressedmail")} />
      }>
      <div className="flex flex-col gap-4 px-3 py-4">
        <section className="rounded-xl border border-border bg-card p-4">
          <div className="flex items-start gap-3">
            <span className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <LayoutGrid className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-base font-semibold text-foreground">
                {__("Install PressedMail", "pressedmail")}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {__(
                  "Add PressedMail to your home screen for faster access and a cleaner app-like window.",
                  "pressedmail",
                )}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void promptInstall()}
            disabled={!canPrompt || isInstalled}
            className={cn(
              "pm-touch-target pm-no-tap-highlight mt-4 inline-flex w-full items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold",
              canPrompt && !isInstalled
                ? "bg-primary text-primary-foreground active:bg-primary/90"
                : "bg-muted text-muted-foreground",
            )}>
            <ExternalLink className="h-4 w-4" aria-hidden="true" />
            {isInstalled
              ? __("Installed", "pressedmail")
              : __("Install PressedMail", "pressedmail")}
          </button>
        </section>

        <InstructionCard
          title={__("iPhone / Safari", "pressedmail")}
          steps={[
            __("Open PressedMail in Safari.", "pressedmail"),
            __("Tap Share in the browser toolbar.", "pressedmail"),
            __("Choose Add to Home Screen, then tap Add.", "pressedmail"),
          ]}
        />
        <InstructionCard
          title={__("Android / Chrome", "pressedmail")}
          steps={[
            __("Open PressedMail in Chrome.", "pressedmail"),
            __("Tap the browser menu.", "pressedmail"),
            __("Choose Install app or Add to Home screen.", "pressedmail"),
          ]}
        />

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
                  "A WordPress web app cannot fully become the operating system default email app like a native app. Supported browsers may allow PressedMail to handle mailto links.",
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
