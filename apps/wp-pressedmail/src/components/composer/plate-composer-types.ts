import type { Value } from '@kit/plate';
import type {
  PlateEmailEditorAdapterProps,
  PlateEmailEditorRef,
} from '@kit/plate/email-editor';

export type PressedMailComposerValue = Value;

export type EmailEditorRef = PlateEmailEditorRef;

export interface PressedMailPlateComposerProps
  extends PlateEmailEditorAdapterProps<PressedMailComposerValue> {}
