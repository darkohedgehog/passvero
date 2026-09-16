import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import type { AuthenticatedUserContext } from "../context/authenticated-user-context";
import { DocumentError } from "./contracts";

const entrySchema = z.object({
  documentId: z.uuid(), storageKey: z.string().regex(/^documents\/[0-9a-f-]{36}\.pdf$/),
  checksumSha256: z.string().regex(/^[0-9a-f]{64}$/), sizeBytes: z.number().int().positive().max(10485760),
}).strict();
export const acceptanceManifestSchema = z.object({
  version: z.literal(1), environment: z.literal("staging"), runId: z.uuid(),
  organizationId: z.uuid(), actorId: z.uuid(),
  entries: z.array(entrySchema).min(1).max(8),
}).strict().refine(value => new Set(value.entries.map(entry => entry.documentId)).size === value.entries.length
  && new Set(value.entries.map(entry => entry.storageKey)).size === value.entries.length);
export type AcceptanceManifest = z.infer<typeof acceptanceManifestSchema>;
export type AcceptanceEntry = AcceptanceManifest["entries"][number];
export interface AcceptanceCleanupPersistence {
  /** Reauthorize and lock; verify marker, exact identity and no attachments;
   * archive before returning. Never delete records or terminal audit evidence. */
  archive(context: AuthenticatedUserContext, manifest: AcceptanceManifest, entry: AcceptanceEntry): Promise<void>;
}

/** The per-run key is privately provisioned by the operator, never request input.
 * Only the runner's successful creation receipts may be sealed. */
export function sealAcceptanceManifest(manifest: AcceptanceManifest, key: Uint8Array): string {
  if (key.length !== 32) throw new DocumentError("FORBIDDEN");
  return createHmac("sha256", key).update(JSON.stringify(acceptanceManifestSchema.parse(manifest))).digest("hex");
}
export function createAcceptanceCleanup(dependencies: {
  readonly key: Uint8Array;
  readonly persistence: AcceptanceCleanupPersistence;
  readonly remove: (key: string) => Promise<void>;
}) {
  const key = new Uint8Array(dependencies.key);
  return async (input: unknown, authentication: string, context: AuthenticatedUserContext) => {
    const parsed = acceptanceManifestSchema.safeParse(input);
    if (!parsed.success || !/^[a-f0-9]{64}$/.test(authentication)) throw new DocumentError("FORBIDDEN");
    const manifest = parsed.data;
    if (manifest.organizationId !== context.organizationId || manifest.actorId !== context.userId
      || !context.permissions.includes("PRODUCT_EDIT") || context.membershipStatus !== "ACTIVE"
      || !timingSafeEqual(Buffer.from(authentication, "hex"), Buffer.from(sealAcceptanceManifest(manifest, key), "hex"))) {
      throw new DocumentError("FORBIDDEN");
    }
    const rows: { documentId: string; result: "REMOVED" | "FAILED" }[] = [];
    for (const entry of manifest.entries) {
      try {
        await dependencies.persistence.archive(context, manifest, entry);
        await dependencies.remove(entry.storageKey);
        rows.push({ documentId: entry.documentId, result: "REMOVED" });
      } catch {
        rows.push({ documentId: entry.documentId, result: "FAILED" });
        break; // Preserve exact remainder for an explicit, authenticated retry.
      }
    }
    return { result: rows.length === manifest.entries.length && rows.every(row => row.result === "REMOVED") ? "PASS" as const : "PARTIAL" as const, rows };
  };
}
