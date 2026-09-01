/**
 * Signatures Types
 *
 * TypeScript interfaces for signature management.
 *
 * @since 1.1.0
 */

/**
 * Signature content type.
 */
export type SignatureContentType = "html" | "plain";

/**
 * Signature interface.
 */
export interface Signature {
  id: number;
  user_id: number;
  account_id: number | null;
  name: string;
  content: string;
  content_type: SignatureContentType;
  is_default: boolean;
  is_active: boolean;
  include_for_new: boolean;
  include_for_reply: boolean;
  include_for_forward: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
}

/**
 * Signature capabilities based on tier.
 */
export interface SignatureCapabilities {
  /** Whether user can create new signatures */
  create: boolean;
  /** Whether user can edit signatures */
  edit: boolean;
  /** Whether user can delete signatures */
  delete: boolean;
  /** Maximum allowed signatures (-1 = unlimited) */
  max_signatures: number;
  /** Whether signatures are unlimited */
  is_unlimited: boolean;
  /** Current signature count */
  current_count: number;
  /** Remaining signatures that can be created */
  remaining: number;
  /** Whether HTML editor is available */
  html_editor: boolean;
}

/**
 * Data for creating a new signature.
 */
export interface CreateSignatureData {
  name: string;
  content: string;
  content_type?: SignatureContentType;
  account_id?: number | null;
  is_default?: boolean;
  include_for_new?: boolean;
  include_for_reply?: boolean;
  include_for_forward?: boolean;
}

/**
 * Data for updating a signature.
 */
export interface UpdateSignatureData {
  name?: string;
  content?: string;
  content_type?: SignatureContentType;
  account_id?: number | null;
  is_default?: boolean;
  is_active?: boolean;
  include_for_new?: boolean;
  include_for_reply?: boolean;
  include_for_forward?: boolean;
  sort_order?: number;
}

/**
 * Signatures context value.
 */
export interface SignaturesContextValue {
  /** All signatures for current user */
  signatures: Signature[];
  /** Loading state */
  loading: boolean;
  /** Error state */
  error: Error | null;
  /** Signature capabilities */
  capabilities: SignatureCapabilities | null;
  /** Get all signatures */
  fetchSignatures: (accountId?: number) => Promise<void>;
  /** Get a single signature */
  getSignature: (signatureId: number) => Promise<Signature | null>;
  /** Get default signature for account */
  getDefaultSignature: (accountId?: number) => Promise<Signature | null>;
  /** Create a new signature */
  createSignature: (
    data: CreateSignatureData,
  ) => Promise<{ success: boolean; signature?: Signature; error?: string }>;
  /** Update a signature */
  updateSignature: (
    signatureId: number,
    data: UpdateSignatureData,
  ) => Promise<{ success: boolean; signature?: Signature; error?: string }>;
  /** Delete a signature */
  deleteSignature: (
    signatureId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Set signature as default */
  setDefault: (
    signatureId: number,
  ) => Promise<{ success: boolean; error?: string }>;
  /** Reorder signatures */
  reorderSignatures: (
    order: number[],
  ) => Promise<{ success: boolean; error?: string }>;
  /** Refresh capabilities */
  refreshCapabilities: () => Promise<void>;
}

/**
 * Signature insert position options.
 */
export type SignaturePosition = "before" | "after" | "cursor";

/**
 * Signature insertion context (new email, reply, forward).
 */
export type SignatureInsertContext = "new" | "reply" | "forward";

/**
 * Default signature options for each context.
 */
export const SIGNATURE_CONTEXT_DEFAULTS: Record<
  SignatureInsertContext,
  keyof Signature
> = {
  new: "include_for_new",
  reply: "include_for_reply",
  forward: "include_for_forward",
};
