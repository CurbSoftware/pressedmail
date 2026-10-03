/**
 * WordPress core's media library frame, as a promise.
 *
 * The composer (insert image, attach files) and Branding & Appearance (logos)
 * both pick media through it. Depends on `wp_enqueue_media()`, which
 * `Assets/Admin.php` runs on PressedMail screens for users who can
 * `upload_files`.
 */
import { __ } from "@wordpress/i18n";

/** The subset of core's attachment payload (`wp_prepare_attachment_for_js`) read here. */
export interface WpMediaAttachment {
  id: number;
  url?: string;
  filename?: string;
  mime?: string;
  filesizeInBytes?: number;
  width?: number;
  height?: number;
}

interface WpMediaFrame {
  on(event: string, handler: () => void): void;
  open(): void;
  close(): void;
  state(): {
    get(selection: "selection"): { toJSON(): WpMediaAttachment[] };
  };
  modal?: { $el?: ArrayLike<HTMLElement> };
}

interface WpMediaGlobal {
  media?: (options: Record<string, unknown>) => WpMediaFrame;
}

declare global {
  interface Window {
    wp?: WpMediaGlobal;
    /** Printed by core's `utils` script, a dependency of the media scripts. */
    userSettings?: { uid?: string | number };
  }
}

export interface MediaFrameOptions {
  title: string;
  button: string;
  /** Library filter: images only, or everything when omitted. */
  type?: "image";
  multiple?: boolean;
  /** List only this user's uploads. */
  author?: number;
}

/**
 * Whether the core library is on this page, so a caller can disable rather
 * than fail. `wp_enqueue_media()` decides that server side.
 */
export function isMediaFrameAvailable(): boolean {
  return typeof window !== "undefined" && typeof window.wp?.media === "function";
}

/** The signed-in user's ID as core prints it, or undefined off wp-admin. */
export function currentWpUserId(): number | undefined {
  const uid = Number(window.userSettings?.uid);
  return Number.isInteger(uid) && uid > 0 ? uid : undefined;
}

/**
 * Keep a Radix modal under the frame from fighting it.
 *
 * The composer can sit inside one (the pop-out reading view). Radix listens on
 * document: a pointerdown or focus outside its content dismisses it, its focus
 * trap pulls focus back, its scroll lock swallows wheel and touch scrolling,
 * and it turns off pointer events on <body>. Core appends the frame to <body>,
 * outside that content. So the frame takes pointer events back, and its own
 * events stop at <body>, after the frame has handled them and before document.
 * Escape is caught first and closes the frame, not the dialog under it.
 */
function shieldFrame(root: HTMLElement | undefined, close: () => void) {
  if (!root) return () => {};
  const inFrame = (node: EventTarget | null) =>
    node instanceof Node && root.contains(node);
  const stop = (event: Event) => {
    if (
      inFrame(event.target) ||
      inFrame((event as FocusEvent).relatedTarget ?? null)
    ) {
      event.stopPropagation();
    }
  };
  const escape = (event: KeyboardEvent) => {
    if (event.key !== "Escape" || !inFrame(event.target)) return;
    event.stopImmediatePropagation();
    close();
  };
  const bubbled = [
    "pointerdown",
    "focusin",
    "focusout",
    "wheel",
    "touchstart",
    "touchmove",
  ];

  root.style.pointerEvents = "auto";
  bubbled.forEach((type) => document.body.addEventListener(type, stop));
  window.addEventListener("keydown", escape, true);
  return () => {
    bubbled.forEach((type) => document.body.removeEventListener(type, stop));
    window.removeEventListener("keydown", escape, true);
  };
}

/**
 * Open the media library and resolve with the chosen attachments, or an empty
 * list when the frame closes without a choice.
 */
export function openMediaFrame(
  options: MediaFrameOptions,
): Promise<WpMediaAttachment[]> {
  return new Promise((resolve, reject) => {
    const frame = isMediaFrameAvailable()
      ? window.wp?.media?.({
          title: options.title,
          library: {
            ...(options.type ? { type: options.type } : {}),
            ...(options.author ? { author: options.author } : {}),
          },
          // "add" toggles each click into the selection, no modifier keys.
          multiple: options.multiple ? "add" : false,
          button: { text: options.button },
        })
      : undefined;

    if (!frame) {
      reject(
        new Error(
          __(
            "The WordPress media library is not available on this screen.",
            "pressedmail",
          ),
        ),
      );
      return;
    }

    let release = () => {};

    frame.on("select", () => {
      resolve(
        frame
          .state()
          .get("selection")
          .toJSON()
          .filter((attachment) => Boolean(attachment?.url)),
      );
    });

    // Core's Select button closes the frame BEFORE it fires "select"
    // (media-views clickSelect), so resolving here at once threw away every
    // choice. Wait a tick and let "select" win; an empty list means cancelled.
    frame.on("close", () =>
      setTimeout(() => {
        release();
        resolve([]);
      }, 0),
    );

    frame.open();
    release = shieldFrame(frame.modal?.$el?.[0], () => frame.close());
  });
}
