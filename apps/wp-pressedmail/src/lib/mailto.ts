export interface MailtoComposeFields {
  to: string;
  cc: string;
  bcc: string;
  subject: string;
  body: string;
}

const EMPTY_MAILTO_FIELDS: MailtoComposeFields = {
  to: "",
  cc: "",
  bcc: "",
  subject: "",
  body: "",
};

function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseMailtoComposeUrl(
  value: string | null | undefined,
): MailtoComposeFields {
  if (!value) return { ...EMPTY_MAILTO_FIELDS };
  const trimmed = value.trim();
  if (!trimmed.toLowerCase().startsWith("mailto:")) {
    return { ...EMPTY_MAILTO_FIELDS };
  }

  const withoutScheme = trimmed.slice("mailto:".length);
  const [rawTo = "", rawQuery = ""] = withoutScheme.split("?", 2);
  const params = new URLSearchParams(rawQuery);

  return {
    to: safeDecode(rawTo),
    cc: params.get("cc") ?? "",
    bcc: params.get("bcc") ?? "",
    subject: params.get("subject") ?? "",
    body: params.get("body") ?? "",
  };
}

export function parseShareTargetComposeParams(
  params: URLSearchParams,
): MailtoComposeFields {
  const title = (params.get("pm_share_title") ?? "").trim();
  const text = (params.get("pm_share_text") ?? "").trim();
  const url = (params.get("pm_share_url") ?? "").trim();
  const body = [text, url].filter(Boolean).join("\n\n");

  if (!title && !body) {
    return { ...EMPTY_MAILTO_FIELDS };
  }

  return {
    ...EMPTY_MAILTO_FIELDS,
    subject: title,
    body,
  };
}
