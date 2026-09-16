import { constants } from "node:fs";
import { open } from "node:fs/promises";
import { z } from "zod";
import { DocumentError, type DocumentPersistence } from "../../application/documents/contracts";
import { sealAcceptanceManifest, type AcceptanceCleanupPersistence, type AcceptanceManifest } from "../../application/documents/acceptance-cleanup";
import { createAcceptanceReceiptWriter } from "./acceptance-receipt-journal";

const configSchema = z.object({
  runId: z.string().uuid(), actorId: z.string().uuid(), organizationId: z.string().uuid(),
  expiresAt: z.number().int().positive().safe(), key: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
type Config = z.infer<typeof configSchema>;
const path = "/etc/passvero-staging/document-acceptance.json";
/** Optional, operator-owned staging-only test window. Never populated from request data. */
export async function readStagingUiAcceptanceConfig(): Promise<Config | null> {
  let file;
  try { file = await open(path, constants.O_RDONLY | constants.O_NOFOLLOW | constants.O_NONBLOCK); }
  catch (error) { if ((error as NodeJS.ErrnoException).code === "ENOENT") return null; throw new DocumentError("OPERATIONAL_FAILURE"); }
  try {
    const stat = await file.stat();
    if (!stat.isFile() || stat.uid !== 0 || (stat.mode & 0o777) !== 0o640 || stat.size > 4096) throw new DocumentError("OPERATIONAL_FAILURE");
    const buffer = Buffer.alloc(4097); const {bytesRead} = await file.read(buffer,0,buffer.length,0);
    if (bytesRead > 4096) throw new DocumentError("OPERATIONAL_FAILURE");
    return configSchema.parse(JSON.parse(buffer.subarray(0,bytesRead).toString("utf8")));
  } finally { await file.close(); }
}
/** Reuses the reviewed exact-receipt cleanup. Ordinary uploads are not marked.
 * A matched fixture must belong to the operator-selected authenticated actor/org.
 * Authority still comes exclusively from the ordinary persistence methods. */
export function withStagingUiAcceptance(base: DocumentPersistence, cleanup: AcceptanceCleanupPersistence,
  options: { config?: () => Promise<Config | null>; retain?: (manifest: AcceptanceManifest, authentication: string) => Promise<void>; now?: () => number } = {}): DocumentPersistence {
  return {
    authorize: (...args) => base.authorize(...args), read: (...args) => base.read(...args),
    finalize: (...args) => base.finalize(...args), fail: (...args) => base.fail(...args),
    async createPending(actor, data) {
      const config = await (options.config ?? readStagingUiAcceptanceConfig)();
      if (!config || !["A", "B", "C"].some(id => data.originalFilename === `acceptance-${config.runId}-${id}.pdf`)) return base.createPending(actor,data);
      const now = (options.now ?? Date.now)();
      if (config.actorId !== actor.userId || config.organizationId !== actor.organizationId
        || now >= config.expiresAt || config.expiresAt - now > 3600000) throw new DocumentError("FORBIDDEN");
      const row = await base.createPending(actor,{...data,displayName:`acceptance:${config.runId}`});
      const manifest: AcceptanceManifest = {version:1,environment:"staging",runId:config.runId,actorId:actor.userId,organizationId:actor.organizationId,
        entries:[{documentId:row.id,storageKey:row.storage.key,checksumSha256:row.checksumSha256,sizeBytes:row.sizeBytes}]};
      try {
        const retain = options.retain ?? createAcceptanceReceiptWriter(`/var/lib/passvero-document-acceptance/${config.runId}`);
        await retain(manifest,sealAcceptanceManifest(manifest,Buffer.from(config.key,"hex")));
      } catch {
        // Receipt failure precedes storage.put. Preserve the row; never erase audits.
        await cleanup.archive(actor,manifest,manifest.entries[0]);
        throw new DocumentError("OPERATIONAL_FAILURE");
      }
      return row;
    },
  };
}
