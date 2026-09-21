import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import externalGlobals from "rollup-plugin-external-globals";
import type { Plugin, ResolvedConfig } from "vite";
import { defineConfig } from "vite";
import sharedFeatureConfig from "./feature-variants.cjs";
import { editionAliases } from "./edition-aliases.cjs";

const require = createRequire(import.meta.url);
const target = process.env.TARGET || "admin";
/**
 * The edition being built.
 *
 * This used to default to `"pro"`, so an unset or misspelt
 * `VITE_PLUGIN_VARIANT` silently produced a Pro bundle, including from the
 * public Free source repository, whose BUILD.md tells people to run a bare
 * `pnpm build`. Every switch on the edition boundary now fails toward Free: a
 * wrong variant costs a missing feature, which is obvious, instead of shipping
 * Pro code in the Free plugin, which is invisible.
 */
function resolveVariant(): "free" | "pro" {
  const requested = process.env.VITE_PLUGIN_VARIANT;

  if (requested === "free" || requested === "pro") {
    return requested;
  }

  if (requested !== undefined) {
    throw new Error(
      `VITE_PLUGIN_VARIANT must be "free" or "pro"; received "${requested}".`,
    );
  }

  console.warn(
    "[pressedmail] VITE_PLUGIN_VARIANT is unset; building the free edition. " +
      "Set it explicitly (pnpm build:free / pnpm build:pro).",
  );
  return "free";
}

const variant = resolveVariant();

const stripConsole = process.env.STRIP_CONSOLE === "true";
const useDbMailbox = process.env.VITE_USE_DB_MAILBOX !== "false";
const emailRulesEnabled = process.env.VITE_ENABLE_EMAIL_RULES !== "false";
const repoRoot = path.resolve(__dirname, "../..");
const kitPlateDependencyResolveRoot = path.resolve(repoRoot, "packages/plate");

function resolveReactCompilerCompatibilityEntrypoint(): string {
  const plateReactEntrypoint = require.resolve("@platejs/core/react", {
    paths: [kitPlateDependencyResolveRoot],
  });
  return require.resolve("react-compiler-runtime/src/index.ts", {
    paths: [path.dirname(plateReactEntrypoint)],
  });
}

const reactCompilerCompatibilityEntrypoint =
  resolveReactCompilerCompatibilityEntrypoint();

const FREE_REACT_RUNTIME_FORBIDDEN = [
  "__CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE",
  "useMemoCache",
  "react.transitional.element",
] as const;

// Each (target, variant) Vite dev server gets its own dependency-optimization
// cache. Pro and Free dev servers otherwise share `node_modules/.vite`, and
// because `VITE_PLUGIN_VARIANT` changes `define`/aliases their configHashes
// differ, so whichever server starts last wipes the other's optimized chunks.
// Serving half-invalidated deps splits the React/Plate editor-store context,
// which surfaces at runtime as "Plate hooks must be used inside a Plate or
// PlateController" until the cache is manually cleared and the server restarted.
const cacheDir = path.resolve(
  __dirname,
  `node_modules/.vite/${target}-${variant}`,
);

// =============================================================================
// Feature Flag System
// =============================================================================

const {
  FEATURE_GROUPS,
  FEATURE_VARIANTS,
  DISABLED_FEATURES: DISABLED_FEATURE_LIST,
} = sharedFeatureConfig as {
  FEATURE_GROUPS: Record<string, readonly string[]>;
  FEATURE_VARIANTS: Record<string, "free" | "pro" | "extended">;
  DISABLED_FEATURES: readonly string[];
};

/**
 * Check if a feature's variant requirement is met
 */
function variantMet(featureVariant: string, currentVariant: string): boolean {
  // Free features are always available
  if (featureVariant === "free") return true;
  // Pro features require pro variant
  if (featureVariant === "pro") return currentVariant === "pro";
  // Legacy extended features are roadmapped and excluded from current builds.
  if (featureVariant === "extended") return false;
  return false;
}

const DISABLED_FEATURES = new Set(DISABLED_FEATURE_LIST);

