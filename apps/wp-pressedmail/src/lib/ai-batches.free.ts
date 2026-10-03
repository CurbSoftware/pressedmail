/**
 * Free edition of ai-batches.ts: Free has no paid AI engine, so every bulk AI
 * run sends one email per request.
 */
export { chunkByAccount } from "./account-chunks";

export function bulkAiChunkSize(
  _engine: string | undefined,
  _cap?: number,
): number {
  return 1;
}
