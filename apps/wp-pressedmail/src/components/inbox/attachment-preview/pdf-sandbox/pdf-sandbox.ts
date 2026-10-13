/**
 * The page's end of the sandboxed PDF viewer: builds the frame, runs the handshake, hands over pdf.js and the file,
 * serves the few extra files pdf.js asks for, and turns what comes back into events the dialog can use.
 *
 * Why a frame at all. pdf.js has had two bugs that let a crafted PDF run script in whoever embedded it
 * (CVE-2024-4367 and GHSA-hq66-cqwq-w95j). Run in the admin page, that script is wp-admin: it can read the mailbox
 * and act as the signed-in user. Here it runs in `<iframe sandbox="allow-scripts">` with an opaque origin, no
 * allow-same-origin, no network (the document's own CSP) and nothing but a private MessagePort to the page. What it
 * can still do is draw into its own canvas and send this module messages, and those are parsed, never trusted.
 *
 * What this module will not do, whatever the frame sends: read the frame's window or DOM, render a string the frame
 * supplied, or serve a file outside the three folders pdf.js uses.
 *
 * Fallbacks, in order. A srcdoc document under a hash-only CSP. If it never answers (an admin-page CSP can stop a
 * srcdoc running) the same viewer as the static `viewer.html`, and the result is remembered. Inside the frame the
 * worker falls back from a real one to the frame's own thread. After that the dialog offers a download.
 */

import {
  PDF_ASSET_FOLDERS,
  parseFrameMessage,
  type PdfAssetKind,
  type PdfErrorCode,
  type PdfForwardedKey,
  type PdfFrameMessage,
  type PdfWorkerMode,
} from "./protocol";
import { buildSrcdoc, scriptHash } from "./sandbox-document";

export interface PdfSandboxLabels {
  /** "Page {n} of {total}": the name of each page. The frame fills it in with textContent. */
  pageLabel: string;
  /** "Page {n} could not be shown": what a page says when it failed to draw. */
  pageError: string;
  /** BCP 47 tag of the two above, so a screen reader reads them in the right voice. */
  lang: string;
}

export interface PdfSandboxTimeouts {
  /** From the srcdoc frame being added until it says it is ready. */
  handshake: number;
  /** The same for the static viewer, which is a request away. */
  handshakeUrl: number;
  /** Fetching and hashing the glue scripts. */
  document: number;
  /** From the handshake until pdf.js and its worker are up. */
  boot: number;
  /** From sending the file until the document is open. */
  open: number;
  /** After the first page fails with nothing drawn, how long another page gets to prove the browser is fine. */
  firstPage: number;
}

export const DEFAULT_PDF_SANDBOX_TIMEOUTS: PdfSandboxTimeouts = {
  handshake: 2000,
  handshakeUrl: 5000,
  document: 10000,
  boot: 15000,
  open: 30000,
  firstPage: 4000,
};

/** What the dialog hears. Plain values only: nothing here came from the frame as a string. */
export type PdfSandboxEvent =
  | { t: "booted"; worker: "wrap" | "data" | "fake" | "unknown" }
  | { t: "loaded"; numPages: number; count: number; capped: boolean }
  | { t: "page"; n: number }
  | { t: "page-error"; n: number }
  | { t: "visible"; n: number }
  | { t: "key"; key: PdfForwardedKey }
  | { t: "asset-missing"; kind: PdfAssetKind }
  | { t: "fallback"; to: "url" }
  | {
      t: "error";
      code: PdfErrorCode;
      stage: string;
      /** For logs and tests. Never shown and never put into markup. */
      detail: string;
    };

export interface PdfSandboxOptions {
  /** Where the frame goes. */
  host: HTMLElement;
  /**
   * The file. It may still be on its way: the frame boots while it arrives. It is transferred to the frame, so the
   * caller must not use the buffer afterwards.
   */
  bytes: ArrayBuffer | Promise<ArrayBuffer>;
  /** The plugin's assets folder, with its trailing slash. */
  assetsUrl: string;
  /** Names the frame for assistive technology. */
  title: string;
  labels: PdfSandboxLabels;
  onEvent: (event: PdfSandboxEvent) => void;
  maxPages?: number;
  workerMode?: PdfWorkerMode;
  timeouts?: Partial<PdfSandboxTimeouts>;
}

export interface PdfSandbox {
  /** Scroll to a page, numbered from 1. */
  goto: (page: number) => void;
  /** 1 is fit width. */
  zoom: (factor: number) => void;
  /** Stop the frame, free its memory and remove it. Safe to call twice. */
  destroy: () => void;
}

