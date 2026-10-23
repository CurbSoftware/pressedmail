/**
 * What's New: the highlights of each release, shown once per person.
 *
 * Add an entry when a release ships something a person can see or use, newest
 * first. A patch with nothing to show needs none: the popup picks the newest
 * entry that is not ahead of the running version and shows it once, so people
 * who update from 1.7.1 to 1.7.2 are not told the same thing twice.
 *
 * Everything here ships in both editions, so nothing in it may describe a Pro
 * feature. Content is bundled and translated, never fetched.
 */
import { __ } from "@wordpress/i18n";

export interface WhatsNewItem {
  /** Stable key, unique within a release. */
  id: string;
  title: string;
  body: string;
}

export interface WhatsNewRelease {
  /** "X.Y.Z" of the release that introduced these items. */
  version: string;
  items: WhatsNewItem[];
}

/**
 * Built on each call so the strings follow the language the app booted with.
 * Newest release first.
 */
export function getWhatsNewReleases(): WhatsNewRelease[] {
  return [
    {
      version: "1.8.0",
      items: [
        {
          id: "show-lines",
          title: __("See your paragraphs", "pressedmail"),
          body: __(
            "Turn on Show lines in the composer toolbar settings to see where each paragraph starts and ends while you write.",
            "pressedmail",
          ),
        },
        {
          id: "signature-preview",
          title: __("Preview signatures and auto-replies", "pressedmail"),
          body: __(
            "The Signature and Auto-reply editors use your theme, and Preview shows the result before you save.",
            "pressedmail",
          ),
        },
        {
          id: "immersive-top",
          title: __("Immersive mode stays in view", "pressedmail"),
          body: __(
            "With immersive mode on, the top of PressedMail is no longer cut off.",
            "pressedmail",
          ),
        },
      ],
    },
    {
      version: "1.7.1",
      items: [
        {
          id: "attachment-preview",
          title: __("Preview attachments", "pressedmail"),
          body: __(
            "Open images and PDFs in a popup instead of downloading them. Use the eye button or the file name.",
            "pressedmail",
          ),
        },
        {
          id: "insert-button",
          title: __("Insert a button", "pressedmail"),
          body: __(
            "Add a button to an email from the toolbar or the slash menu. It shows up as a real button in Outlook too.",
            "pressedmail",
          ),
        },
        {
          id: "instant-actions",
          title: __("Actions that answer at once", "pressedmail"),
          body: __(
            "Saving a draft, deleting, moving and marking mail respond right away. The list changes as you act.",
            "pressedmail",
          ),
        },
        {
          id: "live-counts",
          title: __("New mail, no Refresh", "pressedmail"),
          body: __(
            "New mail and folder counts appear on their own, in every open tab.",
            "pressedmail",
          ),
        },
      ],
    },
  ];
}

/** "1.7.1" or "1.8.0-beta.2" as [1, 7, 1] and [1, 8, 0]. Anything else is null. */
export function parseVersion(version: string): [number, number, number] | null {
  const match = /^(\d{1,4})(?:\.(\d{1,4}))?(?:\.(\d{1,4}))?(?:[-+].*)?$/.exec(
    version.trim(),
  );
  if (!match) return null;
  return [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)];
}

/**
 * Compare two versions by their X.Y.Z numbers. A pre-release suffix is ignored,
 * so a beta of 1.8.0 already sees the 1.8.0 entry. Unreadable input sorts first.
 */
export function compareVersions(a: string, b: string): number {
  const left = parseVersion(a);
  const right = parseVersion(b);
  if (!left || !right) return left ? 1 : right ? -1 : 0;
  for (let index = 0; index < 3; index += 1) {
    const difference = left[index]! - right[index]!;
    if (difference !== 0) return difference;
  }
  return 0;
}

/** The newest release that is not ahead of the running version. */
export function pickWhatsNewRelease(
  runningVersion: string,
  releases: WhatsNewRelease[] = getWhatsNewReleases(),
): WhatsNewRelease | null {
  let picked: WhatsNewRelease | null = null;
  for (const release of releases) {
    if (compareVersions(release.version, runningVersion) > 0) continue;
    if (!picked || compareVersions(release.version, picked.version) > 0) {
      picked = release;
    }
  }
  return picked;
}