/**
 * Resolve all feature flags based on environment variables and variant
 *
 * Priority order:
 * 1. Disabled features (always false)
 * 2. Individual feature flag (VITE_ENABLE_FEATURE_NAME)
 * 3. Group flag (VITE_ENABLE_GROUP_NAME)
 * 4. Variant default (enabled if variant requirement met)
 *
 * All flags default to enabled unless:
 * - Feature is in DISABLED_FEATURES
 * - Explicitly set to 'false' via env var
 * - Variant requirement not met
 */
function resolveFeatureFlags(): Record<string, boolean> {
  const flags: Record<string, boolean> = {};

  for (const [groupName, features] of Object.entries(FEATURE_GROUPS)) {
    const groupEnvKey = `VITE_ENABLE_${groupName}`;
    const groupEnvValue = process.env[groupEnvKey];

    for (const featureId of features) {
      const featureEnvKey = `VITE_ENABLE_${featureId.toUpperCase()}`;
      const featureEnvValue = process.env[featureEnvKey];
      const requiredVariant = FEATURE_VARIANTS[featureId] || "free";

      // Determine if enabled based on priority order
      let enabled: boolean;

      // Priority 1: Disabled features are always false
      if (DISABLED_FEATURES.has(featureId)) {
        enabled = false;
      } else if (featureEnvValue !== undefined) {
        // Priority 2: Individual flag explicitly set
        enabled = featureEnvValue !== "false";
      } else if (groupEnvValue !== undefined) {
        // Priority 3: Group flag explicitly set
        enabled = groupEnvValue !== "false";
      } else {
        // Priority 4: Default to enabled
        enabled = true;
      }

      // Final check: variant requirement must always be met
      if (!variantMet(requiredVariant, variant)) {
        enabled = false;
      }

      const flagName = `__ENABLE_${featureId.toUpperCase()}__`;
      flags[flagName] = enabled;
    }
  }

  return flags;
}

// Resolve feature flags
const featureFlags = resolveFeatureFlags();

/**
 * The Vite dev port is written into `vite-dev-server.json`, which WordPress
 * reads to locate the HMR server, so it is not merely a local listen port, it
 * is baked into what the plugin serves. Two checkouts running `wp:dev` at once
 * otherwise fight over 5174/5176 and over that manifest.
 */
const VITE_DEV_PORTS = { pro: 5174, free: 5176 } as const;

function resolveDevPort(): number {
  const override = process.env.PRESSEDMAIL_VITE_PORT;
  if (override) {
    const parsed = Number.parseInt(override, 10);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      throw new Error(
        `PRESSEDMAIL_VITE_PORT must be a positive integer; received "${override}".`,
      );
    }
    return parsed;
  }
  return VITE_DEV_PORTS[variant];
}

const configs = {
  admin: {
    input: "src/admin/main.tsx",
    outDir: "plugin-files/assets/admin/dist",
    port: resolveDevPort(),
  },
};

const currentConfig = configs[target as keyof typeof configs];
/**
 * Module specifiers this build reads from a WordPress global instead of
 * bundling, and the global each one comes from.
 *
 * Free takes React from core, which prints a compatible copy on every admin
 * screen. Pro keeps its own React 19 (core ships 18, Plate needs 19) but still
 * takes `@wordpress/i18n`, so `wp_set_script_translations()` has somewhere to
 * load a catalogue into for either edition rather than for Free alone.
 *
 * This object is the entire externals configuration, which is what lets
 * `emitWordPressDependencies()` state the script handles as a fact. It used to
 * be `wp_scripts()`, which externalises all sixty-odd globals WordPress
 * registers: an import of jquery, lodash or any other `@wordpress` package
 * would silently have been externalised with no handle declared for it, which
 * is exactly how Free came to depend on wp-i18n without ever saying so.
 */
const wordpressProvidedModules: Record<string, string> =
  variant === "free"
    ? {
        react: "React",
        "react-dom": "ReactDOM",
        "react-dom/client": "ReactDOM",
        "react/jsx-runtime": "ReactJSXRuntime",
        "@wordpress/i18n": "wp.i18n",
      }
    : { "@wordpress/i18n": "wp.i18n" };

const wordpressScriptExternals = externalGlobals(
  wordpressProvidedModules,
) as Plugin;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function resolveKitPlateDependencyEntrypoint(entrypoint: string): string {
  return require.resolve(entrypoint, {
    paths: [kitPlateDependencyResolveRoot],
  });
}

