import { z } from "zod";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { DocumentError } from "./contracts";

export interface DocumentScanRecoveryPersistence {
  recover(context: AuthenticatedUserContext, documentId: string, expectedAttemptId: string): Promise<"UPDATED" | "NO_CHANGE">;
}
const identifiers = z.object({ documentId: z.string().uuid(), expectedAttemptId: z.string().uuid() }).strict();
export function createDocumentScanRecovery(persistence: DocumentScanRecoveryPersistence) {
  return async (documentId: unknown, expectedAttemptId: unknown, context: AuthenticatedUserContext): Promise<{
    readonly documentId: string; readonly status: "UPDATED" | "NO_CHANGE";
  }> => {
    const parsed = identifiers.safeParse({ documentId, expectedAttemptId });
    if (!parsed.success) throw new DocumentError("VALIDATION_ERROR");
    try {
      const status = await persistence.recover(context, parsed.data.documentId, parsed.data.expectedAttemptId);
      return { documentId: parsed.data.documentId, status };
    } catch (error) {
      if (error instanceof DocumentError) throw error;
      throw new DocumentError("OPERATIONAL_FAILURE");
    }
  };
}
