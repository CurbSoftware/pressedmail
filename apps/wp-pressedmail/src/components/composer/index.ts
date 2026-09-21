export { PlateComposer } from "./plate-composer";
export type { PlateComposerProps } from "./plate-composer";
export type {
  EmailEditorRef,
  PressedMailComposerValue,
} from "./plate-composer-types";

export { PressedMailRichTextEditor } from "./PressedMailRichTextEditor";
export type { PressedMailRichTextEditorProps } from "./PressedMailRichTextEditor";

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
  AttachmentCardPlugin,
  AISuggestionPlugin,
  SignatureNode,
  AttachmentCardNode,
  AISuggestionNode,
} from "./nodes";
export type {
  SignatureElement,
  AttachmentCardElement,
  AISuggestionElement,
} from "./nodes";