function createKitPlateDependencyAlias(entrypoint: string) {
  return {
    find: new RegExp(`^${escapeRegExp(entrypoint)}$`),
    replacement: resolveKitPlateDependencyEntrypoint(entrypoint),
  };
}

function wordpressBuildConfig(): Plugin {
  let resolvedOutDir = "";

  return {
    name: "pressedmail:wp-build-config",
    enforce: "pre",
    configResolved(resolved) {
      resolvedOutDir = resolved.build.outDir;
    },
    config(existingConfig, env) {
      const outDir =
        env.command === "serve"
          ? `${currentConfig.outDir}-${variant}`
          : currentConfig.outDir;

      return {
        base: "./",
        build: {
          outDir,
          emptyOutDir: true,
          manifest: "manifest.json",
          modulePreload: false,
          rollupOptions: {
            input: currentConfig.input,
            output: {
              // The entry keeps Vite's content hash, like every other chunk.
              //
              // It used to be pinned to `assets/main.js` so that WordPress could
              // resolve the script's translations by a stable md5. That was
              // redundant: `Admin.php::translation_relative_path()` already maps
              // the registered entry to that stable path before core computes
              // anything, so the name on disk never reaches the lookup. Pinning
              // it cost more than it bought, because every lazy chunk imports
              // the entry by a query-less relative path (`from"./main.js"`)
              // while WordPress loads it as `main.js?ver=<mtime>`: two module
              // identities for one file. The second one is whatever the CDN has,
              // and this origin sends `max-age=315360000`, so after an update a
              // browser ran the previous build's entry, asked for chunk names
              // that no longer existed, and the Pro More screen died with
              // "Failed to fetch dynamically imported module".
              //
              // A content hash makes the entry immutable like the rest of the
              // bundle, and every build's chunks import the entry that was built
              // with them.
              entryFileNames: "assets/[name]-[hash].js",
              // The syntax-highlighting grammars get their own chunk, and the
              // reason is not bundle size.
              //
              // WP-CLI extracts strings from JavaScript with Peast, which has a
              // bracket-counting bug in Scanner::reconsumeCurrentTokenAsRegexp():
              // when the token after a `/` is a closing bracket, the
              // compensation is skipped and the scan later fails on a legitimate
              // bracket. A regex whose first body character is `]`, `}` or `)`
              // triggers it, and highlight.js carries three: two in the PHP
              // grammar and one in Swift, reached through lowlight's `common`
              // set. Peast then refuses the whole file, and WP-CLI extracts
              // nothing from it at all, so the interface's 1,653 strings never
              // reach translate.wordpress.org.
              //
              // Isolating the grammars moves those bytes out of the entry chunk.
              // A grammar holds no translatable strings, so the chunk that
              // cannot be parsed costs nothing, and the chunk that can be
              // parsed is the one carrying the interface.
              manualChunks: (id) =>
                id.includes('highlight.js') || id.includes('lowlight')
                  ? 'highlight-grammars'
                  : undefined,
            },
            treeshake:
              variant === "free"
                ? {
                    moduleSideEffects: (id) =>
                      id !== reactCompilerCompatibilityEntrypoint,
                    propertyReadSideEffects: false,
                  }
                : undefined,
          },
          sourcemap: existingConfig.build?.sourcemap ?? false,
        },
        css: {
          devSourcemap: true,
        },
      };
    },
    // Vite's manifest keys every module it treated as an entry, including lazy
    // modules resolved outside this app. Under pnpm those keys are the resolved
    // store path (`../../node_modules/.pnpm/<pkg>@<version>_<hash>/...`), so the
    // shipped manifest published the local install layout and told a reviewer
    // nothing about the plugin.
    //
    // Nothing reads them. `libs/assets.php` loads one named entry
    // (`src/admin/main.tsx`) and follows neither `imports` nor `dynamicImports`,
    // so an out-of-root key is unreachable weight in the package. Keep the
    // manifest to what the app itself owns.
    closeBundle() {
      if (!resolvedOutDir) return;

      const manifestPath = path.join(resolvedOutDir, "manifest.json");

      if (!existsSync(manifestPath)) return;

      const manifest: Record<string, unknown> = JSON.parse(
        readFileSync(manifestPath, "utf8"),
      );
      const inAppRoot = Object.entries(manifest).filter(
        ([key]) => !key.startsWith(".."),
      );

      if (inAppRoot.length === Object.keys(manifest).length) return;

      // Match Vite's own output: two-space indent, no trailing newline.
      writeFileSync(
        manifestPath,
        JSON.stringify(Object.fromEntries(inAppRoot), null, 2),
        "utf8",
      );
    },
  };
}

