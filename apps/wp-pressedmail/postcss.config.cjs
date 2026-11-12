module.exports = {
  // Styles are explicit Free-source seeds, including this build input. The
  // cascade itself ships in the vendored packages/ui.
  plugins: [
    // eslint-disable-next-line @typescript-eslint/no-require-imports -- PostCSS loads this CommonJS config.
    require("@kit/ui/styles/text-color-cascade.cjs")({
      scope:
        ":is(#pressedmail-plugin, #pressedmail-plugin-frontend, .pressedmail-frontend, [data-pm-portal], [data-radix-portal])",
    }),
  ],
};
