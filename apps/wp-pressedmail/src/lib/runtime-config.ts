function getFrontendRuntime() {
  if (typeof window === "undefined") {
    return undefined;
  }

  return window.pressedmail;
}

/**
 * `wp_localize_script` stringifies PHP booleans, so a flag PHP set to `true`
 * arrives as the string `"1"` in some bootstraps and as a real boolean in
 * others. Accept every form the localizer can produce; anything else, an
 * absent payload included, is false.
 */
export function isTruthyRuntimeFlag(value: unknown): boolean {
  return value === true || value === "1" || value === 1;
}

/**
 * Synchronous licence state injected by PHP at boot (`EditionBootstrap::runtime_data`
 * → `pressedmail_is_licensed()` → `License::is_license_active()`, the same call
 * `/features/flags` re-runs one request later). Sound enough to seed the client
 * before the flags request lands, so a licensed customer is not rendered as
 * unlicensed on first paint.
 */
export function getRuntimeIsLicensed(): boolean {
  if (typeof window === "undefined") {
    return false;
  }

  return isTruthyRuntimeFlag(window.pressedmailPlugin?.isLicensed);
}

/** WordPress site timezone shared by browser and server notification policy. */
export function getRuntimeSiteTimezone(): string {
  if (typeof window === "undefined") {
    return "UTC";
  }

  const configured = window.pressedmailPlugin?.siteTimezone;
  return typeof configured === "string" && configured.trim() !== ""
    ? configured.trim()
    : "UTC";
}

export function getRuntimeWpNonce(): string {
  if (typeof window === "undefined") {
    return "";
  }

  return (
    window.pressedmailPlugin?.wpApiSettings?.nonce ||
    getFrontendRuntime()?.nonce ||
    // WordPress-core REST nonce fallback: some environments only localize the
    // core `wpApiSettings` global (no plugin payload). Kept last so the plugin
    // nonce always wins; makes this the single canonical nonce source.
    (window as unknown as { wpApiSettings?: { nonce?: string } }).wpApiSettings
      ?.nonce ||
    ""
  );
}

export function getRuntimeRestRoot(): string {
  if (typeof window === "undefined") {
    return "/wp-json/";
  }

  const root =
    window.pressedmailPlugin?.wpApiSettings?.root ||
    window.pressedmailPlugin?.apiUrl ||
    getFrontendRuntime()?.apiUrl;

  if (!root) {
    return "/wp-json/";
  }

  return root.endsWith("/") ? root : `${root}/`;
}

// The plugin serves exactly one REST namespace, and it is prefixed. The old
// unprefixed namespace was removed from the server, so falling back to it would
// only ever produce 404s. See test-rest-single-namespace-contract.php, which
// fails if that literal reappears anywhere in this tree.
const PLUGIN_REST_NAMESPACE = "pressedmail/v1";

function normalizeRestNamespace(namespace: unknown): string {
  if (typeof namespace !== "string") {
    return PLUGIN_REST_NAMESPACE;
  }

  const normalized = namespace.trim().replace(/^\/+|\/+$/g, "");
  return normalized || PLUGIN_REST_NAMESPACE;
}

/**
 * Runtime plugin REST namespace, localized by the server as `pressedmail/v1`.
 */
export function getRuntimeRestNamespace(): string {
  if (typeof window === "undefined") {
    return PLUGIN_REST_NAMESPACE;
  }

  return normalizeRestNamespace(
    window.pressedmailPlugin?.restNamespace ||
      getFrontendRuntime()?.routePrefix ||
      PLUGIN_REST_NAMESPACE,
  );
}

/**
 * Absolute URL prefix every plugin REST call should be built against.
 * Returns e.g. `/wp-json/pressedmail/v1/`.
 */
export function getPluginRestBase(): string {
  return getRuntimeRestRoot() + getRuntimeRestNamespace() + "/";
}
