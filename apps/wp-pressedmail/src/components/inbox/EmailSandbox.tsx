import React from "react";
import { __ } from "@wordpress/i18n";
import { cn } from "@/lib/utils";
import { sanitizeEmailHtml, blockExternalImages } from "@/lib/sanitize-email";
import { getPluginRestBase, getRuntimeWpNonce } from "@/lib/runtime-config";
import { subscribeRuntimeNonce } from "@/lib/nonce";

interface EmailSandboxProps {
  /**
   * Endpoint mode (preferred): when accountId + uid are provided, the iframe
   * loads `/wp-json/pressedmail/v1/messages/iframe/{accountId}?uid=...` with real
   * Content-Security-Policy response headers. This is stronger than the
   * srcdoc + <meta> fallback because the headers apply before parsing.
   */
  accountId?: number | null;
  uid?: string | number | null;
  folder?: string | null;
  /**
   * Preview mode: raw HTML for in-memory previews (composer, signatures).
   * Will be DOMPurify-sanitized and rendered via srcdoc. Ignored when
   * accountId + uid are present.
   */
  html?: string;
  /** Additional class name for the outer container. */
  className?: string;
  /** When true, external images are shown. Default: false (blocked). */
  showExternalImages?: boolean;
  /** Fires when blocked image count changes (preview mode only). */
  onBlockedImageCount?: (count: number) => void;
  /**
   * Hex color (#rgb or #rrggbb) painted on the iframe's html/body so the
   * sender's chosen email background fills the preview surface edge to edge.
   * When omitted the iframe falls back to the host's UI theme background.
   */
  bodyBackgroundColor?: string;
}

/**
 * Renders email HTML inside a sandboxed iframe for security isolation.
 *
 * Security guarantees:
 * - No JavaScript execution (sandbox omits allow-scripts)
 * - No access to parent DOM/cookies/storage (no allow-same-origin)
 * - No form submission
 * - No top-frame navigation
 * - CSS cannot escape the iframe (no overlay attacks on WP admin)
 * - All links open in new tabs via <base target="_blank">
 * - DOMPurify sanitization as defense-in-depth before iframe
 * - External images blocked by default (tracking pixel protection)
 */
export function EmailSandbox({
  accountId,
  uid,
  folder,
  html,
  className,
  showExternalImages = false,
  onBlockedImageCount,
  bodyBackgroundColor,
}: EmailSandboxProps) {
  const useEndpoint = Boolean(
    accountId != null && uid != null && String(uid) !== "",
  );

  const themeColors = useThemeColorsForSandbox();
  const chromeColors = useSandboxChromeColors();
  const runtimeNonce = React.useSyncExternalStore(
    subscribeRuntimeNonce,
    getRuntimeWpNonce,
    () => "",
  );

  // ---- Preview / srcdoc fallback ----
  const sanitized = React.useMemo(() => sanitizeEmailHtml(html ?? ""), [html]);
  const blockedImageResult = React.useMemo(
    () => blockExternalImages(sanitized),
    [sanitized],
  );
  const { processedHtml, blockedCount } = React.useMemo(() => {
    if (useEndpoint) {
      return {
        processedHtml: "",
        blockedCount: blockedImageResult.blockedCount,
      };
    }
    if (showExternalImages) {
      return {
        processedHtml: sanitized,
        blockedCount: blockedImageResult.blockedCount,
      };
    }
    return {
      processedHtml: blockedImageResult.html,
      blockedCount: blockedImageResult.blockedCount,
    };
  }, [blockedImageResult, sanitized, showExternalImages, useEndpoint]);

  React.useEffect(() => {
    onBlockedImageCount?.(blockedCount);
  }, [blockedCount, onBlockedImageCount]);

  const srcdoc = React.useMemo(() => {
    if (useEndpoint) return "";
    return buildSandboxDocument(
      processedHtml,
      themeColors,
      bodyBackgroundColor,
      chromeColors,
    );
  }, [bodyBackgroundColor, chromeColors, processedHtml, themeColors, useEndpoint]);

  // ---- Endpoint mode ----
  const src = React.useMemo(() => {
    if (!useEndpoint) return "";
    return buildIframeEndpointUrl(
      {
        accountId: accountId!,
        uid: String(uid),
        folder: folder ?? "INBOX",
        showImages: showExternalImages,
        colors: themeColors,
        chromeColors,
      },
      runtimeNonce,
    );
  }, [
    accountId,
    uid,
    folder,
    showExternalImages,
    chromeColors,
    themeColors,
    runtimeNonce,
    useEndpoint,
  ]);

  return (
    <div className={cn("flex flex-col flex-1 min-h-0", className)}>
      <iframe
        data-test="email-sandbox-iframe"
        sandbox="allow-popups allow-popups-to-escape-sandbox"
        referrerPolicy="no-referrer"
        {...(useEndpoint ? { src } : { srcDoc: srcdoc })}
        title={__("Email content", "pressedmail")}
        style={{
          width: "100%",
          border: "none",
          flex: "1 1 0",
          minHeight: 200,
          display: "block",
        }}
      />
    </div>
  );
}