/** What a test replaces. The defaults are the real browser. */
export interface PdfSandboxDeps {
  createFrame: (doc: Document) => HTMLIFrameElement;
  createChannel: () => MessageChannel;
  fetchBytes: (url: string) => Promise<ArrayBuffer>;
  fetchText: (url: string) => Promise<string>;
  hash: (text: string) => Promise<string | null>;
}

type DocumentMode = "srcdoc" | "url";

/** Where the files are, under the plugin's assets folder. */
export const PDF_SANDBOX_FILES = {
  lib: "pdfjs/pdf.min.mjs",
  worker: "pdfjs/pdf.worker.min.mjs",
  core: "pdf-viewer/viewer-core.js",
  boot: "pdf-viewer/iframe-boot.js",
  viewer: "pdf-viewer/viewer.html",
} as const;
const FILES = PDF_SANDBOX_FILES;

/** The most extra files one preview may be sent: pdf.js asks for a few cMaps, a decoder or two, and two fonts. */
const MAX_ASSET_REQUESTS = 64;

/** Where the CSP of the admin page last stopped a srcdoc, so the next preview does not wait out the handshake again. */
let rememberedMode: DocumentMode = "srcdoc";

/** Forget what was learned about this page. For tests. */
export function resetPdfSandboxMemory(): void {
  rememberedMode = "srcdoc";
  bytesCache.clear();
  textCache.clear();
}

const bytesCache = new Map<string, Promise<ArrayBuffer>>();
const textCache = new Map<string, Promise<string>>();

/** One request per file for the life of the page. A failure is forgotten, so the next preview tries again. */
function cached<T>(
  cache: Map<string, Promise<T>>,
  url: string,
  read: (response: Response) => Promise<T>,
): Promise<T> {
  let hit = cache.get(url);
  if (!hit) {
    // Same origin, with cookies: the plugin's static folder sends no CORS headers, and a page that can read a file
    // as bytes is what lets the frame, which cannot import it, receive it.
    hit = fetch(url, { credentials: "same-origin" }).then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return read(response);
    });
    cache.set(url, hit);
    hit.catch(() => cache.delete(url));
  }
  return hit;
}

const defaultDeps: PdfSandboxDeps = {
  createFrame: (doc) => doc.createElement("iframe"),
  createChannel: () => new MessageChannel(),
  fetchBytes: (url) =>
    cached(bytesCache, url, (response) => response.arrayBuffer()),
  fetchText: (url) => cached(textCache, url, (response) => response.text()),
  hash: scriptHash,
};

/**
 * Whether this browser can run the bundled pdf.js. The legacy build still calls Promise.withResolvers (Chrome 119,
 * Firefox 121, Safari 17.4). The frame checks again in its own realm; this one spares a download on a browser that
 * plainly cannot.
 */
export function pdfPreviewSupported(): boolean {
  return (
    typeof (Promise as unknown as { withResolvers?: unknown }).withResolvers ===
      "function" && typeof MessageChannel === "function"
  );
}

function withTimeout<T>(work: Promise<T>, ms: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    work.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error: unknown) => {
        clearTimeout(timer);
        reject(error instanceof Error ? error : new Error(String(error)));
      },
    );
  });
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