function enforceFreeReactCompatibility(): Plugin {
  return {
    name: "pressedmail:free-react-compatibility",
    apply: "build",
    generateBundle(_options, bundle) {
      if (variant !== "free") return;

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;

        for (const forbidden of FREE_REACT_RUNTIME_FORBIDDEN) {
          if (output.code.includes(forbidden)) {
            throw new Error(
              `Free bundle ${output.fileName} contains incompatible React runtime marker: ${forbidden}`,
            );
          }
        }
      }
    },
  };
}

/**
 * Writes the list of first-party modules Rollup actually pulled into the bundle.
 *
 * The edition boundary is enforced by Vite aliases and `__ENABLE_*` defines, and
 * nothing verified that either worked: the only bundle-level check in this file
 * looks for three React runtime strings. A module list is the cheapest honest
 * answer to "did Pro code reach the Free build", because it reflects the real
 * graph rather than the config that was supposed to shape it.
 *
 * `scripts/plugin/verify-edition-purity.mjs` consumes this. The file lands next
 * to the bundle and is gitignored along with the rest of `dist`.
 */
function emitModuleGraph(): Plugin {
  return {
    name: "pressedmail:module-graph",
    apply: "build",
    generateBundle(_options, bundle) {
      const modules = new Set<string>();

      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          // Only first-party source; node_modules would drown the signal.
          if (id.includes("/node_modules/")) continue;
          const relative = path.relative(__dirname, id).split("?", 1)[0] ?? "";
          if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
            continue;
          }
          modules.add(relative);
        }
      }

      this.emitFile({
        type: "asset",
        fileName: "module-graph.json",
        source: JSON.stringify(
          {
            variant,
            target,
            modules: [...modules].sort(),
          },
          null,
          2,
        ),
      });
    },
  };
}

/**
 * Names the package a bundled module came from, or null when it is first-party.
 *
 * pnpm stores every dependency under `node_modules/.pnpm/<name>@<version>/`,
 * so the package root is always the last `node_modules/<name>` pair in the id.
 */
function packageDirForModule(id: string): string | null {
  const marker = `${path.sep}node_modules${path.sep}`;
  const at = id.lastIndexOf(marker);
  if (at === -1) return null;

  const segments = id.slice(at + marker.length).split(path.sep);
  const name = segments[0]?.startsWith("@")
    ? segments.slice(0, 2).join("/")
    : segments[0];
  if (!name) return null;

  const dir = path.join(id.slice(0, at + marker.length), name);
  return existsSync(path.join(dir, "package.json")) ? dir : null;
}

/** The licence file a package ships, or null when it ships none. */
function licenseTextForPackage(dir: string): string | null {
  for (const candidate of readdirSync(dir)) {
    if (/^(licen[cs]e|copying|notice)(\.(md|txt|markdown))?$/i.test(candidate)) {
      const full = path.join(dir, candidate);
      if (statSync(full).isFile()) return readFileSync(full, "utf8").trim();
    }
  }
  return null;
}

/**
 * Turns a package.json `repository` value into a browsable URL.
 *
 * npm allows the same repository to be spelled half a dozen ways, and the raw
 * values in this tree include `ssh://git@github.com/owner/repo`, the bare
 * `owner/repo` shorthand and the `github:owner/repo` form.
 */
