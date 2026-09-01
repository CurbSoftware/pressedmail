"use client";

import * as React from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

export interface InstallPromptState {
  canPrompt: boolean;
  isInstalled: boolean;
  promptInstall: () => Promise<void>;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  const navigatorStandalone = (
    window.navigator as Navigator & { standalone?: boolean }
  ).standalone;
  return (
    navigatorStandalone === true ||
    window.matchMedia?.("(display-mode: standalone)").matches === true
  );
}

export function useInstallPrompt(): InstallPromptState {
  const [installEvent, setInstallEvent] =
    React.useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = React.useState(isStandaloneDisplay);

  React.useEffect(() => {
    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault();
      setInstallEvent(event as BeforeInstallPromptEvent);
    };
    const handleInstalled = () => {
      setInstallEvent(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);
    setIsInstalled(isStandaloneDisplay());

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  const promptInstall = React.useCallback(async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice.catch(() => null);
    setInstallEvent(null);
    setIsInstalled(isStandaloneDisplay());
  }, [installEvent]);

  return {
    canPrompt: Boolean(installEvent),
    isInstalled,
    promptInstall,
  };
}
