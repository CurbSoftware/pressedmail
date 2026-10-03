/** A queued send the undo-send toast can still cancel. */
export interface PendingUndoSend {
  id: number;
  subject?: string;
  sendAt?: string;
  delaySeconds: number;
}

/** Composer inputs only Pro has. Free's composer receives none. */
export interface ComposeProInputs {
  showUndoSend: (pending: PendingUndoSend) => void;
  showAIPanel: boolean;
  contactListsEnabled: boolean;
  trackingFeatureEnabled: boolean;
  undoSendEnabled: boolean;
  undoSendDelaySeconds: 15 | 30 | 60;
}
