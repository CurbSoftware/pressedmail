/**
 * Keep Tailwind text colors above wp-admin without rebuilding its variants.
 *
 * Vite runs PostCSS after Tailwind's transform. Move only utility `color`
 * declarations out of their layer, retaining the compiler's selector, nesting,
 * condition and source order. Explicitly important utilities stay in their
 * layer, where CSS gives them priority over the normal utilities we promote.
 *
 * Every promoted rule is prefixed with `scope`, the product's own roots, which
 * each caller passes. Two stylesheets that load on one page (PressedMail and a
 * companion) must both weigh at least one ID: promoted rules are all
 * `!important`, so specificity alone decides between the host's
 * `.text-foreground` and a companion's `hover:` variant.
 */

function textColor(value) {
  // Preserve the existing theme mappings for the remaining generic text colors.
  const aliases = {
    "blue-500": "primary",
    "blue-600": "primary",
    "blue-700": "primary",
    "purple-600": "primary",
    "indigo-600": "primary",
    "gray-900": "foreground",
    "gray-800": "foreground",
    "gray-700": "foreground",
    "gray-600": "muted-foreground",
    "gray-500": "muted-foreground",
    "gray-400": "muted-foreground",
    "red-500": "destructive",
    "red-600": "destructive",
  };
  return value
    .replace(/var\(--color-([a-z]+-\d+)\)/g, (match, color) =>
      aliases[color] ? `var(--${aliases[color]})` : match,
    )
    .replace(
      /var\(--(primary|success|warning|info|destructive)\)/g,
      (_, color) => `var(--${color}-text, var(--${color}))`,
    );
}

function extract(node, important, scope, scoped = false) {
  if (node.type === "decl") {
    if (node.prop !== "color" || !!node.important !== important) return null;
    const promoted = node.clone({
      important: true,
      value: textColor(node.value),
    });
    node.remove();
    return promoted;
  }
  if (!node.nodes) return null;
  const promoted = node.clone({ nodes: [] });
  if (node.type === "rule" && !scoped) {
    promoted.selectors = node.selectors.map(
      (selector) => `${scope} ${selector}`,
    );
  }
  for (const child of [...node.nodes]) {
    const result = extract(
      child,
      important,
      scope,
      scoped || node.type === "rule",
    );
    if (result) promoted.append(result);
  }
  if (node.nodes.length === 0) node.remove();
  return promoted.nodes.length ? promoted : null;
}

/** @param {{ scope: string }} options */
module.exports = ({ scope } = {}) => {
  if (typeof scope !== "string" || scope.trim() === "") {
    throw new TypeError(
      "text-color-cascade needs a scope: the selector of the product's roots.",
    );
  }
  return {
    postcssPlugin: "text-color-cascade",
    OnceExit(root) {
      const promoted = [];
      root.walkAtRules("layer", (layer) => {
        if (layer.params !== "utilities" || !layer.nodes) return;
        for (const node of [...layer.nodes]) {
          const result = extract(node, false, scope);
          if (result) promoted.push(result);
        }
        const important = layer.clone({ nodes: [] });
        for (const node of [...layer.nodes]) {
          const result = extract(node, true, scope);
          if (result) important.append(result);
        }
        if (important.nodes.length) promoted.push(important);
      });
      root.append(promoted);
    },
  };
};
