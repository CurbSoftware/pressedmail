module.exports = {
  // Styles are explicit Free-source seeds, including this build input.
  // eslint-disable-next-line @typescript-eslint/no-require-imports -- PostCSS loads this CommonJS config.
  plugins: [require("./src/styles/text-color-cascade.cjs")()],
};
