import { useEffect, useMemo, useState } from "react";

import { useSignatures } from "@/context/signatures/SignaturesContext";
import { apiFetch } from "@/lib/api-client";
import { routeApiPrefix } from "@/context/Strings";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import type { Signature } from "@/types/signatures";

export type ComposeMode = "new" | "reply" | "reply-all" | "forward";

export interface UseSignatureBindingOptions {
  accountId: number | null;
  mode?: ComposeMode;
  rulesEnabled?: boolean;
  recipients?: string[];
  subject?: string;
  folder?: string;
  session?: number | null;
}

export interface UseSignatureBindingReturn {
  signature: Pick<Signature, "id" | "content" | "content_type"> | null;
  ready: boolean;
  failed: boolean;
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
  const {
    accountId,
    mode = "new",
    rulesEnabled = false,
    recipients = [],
    subject = "",
    folder = "",
    session,
  } = options;
  const { signatures } = useSignatures();
  const useRules =
    __IS_PRO__ && rulesEnabled && accountId !== null && signatures.length > 0;
  const query = new URLSearchParams({
    account_id: String(accountId),
    email_type: mode === "reply-all" ? "reply" : mode,
    subject,
    folder,
  });
  for (const recipient of [...new Set(recipients)].sort())
    query.append("recipients[]", recipient);
  const queryString = query.toString();
  const requestKey = JSON.stringify([queryString, session]);
  const [resolved, setResolved] = useState<{
    key: string;
    failed: boolean;
    signature: UseSignatureBindingReturn["signature"];
  } | null>(null);

  useEffect(() => {
    if (!useRules) return;
    const controller = new AbortController();
    const principal = captureRequestPrincipal();
    // Recipient tokens and subject typing can change together in one edit.
    const timer = setTimeout(() => {
      void (async () => {
        try {
          const response = await apiFetch(
            `${routeApiPrefix}/signature-rules/compose?${queryString}`,
            { signal: controller.signal },
          );
          const payload = await response.json();
          if (!response.ok || payload?.status !== "success")
            throw new Error("Signature lookup failed");
          const data = payload.data;
          if (
            data !== null &&
            (!Number.isInteger(data?.signature_id) ||
              typeof data?.content !== "string" ||
              !["html", "plain"].includes(data?.content_type))
          )
            throw new Error("Invalid signature lookup response");
          if (
            !controller.signal.aborted &&
            isRequestPrincipalCurrent(principal)
          ) {
            setResolved({
              key: requestKey,
              failed: false,
              signature:
                data === null
                  ? null
                  : {
                      id: data.signature_id,
                      content: data.content,
                      content_type: data.content_type,
                    },
            });
          }
        } catch {
          // Failure settles delivery without treating it as a no-signature rule.
          if (
            !controller.signal.aborted &&
            isRequestPrincipalCurrent(principal)
          ) {
            setResolved({ key: requestKey, signature: null, failed: true });
          }
        }
      })();
    }, 200);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [useRules, queryString, requestKey]);

  const signature = useMemo(
    () => resolveSignature(signatures, accountId),
    [signatures, accountId],
  );

  const shouldInsertForMode = useMemo(() => {
    if (!signature) return false;
    return includesMode(signature, mode);
  }, [signature, mode]);

  if (useRules) {
    const current = resolved?.key === requestKey ? resolved : null;
    return {
      signature: current?.signature ?? null,
      signatureHtml: current?.signature?.content ?? "",
      shouldInsertForMode: Boolean(current?.signature),
      ready: current !== null,
      failed: current?.failed ?? false,
    };
  }

  return {
    ready: true,
    failed: false,
    signature,
    signatureHtml: signature?.content ?? "",
    shouldInsertForMode,
  };
}
