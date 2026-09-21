/**
 * `gettext-parser` ships no type declarations.
 *
 * Its PO and MO readers are used by the translation pipeline contract test. This
 * is a standalone ambient declaration rather than an entry in `shims.d.ts`,
 * which is a module: a `declare module` inside a module file is an augmentation
 * and cannot introduce a module that has no types to augment.
 */
declare module "gettext-parser" {
  interface GettextTranslation {
    msgid: string;
    msgstr: string[];
  }

  interface GettextParsedPo {
    headers: Record<string, string>;
    translations: Record<string, Record<string, GettextTranslation>>;
  }

  const gettextParser: {
    po: { parse: (input: Uint8Array | string) => GettextParsedPo };
    mo: {
      parse: (input: Uint8Array) => GettextParsedPo;
      compile: (input: Pick<GettextParsedPo, "translations">) => Uint8Array;
    };
  };

  export default gettextParser;
}
