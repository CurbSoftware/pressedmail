/**
 * Message list display options.
 *
 * These lived on the ListOptionsModal component, which nothing rendered: three
 * live files imported the type from a modal that was never mounted. The type
 * has consumers, so it stays; the modal it used to live beside does not.
 */
export interface ListOptions {
  sortColumn: "from" | "subject" | "date";
  sortOrder: "asc" | "desc";
  listMode: "list" | "threads";
  showDetails: boolean;
}
