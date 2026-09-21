import type { EmailContentType } from "@/types";
import type {
  ComposeConfirmation,
  UseComposeFormReturn,
} from "@/hooks/compose/v2/useComposeForm";

/**
 * Inert composer schedule actions. Same props as the licensed implementation,
 * so the physical `.active` shim can fall back to this rather than to the paid
 * module. See MobileScheduleActions.free.tsx for why that direction matters.
 */
interface Props {
  form: UseComposeFormReturn;
  isDeliveryPending: boolean;
  variant: "compact" | "ribbon";
}

export function ComposerScheduleSendButton(_props: Props) {
  return null;
}

export function ComposerRemoveScheduleButton(_props: Props) {
  return null;
}

export function ComposerReadReceiptButton(_props: Props) {
  return null;
}

/**
 * The read-receipt option and value shapes, declared here rather than imported
 * from `@/hooks/compose/v2/useReadReceipt`.
 *
 * Rollup erases a type-only import, so the specifier never reached the Free
 * bundle and no bundle check noticed it. The Free source export follows
 * specifiers, though, and `import(...)` matches its pattern, so naming the Pro
 * module published its `apiFetch` call, its tracking-settings parser and its
 * copy to the public repository. Structural declarations keep that module out.
 */
interface ReadReceiptValue {
  requested: boolean;
  revision: string;
}

interface UseReadReceiptOptions {
  available: boolean;
  contentType: EmailContentType;
  value: ReadReceiptValue;
  onChange: (value: ReadReceiptValue, capturedSession: number | null) => void;
  getComposeSessionVersion: () => number | null;
  requestConfirmation: (
    details: ComposeConfirmation,
    session: number | null,
  ) => Promise<boolean>;
}

/** Free has no tracking settings requests or consent UI. */
export function useReadReceipt(_options: UseReadReceiptOptions) {
  return {
    pending: false,
    error: null as string | null,
    enable: async () => false,
    disableForMessage: () => {},
    revokeAll: async () => false,
  };
}
