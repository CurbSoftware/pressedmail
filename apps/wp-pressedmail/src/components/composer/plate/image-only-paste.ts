/**
 * The files a paste should upload instead of letting Plate read its HTML.
 *
 * Copying an image puts the file on the clipboard next to HTML that names it
 * by a source the recipient can never load: blob:, file:///, or a signed-in
 * webmail URL. Plate's placeholder only takes the file when there is no HTML,
 * so a copied image arrived as a dead link. When the HTML is nothing but
 * images, upload the file the user is looking at. Text with pictures in it
 * (a Word or Docs selection) still pastes as HTML.
 */
export function imageOnlyPasteFiles(
  data: Pick<DataTransfer, "files" | "types" | "getData">,
): FileList | null {
  const { files, types } = data;
  if (files.length === 0) return null;
  if (!types.includes("text/html")) return files;
  if (!Array.from(files).every((file) => file.type.startsWith("image/")))
    return null;
  const doc = new DOMParser().parseFromString(
    data.getData("text/html"),
    "text/html",
  );
  return doc.images.length > 0 && !(doc.body.textContent ?? "").trim()
    ? files
    : null;
}
