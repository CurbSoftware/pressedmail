/**
 * `gettext-parser` ships no type declarations.
 *
 * Only its PO reader is used, by the translation-template contract test. This
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
  };

  export default gettextParser;
}
