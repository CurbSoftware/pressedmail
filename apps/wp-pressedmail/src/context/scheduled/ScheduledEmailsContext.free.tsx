import type { ReactNode } from "react";

export function ScheduledEmailsProvider({ children }: { children: ReactNode }) {
  return children;
}

export function useOptionalScheduledEmails() {
  return null;
}

export function useScheduledEmails(): never {
  throw new Error();
}
