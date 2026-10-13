/**
 * The last resort when the viewer will not start: hand the file to the browser's own PDF viewer in a new tab.
 *
 * Call it from the click itself, so a popup blocker lets the tab open. The tab reads the file lazily, so the address
 * outlives the dialog (and its own, which is revoked when the preview closes) by a minute. Only a blob the server
 * has already recognised as a PDF from its bytes gets here, and it keeps that type.
 */
export function openPdfInNewTab(blob: Blob): void {
  const url = URL.createObjectURL(blob);
  window.open(url, "_blank", "noopener,noreferrer");
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
}