function repositoryUrlForPackage(value: unknown): string | undefined {
  if (typeof value !== "string" || value.trim() === "") return undefined;

  const raw = value.trim().replace(/^git\+/, "");
  const scp = raw.match(/^git@([^:]+):(.+)$/);
  const shorthand = raw.match(/^(?:github|gitlab|bitbucket):(.+)$/);
  if (scp?.[1] && scp[2]) return `https://${scp[1]}/${scp[2]}`.replace(/\.git$/, "");
  if (shorthand?.[1]) return `https://github.com/${shorthand[1]}`.replace(/\.git$/, "");
  if (/^[\w.-]+\/[\w.-]+$/.test(raw)) return `https://github.com/${raw}`;

  return raw
    .replace(/^ssh:\/\/git@/, "https://")
    .replace(/^ssh:\/\//, "https://")
    .replace(/^git:\/\//, "https://")
    .replace(/\.git$/, "");
}

/**
 * Writes the copyright and licence notices for the third-party code in the
 * bundle, from the modules Rollup actually pulled in.
 *
 * MIT, ISC, BSD and Apache-2.0 all require the copyright notice and the licence
 * text to travel with a redistributed binary, and minification is what strips
 * them: `format.comments` below keeps a package's `@license` banner only when it
 * wrote one, and most of them do not. Keeping a hand-written list accurate is a
 * losing game, so the list is derived from the module graph instead and cannot
 * describe a package the build did not compile.
 *
 * The file lands next to the bundle and ships in the plugin zip, because the
 * bundle is what it covers.
 */
function emitThirdPartyNotices(): Plugin {
  return {
    name: "pressedmail:third-party-notices",
    apply: "build",
    generateBundle(_options, bundle) {
      const dirs = new Set<string>();
      for (const output of Object.values(bundle)) {
        if (output.type !== "chunk") continue;
        for (const id of Object.keys(output.modules)) {
          const dir = packageDirForModule(id);
          if (dir) dirs.add(dir);
        }
      }

      const entries = [...dirs]
        .map((dir) => {
          const manifest = JSON.parse(
            readFileSync(path.join(dir, "package.json"), "utf8"),
          ) as {
            name?: string;
            version?: string;
            license?: string;
            licenses?: { type?: string }[];
            repository?: { url?: string } | string;
          };
          const repository =
            typeof manifest.repository === "string"
              ? manifest.repository
              : manifest.repository?.url;
          return {
            name: manifest.name ?? path.basename(dir),
            version: manifest.version ?? "unknown",
            license:
              manifest.license ??
              manifest.licenses?.map((entry) => entry.type).join(" OR ") ??
              "see notice below",
            repository: repositoryUrlForPackage(repository),
            text: licenseTextForPackage(dir),
          };
        })
        .sort((a, b) => a.name.localeCompare(b.name));

      const body = entries
        .map(
          (entry, index) =>
            `${index + 1}. ${entry.name} ${entry.version} - ${entry.license}` +
            (entry.repository ? ` - ${entry.repository}` : ""),
        )
        .join("\n");

      const notices = entries
        .map(
          (entry, index) =>
            `${"-".repeat(78)}\n` +
            `${index + 1}. ${entry.name} ${entry.version}\n` +
            `Licence: ${entry.license}\n` +
            (entry.repository ? `Source: ${entry.repository}\n` : "") +
            `${"-".repeat(78)}\n\n` +
            (entry.text ??
              `This package publishes no licence file in its npm tarball. Its\n` +
                `package.json declares ${entry.license}, whose text is published at\n` +
                `https://spdx.org/licenses/${entry.license}.html`),
        )
        .join("\n\n");

      this.emitFile({
        type: "asset",
        fileName: "THIRD-PARTY-NOTICES.txt",
        source:
          `Third-party notices for the PressedMail ${variant} admin bundle\n` +
          `${"=".repeat(78)}\n\n` +
          `The compiled JavaScript in this directory contains code from the\n` +
          `packages listed below, taken from the npm registry. Each is used under\n` +
          `the licence shown, and its copyright notice and licence text as\n` +
          `published by the package follow the index. Every licence here is\n` +
          `compatible with the GPL-2.0-or-later terms PressedMail ships under.\n\n` +
          `Where each package came from, and which files are adapted rather than\n` +
          `used as published, is in THIRD-PARTY-PROVENANCE.md in the source\n` +
          `repository: https://github.com/CurbSoftware/pressedmail\n\n` +
          `${body}\n\n\n${notices}\n`,
      });
    },
  };
}

/**
 * The registered WordPress script handle that prints a module's global.
 *
 * The two names differ: `@wordpress/i18n` is the `wp.i18n` global, printed by
 * the script registered as `wp-i18n`.
 */
function wordpressScriptHandle(specifier: string): string {
  if (specifier.startsWith("@wordpress/")) {
    return `wp-${specifier.slice("@wordpress/".length)}`;
  }
  if (specifier.startsWith("react/jsx-")) return "react-jsx-runtime";
  if (specifier.startsWith("react-dom")) return "react-dom";
  return specifier;
}

/**
 * Writes the WordPress script handles the built bundle depends on.
 *
 * Both editions used to declare react, react-dom and react-jsx-runtime, so Pro
 * loaded a second React it never calls, while Free never declared wp-i18n and
 * only received it because `wp_set_script_translations()` appends that handle.
 *
 * The answer is the externals configuration, not the emitted code: a first
 * attempt matched globals by regex over the minified chunks, and read React's
 * own error strings inside the Pro bundle as a dependency on React. Every
 * module in `wordpressProvidedModules` is one this build does not carry, so
 * that list, mapped to handles, is the dependency list.
 * `includes/Assets/Admin.php` reads the file.
 */
function emitWordPressDependencies(): Plugin {
  return {
    name: "pressedmail:wp-dependencies",
    apply: "build",
    generateBundle() {
      this.emitFile({
        type: "asset",
        fileName: "wp-dependencies.json",
        source: JSON.stringify(
          {
            variant,
            handles: [
              ...new Set(
                Object.keys(wordpressProvidedModules).map(
                  wordpressScriptHandle,
                ),
              ),
            ].sort(),
          },
          null,
          2,
        ),
      });
    },
  };
}

function useFreeReactCompilerCompatibilityRuntime(): Plugin {
  return {
    name: "pressedmail:free-react-compiler-runtime",
    enforce: "pre",
    load(id) {
      if (
        variant !== "free" ||
        id.split("?", 1)[0] !== reactCompilerCompatibilityEntrypoint
      ) {
        return null;
      }

      // Plate consumes only `c`. Keep the installed compatibility package as
      // the resolved runtime boundary, but compile its React 17/18 fallback
      // surface without its unused development dispatcher guards. Those
      // guards read React 19 private internals even though `c` itself does not.
      return `
        import * as React from "react";
        const empty = Symbol.for("react.memo_cache_sentinel");
        export function c(size) {
          return React.useMemo(() => {
            const cache = new Array(size);
            for (let index = 0; index < size; index += 1) cache[index] = empty;
            cache[empty] = true;
            return cache;
          }, []);
        }
      `;
    },
  };
}

function writeDevServerManifest(): Plugin {
  const pluginsToCheck = ["vite:react-refresh"];
  let manifestFile = "";
  let resolvedConfig: ResolvedConfig;

  return {
    name: "pressedmail:wp-dev-server-manifest",
    apply: "serve",
    configResolved(config) {
      resolvedConfig = config;
    },
    buildStart() {
      const { base, build, plugins, server } = resolvedConfig;
      const port = server.port ?? currentConfig.port;
      const data = JSON.stringify({
        base,
        origin: `http://localhost:${port}`,
        port,
        plugins: pluginsToCheck.filter((pluginName) =>
          plugins.some(({ name }) => name === pluginName),
        ),
      });

      manifestFile = path.join(build.outDir, "vite-dev-server.json");
      mkdirSync(build.outDir, { recursive: true });
      writeFileSync(manifestFile, data, "utf8");
    },
    configureServer(server) {
      server.httpServer?.once("close", () => {
        if (manifestFile) {
          rmSync(manifestFile, { force: true });
        }
      });
    },
  };
}

/**
 * Fixes the origin in vite-for-wp's dev server manifest.
 * The v4wp plugin sets origin to 0.0.0.0 when host: true, but browsers need localhost.
 */
function fixDevServerOrigin(): Plugin {
  return {
    name: "fix-dev-server-origin",
    apply: "serve",
    configResolved(config: ResolvedConfig) {
      // Fix the origin from 0.0.0.0 to localhost so browsers can resolve it
      if (config.server.origin?.includes("0.0.0.0")) {
        (config.server as { origin: string }).origin =
          config.server.origin.replace("0.0.0.0", "localhost");
      }
    },
  };
}

export default defineConfig({
  cacheDir,
  plugins: [
    wordpressBuildConfig(),
    useFreeReactCompilerCompatibilityRuntime(),
    fixDevServerOrigin(),
    writeDevServerManifest(),
    tailwindcss(),
    react(),
    wordpressScriptExternals,
    enforceFreeReactCompatibility(),
    emitModuleGraph(),
    emitWordPressDependencies(),
    emitThirdPartyNotices(),
  ],
  define: {
    __PLUGIN_VARIANT__: JSON.stringify(variant),
    __IS_FREE__: variant === "free",
    __SINGLE_MAILBOX__: variant === "free",
    __SINGLE_SIGNATURE__: variant === "free",
    __SINGLE_SEAT__: variant === "free",
    __IS_PRO__: variant === "pro",
    __USE_DB_MAILBOX__: useDbMailbox,
    __ENABLE_EMAIL_RULES__: emailRulesEnabled,
    // Spread all resolved feature flags
    ...featureFlags,
    // Analytics is a parked feature; never enabled in shipped builds.
    __ENABLE_ANALYTICS__: false,
  },
  resolve: {
    alias: [
      ...(variant === "free"
        ? ["react/compiler-runtime", "react-compiler-runtime"].map(
            (entrypoint) => ({
              find: entrypoint,
              replacement: reactCompilerCompatibilityEntrypoint,
            }),
          )
        : []),
      createKitPlateDependencyAlias("platejs"),
      createKitPlateDependencyAlias("platejs/react"),
      createKitPlateDependencyAlias("platejs/static"),
      createKitPlateDependencyAlias("@platejs/core"),
      createKitPlateDependencyAlias("@platejs/core/react"),
      createKitPlateDependencyAlias("@platejs/core/static"),
      createKitPlateDependencyAlias("@platejs/utils"),
      createKitPlateDependencyAlias("@platejs/utils/react"),
      // The Free/Pro alias table is shared with the test runner so the two
      // cannot drift. See edition-aliases.cjs.
      ...editionAliases(__dirname, variant, featureFlags),
      {
        find: "@",
        replacement: path.resolve(__dirname, "./src"),
      },
      {
        find: "next-intl",
        replacement: path.resolve(
          repoRoot,
          "packages/ui/src/plugin/next-intl-shim.tsx",
        ),
      },
    ],
    // Plate packages must resolve to a single platejs/react instance, or
    // @platejs/* chrome (floating, selection, dnd) gets its own copy of the
    // editor store context and Plate hooks throw "must be used inside a
    // Plate or PlateController" at runtime in the dev server.
    dedupe: [
      "react",
      "react-dom",
      "platejs",
      "@platejs/core",
      "@platejs/utils",
      "slate",
      "slate-dom",
      "slate-react",
    ],
  },
  build: stripConsole
    ? {
        minify: "terser" as const,
        terserOptions: {
          compress: {
            drop_console: true,
            drop_debugger: true,
          },
          format: {
            // The MIT, ISC and BSD-3-Clause libraries in this bundle require
            // their notice to survive redistribution. `comments: false` removed
            // every @license banner from the shipped chunks.
            comments: /@license|@preserve|^!/,
          },
        },
      }
    : undefined,
  server: {
    // Loopback only. `host: true` binds 0.0.0.0, and allowedHosts only checks
    // the Host header, which any direct request sets for itself, so the whole
    // repository (committed credentials included) was readable over /@fs/ by
    // anyone on the network while a developer ran this server.
    host: "localhost",
    port: currentConfig.port,
    strictPort: true,
    origin: `http://localhost:${currentConfig.port}`,
    allowedHosts: ["localhost"],
    cors: true,
    fs: {
      // The app, the workspace packages it compiles from, and the dependency
      // store. Not `environment/` or `testing/`.
      allow: [
        __dirname,
        path.resolve(repoRoot, "packages"),
        path.resolve(repoRoot, "node_modules"),
      ],
    },
    watch: {
      ignored: [
        "**/node_modules/**",
        "**/.git/**",
        "**/.turbo/**",
        "**/dist/**",
        "**/plugin-files/assets/*/dist/**",
        "**/apps/wp-pressedmail/dist/**",
        "**/apps/web-*/**",
        "**/apps/dashboard/**",
        "**/apps/dev-tool/**",
        "**/packages/supabase-schemas-*/schemas/**",
        "**/testing/**",
        "**/coverage/**",
        "**/.next/**",
      ],
    },
  },
});
