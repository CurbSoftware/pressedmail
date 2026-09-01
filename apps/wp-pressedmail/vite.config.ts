import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { wp_scripts } from "@kucrut/vite-for-wp/plugins";
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
const wordpressScriptExternals =
  variant === "free"
    ? wp_scripts({
        extraScripts: {
          "react/jsx-runtime": "ReactJSXRuntime",
          "react-dom/client": "ReactDOM",
        },
      })
    : null;

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
  return {
    name: "pressedmail:wp-build-config",
    enforce: "pre",
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
            comments: false,
          },
        },
      }
    : undefined,
  server: {
    host: true,
    port: currentConfig.port,
    strictPort: true,
    origin: `http://localhost:${currentConfig.port}`,
    allowedHosts: ["localhost"],
    cors: true,
    fs: {
      allow: [repoRoot],
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
