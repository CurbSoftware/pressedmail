import { apiForm, apiPost } from "@/lib/api-client";
import { routeApiPrefix } from "@/context/Strings";

export interface IcsPreviewEvent {
  uid: string;
  title: string;
  description: string;
  location: string;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  timezone: string;
  attendees: string[];
  organizer: string;
  duplicate: boolean;
}

export interface IcsImportResult {
  success: boolean;
  error?: string;
  code?: string;
  dryRun: boolean;
  calendarId: number;
  imported: number;
  skipped: number;
  skips: { duplicate: number };
  adjustments: string[];
  events: IcsPreviewEvent[];
  method: string;
}

interface MessageAttachmentBase {
  accountId: number;
  folder: string;
  /** Exact dotted MIME part identifier, never a positional array index. */
  part: string;
}

export type MessageAttachmentRef = MessageAttachmentBase &
  (
    | { uid: string | number; msgNo?: never }
    | { uid?: never; msgNo: string | number }
  );

export function isIcsFile(file: File): boolean {
  const type = file.type.toLowerCase().split(";", 1)[0]?.trim();
  return (
    file.name.toLowerCase().endsWith(".ics") ||
    type === "text/calendar" ||
    type === "application/ics"
  );
}

const EMPTY_RESULT: Omit<IcsImportResult, "success"> = {
  dryRun: false,
  calendarId: 0,
  imported: 0,
  skipped: 0,
  skips: { duplicate: 0 },
  adjustments: [],
  events: [],
  method: "PUBLISH",
};

function toResult(envelope: Record<string, unknown>): IcsImportResult {
  const ok =
    envelope.success === true ||
    envelope.status === "success" ||
    envelope.status === 200 ||
    envelope.status === "200";
  const rawSkips =
    (envelope.skips as Record<string, unknown> | undefined) ?? {};

  return {
    ...EMPTY_RESULT,
    success: ok,
    error: ok ? undefined : String(envelope.message || "Request failed."),
    code: typeof envelope.code === "string" ? envelope.code : undefined,
    dryRun: Boolean(envelope.dry_run),
    calendarId: Number(envelope.calendar_id ?? 0),
    imported: Number(envelope.imported ?? 0),
    skipped: Number(envelope.skipped ?? 0),
    skips: { duplicate: Number(rawSkips.duplicate ?? 0) },
    adjustments: Array.isArray(envelope.adjustments)
      ? (envelope.adjustments as string[])
      : [],
    events: Array.isArray(envelope.events)
      ? (envelope.events as IcsPreviewEvent[])
      : [],
    method: typeof envelope.method === "string" ? envelope.method : "PUBLISH",
  };
}

export async function importIcsFile(
  file: File,
  localCalendarId = 0,
  preview = false,
): Promise<IcsImportResult> {
  const form = new FormData();
  form.append("file", file, file.name);
  if (localCalendarId > 0) {
    form.append("local_calendar_id", String(localCalendarId));
  }
  if (preview) {
    form.append("preview", "1");
  }

  const envelope = await apiForm<unknown>(
    `${routeApiPrefix}/calendar/local-events/import-ics`,
    form,
  );
  return toResult(envelope as Record<string, unknown>);
}

function positiveCoordinate(value: string | number | undefined): string | null {
  if (value === undefined || value === "") return null;
  const normalized = String(value);
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
}

function refToPayload(
  ref: MessageAttachmentRef,
  localCalendarId: number,
): Record<string, unknown> {
  const uid = positiveCoordinate(ref.uid);
  const msgNo = positiveCoordinate(ref.msgNo);
  if ((uid === null) === (msgNo === null)) {
    throw new Error(
      "An attachment reference must include exactly one positive UID or message number.",
    );
  }
  if (!Number.isInteger(ref.accountId) || ref.accountId <= 0) {
    throw new Error("An attachment reference requires a positive account ID.");
  }
  if (!ref.folder.trim()) {
    throw new Error("An attachment reference requires a folder.");
  }
  if (!/^[1-9]\d*(?:\.[1-9]\d*)*$/.test(ref.part)) {
    throw new Error("An attachment reference requires an exact MIME part.");
  }

  const payload: Record<string, unknown> = {
    account_id: ref.accountId,
    folder: ref.folder,
    part: ref.part,
  };
  if (uid !== null) payload.uid = uid;
  if (msgNo !== null) payload.msg_no = msgNo;
  if (localCalendarId > 0) payload.local_calendar_id = localCalendarId;
  return payload;
}

export async function previewMessageIcs(
  ref: MessageAttachmentRef,
  localCalendarId = 0,
): Promise<IcsImportResult> {
  const envelope = await apiPost<unknown>(
    `${routeApiPrefix}/calendar/local-events/preview-attachment`,
    refToPayload(ref, localCalendarId),
  );
  return toResult(envelope as Record<string, unknown>);
}

export async function importMessageIcs(
  ref: MessageAttachmentRef,
  localCalendarId = 0,
): Promise<IcsImportResult> {
  const envelope = await apiPost<unknown>(
    `${routeApiPrefix}/calendar/local-events/import-from-attachment`,
    refToPayload(ref, localCalendarId),
  );
  return toResult(envelope as Record<string, unknown>);
}
