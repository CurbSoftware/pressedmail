/**
 * Free ICS import surface.
 *
 * The Free build has no calendar, so it has no import route to call and no
 * dialog to show. The whole preview client lives in the Pro module; this file
 * exists so the reading pane keeps one import path in both editions and the
 * Pro fetch URLs never reach the Free bundle.
 *
 * The types below are declared structurally rather than re-exported from
 * `ics-import.service`, because importing that module is what pulled it into
 * the Free bundle in the first place.
 */

export type IcsImportSource =
  | { kind: "file"; file: File; localCalendarId?: number }
  | {
      kind: "attachment";
      attachment: unknown;
      localCalendarId?: number;
    };

export interface ImportIcsPreviewProps {
  source: IcsImportSource | null;
  onClose: () => void;
  onImported?: (result: unknown) => void | Promise<void>;
}

export function ImportIcsPreview(_props: ImportIcsPreviewProps): null {
  return null;
}

export default ImportIcsPreview;
