import { useEffect } from "react";

/**
 * Warn the user before they refresh or navigate away while a long-running
 * process (a bulk AI queue, an in-flight summary) is active. While `active`,
 * a `beforeunload` listener triggers the browser's native "leave site?" prompt;
 * it is removed as soon as the work finishes or the component unmounts.
 *
 * @param active Whether a process is currently running.
 * @param message Legacy custom prompt text (most browsers ignore it now).
 */
export function useWarnIfBusy(active: boolean, message = ""): void {
  useEffect(() => {
    if (!active) {
      return;
    }

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Legacy browsers require returnValue to be set to show the prompt.
      event.returnValue = message;
      return message;
    };

    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [active, message]);
}

export default useWarnIfBusy;