interface IframeUrlOpts {
  accountId: number;
  uid: string;
  folder: string;
  showImages: boolean;
  colors: SandboxThemeColors;
  chromeColors: SandboxChromeColors;
}

export function buildIframeEndpointUrl(
  opts: IframeUrlOpts,
  nonce = getRuntimeWpNonce(),
): string {
  const base = getPluginRestBase();
  const params = new URLSearchParams({
    uid: opts.uid,
    folder: opts.folder,
    show_images: opts.showImages ? "1" : "0",
    theme_bg: opts.colors.background,
    theme_fg: opts.colors.foreground,
    theme_link: opts.colors.linkColor,
    chrome_bg: opts.chromeColors.background,
    chrome_fg: opts.chromeColors.foreground,
    chrome_border: opts.chromeColors.border,
    _wpnonce: nonce,
  });
  return `${base}messages/iframe/${opts.accountId}?${params.toString()}`;
}

/**
 * Fixed light surface colors for the email sandbox.
 *
 * Email content renders theme-independent: the same fixed light surface in dark
 * and light UI mode, so senders' emails are not restyled by the app theme. The
 * sender's own colors still win via inline styles and the explicit
 * bodyBackgroundColor override; the per-user force-light / invert override
 * remains the opt-in path.
 */
function useThemeColorsForSandbox(): SandboxThemeColors {
  return React.useMemo(
    () => ({
      background: "#ffffff",
      foreground: "#111827",
      linkColor: "#2563eb",
    }),
    [],
  );
}

interface SandboxThemeColors {
  background: string;
  foreground: string;
  linkColor: string;
}

interface SandboxChromeColors {
  background: string;
  foreground: string;
  border: string;
}

const DEFAULT_SANDBOX_CHROME_COLORS: SandboxChromeColors = {
  background: "#ffffff",
  foreground: "#111827",
  border: "#d1d5db",
};

function getSandboxThemeRoot(): HTMLElement | null {
  if (typeof document === "undefined") return null;

  return (
    document.getElementById("pressedmail-plugin") ??
    document.getElementById("pressedmail-plugin-frontend") ??
    document.querySelector<HTMLElement>("[data-pm-theme-root]") ??
    document.documentElement
  );
}

function readSandboxChromeColors(): SandboxChromeColors {
  const themeRoot = getSandboxThemeRoot();
  if (!themeRoot || typeof window === "undefined") {
    return DEFAULT_SANDBOX_CHROME_COLORS;
  }

  const style = window.getComputedStyle(themeRoot);
  return {
    background:
      style.getPropertyValue("--card").trim() ||
      DEFAULT_SANDBOX_CHROME_COLORS.background,
    foreground:
      style.getPropertyValue("--card-foreground").trim() ||
      DEFAULT_SANDBOX_CHROME_COLORS.foreground,
    border:
      style.getPropertyValue("--border").trim() ||
      DEFAULT_SANDBOX_CHROME_COLORS.border,
  };
}

function useSandboxChromeColors(): SandboxChromeColors {
  const [colors, setColors] = React.useState(readSandboxChromeColors);

  React.useEffect(() => {
    const updateColors = () => {
      const next = readSandboxChromeColors();
      setColors((current) =>
        current.background === next.background &&
        current.foreground === next.foreground &&
        current.border === next.border
          ? current
          : next,
      );
    };

    updateColors();

    const themeRoot = getSandboxThemeRoot();
    const targets = new Set<Element>([
      document.documentElement,
      document.body,
      ...(themeRoot ? [themeRoot] : []),
    ]);
    const observer = new MutationObserver(updateColors);
    targets.forEach((target) =>
      observer.observe(target, {
        attributes: true,
        attributeFilter: ["class"],
      }),
    );

    return () => observer.disconnect();
  }, []);

  return colors;
}

const HEX_COLOR_PATTERN = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const CSS_HEX_COLOR_PATTERN = /^#[0-9a-fA-F]{3,8}$/;
const CSS_COLOR_FUNCTION_PATTERN =
  /^(?:rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|hwb|color)\(\s*[0-9a-zA-Z.,%/\s+-]*\)$/;