export function createPdfSandbox(
  options: PdfSandboxOptions,
  overrides: Partial<PdfSandboxDeps> = {},
): PdfSandbox {
  const deps: PdfSandboxDeps = { ...defaultDeps, ...overrides };
  const timeouts: PdfSandboxTimeouts = {
    ...DEFAULT_PDF_SANDBOX_TIMEOUTS,
    ...options.timeouts,
  };
  const doc = options.host.ownerDocument;
  const win = doc.defaultView ?? window;
  const base = options.assetsUrl;

  let frame: HTMLIFrameElement | null = null;
  let port: MessagePort | null = null;
  let mode: DocumentMode = rememberedMode;
  let generation = 0;
  let fellBack = false;
  let destroyed = false;
  let failed = false;
  let pagesDrawn = 0;
  // Each step of the conversation happens once, in order. A frame that repeats one is not making progress, and a
  // repeated hello would have the page clone pdf.js's two megabytes again every time.
  let greeted = false;
  let booted = false;
  let assetsServed = 0;
  const timers: Partial<
    Record<
      "handshake" | "boot" | "open" | "firstPage",
      ReturnType<typeof setTimeout>
    >
  > = {};

  const emit = (event: PdfSandboxEvent) => {
    if (destroyed || (failed && event.t !== "error")) return;
    options.onEvent(event);
  };

  const disarm = (name: keyof typeof timers) => {
    const timer = timers[name];
    if (timer !== undefined) clearTimeout(timer);
    delete timers[name];
  };
  const disarmAll = () => {
    (Object.keys(timers) as (keyof typeof timers)[]).forEach(disarm);
  };
  const arm = (name: keyof typeof timers, ms: number, then: () => void) => {
    disarm(name);
    timers[name] = setTimeout(then, ms);
  };

  /** The one way out. Whatever the frame does afterwards is ignored. */
  const fail = (code: PdfErrorCode, stage: string, detail = "") => {
    if (destroyed || failed) return;
    failed = true;
    disarmAll();
    emit({ t: "error", code, stage, detail });
  };

  const url = (file: string) => `${base}${file}`;

  // pdf.js and its worker are fetched while the frame is still being built, and used when it says hello. Until then
  // nobody awaits them, so a rejection gets a quiet handler to stay out of the unhandled-rejection log; the real
  // handler is attached where the result is used.
  let library: Promise<[ArrayBuffer, ArrayBuffer]> | null = null;
  const ensureLibrary = () => {
    if (!library) {
      library = Promise.all([
        deps.fetchBytes(url(FILES.lib)),
        deps.fetchBytes(url(FILES.worker)),
      ]);
      library.catch(() => undefined);
    }
    return library;
  };
  const fileReady = Promise.resolve(options.bytes);
  fileReady.catch(() => undefined);

  function makeFrame(): HTMLIFrameElement {
    const created = deps.createFrame(doc);
    // Never add allow-same-origin. Without it the frame has an opaque origin, which is the whole point.
    created.setAttribute("sandbox", "allow-scripts");
    created.setAttribute("referrerpolicy", "no-referrer");
    created.setAttribute("allow", "");
    created.title = options.title;
    created.style.cssText =
      "border:0;width:100%;height:100%;display:block;background:#525659";
    return created;
  }

  async function buildDocument(): Promise<string | null> {
    const [core, boot] = await Promise.all([
      deps.fetchText(url(FILES.core)),
      deps.fetchText(url(FILES.boot)),
    ]);
    return buildSrcdoc([core, boot], deps.hash);
  }

  async function mount(next: DocumentMode): Promise<void> {
    const mine = ++generation;
    mode = next;
    let srcdoc: string | null = null;
    if (next === "srcdoc") {
      try {
        srcdoc = await withTimeout(buildDocument(), timeouts.document);
      } catch {
        srcdoc = null;
      }
      if (destroyed || mine !== generation) return;
      // No hash (a plain-http admin) or no scripts: the static viewer needs neither.
      if (srcdoc === null) mode = "url";
    }
    const created = makeFrame();
    if (mode === "srcdoc" && srcdoc !== null) created.srcdoc = srcdoc;
    else created.src = url(FILES.viewer);
    frame = created;
    options.host.appendChild(created);
    arm(
      "handshake",
      mode === "srcdoc" ? timeouts.handshake : timeouts.handshakeUrl,
      onHandshakeTimeout,
    );
  }

  function onHandshakeTimeout() {
    if (destroyed || failed) return;
    if (mode === "srcdoc") {
      // Most likely a Content-Security-Policy on this admin page. A srcdoc inherits it and a URL document does not.
      emit({ t: "fallback", to: "url" });
      fellBack = true;
      frame?.remove();
      frame = null;
      void mount("url");
      return;
    }
    fail("timeout", "handshake");
  }

  function onWindowMessage(event: MessageEvent) {
    // Only the frame we built, and only until the channel exists. After that the window is not listened to at all.
    if (destroyed || failed || port || !frame) return;
    if (event.source !== frame.contentWindow) return;
    const data: unknown = event.data;
    if (!isRecord(data)) return;

    if (data.t === "pm-unsafe") {
      disarm("handshake");
      fail("unsafe", "sandbox", "the frame is not in an opaque origin");
      return;
    }
    if (data.t !== "pm-ready") return;
    disarm("handshake");
    // An opaque origin reports itself as the string "null". Anything else means the sandbox lost its isolation.
    if (event.origin !== "null") {
      fail("unsafe", "sandbox", "the frame has a real origin");
      return;
    }

    const channel = deps.createChannel();
    port = channel.port1;
    port.onmessage = onPortMessage;
    // An opaque origin has no targetOrigin but '*'. The message carries a port and no data.
    frame.contentWindow?.postMessage({ t: "pm-init", v: 1 }, "*", [
      channel.port2,
    ]);
    if (fellBack && mode === "url") rememberedMode = "url";
  }

  function serveAsset(message: Extract<PdfFrameMessage, { t: "asset-req" }>) {
    const path = `${PDF_ASSET_FOLDERS[message.kind]}${message.name}`;
    deps.fetchBytes(url(`pdfjs/${path}`)).then(
      (bytes) => {
        if (destroyed || !port) return;
        // The cached copy stays here. The frame gets its own, moved rather than copied again.
        const copy = bytes.slice(0);
        port.postMessage({ t: "asset-res", id: message.id, data: copy }, [
          copy,
        ]);
      },
      () => {
        if (destroyed || !port) return;
        // pdf.js carries on without the file, silently: a CJK page loses its text and a JBIG2 or JPEG 2000 scan comes
        // out blank. This event is the only signal anyone gets, so the dialog turns it into a notice.
        emit({ t: "asset-missing", kind: message.kind });
        port.postMessage({
          t: "asset-res",
          id: message.id,
          err: "not available",
        });
      },
    );
  }

  function onPortMessage(event: MessageEvent) {
    if (destroyed || failed) return;
    const message = parseFrameMessage(event.data);
    if (!message) return;

    switch (message.t) {
      case "hello":
        if (greeted) break;
        greeted = true;
        arm("boot", timeouts.boot, () => fail("timeout", "boot"));
        ensureLibrary().then(
          ([lib, worker]) => {
            if (destroyed || !port) return;
            port.postMessage({
              t: "boot",
              lib,
              worker,
              opts: {
                workerMode: options.workerMode ?? "auto",
                maxPages: options.maxPages ?? 200,
              },
            });
          },
          () => fail("fetch", "library"),
        );
        break;
      case "booted":
        // Only after a hello, and only once.
        if (!greeted || booted) break;
        booted = true;
        disarm("boot");
        emit({ t: "booted", worker: message.worker });
        // The file may still be on its way from the mail server; the frame has been booting while it travels.
        fileReady.then(
          (bytes) => {
            if (destroyed || failed || !port) return;
            arm("open", timeouts.open, () => fail("timeout", "open"));
            port.postMessage(
              { t: "open", pdf: bytes, labels: options.labels },
              [bytes],
            );
          },
          () => fail("fetch", "bytes"),
        );
        break;
      case "loaded":
        disarm("open");
        emit({
          t: "loaded",
          numPages: message.numPages,
          count: message.count,
          capped: message.capped,
        });
        break;
      case "page":
        pagesDrawn += 1;
        disarm("firstPage");
        emit({ t: "page", n: message.n });
        break;
      case "page-error":
        emit({ t: "page-error", n: message.n });
        // The first page failing proves nothing on its own: a file can have one bad page. When nothing else draws
        // either, a screen of "page could not be shown" helps nobody, and whichever it is (a browser that lacks
        // something the build needs, or a file too broken to draw) the person is better off with the download.
        if (pagesDrawn === 0 && message.n === 1 && !timers.firstPage) {
          arm("firstPage", timeouts.firstPage, () => {
            if (pagesDrawn === 0) fail("render", "first-page");
          });
        }
        break;
      case "visible":
        emit({ t: "visible", n: message.n });
        break;
      case "key":
        emit({ t: "key", key: message.key });
        break;
      case "error":
        // Noise from a page that is already showing is not a reason to take it down. Before that, every code counts.
        if (
          pagesDrawn > 0 &&
          (message.code === "script" || message.code === "unexpected")
        ) {
          break;
        }
        fail(message.code, message.stage, message.detail);
        break;
      case "asset-req":
        // A file has a handful of cMaps and decoders at most. Past a generous few, the frame is asking for the sake of it.
        if (booted && assetsServed < MAX_ASSET_REQUESTS) {
          assetsServed += 1;
          serveAsset(message);
        }
        break;
    }
  }

  win.addEventListener("message", onWindowMessage);

  if (!pdfPreviewSupported()) {
    queueMicrotask(() =>
      fail("unsupported", "support", "Promise.withResolvers is missing"),
    );
  } else if (!base) {
    queueMicrotask(() => fail("fetch", "assets", "no assets folder"));
  } else {
    ensureLibrary();
    void mount(mode);
  }

  return {
    goto(page) {
      if (!port || failed || !Number.isFinite(page)) return;
      port.postMessage({ t: "goto", page: Math.max(1, Math.trunc(page)) });
    },
    zoom(factor) {
      if (!port || failed || !Number.isFinite(factor)) return;
      port.postMessage({ t: "zoom", factor });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      generation += 1;
      disarmAll();
      win.removeEventListener("message", onWindowMessage);
      const closing = { frame, port };
      frame = null;
      port = null;
      try {
        closing.port?.postMessage({ t: "destroy" });
      } catch {
        // A closed port has nothing left to tell.
      }
      // A moment for the frame to stop its worker and release its canvases before the document goes.
      setTimeout(() => {
        try {
          closing.port?.close();
        } catch {
          // Already closed.
        }
        closing.frame?.remove();
      }, 50);
    },
  };
}
