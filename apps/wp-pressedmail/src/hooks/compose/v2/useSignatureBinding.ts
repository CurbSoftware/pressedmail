import { useMemo } from "react";

import { useSignatures } from "@/context/signatures/SignaturesContext";
import type { Signature } from "@/types/signatures";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export interface UseSignatureBindingOptions {
  accountId: number | null;
  mode?: ComposeMode;
}

export interface UseSignatureBindingReturn {
  signature: Signature | null;
  signatureHtml: string;
  shouldInsertForMode: boolean;
}

function resolveSignature(
  signatures: Signature[],
  accountId: number | null,
): Signature | null {
  // Auto-attach is gated on the account association: a signature is only
  // added to outgoing email automatically when the account's settings have
  // that signature associated as the account's signature. Accounts without
  // an associated signature get nothing. There is no global-default
  // fallback for auto-insert (signatures remain manually insertable from
  // the composer toolbar).
  if (accountId === null) return null;

  const assigned = signatures.filter(
    (s) =>
      s.is_active &&
      s.account_id !== null &&
      Number(s.account_id) === Number(accountId),
  );
  if (assigned.length === 0) return null;

  return assigned.find((s) => s.is_default) ?? assigned[0] ?? null;
}

function includesMode(signature: Signature, mode: ComposeMode): boolean {
  if (mode === "new") return signature.include_for_new;
  if (mode === "reply" || mode === "reply-all") {
    return signature.include_for_reply;
  }
  if (mode === "forward") return signature.include_for_forward;
  return false;
}

export function useSignatureBinding(
  options: UseSignatureBindingOptions,
): UseSignatureBindingReturn {
  const { accountId, mode = "new" } = options;
  const { signatures } = useSignatures();

  const signature = useMemo(
    () => resolveSignature(signatures, accountId),
    [signatures, accountId],
  );

  const shouldInsertForMode = useMemo(() => {
    if (!signature) return false;
    return includesMode(signature, mode);
  }, [signature, mode]);

  return {
    signature,
    signatureHtml: signature?.content ?? "",
    shouldInsertForMode,
  };
}
