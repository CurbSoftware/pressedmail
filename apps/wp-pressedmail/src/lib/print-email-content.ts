import { blockExternalImages, sanitizeEmailHtml } from "@/lib/sanitize-email";

export interface PrintEmailContentOptions {
  mode?: "message" | "compose";
  subject?: string;
  from?: string;
  to?: string;
  cc?: string;
  bcc?: string;
  date?: string;
  html?: string;
  text?: string;
  showExternalImages?: boolean;
  bodyBackgroundColor?: string;
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeTextBody(text: string): string {
  return `<pre>${escapeHtml(text)}</pre>`;
}

function normalizeBodyHtml(options: PrintEmailContentOptions): string {
  const rawHtml =
    options.html ??
    (options.text ? normalizeTextBody(options.text) : "<p></p>");
  const sanitizedHtml = sanitizeEmailHtml(rawHtml);

  if (options.showExternalImages === false) {
    return blockExternalImages(sanitizedHtml).html;
  }

  return sanitizedHtml;
}

function metadataRow(label: string, value?: string): string {
  const normalized = value?.trim();

  if (!normalized) {
    return "";
  }

  return `<dt>${escapeHtml(label)}</dt><dd>${escapeHtml(normalized)}</dd>`;
}

function getDocumentTitle(options: PrintEmailContentOptions): string {
  const subject = options.subject?.trim();

  if (subject) {
    return subject;
  }

  return options.mode === "compose" ? "Draft email" : "Email message";
}

function getBodyBackgroundStyle(color?: string): string {
  if (!color || !HEX_COLOR_PATTERN.test(color)) {
    return "";
  }

  return ` style="background-color: ${color};"`;
}

export function buildPrintableEmailDocument(
  options: PrintEmailContentOptions,
): string {
  const title = getDocumentTitle(options);
  const bodyHtml = normalizeBodyHtml(options);
  const metadata = [
    metadataRow("From", options.from),
    metadataRow("To", options.to),
    metadataRow("Cc", options.cc),
    metadataRow("Bcc", options.bcc),
    metadataRow("Date", options.date),
  ]
    .filter(Boolean)
    .join("");
  const backgroundStyle = getBodyBackgroundStyle(options.bodyBackgroundColor);

  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid: http: https:; style-src 'unsafe-inline';">
  <title>${escapeHtml(title)}</title>
  <style>
    @page { margin: 0.55in; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #111827;
      background: #ffffff;
      font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      font-size: 14px;
      line-height: 1.55;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .email-print-header {
      border-bottom: 1px solid #d1d5db;
      margin-bottom: 18px;
      padding-bottom: 12px;
    }
    h1 {
      color: #111827;
      font-size: 20px;
      font-weight: 650;
      line-height: 1.3;
      margin: 0 0 10px;
    }
    dl {
      display: grid;
      grid-template-columns: max-content minmax(0, 1fr);
      column-gap: 12px;
      row-gap: 4px;
      margin: 0;
    }
    dt {
      color: #4b5563;
      font-weight: 600;
    }
    dd {
      margin: 0;
      overflow-wrap: anywhere;
    }
    .email-print-content {
      min-height: 1px;
      overflow-wrap: anywhere;
      padding: 0;
    }
    .email-print-content img {
      max-width: 100%;
      height: auto;
    }
    .email-print-content table {
      max-width: 100%;
      border-collapse: collapse;
    }
    pre {
      white-space: pre-wrap;
      word-break: break-word;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace;
    }
    a {
      color: #1d4ed8;
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <section class="email-print-header">
    <h1>${escapeHtml(title)}</h1>
    ${metadata ? `<dl>${metadata}</dl>` : ""}
  </section>
  <main class="email-print-content"${backgroundStyle}>${bodyHtml}</main>
</body>
</html>`;
}

export function printEmailContent(options: PrintEmailContentOptions): boolean {
  if (typeof document === "undefined" || !document.body) {
    return false;
  }

  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.setAttribute("title", "PressedMail print frame");
  frame.style.position = "fixed";
  frame.style.right = "0";
  frame.style.bottom = "0";
  frame.style.width = "0";
  frame.style.height = "0";
  frame.style.border = "0";
  frame.style.visibility = "hidden";

  document.body.appendChild(frame);

  const printWindow = frame.contentWindow;
  const printDocument = printWindow?.document;

  if (!printWindow || !printDocument) {
    frame.remove();
    return false;
  }

  try {
    printDocument.open();
    printDocument.write(buildPrintableEmailDocument(options));
    printDocument.close();
    printWindow.focus();
    printWindow.print();
  } catch (error) {
    console.error("[PressedMail] Unable to print email content", error);
    frame.remove();
    return false;
  }

  window.setTimeout(() => {
    frame.remove();
  }, 500);

  return true;
}