const CSS_COLOR_KEYWORD_PATTERN = /^[a-zA-Z]{1,32}$/;

function sanitizeSandboxColor(value: string, fallback: string): string {
  const candidate = value.trim();
  return CSS_HEX_COLOR_PATTERN.test(candidate) ||
    CSS_COLOR_FUNCTION_PATTERN.test(candidate) ||
    CSS_COLOR_KEYWORD_PATTERN.test(candidate)
    ? candidate
    : fallback;
}

/** Build a complete HTML document string for the iframe srcdoc. */
export function buildSandboxDocument(
  sanitizedHtml: string,
  colors: SandboxThemeColors,
  bodyBackgroundColor?: string,
  chromeColors: SandboxChromeColors = DEFAULT_SANDBOX_CHROME_COLORS,
): string {
  const explicitBodyBg =
    typeof bodyBackgroundColor === "string" &&
    HEX_COLOR_PATTERN.test(bodyBackgroundColor)
      ? bodyBackgroundColor
      : null;
  const surfaceBackground = explicitBodyBg ?? (colors.background || "#ffffff");
  const surfaceForeground = colors.foreground || "#111827";
  const safeChromeColors = {
    background: sanitizeSandboxColor(
      chromeColors.background,
      DEFAULT_SANDBOX_CHROME_COLORS.background,
    ),
    foreground: sanitizeSandboxColor(
      chromeColors.foreground,
      DEFAULT_SANDBOX_CHROME_COLORS.foreground,
    ),
    border: sanitizeSandboxColor(
      chromeColors.border,
      DEFAULT_SANDBOX_CHROME_COLORS.border,
    ),
  };

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src data: cid: https:; style-src 'unsafe-inline' https:; font-src data: https:; base-uri 'none'; form-action 'none'; script-src 'none'; connect-src 'none'; frame-src 'none'; object-src 'none'; media-src 'none'">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="referrer" content="no-referrer">
<base target="_blank">
<style>
*,*::before,*::after{box-sizing:border-box}
html,body{
  margin:0;padding:0;
  background:${surfaceBackground};
  color:${surfaceForeground};
  color-scheme:light;
  font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial,sans-serif;
  font-size:14px;
  line-height:1.6;
  word-wrap:break-word;
  overflow-wrap:break-word;
  overflow-x:hidden;
  max-width:100%;
}
body{padding:16px;max-width:100%}
/* Keep native scrollbar chrome aligned with the host UI without changing the
   fixed-light email canvas or sender-authored content colors. */
html{scrollbar-width:thin;scrollbar-color:${safeChromeColors.border} ${safeChromeColors.background}}
*::-webkit-scrollbar{width:8px;height:8px}
*::-webkit-scrollbar-track{background:${safeChromeColors.background}}
*::-webkit-scrollbar-thumb{background-color:${safeChromeColors.border};border-radius:8px}
*::-webkit-scrollbar-thumb:hover{background-color:color-mix(in srgb,${safeChromeColors.border} 65%,${safeChromeColors.foreground})}
/* RTF/HTML emails must render with the sender's own colors intact on a white
   surface (R2). :where() drops these element rules to specificity 0 so ANY
   sender rule (inline style or stylesheet) outranks them, the link color and
   blockquote color here are fallbacks only, applied when the sender specifies
   none. The html/body color above stays a low-priority inherited fallback
   for the same reason. */
:where(a){color:${colors.linkColor}}
img,video{max-width:100% !important;height:auto}
img[data-blocked="true"]{
  display:inline-block;
  min-width:24px;min-height:24px;
  background:#f0f0f0;border:1px dashed #ccc;
}
/* Tables size to their content. A fixed table layout divides the pane by the
   first row and ignores everything else, and anywhere-wrapping on a cell drops
   its min-content width to one character, so together they crushed every
   column. A table wider than the pane scrolls instead of being squeezed. */
table{max-width:100%;border-collapse:collapse}
td,th{padding:4px 8px;overflow-wrap:break-word}
div,p,span,a,li,blockquote{max-width:100%;overflow-wrap:anywhere;word-break:break-word}
:where(blockquote){
  margin:8px 0;padding-left:12px;
  border-left:3px solid #ccc;color:#666;
}
pre,code{max-width:100%;overflow-x:hidden;white-space:pre-wrap;overflow-wrap:anywhere;word-break:break-word}
pre{padding:8px;background:#f5f5f5;border-radius:4px}
.pm-email-content{min-height:calc(100vh - 32px);max-width:100%;overflow-x:auto;overflow-wrap:break-word}
</style>
</head>
<body><main class="pm-email-content">${sanitizedHtml}</main></body>
</html>`;
}
