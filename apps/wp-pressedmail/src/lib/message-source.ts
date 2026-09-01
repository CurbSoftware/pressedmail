/**
 * Client-side reconstruction of a message's headers / .eml / reference.
 *
 * These do NOT fetch the original raw RFC822 source from IMAP, they rebuild a
 * best-effort representation from the structured fields already loaded on the
 * EmailMessage (From/To/Cc/Bcc/Subject/Date/Message-ID/In-Reply-To/References +
 * body). Used by the reading-pane More menu (View headers / Download .eml /
 * Copy reference / Open in new window).
 */

import type { EmailMessage } from "@/types";
import { resolveEmailBody } from "@/lib/email-content-normalization";

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

/** Reconstructed RFC822-ish .eml: headers, blank line, then the body. */
export function buildReconstructedEml(m: EmailMessage): string {
  const resolved = resolveEmailBody(m);
  const contentType =
    resolved.kind === "html"
      ? "text/html; charset=UTF-8"
      : "text/plain; charset=UTF-8";
  const headers = [
    ...headerLines(m),
    "MIME-Version: 1.0",
    `Content-Type: ${contentType}`,
  ];
  return `${headers.join("\r\n")}\r\n\r\n${resolved.content}`;
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

/** Trigger a browser download of the reconstructed .eml. */
export function downloadEmlFile(
  m: EmailMessage,
  doc: Document = document,
): void {
  const blob = new Blob([buildReconstructedEml(m)], {
    type: "message/rfc822",
  });
  const url = URL.createObjectURL(blob);
  const anchor = doc.createElement("a");
  anchor.href = url;
  anchor.download = safeFilename(m.subject);
  doc.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
