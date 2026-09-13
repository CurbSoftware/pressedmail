/**
 * The emoji-mart set is about 400 KB of JSON. Imported statically it rode in
 * the entry chunk that every PressedMail screen parses, composer or not, so it
 * is fetched as its own chunk the first time an editor mounts.
 */
import type { EmojiMartData } from '@emoji-mart/data';
import { EmojiPlugin } from '@kit/plate/emoji/react';
import { usePluginOption } from '@kit/plate/react';

let loaded: EmojiMartData | null = null;
let request: Promise<EmojiMartData> | null = null;

/** Fetches the set once per page. A failed fetch is forgotten, so the next editor retries. */
export function loadEmojiData(): Promise<EmojiMartData> {
  // The package ships no typed default export, hence the cast.
  const pending =
    request ??
    (request = import('@emoji-mart/data').then(
      (module) => (loaded = module.default as unknown as EmojiMartData),
      (error: unknown) => {
        request = null;
        throw error;
      },
    ));
  return pending;
}

export function loadedEmojiData(): EmojiMartData | null {
  return loaded;
}

/**
 * The emoji set once this editor holds it, else null. The picker and the `:`
 * search each build a page-wide singleton from the first data they are given
 * and never rebuild it, so neither may run before this is non-null. If they
 * did, both would keep @platejs/emoji's one-emoji placeholder for the rest of
 * the session.
 */
export function useEmojiData(): EmojiMartData | null {
  const data = usePluginOption(EmojiPlugin, 'data');
  return loaded !== null && data === loaded ? loaded : null;
}
