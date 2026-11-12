/** The PostCSS plugin in text-color-cascade.cjs. */
declare function textColorCascade(options: { scope: string }): {
  postcssPlugin: string;
  OnceExit(root: unknown): void;
};

export = textColorCascade;
