/**
 * The messages between the dialog and the sandboxed PDF frame.
 *
 * Transport: the frame posts one window message (`pm-ready`), the dialog answers with another (`pm-init`) that carries
 * one end of a MessageChannel, and everything after that rides the channel, which only those two hold. The frame's
 * side is `assets/pdf-viewer/iframe-boot.js`.
 *
 * Trust: once pdf.js is parsing a file, the frame is hostile. A bug in the parser could hand a crafted PDF control of
 * its script, and the frame has no reach into the page (no same-origin access, no network) except through this port.
 * So everything arriving here is parsed, not cast. A message has a known `t`, numbers are coerced and clamped,
 * enums are checked against a list, and no string from the frame is ever shown to a person or put into HTML.
 */

/** pdf.js decides which of these it asks for; the dialog serves only these folders. */
export type PdfAssetKind = "cMapUrl" | "standardFontDataUrl" | "wasmUrl";

export const PDF_ASSET_FOLDERS: Record<PdfAssetKind, string> = {
  cMapUrl: "cmaps/",
  standardFontDataUrl: "standard_fonts/",
  wasmUrl: "wasm/",
};

/** A file name inside one of those folders. No slash and no dot-dot, so it cannot leave the folder. */
export const PDF_ASSET_NAME = /^[\w.-]{1,80}$/;

/** How the frame starts pdf.js's worker. 'auto' tries a classic blob worker, then the page's own thread. */
export type PdfWorkerMode = "auto" | "wrap" | "data" | "fake";

/** Keys pressed inside the frame never reach the page, so the dialog allows these to be passed on. */
export const PDF_FORWARDED_KEYS = ["Escape", "+", "=", "-", "_", "0"] as const;
export type PdfForwardedKey = (typeof PDF_FORWARDED_KEYS)[number];

/** What the frame itself can report. */
const FRAME_ERROR_CODES = [
  "password",
  "invalid",
  "missing",
  "unexpected",
  "lib-failed",
  "script",
  // The frame's own browser lacks an API the build needs. Checked there because the frame is a fresh realm.
  "unsupported",
] as const;
export type PdfFrameErrorCode = (typeof FRAME_ERROR_CODES)[number];

/** Everything that can end a preview: the frame's codes plus the ones only the dialog can raise. */
export type PdfErrorCode =
  | PdfFrameErrorCode
  // No handshake, boot or open in time.
  | "timeout"
  // The pdf.js files or the bytes did not arrive.
  | "fetch"
  // The frame refused to run because it was not in an opaque origin.
  | "unsafe"
  // The first page failed and nothing else drew: the browser is too old for this build.
  | "render";

/** The words a frame sends the page. Parsed from untrusted data, so nothing here is a raw string except the log fields. */
export type PdfFrameMessage =
  | { t: "hello" }
  | { t: "booted"; worker: "wrap" | "data" | "fake" | "unknown" }
  | { t: "loaded"; numPages: number; count: number; capped: boolean }
  | { t: "page"; n: number }
  | { t: "page-error"; n: number }
  | { t: "visible"; n: number }
  | { t: "key"; key: PdfForwardedKey }
  | {
      t: "error";
      code: PdfFrameErrorCode;
      /** Diagnostic only. Never shown and never put into markup. */
      stage: string;
      detail: string;
    }
  | { t: "asset-req"; id: number; kind: PdfAssetKind; name: string };

/** Pages are numbered from 1, and no file this viewer opens has anywhere near this many. */
const MAX_PAGE = 100_000;

function toInteger(value: unknown, min: number, max: number): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const whole = Math.trunc(value);
  return whole < min || whole > max ? null : whole;
}

function clip(value: unknown, length: number): string {
  return typeof value === "string" ? value.slice(0, length) : "";
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

/**
 * Turn whatever arrived on the port into a message the dialog understands, or null. Anything unknown, malformed or
 * out of range is dropped without a trace: a hostile frame learns nothing from the silence.
 */
export function parseFrameMessage(data: unknown): PdfFrameMessage | null {
  if (!isRecord(data) || typeof data.t !== "string") return null;

  switch (data.t) {
    case "hello":
      return { t: "hello" };
    case "booted": {
      const worker =
        data.worker === "wrap" ||
        data.worker === "data" ||
        data.worker === "fake"
          ? data.worker
          : "unknown";
      return { t: "booted", worker };
    }
    case "loaded": {
      const numPages = toInteger(data.numPages, 0, MAX_PAGE);
      const count = toInteger(data.count, 0, MAX_PAGE);
      if (numPages === null || count === null) return null;
      return { t: "loaded", numPages, count, capped: data.capped === true };
    }
    case "page":
    case "page-error":
    case "visible": {
      const n = toInteger(data.n, 1, MAX_PAGE);
      return n === null ? null : { t: data.t, n };
    }
    case "key": {
      const key = PDF_FORWARDED_KEYS.find((allowed) => allowed === data.key);
      return key ? { t: "key", key } : null;
    }
    case "error": {
      const code = FRAME_ERROR_CODES.find((known) => known === data.code);
      return {
        t: "error",
        // An unknown code is still a failure. It is not a reason to ignore one.
        code: code ?? "unexpected",
        stage: clip(data.stage, 20),
        detail: `${clip(data.name, 40)} ${clip(data.message, 120)}`.trim(),
      };
    }
    case "asset-req": {
      const id = toInteger(data.id, 0, Number.MAX_SAFE_INTEGER);
      const kind = (Object.keys(PDF_ASSET_FOLDERS) as PdfAssetKind[]).find(
        (known) => known === data.kind,
      );
      if (
        id === null ||
        !kind ||
        typeof data.name !== "string" ||
        !PDF_ASSET_NAME.test(data.name)
      ) {
        return null;
      }
      return { t: "asset-req", id, kind, name: data.name };
    }
    default:
      return null;
  }
}
