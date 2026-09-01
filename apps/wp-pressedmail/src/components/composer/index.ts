export { PlateComposer } from "./plate-composer";
export type { PlateComposerProps } from "./plate-composer";
export type {
  EmailEditorRef,
  PressedMailComposerValue,
} from "./plate-composer-types";

export { PressedMailRichTextEditor } from "./PressedMailRichTextEditor";
export type { PressedMailRichTextEditorProps } from "./PressedMailRichTextEditor";

export { PluginComposerEditor } from "./PluginComposerEditor";
export type { PluginComposerEditorProps } from "./PluginComposerEditor";

export { ComposerEditorPlugins } from "./plate-composer-plugins";
export { ComposerReactPlugins } from "./plate-composer-react-kit";

export {
  deserializeLegacyHtmlToPlateValue,
  deserializeLegacyHtmlStatic,
  serializePlateValueToHtml,
  serializePlateValueToPlainText,
} from "@/components/composer/plate-composer-serialization.active";

export {
  SignatureBlockPlugin,
  QuoteBlockPlugin,
  AttachmentCardPlugin,
  AISuggestionPlugin,
  SignatureNode,
  QuoteNode,
  AttachmentCardNode,
  AISuggestionNode,
} from "./nodes";
export type {
  SignatureElement,
  QuoteElement,
  AttachmentCardElement,
  AISuggestionElement,
} from "./nodes";
