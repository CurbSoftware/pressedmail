import { useMemo } from "react";

import { useSignatures } from "@/context/signatures/SignaturesContext";
import type { Signature } from "@/types/signatures";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export interface UseSignatureBindingOptions {
  accountId: number | null;
  mode?: ComposeMode;
}

export interface UseSignatureBindingReturn {
  signature: Pick<Signature, "id" | "content" | "content_type"> | null;
  signatureHtml: string;
  shouldInsertForMode: boolean;
}

/**
 * The signature the sending account is bound to, if any.
 *
 * Assignment is the whole rule: a signature is assigned to one account on the
 * Settings > Accounts screen, and that account is the only one it goes out
 * with. A signature with no account is hand-insertable from the composer
 * toolbar and never auto-attaches. There is no default flag and no rule
 * matching, and assignment is exclusive server-side, so at most one signature
 * can match.
 */
function resolveSignature(
  signatures: Signature[],
  accountId: number | null,
): Signature | null {
  if (accountId === null) return null;

  return (
    signatures.find(
      (s) =>
        s.is_active &&
        s.account_id !== null &&
        Number(s.account_id) === Number(accountId),
    ) ?? null
  );
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
