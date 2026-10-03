/**
 * Where keyboard focus goes after a notification opens something.
 *
 * Enter on a row closes the popup, and the popup hands focus back to the bell.
 * The message or event the reader just opened is somewhere else, so a keyboard or
 * screen reader user had to Tab back through the whole header to reach it, and
 * nothing said the navigation had happened. A pointer needs none of this: they
 * are already looking at what they clicked.
 *
 * The panel asks for a landing when a row is opened from the keyboard. Whatever
 * shows the target (the inbox once it has selected the message, the calendar once
 * it has opened the event) takes the request and moves focus to it. A target
 * with no one to take it (a settings tab) gets the page itself. One request, one
 * taker: a request nobody took within `WINDOW_MS` is dropped, so a later link
 * from a pointer never inherits focus from an old keypress.
 */
const WINDOW_MS = 15_000;
/**
 * Radix returns focus to the bell in a timer as the popup unmounts. Moving first
 * would be undone by it, so the first try waits for it to have run. A target that
 * never arrives (the message was moved) leaves focus on the bell, which is where
 * the reader was.
 */
const SETTLE_MS = 60;
/** How many frames to wait for the target to be drawn, about a second. */
const MAX_FRAMES = 60;

let requestedAt: number | null = null;

/** A row was opened from the keyboard: whoever shows its target should take focus. */
export function requestLandingFocus(wanted = true): void {
  requestedAt = wanted ? Date.now() : null;
}

/** Whether a request is waiting, and clear it: the taker is the one that moves focus. */
export function takeLandingFocus(): boolean {
  const wanted = requestedAt !== null && Date.now() - requestedAt < WINDOW_MS;
  requestedAt = null;
  return wanted;
}

/** A node that takes focus by script, and is not a stop in the tab order. */
function focusProgrammatically(element: HTMLElement): void {
  if (!element.hasAttribute("tabindex")) element.tabIndex = -1;
  element.focus();
}

/**
 * Focus what `find` returns, as soon as it exists. The target is drawn a render or
 * two after the navigation, so this looks once a frame for about a second and then
 * gives up, leaving focus where it was.
 */
export function focusLanding(find: () => HTMLElement | null | undefined): void {
  let frames = 0;
  const attempt = () => {
    const target = find();
    if (target?.isConnected) {
      focusProgrammatically(target);
      return;
    }
    if (++frames < MAX_FRAMES) window.requestAnimationFrame(attempt);
  };
  window.setTimeout(() => window.requestAnimationFrame(attempt), SETTLE_MS);
}

/**
 * The row of the message the list has just selected, or the reading pane when
 * that message is older than the list and has no row.
 */
export function findOpenedMessage(): HTMLElement | null {
  return (
    document.querySelector<HTMLElement>(
      '[data-message-row][aria-selected="true"]',
    ) ?? document.querySelector<HTMLElement>('[data-test="message-detail"]')
  );
}

/** The page's own region, for a target nothing else takes focus for. */
export function findMainRegion(): HTMLElement | null {
  return document.querySelector<HTMLElement>("main");
}
