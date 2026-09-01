import { PermissionError, SessionExpiredError } from "@/lib/api-client";
import { getConnectionStateService } from "@/services/implementations/connection-state.service";

export type ApiAuthError = SessionExpiredError | PermissionError;

export function isApiAuthError(error: unknown): error is ApiAuthError {
  return (
    error instanceof SessionExpiredError || error instanceof PermissionError
  );
}

export function surfaceApiAuthError(error: unknown): error is ApiAuthError {
  if (!isApiAuthError(error)) {
    return false;
  }

  getConnectionStateService().markSessionError(error.message);
  return true;
}
