const RELOADED_FOR_KEY = "pressedmail:stale-chunk-reload";

/**
 * Reload once when a lazy chunk fails to load.
 *
 * A tab left open across a plugin update keeps running the old entry, and the
 * update deleted the chunks that entry points at, so the next lazy import 404s
 * (compose, a settings tab, a mobile screen). Vite's preload helper reports that
 * as `vite:preloadError`. Reloading picks up the new build.
 *
 * At most one reload per build: the entry URL is content-hashed, so a second
 * failure from the same entry is a real missing file and must surface instead of
 * looping. No storage means no reload for the same reason. The event is not
 * cancelled, so a reload the user declines (unsaved compose draft) still shows
 * the original error.
 */
export function installStaleChunkReload(
  entryUrl: string,
  reload: () => void = () => window.location.reload(),
): () => void {
  const onPreloadError = () => {
    try {
      if (window.sessionStorage.getItem(RELOADED_FOR_KEY) === entryUrl) {
        return;
      }
      window.sessionStorage.setItem(RELOADED_FOR_KEY, entryUrl);
    } catch {
      return;
    }
    reload();
  };

  window.addEventListener("vite:preloadError", onPreloadError);
  return () => window.removeEventListener("vite:preloadError", onPreloadError);
}
