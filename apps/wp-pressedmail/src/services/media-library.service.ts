import { buildApiUrl, routeApiPrefix } from "@/context/Strings";
import { apiFetch } from "@/lib/api-client";

/**
 * One media item the composer can insert (image) or attach (any type).
 * Mirrors the legacy wp.media selection shape so downstream insert/attach logic
 * is unchanged, plus a `thumbnail` for the picker grid.
 */
export interface MediaPickerSelection {
  id: number;
  url: string;
  filename: string;
  mimeType: string;
  size: number;
  thumbnail?: string;
  width?: number | null;
  height?: number | null;
}

export interface MediaLibraryListResult {
  items: MediaPickerSelection[];
  page: number;
  hasMore: boolean;
  total: number;
}

export interface MediaLibraryListParams {
  /** `image` → only image/* ; `all` → every WordPress-allowed type. */
  type?: "image" | "all";
  search?: string;
  page?: number;
  perPage?: number;
}

/**
 * List the current user's own Media Library uploads (author-scoped server-side),
 * powering the composer's custom media-picker popup. Authenticated via the WP
 * REST nonce: same pattern as the inline-image upload service.
 */
export async function listMediaLibrary(
  params: MediaLibraryListParams = {},
): Promise<MediaLibraryListResult> {
  const { type = "all", search = "", page = 1, perPage = 40 } = params;

  const url = buildApiUrl(`${routeApiPrefix}/attachments/media-library`, {
    type,
    page,
    per_page: perPage,
    s: search.trim() || undefined,
  });

  const response = await apiFetch(url, {
    method: "GET",
    credentials: "include",
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.message || `Failed to load media (${response.status}).`);
  }

  const body = await response.json();
  if (!body?.success || !body?.data) {
    throw new Error(body?.message || "Failed to load media.");
  }

  const data = body.data;
  return {
    items: Array.isArray(data.items) ? (data.items as MediaPickerSelection[]) : [],
    page: Number(data.page ?? page),
    hasMore: Boolean(data.hasMore),
    total: Number(data.total ?? 0),
  };
}
