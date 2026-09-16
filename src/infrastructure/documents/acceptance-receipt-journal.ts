import { constants } from "node:fs";
import { lstat, open, realpath } from "node:fs/promises";
import { isAbsolute, join } from "node:path";
import { acceptanceManifestSchema, type AcceptanceManifest } from "../../application/documents/acceptance-cleanup";
import { DocumentError } from "../../application/documents/contracts";

/** Operator-provisioned 0700 directory, unique per acceptance run. No payloads.
 * Creation receipts are fsynced before upload, never replaced by a later row. */
export function createAcceptanceReceiptWriter(directory: string) {
  return async (manifest: AcceptanceManifest, authentication: string) => {
    const value = acceptanceManifestSchema.parse(manifest);
    if (value.entries.length !== 1 || !/^[a-f0-9]{64}$/.test(authentication)
      || !isAbsolute(directory) || await realpath(directory) !== directory) throw new DocumentError("FORBIDDEN");
    const info = await lstat(directory);
    if (!info.isDirectory() || info.uid !== process.getuid?.() || (info.mode & 0o777) !== 0o700) throw new DocumentError("FORBIDDEN");
    const handle = await open(join(directory, `${value.entries[0].documentId}.json`), constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try {
      await handle.writeFile(JSON.stringify({ manifest: value, authentication }));
      await handle.sync();
    } finally { await handle.close(); }
    const parent = await open(directory, constants.O_RDONLY | constants.O_NOFOLLOW);
    try { await parent.sync(); } finally { await parent.close(); }
  };
}
