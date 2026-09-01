/**
 * Signatures Context
 *
 * React context for signature management with tier-based limits.
 *
 * @since 1.1.0
 */

import React, {
  createContext,
  useContext,
  useState,
  useCallback,
  useMemo,
  useEffect,
} from "react";
import type {
  Signature,
  SignatureCapabilities,
  SignaturesContextValue,
  CreateSignatureData,
  UpdateSignatureData,
} from "../../types/signatures";
import { routeApiPrefix, buildApiUrl } from "../Strings";
import { apiFetch } from "@/lib/api-client";

const SignaturesContext = createContext<SignaturesContextValue | undefined>(
  undefined,
);

/**
 * Get headers for API requests including WordPress nonce.
 */
const getApiHeaders = (): HeadersInit => ({
  "Content-Type": "application/json",
});

interface SignaturesProviderProps {
  children: React.ReactNode;
  accountId?: number;
}

export const SignaturesProvider: React.FC<SignaturesProviderProps> = ({
  children,
  accountId,
}) => {
  const [signatures, setSignatures] = useState<Signature[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<Error | null>(null);
  const [capabilities, setCapabilities] =
    useState<SignatureCapabilities | null>(null);

  /**
   * Get API base URL.
   */
  const getApiUrl = (): string => routeApiPrefix;

  /**
   * Fetch all signatures.
   */
  const fetchSignatures = useCallback(
    async (filterAccountId?: number) => {
      try {
        setLoading(true);
        setError(null);

        const accId = filterAccountId ?? accountId;
        const url = buildApiUrl(`${getApiUrl()}/signatures`, {
          account_id: accId,
        });

        const response = await apiFetch(url, {
          credentials: "include",
          headers: getApiHeaders(),
        });

        if (!response.ok) {
          throw new Error(`Failed to fetch signatures: ${response.statusText}`);
        }

        const data = await response.json();

        if (data.status === "success") {
          setSignatures(data.signatures || []);
          if (data.capabilities) {
            setCapabilities(data.capabilities);
          }
        } else {
          throw new Error(data.message || "Failed to fetch signatures");
        }
      } catch (err) {
        console.error("Error fetching signatures:", err);
        setError(err instanceof Error ? err : new Error("Unknown error"));
        setSignatures([]);
      } finally {
        setLoading(false);
      }
    },
    [accountId],
  );

  /**
   * Get a single signature.
   */
  const getSignature = useCallback(
    async (signatureId: number): Promise<Signature | null> => {
      try {
        const response = await apiFetch(
          `${getApiUrl()}/signatures/${signatureId}`,
          {
            credentials: "include",
            headers: getApiHeaders(),
          },
        );

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.status === "success" ? data.signature : null;
      } catch (err) {
        console.error("Error fetching signature:", err);
        return null;
      }
    },
    [getApiUrl],
  );

  /**
   * Get default signature for account.
   */
  const getDefaultSignature = useCallback(
    async (filterAccountId?: number): Promise<Signature | null> => {
      try {
        const accId = filterAccountId ?? accountId;
        const url = buildApiUrl(`${getApiUrl()}/signatures/default`, {
          account_id: accId,
        });

        const response = await apiFetch(url, {
          credentials: "include",
          headers: getApiHeaders(),
        });

        if (!response.ok) {
          return null;
        }

        const data = await response.json();
        return data.status === "success" ? data.signature : null;
      } catch (err) {
        console.error("Error fetching default signature:", err);
        return null;
      }
    },
    [getApiUrl, accountId],
  );

  /**
   * Create a new signature.
   */
  const createSignature = useCallback(
    async (
      data: CreateSignatureData,
    ): Promise<{ success: boolean; signature?: Signature; error?: string }> => {
      try {
        const response = await apiFetch(`${getApiUrl()}/signatures/create`, {
          method: "POST",
          credentials: "include",
          headers: getApiHeaders(),
          body: JSON.stringify(data),
        });

        const result = await response.json();

        if (result.status === "success") {
          // Update local state
          setSignatures((prev) => [...prev, result.signature]);
          if (result.capabilities) {
            setCapabilities(result.capabilities);
          }
          return { success: true, signature: result.signature };
        }

        return { success: false, error: result.message };
      } catch (err) {
        console.error("Error creating signature:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [getApiUrl],
  );

  /**
   * Update a signature.
   */
  const updateSignature = useCallback(
    async (
      signatureId: number,
      data: UpdateSignatureData,
    ): Promise<{ success: boolean; signature?: Signature; error?: string }> => {
      try {
        const response = await apiFetch(
          `${getApiUrl()}/signatures/update/${signatureId}`,
          {
            method: "POST",
            credentials: "include",
            headers: getApiHeaders(),
            body: JSON.stringify(data),
          },
        );

        const result = await response.json();

        if (result.status === "success") {
          // Update local state
          setSignatures((prev) =>
            prev.map((sig) =>
              sig.id === signatureId ? result.signature : sig,
            ),
          );
          return { success: true, signature: result.signature };
        }

        return { success: false, error: result.message };
      } catch (err) {
        console.error("Error updating signature:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [getApiUrl],
  );

  /**
   * Delete a signature.
   */
  const deleteSignature = useCallback(
    async (
      signatureId: number,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiFetch(
          `${getApiUrl()}/signatures/delete/${signatureId}`,
          {
            method: "POST",
            credentials: "include",
            headers: getApiHeaders(),
          },
        );

        const result = await response.json();

        if (result.status === "success") {
          // Update local state
          setSignatures((prev) => prev.filter((sig) => sig.id !== signatureId));
          if (result.capabilities) {
            setCapabilities(result.capabilities);
          }
          return { success: true };
        }

        return { success: false, error: result.message };
      } catch (err) {
        console.error("Error deleting signature:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [getApiUrl],
  );

  /**
   * Set signature as default.
   */
  const setDefault = useCallback(
    async (
      signatureId: number,
    ): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiFetch(
          `${getApiUrl()}/signatures/set-default/${signatureId}`,
          {
            method: "POST",
            credentials: "include",
            headers: getApiHeaders(),
          },
        );

        const result = await response.json();

        if (result.status === "success") {
          // Update local state - set new default and unset old
          setSignatures((prev) =>
            prev.map((sig) => ({
              ...sig,
              is_default: sig.id === signatureId,
            })),
          );
          return { success: true };
        }

        return { success: false, error: result.message };
      } catch (err) {
        console.error("Error setting default signature:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [getApiUrl],
  );

  /**
   * Reorder signatures.
   */
  const reorderSignatures = useCallback(
    async (order: number[]): Promise<{ success: boolean; error?: string }> => {
      try {
        const response = await apiFetch(`${getApiUrl()}/signatures/reorder`, {
          method: "POST",
          credentials: "include",
          headers: getApiHeaders(),
          body: JSON.stringify({ order }),
        });

        const result = await response.json();

        if (result.status === "success") {
          // Update local state with new order
          setSignatures((prev) => {
            const sigMap = new Map(prev.map((sig) => [sig.id, sig]));
            return order
              .map((id, index) => {
                const sig = sigMap.get(id);
                return sig ? { ...sig, sort_order: index } : null;
              })
              .filter((sig): sig is Signature => sig !== null);
          });
          return { success: true };
        }

        return { success: false, error: result.message };
      } catch (err) {
        console.error("Error reordering signatures:", err);
        return {
          success: false,
          error: err instanceof Error ? err.message : "Unknown error",
        };
      }
    },
    [getApiUrl],
  );

  /**
   * Refresh capabilities.
   */
  const refreshCapabilities = useCallback(async () => {
    try {
      const response = await apiFetch(`${getApiUrl()}/signatures/capabilities`, {
        credentials: "include",
        headers: getApiHeaders(),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json();
      if (data.status === "success" && data.capabilities) {
        setCapabilities(data.capabilities);
      }
    } catch (err) {
      console.error("Error refreshing capabilities:", err);
    }
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchSignatures();
  }, [fetchSignatures]);

  const value: SignaturesContextValue = useMemo(
    () => ({
      signatures,
      loading,
      error,
      capabilities,
      fetchSignatures,
      getSignature,
      getDefaultSignature,
      createSignature,
      updateSignature,
      deleteSignature,
      setDefault,
      reorderSignatures,
      refreshCapabilities,
    }),
    [
      signatures,
      loading,
      error,
      capabilities,
      fetchSignatures,
      getSignature,
      getDefaultSignature,
      createSignature,
      updateSignature,
      deleteSignature,
      setDefault,
      reorderSignatures,
      refreshCapabilities,
    ],
  );

  return (
    <SignaturesContext.Provider value={value}>
      {children}
    </SignaturesContext.Provider>
  );
};

/**
 * Hook to use signatures context.
 */
export const useSignatures = (): SignaturesContextValue => {
  const context = useContext(SignaturesContext);
  if (context === undefined) {
    throw new Error("useSignatures must be used within a SignaturesProvider");
  }
  return context;
};

/**
 * Hook to get signature capabilities.
 */
export const useSignatureCapabilities = (): SignatureCapabilities | null => {
  const { capabilities } = useSignatures();
  return capabilities;
};

/**
 * Hook to check if user can create more signatures.
 */
export const useCanCreateSignature = (): boolean => {
  const { capabilities } = useSignatures();
  return capabilities?.create ?? true;
};

/**
 * Hook to get the default signature.
 */
export const useDefaultSignature = (): Signature | null => {
  const { signatures } = useSignatures();
  return signatures.find((sig) => sig.is_default) ?? null;
};

/**
 * Hook to get signatures for a specific account.
 */
export const useAccountSignatures = (accountId: number | null): Signature[] => {
  const { signatures } = useSignatures();
  if (!accountId) {
    return signatures.filter((sig) => sig.account_id === null);
  }
  return signatures.filter(
    (sig) => sig.account_id === accountId || sig.account_id === null,
  );
};

export default SignaturesContext;
