/**
 * Message headers, references and complete EML downloads.
 *
 * Header previews and references use the loaded fields. EML downloads fetch
 * the original headers and MIME body from the selected account and folder.
 */

import { __ } from "@wordpress/i18n";
import { getMessageIdentityRef } from "@/lib/message-identity";
import {
  captureRequestPrincipal,
  isRequestPrincipalCurrent,
} from "@/lib/principal-storage";
import type { EmailMessage } from "@/types";
import { apiForm } from "@/lib/api-client";
import { routeApiPrefix } from "@/context/Strings";

function headerLines(m: EmailMessage): string[] {
  const out: string[] = [];
  const push = (key: string, value?: string | number | null) => {
    if (value != null && String(value).trim() !== "") {
      out.push(`${key}: ${value}`);
    }
  };
  push("Date", m.receivedDate ?? m.date);
  push("From", m.from ?? m.email);
  push("To", m.to);
  push("Cc", m.cc);
  push("Bcc", m.bcc);
  push("Subject", m.subject);
  push("Message-ID", m.messageId);
  push("In-Reply-To", m.inReplyTo);
  push("References", m.references);
  return out;
}

/** Reconstructed header block (newline-joined), for the "View headers" dialog. */
export function buildReconstructedHeaders(m: EmailMessage): string {
  return headerLines(m).join("\n");
}

/** Short human-readable reference string for "Copy message reference". */
export function buildMessageReference(m: EmailMessage): string {
  const sender = m.from ?? m.email;
  const date = m.receivedDate ?? m.date;
  return [
    m.subject ? `Subject: ${m.subject}` : null,
    sender ? `From: ${sender}` : null,
    date ? `Date: ${date}` : null,
    m.messageId ? `Message-ID: ${m.messageId}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

function safeFilename(subject?: string): string {
  const base = (subject || "message")
    .replace(/[^a-z0-9_-]+/gi, "_")
    .slice(0, 80);
  return `${base || "message"}.eml`;
}

/** Download the complete MIME message without rebuilding its body parts. */
export async function downloadEmlFile(
  m: EmailMessage,
  doc: Document = document,
  canDownload: () => boolean = () => true,
): Promise<void> {
  const identity = getMessageIdentityRef(m);
  if (!identity)
    throw new Error(
      __("The original message identity is unavailable.", "pressedmail"),
    );
  const principal = captureRequestPrincipal();
  const current = () => isRequestPrincipalCurrent(principal) && canDownload();
  const assertCurrent = () => {
    if (!current())
      throw new Error(
        __(
          "The selected message or signed-in user has changed. Reopen the message and try again.",
          "pressedmail",
        ),
      );
  };
  assertCurrent();
  const filename = safeFilename(m.subject);
  const response = await apiForm<{ source_base64?: string }>(
    routeApiPrefix + "/message/raw-source",
    {
      account_id: identity.accountId,
      uid: identity.uid,
      folder: identity.folder,
      uid_validity: identity.uidValidity,
    },
  );
  assertCurrent();
  const source = response.data?.source_base64;
  if (
    response.status !== "success" ||
    typeof source !== "string" ||
    source.length === 0
  ) {
    throw new Error(
      response.message ||
        __("Could not download the complete message.", "pressedmail"),
    );
  }
  // Match the server's 25 MiB original-message limit before decoding another copy.
  if (
    source.length > 4 * Math.ceil((25 * 1024 * 1024) / 3) ||
    /[^A-Za-z0-9+/=]/.test(source)
  ) {
    throw new Error(
      __("The original message source is invalid or too large.", "pressedmail"),
    );
  }
  const bytes = Uint8Array.from(atob(source), (char) => char.charCodeAt(0));
  if (bytes.length > 25 * 1024 * 1024)
    throw new Error(
      __("The original message source is too large.", "pressedmail"),
    );
  assertCurrent();
  const url = URL.createObjectURL(
    new Blob([bytes], { type: "message/rfc822" }),
  );
  let anchor: HTMLAnchorElement | null = null;
  try {
    assertCurrent();
    anchor = doc.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    doc.body.appendChild(anchor);
    assertCurrent();
    anchor.click();
  } finally {
    anchor?.remove();
    URL.revokeObjectURL(url);
  }
}
